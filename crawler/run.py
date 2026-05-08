"""Crawler entrypoint. Orchestrates Phase A then Phase B with a 9k req budget cap.

Usage:
    python -m crawler.run                  # full run (resumable)
    python -m crawler.run --status         # 10-line health summary
    python -m crawler.run --phase a        # run only Phase A
    python -m crawler.run --phase b        # run only Phase B
    python -m crawler.run --report         # write RUN_REPORT.md
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

# Allow running as both `python -m crawler.run` and `python crawler/run.py`
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    from crawler.client import db, log, BUDGET_CAP, now_iso  # type: ignore
    from crawler.discovery import run_phase_a  # type: ignore
    from crawler.characterize import run_phase_b  # type: ignore
    from probe.common import Client  # type: ignore
    from crawler.squad_filter import is_squad  # type: ignore
else:
    from .client import db, log, BUDGET_CAP, now_iso
    from .discovery import run_phase_a
    from .characterize import run_phase_b
    from probe.common import Client
    from .squad_filter import is_squad


def cmd_status() -> None:
    conn = db()
    rows = []
    rows.append(("tags", conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0]))
    rows.append(("sources_total", conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]))
    rows.append(("sources_squad", conn.execute("SELECT COUNT(*) FROM sources WHERE is_squad=1").fetchone()[0]))
    rows.append(("sources_curated", conn.execute("SELECT COUNT(*) FROM sources WHERE is_squad=0").fetchone()[0]))
    rows.append(("sources_characterized", conn.execute("SELECT COUNT(*) FROM sources WHERE last_crawled_at IS NOT NULL").fetchone()[0]))
    rows.append(("sources_exhausted", conn.execute("SELECT COUNT(*) FROM sources WHERE is_exhausted=1").fetchone()[0]))
    rows.append(("posts_total", conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]))
    tags_done = conn.execute("SELECT COUNT(*) FROM tag_progress WHERE done=1").fetchone()[0]
    tags_all = conn.execute("SELECT COUNT(*) FROM tag_progress").fetchone()[0]
    rows.append(("tag_progress", f"{tags_done}/{tags_all}"))
    feed_done = conn.execute("SELECT COUNT(*) FROM feed_progress WHERE done=1").fetchone()[0]
    rows.append(("feeds_done", feed_done))
    runs = conn.execute(
        "SELECT phase, started_at, ended_at, requests_made, errors FROM crawl_runs ORDER BY id DESC LIMIT 5"
    ).fetchall()
    print("=== Atlas crawler status ===")
    for k, v in rows:
        print(f"  {k:<24} {v}")
    print("--- recent runs ---")
    for r in runs:
        print(f"  {r}")
    conn.close()


def cmd_run(phase: str | None) -> None:
    conn = db()
    client = Client(min_interval=1.05, max_retries=4)
    t0 = time.monotonic()
    log(f"=== crawler start (phase={phase or 'all'}, budget={BUDGET_CAP}) ===")
    total_reqs = 0
    errors = 0
    try:
        if phase in (None, "a"):
            r, e = run_phase_a(conn, client, budget_left=BUDGET_CAP - total_reqs)
            total_reqs += r
            errors += e
            log(f"=== Phase A done: reqs={r} errors={e} (total {total_reqs}) ===")
        if (phase in (None, "b")) and total_reqs < BUDGET_CAP:
            r, e = run_phase_b(conn, client, budget_left=BUDGET_CAP - total_reqs)
            total_reqs += r
            errors += e
            log(f"=== Phase B done: reqs={r} errors={e} (total {total_reqs}) ===")
    except KeyboardInterrupt:
        log("=== INTERRUPTED ===")
    finally:
        elapsed = time.monotonic() - t0
        log(f"=== crawler stop. total_reqs={total_reqs} errors={errors} elapsed={int(elapsed)}s ===")
        client.close()
        conn.close()


def cmd_report() -> None:
    """Write crawler/RUN_REPORT.md with stats + spot-check."""
    conn = db()
    out_path = Path(__file__).resolve().parent / "RUN_REPORT.md"
    runs = conn.execute(
        "SELECT phase, started_at, ended_at, requests_made, errors, notes FROM crawl_runs ORDER BY id"
    ).fetchall()
    total_runtime = 0.0
    total_reqs = 0
    total_errors = 0
    from datetime import datetime
    for phase, sa, ea, rm, er, _ in runs:
        if sa and ea:
            try:
                t0 = datetime.fromisoformat(sa)
                t1 = datetime.fromisoformat(ea)
                total_runtime += (t1 - t0).total_seconds()
            except Exception:
                pass
        total_reqs += rm or 0
        total_errors += er or 0

    sources_total = conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
    sources_curated = conn.execute("SELECT COUNT(*) FROM sources WHERE is_squad=0").fetchone()[0]
    sources_squad = conn.execute("SELECT COUNT(*) FROM sources WHERE is_squad=1").fetchone()[0]
    sources_exhausted = conn.execute("SELECT COUNT(*) FROM sources WHERE is_exhausted=1").fetchone()[0]
    sources_characterized = conn.execute("SELECT COUNT(*) FROM sources WHERE last_crawled_at IS NOT NULL").fetchone()[0]
    posts_total = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
    tags_total = conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0]

    top_by_count = conn.execute(
        """
        SELECT s.handle, s.name, s.posts_collected, s.is_exhausted, s.is_squad
        FROM sources s
        ORDER BY s.posts_collected DESC
        LIMIT 10
        """
    ).fetchall()

    top_by_upvotes = conn.execute(
        """
        SELECT s.handle, s.name, AVG(p.num_upvotes) AS avg_up, COUNT(p.id) AS n
        FROM sources s
        JOIN posts p ON p.source_id = s.id
        WHERE s.is_squad = 0
        GROUP BY s.id
        HAVING n >= 20
        ORDER BY avg_up DESC
        LIMIT 10
        """
    ).fetchall()

    error_sources = conn.execute(
        "SELECT handle, name, error_note FROM sources WHERE error_note IS NOT NULL ORDER BY handle LIMIT 30"
    ).fetchall()

    # spot-check: 20 flagged + 20 unflagged
    flagged = conn.execute(
        "SELECT id, handle, name, description FROM sources WHERE is_squad=1 ORDER BY RANDOM() LIMIT 20"
    ).fetchall()
    unflagged = conn.execute(
        "SELECT id, handle, name, description FROM sources WHERE is_squad=0 ORDER BY RANDOM() LIMIT 20"
    ).fetchall()

    lines: list[str] = []
    lines.append("# Source Bias Atlas — Crawler Run Report\n")
    lines.append(f"_Generated {now_iso()}_\n")
    lines.append("## Totals\n")
    lines.append(f"- Total runtime (sum of phases): **{int(total_runtime)}s** (~{total_runtime/60:.1f} min)")
    lines.append(f"- Total requests: **{total_reqs}** / {BUDGET_CAP} budget cap")
    lines.append(f"- Total errors: **{total_errors}**")
    lines.append(f"- Tags cached: **{tags_total}**")
    lines.append(f"- Sources total: **{sources_total}** "
                 f"(curated **{sources_curated}**, squad **{sources_squad}**)")
    lines.append(f"- Sources characterized: **{sources_characterized}** "
                 f"(exhausted **{sources_exhausted}**)")
    lines.append(f"- Posts total: **{posts_total}**")
    lines.append("")
    lines.append("## Run history\n")
    lines.append("| phase | started | ended | reqs | errors |")
    lines.append("|---|---|---|---|---|")
    for phase, sa, ea, rm, er, _n in runs:
        lines.append(f"| {phase} | {sa} | {ea or '?'} | {rm or 0} | {er or 0} |")
    lines.append("")
    lines.append("## Top 10 sources by post count\n")
    lines.append("| handle | name | posts | exhausted | squad |")
    lines.append("|---|---|---|---|---|")
    for handle, name, cnt, exh, sq in top_by_count:
        lines.append(f"| {handle} | {(name or '')[:60]} | {cnt} | {exh} | {sq} |")
    lines.append("")
    lines.append("## Top 10 sources by avg upvotes (≥20 posts, non-squad)\n")
    lines.append("| handle | name | avg upvotes | n |")
    lines.append("|---|---|---|---|")
    for handle, name, avg_up, n in top_by_upvotes:
        lines.append(f"| {handle} | {(name or '')[:60]} | {avg_up:.1f} | {n} |")
    lines.append("")
    lines.append("## Anomalies / errored sources (up to 30)\n")
    if error_sources:
        lines.append("| handle | name | error |")
        lines.append("|---|---|---|")
        for handle, name, note in error_sources:
            lines.append(f"| {handle} | {(name or '')[:60]} | {note} |")
    else:
        lines.append("_None — clean run._")
    lines.append("")
    lines.append("## Squad-filter spot check\n")
    lines.append("### 20 sources flagged is_squad=1\n")
    lines.append("| id | handle | name | description |")
    lines.append("|---|---|---|---|")
    for sid, h, n, d in flagged:
        lines.append(f"| `{sid[:24]}` | {h or ''} | {(n or '')[:40]} | {((d or '')[:60]).replace('|','/')} |")
    lines.append("")
    lines.append("### 20 sources flagged is_squad=0\n")
    lines.append("| id | handle | name | description |")
    lines.append("|---|---|---|---|")
    for sid, h, n, d in unflagged:
        lines.append(f"| `{sid[:24]}` | {h or ''} | {(n or '')[:40]} | {((d or '')[:60]).replace('|','/')} |")
    lines.append("")

    out_path.write_text("\n".join(lines))
    print(f"Wrote {out_path}")
    conn.close()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--status", action="store_true", help="print health summary and exit")
    p.add_argument("--report", action="store_true", help="write RUN_REPORT.md and exit")
    p.add_argument("--phase", choices=["a", "b"], help="run only phase a or b")
    args = p.parse_args()
    if args.status:
        cmd_status()
        return
    if args.report:
        cmd_report()
        return
    cmd_run(args.phase)


if __name__ == "__main__":
    main()
