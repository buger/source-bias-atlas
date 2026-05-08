"""Probe 3 — pagination depth on `/feeds/tag/{tag}`.

Picks a big / mid / niche tag from /tags/ and paginates each up to ~10 pages.
"""
from __future__ import annotations

from datetime import datetime

from common import Client, db, log_run, upsert_post, upsert_source

TAGS = [
    ("javascript", "big"),
    ("rust", "mid"),
    ("webassembly", "niche"),
]
PAGE_LIMIT = 50
PAGE_CAP = 10


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

    # First confirm the niche tag exists; if not, fall back to the first tag we don't know
    tag_resp = c.get_json("/tags/")
    known = {t.get("name") if isinstance(t, dict) else t for t in (tag_resp or {}).get("data", [])}
    targets = []
    for tag, label in TAGS:
        if tag not in known:
            findings.append(f"  WARN: tag '{tag}' not in /tags/, attempting anyway")
        targets.append((tag, label))

    for tag, label in targets:
        cursor = None
        pages = 0
        total = 0
        oldest = None
        newest = None
        terminated = False
        unique_sources: set[str] = set()
        while pages < PAGE_CAP:
            data = c.get_json(f"/feeds/tag/{tag}", limit=PAGE_LIMIT, cursor=cursor)
            pages += 1
            if data is None:
                findings.append(f"  [{label}] {tag}: ERROR on page {pages}")
                break
            posts = data.get("data") or []
            pag = data.get("pagination") or {}
            for p in posts:
                upsert_post(conn, p)
                src = p.get("source") or {}
                upsert_source(conn, src, f"tag-feed:{tag}")
                if src.get("id"):
                    unique_sources.add(src["id"])
                ts = parse_iso(p.get("createdAt"))
                if ts:
                    if not oldest or ts < oldest: oldest = ts
                    if not newest or ts > newest: newest = ts
            total += len(posts)
            if not pag.get("hasNextPage"):
                terminated = True
                break
            cursor = pag.get("cursor")
            if not cursor:
                terminated = True
                break
        span = (newest - oldest).days if (oldest and newest) else None
        findings.append(
            f"  [{label}] {tag}: pages={pages} total={total} "
            f"hasNextPage_terminated={terminated} unique_sources={len(unique_sources)} "
            f"span_days={span} newest={newest} oldest={oldest}"
        )
        conn.commit()

    log_run(conn, "probe3_tag_pagination", c.req_count, c.elapsed(), "\n".join(findings))
    conn.close(); c.close()
    print(f"Probe 3 complete: {c.req_count} requests, {c.elapsed():.1f}s")
    for line in findings:
        print(line)


if __name__ == "__main__":
    main()
