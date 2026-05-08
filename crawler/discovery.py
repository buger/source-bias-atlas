"""Phase A — Discovery.

1. Fetch /tags/ (caches 962-tag taxonomy).
2. For each tag: paginate /feeds/tag/{tag}?limit=50 up to 3 pages.
3. One-time sweep of /feeds/popular and /feeds/discussed?period=30 to exhaustion.
4. Persist sources (with is_squad flag) and posts as we go.

Resumable via tag_progress and feed_progress tables.
"""
from __future__ import annotations

import time
from typing import Optional

from .client import (
    BUDGET_CAP, db, log, start_run, end_run,
    upsert_source, upsert_post, now_iso,
)
from .squad_filter import is_squad

TAG_PAGE_CAP = 3
LIMIT = 50


def _ensure_tags(conn, client) -> int:
    """GET /tags/ once and seed tags table. Returns reqs spent (0 or 1)."""
    have = conn.execute("SELECT COUNT(*) FROM tags").fetchone()[0]
    if have > 0:
        log(f"[Phase A] tags already cached ({have})")
        return 0
    j = client.get_json("/tags/")
    if not j or "data" not in j:
        log("[Phase A] /tags/ failed — aborting")
        return 1
    rows = j["data"]
    for t in rows:
        name = t.get("name") if isinstance(t, dict) else t
        if name:
            conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (name,))
            conn.execute("INSERT OR IGNORE INTO tag_progress(tag) VALUES (?)", (name,))
    conn.commit()
    log(f"[Phase A] tags cached: {len(rows)}")
    return 1


def _persist_post_and_source(conn, p: dict) -> tuple[int, int]:
    """Returns (new_sources, new_posts)."""
    src = p.get("source") or {}
    new_src = 0
    if src.get("id"):
        new_src = 1 if upsert_source(conn, src, is_squad(src)) else 0
    new_post = 1 if upsert_post(conn, p) else 0
    return new_src, new_post


def _paginate_tag(conn, client, tag: str, max_pages: int, budget_left: int) -> tuple[int, int, int]:
    """Paginate /feeds/tag/{tag}. Returns (reqs_made, new_sources, new_posts)."""
    row = conn.execute(
        "SELECT pages_fetched, done, last_cursor FROM tag_progress WHERE tag=?", (tag,)
    ).fetchone()
    if row is None:
        conn.execute("INSERT INTO tag_progress(tag) VALUES (?)", (tag,))
        conn.commit()
        pages_fetched, done, cursor = 0, 0, None
    else:
        pages_fetched, done, cursor = row

    if done:
        return 0, 0, 0

    reqs = new_src = new_post = 0
    while pages_fetched < max_pages and reqs < budget_left:
        params = {"limit": LIMIT}
        if cursor:
            params["cursor"] = cursor
        j = client.get_json(f"/feeds/tag/{tag}", **params)
        reqs += 1
        if not j:
            log(f"[Phase A] tag={tag} page {pages_fetched+1} → null/error; marking done")
            conn.execute("UPDATE tag_progress SET done=1 WHERE tag=?", (tag,))
            conn.commit()
            return reqs, new_src, new_post
        for p in j.get("data") or []:
            ns, np = _persist_post_and_source(conn, p)
            new_src += ns
            new_post += np
        pagination = j.get("pagination") or {}
        cursor = pagination.get("cursor")
        has_next = bool(pagination.get("hasNextPage"))
        pages_fetched += 1
        conn.execute(
            "UPDATE tag_progress SET pages_fetched=?, last_cursor=? WHERE tag=?",
            (pages_fetched, cursor, tag),
        )
        conn.commit()
        if not has_next or not cursor:
            conn.execute("UPDATE tag_progress SET done=1 WHERE tag=?", (tag,))
            conn.commit()
            break
    if pages_fetched >= max_pages:
        conn.execute("UPDATE tag_progress SET done=1 WHERE tag=?", (tag,))
        conn.commit()
    return reqs, new_src, new_post


def _exhaust_feed(conn, client, feed: str, params_extra: Optional[dict], budget_left: int,
                  hard_cap_pages: int = 80) -> tuple[int, int, int]:
    """Sweep a feed (popular / discussed) to exhaustion."""
    row = conn.execute(
        "SELECT pages_fetched, done, last_cursor FROM feed_progress WHERE feed=?", (feed,)
    ).fetchone()
    if row is None:
        conn.execute("INSERT INTO feed_progress(feed) VALUES (?)", (feed,))
        conn.commit()
        pages_fetched, done, cursor = 0, 0, None
    else:
        pages_fetched, done, cursor = row
    if done:
        return 0, 0, 0

    reqs = new_src = new_post = 0
    path = f"/feeds/{feed}"
    while reqs < budget_left and pages_fetched < hard_cap_pages:
        params = {"limit": LIMIT}
        if params_extra:
            params.update(params_extra)
        if cursor:
            params["cursor"] = cursor
        j = client.get_json(path, **params)
        reqs += 1
        if not j:
            log(f"[Phase A] feed {feed} page {pages_fetched+1} → null/error; marking done")
            conn.execute("UPDATE feed_progress SET done=1 WHERE feed=?", (feed,))
            conn.commit()
            return reqs, new_src, new_post
        for p in j.get("data") or []:
            ns, np = _persist_post_and_source(conn, p)
            new_src += ns
            new_post += np
        pagination = j.get("pagination") or {}
        cursor = pagination.get("cursor")
        has_next = bool(pagination.get("hasNextPage"))
        pages_fetched += 1
        conn.execute(
            "UPDATE feed_progress SET pages_fetched=?, last_cursor=? WHERE feed=?",
            (pages_fetched, cursor, feed),
        )
        conn.commit()
        if not has_next or not cursor:
            conn.execute("UPDATE feed_progress SET done=1 WHERE feed=?", (feed,))
            conn.commit()
            break
    return reqs, new_src, new_post


def run_phase_a(conn, client, budget_left: int) -> tuple[int, int]:
    """Run discovery. Returns (reqs_made, errors)."""
    run_id = start_run(conn, "A_discovery", "tags + tag-feeds + popular + discussed")
    t0 = time.monotonic()
    total_reqs = 0
    errors = 0

    try:
        total_reqs += _ensure_tags(conn, client)
        budget_left -= total_reqs

        # Sweep popular + discussed first (small, exhausts fast — primes the source list)
        for feed, extra in [("popular", None), ("discussed", {"period": 30})]:
            if budget_left <= 0:
                break
            r, ns, np = _exhaust_feed(conn, client, feed, extra, budget_left)
            total_reqs += r
            budget_left -= r
            log(f"[Phase A] feed /{feed}: +{r} reqs, +{ns} new sources, +{np} new posts")

        # Walk tags
        tags = [
            row[0]
            for row in conn.execute(
                "SELECT tag FROM tag_progress WHERE done=0 ORDER BY tag"
            ).fetchall()
        ]
        total_tags = conn.execute("SELECT COUNT(*) FROM tag_progress").fetchone()[0]
        idx_offset = total_tags - len(tags)
        log(f"[Phase A] starting tag sweep: {len(tags)} pending of {total_tags}")

        last_log = 0
        for i, tag in enumerate(tags, start=1):
            if budget_left <= 0:
                log("[Phase A] budget exhausted during tag sweep")
                break
            r, ns, np = _paginate_tag(conn, client, tag, TAG_PAGE_CAP, budget_left)
            total_reqs += r
            budget_left -= r
            if total_reqs - last_log >= 10 or i == len(tags):
                src_total = conn.execute("SELECT COUNT(*) FROM sources").fetchone()[0]
                post_total = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
                elapsed = time.monotonic() - t0
                log(
                    f"[Phase A] tag {idx_offset+i}/{total_tags} ({tag}) → "
                    f"{src_total} sources total | {post_total} posts | "
                    f"{client.req_count} client_reqs | {int(elapsed)}s elapsed"
                )
                last_log = total_reqs

    finally:
        end_run(conn, run_id, total_reqs, errors,
                f"phase A complete; reqs={total_reqs}")
    return total_reqs, errors
