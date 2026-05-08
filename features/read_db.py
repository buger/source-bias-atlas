"""Load posts and sources from a sqlite path.

Handles drift between probe.db (probe-time schema) and atlas.db (canonical
crawler schema). Both are normalized into PostRow / SourceRow dataclasses.
"""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from schema import PostRow, SourceRow


def _table_columns(con: sqlite3.Connection, table: str) -> set[str]:
    cur = con.execute(f"PRAGMA table_info({table})")
    return {r[1] for r in cur.fetchall()}


def _parse_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        v = json.loads(raw)
    except (ValueError, TypeError):
        return []
    if isinstance(v, list):
        return [str(t) for t in v if t]
    return []


def load_db(db_path: str | Path) -> tuple[list[SourceRow], list[PostRow]]:
    """Load sources and posts. Returns (sources, posts)."""
    db_path = str(db_path)
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row

    src_cols = _table_columns(con, "sources")
    post_cols = _table_columns(con, "posts")

    # Sources
    sources: list[SourceRow] = []
    for row in con.execute("SELECT * FROM sources"):
        sources.append(
            SourceRow(
                id=row["id"],
                handle=row["handle"] if "handle" in src_cols else row["id"],
                name=row["name"] if "name" in src_cols else None,
                description=row["description"] if "description" in src_cols else None,
                image=row["image"] if "image" in src_cols else None,
            )
        )

    # Posts — handle source_handle column drift
    has_source_handle = "source_handle" in post_cols
    handle_by_source_id = {s.id: s.handle for s in sources}

    posts: list[PostRow] = []
    for row in con.execute("SELECT * FROM posts"):
        source_id = row["source_id"]
        if has_source_handle and row["source_handle"]:
            source_handle = row["source_handle"]
        else:
            source_handle = handle_by_source_id.get(source_id, source_id)

        # tags column may be 'tags' (probe) or 'tags_json' (atlas)
        if "tags" in post_cols:
            tags_raw = row["tags"]
        elif "tags_json" in post_cols:
            tags_raw = row["tags_json"]
        else:
            tags_raw = None

        posts.append(
            PostRow(
                id=row["id"],
                source_id=source_id,
                source_handle=source_handle,
                title=row["title"] if "title" in post_cols else None,
                url=row["url"] if "url" in post_cols else None,
                summary=row["summary"] if "summary" in post_cols else None,
                type=row["type"] if "type" in post_cols else None,
                read_time=row["read_time"] if "read_time" in post_cols else None,
                num_upvotes=row["num_upvotes"] if "num_upvotes" in post_cols else None,
                num_comments=row["num_comments"] if "num_comments" in post_cols else None,
                created_at=row["created_at"] if "created_at" in post_cols else None,
                published_at=row["published_at"] if "published_at" in post_cols else None,
                author_name=row["author_name"] if "author_name" in post_cols else None,
                tags=_parse_tags(tags_raw),
            )
        )

    con.close()
    return sources, posts
