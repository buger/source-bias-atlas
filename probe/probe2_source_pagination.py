"""Probe 2 — pagination depth on `/feeds/source/{handle}`.

Picks 3 sources of varying size and paginates each until exhaustion or
1000 posts. Caps each source at ~12 pages to stay miserly on the budget.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

from common import Client, db, log_run, upsert_post, upsert_source

# Curated handles: a major aggregator, a mid-size publisher, a niche personal blog.
# Picked from popular feed observation + general daily.dev knowledge.
TARGETS = [
    ("hn", "big"),               # Hacker News — high-volume aggregator
    ("netflix", "medium"),       # Netflix Tech Blog
    ("kittygiraudel", "small"),  # personal blog seen in foryou
]

PER_SOURCE_PAGE_CAP = 12     # ~12 pages * 50 = 600 posts max per source
PAGE_LIMIT = 50
HARD_TOTAL_CAP = 1000


def parse_iso(ts: str | None):
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def main() -> None:
    c = Client()
    conn = db()
    findings: list[str] = []

    for handle, label in TARGETS:
        cursor = None
        pages = 0
        total = 0
        oldest: datetime | None = None
        newest: datetime | None = None
        terminated_naturally = False
        sample_post_ids: list[str] = []

        while pages < PER_SOURCE_PAGE_CAP and total < HARD_TOTAL_CAP:
            data = c.get_json(f"/feeds/source/{handle}", limit=PAGE_LIMIT, cursor=cursor)
            pages += 1
            if data is None:
                findings.append(f"  [{label}] {handle}: ERROR on page {pages}, stopping")
                break
            posts = data.get("data", []) or []
            pag = data.get("pagination", {}) or {}
            for p in posts:
                upsert_post(conn, p)
                upsert_source(conn, p.get("source") or {}, f"source-feed:{handle}")
                ts = parse_iso(p.get("createdAt"))
                if ts:
                    if not oldest or ts < oldest:
                        oldest = ts
                    if not newest or ts > newest:
                        newest = ts
                if len(sample_post_ids) < 3:
                    sample_post_ids.append(p.get("id"))
            total += len(posts)
            if not pag.get("hasNextPage"):
                terminated_naturally = True
                break
            cursor = pag.get("cursor")
            if not cursor:
                terminated_naturally = True
                break

        span_days = None
        if oldest and newest:
            span_days = (newest - oldest).days
        findings.append(
            f"  [{label}] {handle}: pages={pages} total={total} "
            f"hasNextPage_terminated={terminated_naturally} "
            f"newest={newest.isoformat() if newest else 'NA'} "
            f"oldest={oldest.isoformat() if oldest else 'NA'} "
            f"span_days={span_days}"
        )
        conn.commit()

    log_run(conn, "probe2_source_pagination", c.req_count, c.elapsed(), "\n".join(findings))
    conn.close()
    c.close()
    print(f"Probe 2 complete: {c.req_count} requests, {c.elapsed():.1f}s")
    for line in findings:
        print(line)


if __name__ == "__main__":
    main()
