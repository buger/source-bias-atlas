"""Per-source enrichment: top tags, representative + outlier sample titles.

Pulls directly from the SQLite DB (probe.db now, atlas.db later).
"""
from __future__ import annotations

import json
import sqlite3
from collections import Counter
from typing import Dict, List, Tuple


def _parse_tags(raw: str | None) -> List[str]:
    if not raw:
        return []
    raw = raw.strip()
    if not raw:
        return []
    # Try JSON list first.
    if raw.startswith("["):
        try:
            arr = json.loads(raw)
            if isinstance(arr, list):
                return [str(t).strip() for t in arr if t]
        except json.JSONDecodeError:
            pass
    # Otherwise comma-separated.
    return [t.strip() for t in raw.split(",") if t.strip()]


def _detect_tags_column(conn: sqlite3.Connection) -> str:
    """probe.db uses 'tags', atlas.db uses 'tags_json'. Detect which."""
    cur = conn.execute("PRAGMA table_info(posts)")
    cols = {row[1] for row in cur.fetchall()}
    if "tags_json" in cols:
        return "tags_json"
    return "tags"


def _fetch_posts(conn: sqlite3.Connection, source_id: str) -> List[Dict]:
    tags_col = _detect_tags_column(conn)
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, title, {tags_col} AS tags, type, num_upvotes, num_comments, "
        "  COALESCE(NULLIF(published_at,''), created_at) AS ts "
        "FROM posts WHERE source_id = ?",
        (source_id,),
    )
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _detect_raw_column(conn: sqlite3.Connection) -> str:
    """probe.db uses 'raw', atlas.db uses 'raw_json'."""
    cur = conn.execute("PRAGMA table_info(posts)")
    cols = {row[1] for row in cur.fetchall()}
    return "raw_json" if "raw_json" in cols else "raw"


def _row_to_post_dict(row: Tuple) -> Dict:
    pid, title, url, summary, upvotes, comments, ts, raw = row
    comments_permalink = None
    image = None
    if raw:
        try:
            rj = json.loads(raw)
            comments_permalink = rj.get("commentsPermalink")
            image = rj.get("image")
        except (json.JSONDecodeError, TypeError):
            pass
    return {
        "id": pid,
        "title": (title or "").strip() or None,
        "url": url,
        "comments_permalink": comments_permalink,
        "summary": (summary or "").strip() or None,
        "image": image,
        "num_upvotes": int(upvotes or 0),
        "num_comments": int(comments or 0),
        "created_at": ts,
    }


def _fetch_recent_posts(conn: sqlite3.Connection, source_id: str, limit: int = 10) -> List[Dict]:
    """Return up to `limit` recent posts (most recent first).

    For high-volume sources, the very newest posts often have 0 engagement
    because daily.dev hasn't had time to accumulate signal. We bias toward
    posts that are at least 3 days old OR have any engagement; if not enough
    such posts exist, fall back to truly newest.
    """
    raw_col = _detect_raw_column(conn)
    base_select = (
        f"SELECT id, title, url, summary, num_upvotes, num_comments, "
        f"  COALESCE(NULLIF(published_at,''), created_at) AS ts, "
        f"  {raw_col} AS raw "
        f"FROM posts WHERE source_id = ?"
    )
    # Prefer posts with engagement OR posts that are at least 3 days old.
    cur = conn.execute(
        base_select + (
            " AND ("
            "    num_upvotes > 0 OR num_comments > 0"
            "    OR COALESCE(NULLIF(published_at,''), created_at) < datetime('now', '-3 days')"
            ")"
            " ORDER BY COALESCE(NULLIF(published_at,''), created_at) DESC LIMIT ?"
        ),
        (source_id, limit),
    )
    out = [_row_to_post_dict(r) for r in cur.fetchall()]
    if len(out) >= limit:
        return out
    # Fallback: not enough qualifying posts — fill with truly newest.
    seen = {p["id"] for p in out}
    cur = conn.execute(
        base_select + " ORDER BY COALESCE(NULLIF(published_at,''), created_at) DESC LIMIT ?",
        (source_id, limit * 2),
    )
    for r in cur.fetchall():
        if len(out) >= limit:
            break
        d = _row_to_post_dict(r)
        if d["id"] not in seen:
            out.append(d)
            seen.add(d["id"])
    return out


def _fetch_top_posts(conn: sqlite3.Connection, source_id: str, limit: int = 5) -> List[Dict]:
    """Return up to `limit` highest-engagement posts ever for this source.

    Engagement score = num_upvotes + 5 * num_comments (comments weighted
    higher because they're rarer signal). Sources where no posts have any
    engagement return an empty list.
    """
    raw_col = _detect_raw_column(conn)
    cur = conn.execute(
        f"SELECT id, title, url, summary, num_upvotes, num_comments, "
        f"  COALESCE(NULLIF(published_at,''), created_at) AS ts, "
        f"  {raw_col} AS raw "
        "FROM posts WHERE source_id = ? "
        "  AND (num_upvotes > 0 OR num_comments > 0) "
        "ORDER BY (num_upvotes + 5 * num_comments) DESC, "
        "         num_upvotes DESC "
        "LIMIT ?",
        (source_id, limit),
    )
    return [_row_to_post_dict(r) for r in cur.fetchall()]


def top_tags(posts: List[Dict], limit: int = 8) -> List[Tuple[str, int]]:
    counter: Counter[str] = Counter()
    for p in posts:
        for tag in _parse_tags(p.get("tags")):
            counter[tag] += 1
    return [[tag, int(cnt)] for tag, cnt in counter.most_common(limit)]


def sample_titles(posts: List[Dict], title_length_avg: float) -> Dict[str, List[str]]:
    """Pick representative (top-3 upvoted) and 1 outlier post.

    Outlier heuristic:
      - Find the rarest post `type` for this source. If it is unique (count==1),
        prefer that title (e.g. the source's only video among articles).
      - Otherwise, pick the title whose length deviates most from the source
        mean (longest-relative-to-avg, since super-short stub titles are rarely
        interesting).
    """
    if not posts:
        return {"representative": [], "outlier": []}

    upvote_sorted = sorted(
        posts,
        key=lambda p: (p.get("num_upvotes") or 0),
        reverse=True,
    )
    representative = [
        (p.get("title") or "").strip() for p in upvote_sorted[:3] if p.get("title")
    ]

    type_counts = Counter((p.get("type") or "article") for p in posts)
    rare_type = min(type_counts.items(), key=lambda kv: kv[1])

    outlier_title = None
    if rare_type[1] == 1 and rare_type[0] != type_counts.most_common(1)[0][0]:
        for p in posts:
            if (p.get("type") or "article") == rare_type[0]:
                outlier_title = (p.get("title") or "").strip() or None
                break

    if not outlier_title:
        # Length-based fallback.
        avg = max(title_length_avg, 1.0)
        scored = [
            (
                abs(len((p.get("title") or "")) - avg) / avg,
                p.get("title") or "",
            )
            for p in posts
        ]
        scored.sort(reverse=True)
        for _score, title in scored:
            t = title.strip()
            if t and t not in representative:
                outlier_title = t
                break

    return {
        "representative": representative,
        "outlier": [outlier_title] if outlier_title else [],
    }


def enrich(db_path: str, source_ids: List[str], title_length_avgs: Dict[str, float]):
    """Return {source_id: {top_tags, sample_titles, recent_posts, top_posts}}."""
    conn = sqlite3.connect(db_path)
    out: Dict[str, Dict] = {}
    try:
        for sid in source_ids:
            posts = _fetch_posts(conn, sid)
            out[sid] = {
                "top_tags": top_tags(posts),
                "sample_titles": sample_titles(
                    posts, title_length_avgs.get(sid, 60.0)
                ),
                "recent_posts": _fetch_recent_posts(conn, sid, limit=10),
                "top_posts": _fetch_top_posts(conn, sid, limit=5),
            }
    finally:
        conn.close()
    return out
