"""Probe 2b — push HN deeper to find the source-feed pagination ceiling.

Runs at most 8 more pages beyond the prior 12, watching for hasNextPage=false
or a sudden empty page / repeat cursor. Tells us the true cap of
`/feeds/source/{handle}`.
"""
from __future__ import annotations

import time

from common import Client, db, log_run, upsert_post

EXTRA_PAGES = 16   # we'll bail early if hasNextPage flips


def main() -> None:
    c = Client()
    conn = db()
    cursor = None
    pages = 0
    total = 0
    seen_cursors: set[str] = set()
    notes: list[str] = []
    while pages < EXTRA_PAGES:
        data = c.get_json("/feeds/source/hn", limit=50, cursor=cursor)
        pages += 1
        if data is None:
            notes.append(f"  page {pages}: ERROR, stop")
            break
        posts = data.get("data", []) or []
        pag = data.get("pagination", {}) or {}
        total += len(posts)
        notes.append(
            f"  page {pages}: count={len(posts)} hasNextPage={pag.get('hasNextPage')} "
            f"cursor_short={(pag.get('cursor') or '')[:24]}"
        )
        for p in posts:
            upsert_post(conn, p)
        if not pag.get("hasNextPage"):
            notes.append("  -> hasNextPage flipped false")
            break
        cursor = pag.get("cursor")
        if not cursor:
            notes.append("  -> cursor null")
            break
        if cursor in seen_cursors:
            notes.append("  -> CURSOR REPEAT detected")
            break
        seen_cursors.add(cursor)
    notes.append(f"  TOTAL pages={pages} posts={total}")
    log_run(conn, "probe2b_deep_hn", c.req_count, c.elapsed(), "\n".join(notes))
    conn.commit(); conn.close(); c.close()
    print(f"Probe 2b complete: {c.req_count} requests, {c.elapsed():.1f}s")
    for n in notes:
        print(n)


if __name__ == "__main__":
    main()
