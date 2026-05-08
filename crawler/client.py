"""Crawler client + DB helpers.

Reuses the probe's httpx wrapper (`probe.common.Client`) for rate-limited,
429-aware HTTP, but writes to a fresh `crawler/atlas.db`.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Ensure we can import probe.common
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from probe.common import Client  # noqa: E402

CRAWLER_DIR = Path(__file__).resolve().parent
DB_PATH = CRAWLER_DIR / "atlas.db"
SCHEMA_PATH = CRAWLER_DIR / "schema.sql"
LOG_PATH = CRAWLER_DIR / "progress.log"

BUDGET_CAP = 9000


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text())
    conn.commit()
    return conn


def log(msg: str) -> None:
    """Append a line to progress.log AND print it."""
    line = f"[{now_iso()}] {msg}"
    print(line, flush=True)
    with LOG_PATH.open("a") as f:
        f.write(line + "\n")


def upsert_source(conn: sqlite3.Connection, src: dict, is_squad: int) -> bool:
    """Insert source if new. Returns True if a new row was created."""
    if not src or not src.get("id"):
        return False
    cur = conn.execute("SELECT 1 FROM sources WHERE id=?", (src["id"],))
    if cur.fetchone() is not None:
        return False
    conn.execute(
        "INSERT INTO sources(id, handle, name, image, description, is_squad, first_seen_at)"
        " VALUES (?,?,?,?,?,?,?)",
        (
            src.get("id"),
            src.get("handle"),
            src.get("name"),
            src.get("image"),
            src.get("description"),
            is_squad,
            now_iso(),
        ),
    )
    return True


def upsert_post(conn: sqlite3.Connection, p: dict) -> bool:
    """INSERT OR IGNORE a post. Returns True if newly inserted."""
    if not p or not p.get("id"):
        return False
    src = p.get("source") or {}
    if not src.get("id"):
        return False
    author = p.get("author") or {}
    cur = conn.execute(
        "INSERT OR IGNORE INTO posts(id, source_id, title, url, summary, image, type,"
        " read_time, num_upvotes, num_comments, created_at, published_at, author_name,"
        " tags_json, raw_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            p.get("id"),
            src.get("id"),
            p.get("title"),
            p.get("url"),
            p.get("summary"),
            p.get("image"),
            p.get("type"),
            p.get("readTime"),
            p.get("numUpvotes"),
            p.get("numComments"),
            p.get("createdAt") or now_iso(),
            p.get("publishedAt"),
            author.get("name") if author else None,
            json.dumps(p.get("tags") or []),
            json.dumps(p),
        ),
    )
    return cur.rowcount > 0


def start_run(conn: sqlite3.Connection, phase: str, notes: str = "") -> int:
    cur = conn.execute(
        "INSERT INTO crawl_runs(phase, started_at, notes) VALUES (?,?,?)",
        (phase, now_iso(), notes),
    )
    conn.commit()
    return cur.lastrowid  # type: ignore[return-value]


def end_run(conn: sqlite3.Connection, run_id: int, requests_made: int, errors: int, notes: str = "") -> None:
    conn.execute(
        "UPDATE crawl_runs SET ended_at=?, requests_made=?, errors=?, notes=COALESCE(notes,'')||?"
        " WHERE id=?",
        (now_iso(), requests_made, errors, ("\n" + notes) if notes else "", run_id),
    )
    conn.commit()


def update_source_aggregates(conn: sqlite3.Connection, source_id: str, is_exhausted: int = 0,
                             error_note: Optional[str] = None) -> None:
    """Recompute posts_collected, oldest/newest from posts table for this source."""
    row = conn.execute(
        "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM posts WHERE source_id=?",
        (source_id,),
    ).fetchone()
    cnt, oldest, newest = row
    conn.execute(
        "UPDATE sources SET posts_collected=?, oldest_post_at=?, newest_post_at=?,"
        " is_exhausted=?, last_crawled_at=?, error_note=COALESCE(?, error_note) WHERE id=?",
        (cnt or 0, oldest, newest, is_exhausted, now_iso(), error_note, source_id),
    )
