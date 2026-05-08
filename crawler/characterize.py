"""Phase B — Per-source characterization.

For each non-Squad source with < 50 posts cached, paginate
/feeds/source/{handle}?limit=50 until:
  - hasNextPage = false, OR
  - 200 posts collected (10 pages cap), OR
  - 6 pages reached AND median numUpvotes of last page < 1 (firehose).

Resumable: skips sources where last_crawled_at IS NOT NULL.
"""
from __future__ import annotations

import statistics
import time

from .client import (
    db, log, start_run, end_run, upsert_source, upsert_post,
    update_source_aggregates, now_iso,
)
from .squad_filter import is_squad

LIMIT = 50
HARD_PAGE_CAP = 10           # 200 posts max
FIREHOSE_CHECK_PAGE = 6      # at this page, evaluate median upvotes
FIREHOSE_UPVOTE_FLOOR = 1    # median below this on last page → stop early
MIN_PRECACHED_POSTS = 50     # if source already has >= this many, skip


def _select_targets(conn) -> list[tuple[str, str]]:
    """Return list of (id, handle) for sources to characterize."""
    rows = conn.execute(
        """
        SELECT id, handle FROM sources
        WHERE is_squad = 0
          AND (last_crawled_at IS NULL OR posts_collected < ?)
        ORDER BY first_seen_at
        """,
        (MIN_PRECACHED_POSTS,),
    ).fetchall()
    out = []
    for sid, handle in rows:
        h = handle or sid
        if not h:
            continue
        out.append((sid, h))
    return out


def _crawl_one_source(conn, client, source_id: str, handle: str,
                      budget_left: int) -> tuple[int, int, bool, str]:
    """Returns (reqs, new_posts, exhausted, error_note)."""
    cursor = None
    pages = 0
    new_posts = 0
    reqs = 0
    exhausted = False
    error_note = ""
    last_page_upvotes: list[int] = []
    consecutive_5xx = 0

    while pages < HARD_PAGE_CAP and reqs < budget_left:
        params = {"limit": LIMIT}
        if cursor:
            params["cursor"] = cursor
        resp = client.get(f"/feeds/source/{handle}", **params)
        reqs += 1
        if resp.status_code in (401, 403):
            error_note = f"http_{resp.status_code}"
            log(f"[Phase B] {handle}: HTTP {resp.status_code} — abandoning")
            break
        if resp.status_code == 404:
            error_note = "http_404"
            log(f"[Phase B] {handle}: HTTP 404 — abandoning")
            break
        if resp.status_code >= 500:
            consecutive_5xx += 1
            if consecutive_5xx >= 2:
                error_note = f"http_{resp.status_code}_repeated"
                log(f"[Phase B] {handle}: repeated 5xx — abandoning")
                break
            continue
        if resp.status_code != 200:
            error_note = f"http_{resp.status_code}"
            break
        consecutive_5xx = 0
        try:
            j = resp.json()
        except Exception:
            error_note = "json_decode_error"
            break
        page_posts = j.get("data") or []
        upvotes_this_page = []
        for p in page_posts:
            # ensure source row updated if present in payload
            src = p.get("source") or {}
            if src.get("id"):
                upsert_source(conn, src, is_squad(src))
            if upsert_post(conn, p):
                new_posts += 1
            upvotes_this_page.append(int(p.get("numUpvotes") or 0))
        last_page_upvotes = upvotes_this_page
        pagination = j.get("pagination") or {}
        cursor = pagination.get("cursor")
        has_next = bool(pagination.get("hasNextPage"))
        pages += 1
        # commit every page
        conn.commit()
        if not has_next or not cursor or not page_posts:
            exhausted = True
            break
        if pages >= FIREHOSE_CHECK_PAGE and last_page_upvotes:
            try:
                med = statistics.median(last_page_upvotes)
            except statistics.StatisticsError:
                med = 0
            if med < FIREHOSE_UPVOTE_FLOOR:
                # firehose detected — stop early but not "exhausted"
                error_note = error_note or "firehose_stop"
                break

    update_source_aggregates(conn, source_id,
                             is_exhausted=1 if exhausted else 0,
                             error_note=error_note or None)
    conn.commit()
    return reqs, new_posts, exhausted, error_note


def run_phase_b(conn, client, budget_left: int) -> tuple[int, int]:
    run_id = start_run(conn, "B_characterize", "per-source feed crawl")
    t0 = time.monotonic()
    total_reqs = 0
    errors = 0
    try:
        targets = _select_targets(conn)
        total = len(targets)
        log(f"[Phase B] {total} sources to characterize")
        last_log = 0
        for i, (sid, handle) in enumerate(targets, start=1):
            if budget_left <= 0:
                log("[Phase B] budget exhausted")
                break
            r, np, exhausted, err = _crawl_one_source(conn, client, sid, handle, budget_left)
            total_reqs += r
            budget_left -= r
            if err:
                errors += 1
            if total_reqs - last_log >= 10 or i == total:
                src_done = conn.execute(
                    "SELECT COUNT(*) FROM sources WHERE last_crawled_at IS NOT NULL"
                ).fetchone()[0]
                post_total = conn.execute("SELECT COUNT(*) FROM posts").fetchone()[0]
                elapsed = time.monotonic() - t0
                log(
                    f"[Phase B] source {i}/{total} ({handle}) → "
                    f"{src_done} chars'd | {post_total} posts | "
                    f"{client.req_count} client_reqs | {int(elapsed)}s elapsed | errs={errors}"
                )
                last_log = total_reqs
    finally:
        end_run(conn, run_id, total_reqs, errors, f"phase B reqs={total_reqs} errors={errors}")
    return total_reqs, errors
