"""Probe 4 — source discovery curve.

Rotates through /feeds/popular, /feeds/discussed?period=30, /feeds/foryou,
paginating each, recording new unique sources per request. Stops at 5 min OR
~120 requests (we already burned a chunk of the 1500 budget).
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from common import Client, PROBE_DIR, db, log_run, upsert_post, upsert_source

WALL_BUDGET_SEC = 5 * 60
REQ_BUDGET = 120
PAGE_LIMIT = 50  # API rejects limit>50 with 500 (verified)

ENDPOINTS = [
    ("popular", "/feeds/popular", {}),
    ("discussed30", "/feeds/discussed", {"period": 30}),
    ("foryou", "/feeds/foryou", {}),
]


def main() -> None:
    c = Client()
    conn = db()
    cursors: dict[str, str | None] = {name: None for name, _, _ in ENDPOINTS}
    exhausted: dict[str, bool] = {name: False for name, _, _ in ENDPOINTS}
    seen_sources: set[str] = set()
    curve: list[tuple[int, int]] = []  # (req_count, unique_sources)
    start = time.monotonic()
    rotation = 0

    while c.req_count < REQ_BUDGET and (time.monotonic() - start) < WALL_BUDGET_SEC:
        if all(exhausted.values()):
            break
        name, path, base_params = ENDPOINTS[rotation % len(ENDPOINTS)]
        rotation += 1
        if exhausted[name]:
            continue
        params = dict(base_params)
        params["limit"] = PAGE_LIMIT
        if cursors[name]:
            params["cursor"] = cursors[name]
        data = c.get_json(path, **params)
        if data is None:
            exhausted[name] = True
            continue
        posts = data.get("data") or []
        pag = data.get("pagination") or {}
        for p in posts:
            src = p.get("source") or {}
            sid = src.get("id")
            if sid and sid not in seen_sources:
                seen_sources.add(sid)
                upsert_source(conn, src, f"discovery:{name}")
            upsert_post(conn, p)
        curve.append((c.req_count, len(seen_sources)))
        if not pag.get("hasNextPage") or not pag.get("cursor"):
            exhausted[name] = True
        else:
            cursors[name] = pag.get("cursor")

    elapsed = time.monotonic() - start
    # Save curve for report
    curve_path = PROBE_DIR / "samples" / "probe4_curve.json"
    curve_path.write_text(json.dumps({
        "curve": curve,
        "elapsed_sec": elapsed,
        "req_count": c.req_count,
        "unique_sources": len(seen_sources),
        "exhausted": exhausted,
    }, indent=2))
    notes = (
        f"Discovered {len(seen_sources)} unique sources in {c.req_count} requests / {elapsed:.1f}s. "
        f"Exhausted={exhausted}. Curve saved to samples/probe4_curve.json"
    )
    log_run(conn, "probe4_discovery", c.req_count, c.elapsed(), notes)
    conn.commit(); conn.close(); c.close()
    print(f"Probe 4 complete: {c.req_count} requests, {elapsed:.1f}s, sources={len(seen_sources)}")
    # Show curve milestones
    for r, s in curve[::5]:
        print(f"  reqs={r} unique_sources={s}")
    if curve:
        print(f"  last: reqs={curve[-1][0]} unique_sources={curve[-1][1]}")


if __name__ == "__main__":
    main()
