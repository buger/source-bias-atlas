"""Probe 5 — field coverage on Post.

For 3 sources (50 posts each), tally how often each FeedPost field is populated.
Special attention to: numUpvotes, numComments, summary length, tags array,
readTime, createdAt vs publishedAt, author shape, type enum, image.
"""
from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict

from common import Client, db, log_run, upsert_post, upsert_source

SOURCES = ["hn", "netflix", "kittygiraudel"]
PER_SOURCE = 50


def main() -> None:
    c = Client()
    conn = db()
    findings: list[str] = []
    overall_counters: dict[str, dict] = {}

    for handle in SOURCES:
        data = c.get_json(f"/feeds/source/{handle}", limit=PER_SOURCE)
        if not data:
            findings.append(f"  {handle}: ERROR")
            continue
        posts = data.get("data") or []
        n = len(posts)
        if n == 0:
            findings.append(f"  {handle}: 0 posts")
            continue
        present = Counter()
        type_counter = Counter()
        summary_lens: list[int] = []
        tag_lens: list[int] = []
        read_times: list[int] = []
        created_eq_published = 0
        published_present = 0
        author_field_keys: Counter = Counter()
        for p in posts:
            for key in ("id","title","url","image","summary","type","publishedAt",
                        "createdAt","commentsPermalink","source","tags","readTime",
                        "numUpvotes","numComments","author"):
                v = p.get(key)
                if v not in (None, "", []):
                    present[key] += 1
            type_counter[p.get("type") or "<null>"] += 1
            s = p.get("summary")
            if s:
                summary_lens.append(len(s))
            tags = p.get("tags") or []
            tag_lens.append(len(tags))
            rt = p.get("readTime")
            if isinstance(rt, int):
                read_times.append(rt)
            if p.get("publishedAt"):
                published_present += 1
                if p.get("publishedAt") == p.get("createdAt"):
                    created_eq_published += 1
            a = p.get("author")
            if isinstance(a, dict):
                for k in a.keys():
                    author_field_keys[k] += 1
            upsert_post(conn, p)
            upsert_source(conn, p.get("source") or {}, f"probe5:{handle}")
        coverage = {k: f"{present[k]}/{n}" for k in present}
        sum_avg = round(statistics.mean(summary_lens), 1) if summary_lens else 0
        sum_med = statistics.median(summary_lens) if summary_lens else 0
        rt_avg = round(statistics.mean(read_times), 1) if read_times else 0
        tag_avg = round(statistics.mean(tag_lens), 2) if tag_lens else 0
        tag_max = max(tag_lens) if tag_lens else 0
        tag_zero = sum(1 for t in tag_lens if t == 0)
        findings.append(
            f"  === {handle} (n={n}) ===\n"
            f"    coverage: {coverage}\n"
            f"    summary: avg_len={sum_avg} median={sum_med}\n"
            f"    tags: avg_len={tag_avg} max={tag_max} zero={tag_zero}/{n}\n"
            f"    readTime: present={len(read_times)}/{n} avg_min={rt_avg}\n"
            f"    publishedAt present={published_present}/{n} (==createdAt: {created_eq_published})\n"
            f"    type distribution: {dict(type_counter)}\n"
            f"    author field keys: {dict(author_field_keys)}"
        )
        overall_counters[handle] = {
            "coverage": coverage,
            "type_distribution": dict(type_counter),
            "tags_avg": tag_avg,
            "tags_zero": tag_zero,
            "summary_avg_len": sum_avg,
            "readtime_present": len(read_times),
            "n": n,
        }
        conn.commit()

    # save overall summary
    (conn.cursor().connection.execute("SELECT 1"))  # noqa
    from common import PROBE_DIR
    (PROBE_DIR / "samples" / "probe5_coverage.json").write_text(
        json.dumps(overall_counters, indent=2)
    )

    log_run(conn, "probe5_field_coverage", c.req_count, c.elapsed(), "\n".join(findings))
    conn.close(); c.close()
    print(f"Probe 5 complete: {c.req_count} requests, {c.elapsed():.1f}s")
    for line in findings:
        print(line)


if __name__ == "__main__":
    main()
