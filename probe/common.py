"""Shared HTTP client + sqlite helpers for daily.dev probes.

Loads token from `.env.local`, provides a polite httpx client with
retry-on-429 (honoring `Retry-After`), tracks request count + elapsed time,
and exposes idempotent table creation for `probe.db`.
"""
from __future__ import annotations

import os
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

PROBE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PROBE_DIR.parent
SAMPLES_DIR = PROBE_DIR / "samples"
DB_PATH = PROBE_DIR / "probe.db"

load_dotenv(REPO_ROOT / ".env.local")

TOKEN = os.environ.get("DAILYDEV_TOKEN")
BASE = os.environ.get("DAILYDEV_API_BASE", "https://api.daily.dev/public/v1").rstrip("/")

if not TOKEN:
    raise SystemExit("DAILYDEV_TOKEN missing from .env.local")


class Client:
    """Tiny wrapper around httpx with rate-limit-aware retries + req counter."""

    def __init__(self, min_interval: float = 1.05, max_retries: int = 8):
        # 60 req/min user tier => 1 req/sec is the safe cap
        # max_retries=8 gives ~5min total backoff window for transient network outages
        self.min_interval = min_interval
        self.max_retries = max_retries
        self._last = 0.0
        self.req_count = 0
        self.start = time.monotonic()
        self.client = httpx.Client(
            base_url=BASE,
            headers={
                "Authorization": f"Bearer {TOKEN}",
                "Accept": "application/json",
                "User-Agent": "source-bias-atlas-probe/0.1",
            },
            timeout=httpx.Timeout(60.0, read=60.0, connect=15.0),
        )

    def get(self, path: str, **params: Any) -> httpx.Response:
        # strip None params
        clean = {k: v for k, v in params.items() if v is not None}
        for attempt in range(self.max_retries + 1):
            # gentle pacing
            now = time.monotonic()
            wait = self.min_interval - (now - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.monotonic()
            self.req_count += 1
            try:
                resp = self.client.get(path, params=clean)
            except (httpx.NetworkError, httpx.ProtocolError, httpx.TimeoutException) as e:
                # NetworkError covers ConnectError + ReadError + WriteError + CloseError
                # ProtocolError covers RemoteProtocolError + LocalProtocolError
                # TimeoutException covers Connect/Read/Write/Pool timeouts
                if attempt < self.max_retries:
                    delay = min(2 ** attempt, 60)
                    time.sleep(delay)
                    continue
                raise
            if resp.status_code == 429 and attempt < self.max_retries:
                ra = resp.headers.get("Retry-After")
                delay = float(ra) if ra and ra.replace(".", "").isdigit() else 2 ** attempt
                time.sleep(min(delay, 30))
                continue
            return resp
        return resp  # type: ignore[return-value]

    def get_json(self, path: str, **params: Any) -> Optional[dict]:
        r = self.get(path, **params)
        if r.status_code != 200:
            return None
        return r.json()

    def elapsed(self) -> float:
        return time.monotonic() - self.start

    def close(self) -> None:
        self.client.close()


def db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS sources (
            id TEXT PRIMARY KEY,
            handle TEXT,
            name TEXT,
            description TEXT,
            image TEXT,
            discovered_via TEXT
        );
        CREATE TABLE IF NOT EXISTS posts (
            id TEXT PRIMARY KEY,
            source_id TEXT,
            source_handle TEXT,
            title TEXT,
            url TEXT,
            type TEXT,
            summary TEXT,
            tags TEXT,            -- JSON array
            read_time INTEGER,
            num_upvotes INTEGER,
            num_comments INTEGER,
            image TEXT,
            author_name TEXT,
            published_at TEXT,
            created_at TEXT,
            raw TEXT              -- full JSON blob
        );
        CREATE TABLE IF NOT EXISTS tags (
            name TEXT PRIMARY KEY
        );
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            post_id TEXT,
            content TEXT,
            num_upvotes INTEGER,
            created_at TEXT,
            raw TEXT
        );
        CREATE TABLE IF NOT EXISTS probe_runs (
            probe TEXT,
            ts TEXT DEFAULT CURRENT_TIMESTAMP,
            requests INTEGER,
            elapsed_sec REAL,
            notes TEXT
        );
        """
    )
    return conn


def upsert_source(conn: sqlite3.Connection, src: dict, via: str) -> None:
    if not src or not src.get("id"):
        return
    conn.execute(
        "INSERT OR IGNORE INTO sources(id, handle, name, description, image, discovered_via)"
        " VALUES (?,?,?,?,?,?)",
        (
            src.get("id"),
            src.get("handle"),
            src.get("name"),
            src.get("description"),
            src.get("image"),
            via,
        ),
    )


def upsert_post(conn: sqlite3.Connection, p: dict) -> None:
    import json as _json
    src = p.get("source") or {}
    author = p.get("author") or {}
    conn.execute(
        "INSERT OR REPLACE INTO posts(id, source_id, source_handle, title, url, type,"
        " summary, tags, read_time, num_upvotes, num_comments, image, author_name,"
        " published_at, created_at, raw) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            p.get("id"),
            src.get("id"),
            src.get("handle"),
            p.get("title"),
            p.get("url"),
            p.get("type"),
            p.get("summary"),
            _json.dumps(p.get("tags") or []),
            p.get("readTime"),
            p.get("numUpvotes"),
            p.get("numComments"),
            p.get("image"),
            author.get("name") if author else None,
            p.get("publishedAt"),
            p.get("createdAt"),
            _json.dumps(p),
        ),
    )


def log_run(conn: sqlite3.Connection, probe: str, requests: int, elapsed: float, notes: str = "") -> None:
    conn.execute(
        "INSERT INTO probe_runs(probe, requests, elapsed_sec, notes) VALUES (?,?,?,?)",
        (probe, requests, elapsed, notes),
    )
    conn.commit()
