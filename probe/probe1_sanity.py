"""Probe 1 — endpoint sanity check.

Hits each documented endpoint once, dumps a ≤1KB sample to `samples/`,
and prints field coverage vs. spec for FeedPost / PostDetail / etc.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from common import Client, SAMPLES_DIR, db, log_run, upsert_post, upsert_source

SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

# Fields the spec says exist on FeedPost (def-17)
FEEDPOST_SPEC_FIELDS = {
    "id", "title", "url", "image", "summary", "type", "publishedAt",
    "createdAt", "commentsPermalink", "source", "tags", "readTime",
    "numUpvotes", "numComments", "author",
}
POSTDETAIL_SPEC_FIELDS = FEEDPOST_SPEC_FIELDS | {"bookmarked", "content", "userState"}


def dump_sample(name: str, payload, max_bytes: int = 1024) -> None:
    """Write a pretty sample, truncating arrays to first 2 items if oversized."""
    text = json.dumps(payload, indent=2, ensure_ascii=False)
    if len(text) > max_bytes:
        # try to trim "data" arrays
        if isinstance(payload, dict) and isinstance(payload.get("data"), list):
            trimmed = dict(payload)
            trimmed["data"] = payload["data"][:1]
            trimmed["_truncated"] = f"original_data_len={len(payload['data'])}"
            text = json.dumps(trimmed, indent=2, ensure_ascii=False)
    if len(text) > max_bytes:
        text = text[:max_bytes] + "\n... [truncated]\n"
    (SAMPLES_DIR / f"{name}.json").write_text(text)


def field_diff(actual: dict, spec: set[str]) -> tuple[set[str], set[str], set[str]]:
    keys = set(actual.keys())
    null_keys = {k for k, v in actual.items() if v is None or v == [] or v == ""}
    missing = spec - keys  # spec says exists, actual doesn't have key
    extra = keys - spec
    return missing, extra, null_keys


def main() -> None:
    c = Client()
    conn = db()
    findings: list[str] = []

    def check(label: str, path: str, **params):
        r = c.get(path, **params)
        ok = r.status_code == 200
        body = r.json() if ok else {"error": r.text[:300], "status": r.status_code}
        dump_sample(label, body)
        findings.append(f"  {label} -> {r.status_code} ({path}{'?'+'&'.join(f'{k}={v}' for k,v in params.items()) if params else ''})")
        return body if ok else None

    # 1) popular
    pop = check("01_feeds_popular", "/feeds/popular", limit=5)
    post_id = None
    if pop and pop.get("data"):
        post = pop["data"][0]
        post_id = post["id"]
        miss, extra, nulls = field_diff(post, FEEDPOST_SPEC_FIELDS)
        findings.append(f"    FeedPost missing: {sorted(miss)}; extra: {sorted(extra)}; null/empty: {sorted(nulls)}")
        for p in pop["data"]:
            upsert_post(conn, p)
            upsert_source(conn, p.get("source") or {}, "popular")

    # 2) discussed
    disc = check("02_feeds_discussed", "/feeds/discussed", period=7, limit=5)
    if disc and disc.get("data"):
        for p in disc["data"]:
            upsert_post(conn, p)
            upsert_source(conn, p.get("source") or {}, "discussed")

    # 3) foryou
    fy = check("03_feeds_foryou", "/feeds/foryou", limit=5)
    if fy and fy.get("data"):
        for p in fy["data"]:
            upsert_post(conn, p)
            upsert_source(conn, p.get("source") or {}, "foryou")

    # 4) tags
    tags = check("04_tags", "/tags/")
    tag_count = len(tags.get("data", [])) if tags else 0
    findings.append(f"    /tags/ returned {tag_count} tags")
    if tags:
        for t in tags.get("data", []):
            n = t.get("name") if isinstance(t, dict) else t
            if n:
                conn.execute("INSERT OR IGNORE INTO tags(name) VALUES (?)", (n,))

    # 5) search/sources
    ss = check("05_search_sources", "/search/sources", q="netflix", limit=5)
    if ss and ss.get("data"):
        for s in ss["data"]:
            upsert_source(conn, s, "search:netflix")

    # 6) search/posts
    sp = check("06_search_posts", "/search/posts", q="kubernetes", limit=5)
    if sp and sp.get("data"):
        for p in sp["data"]:
            upsert_post(conn, p)
            upsert_source(conn, p.get("source") or {}, "search-posts:kubernetes")

    # 7) post detail
    if post_id:
        pd = check("07_post_detail", f"/posts/{post_id}")
        if pd and pd.get("data"):
            d = pd["data"]
            miss, extra, nulls = field_diff(d, POSTDETAIL_SPEC_FIELDS)
            findings.append(f"    PostDetail missing: {sorted(miss)}; extra: {sorted(extra)}; null/empty: {sorted(nulls)}")
        # 8) comments
        cm = check("08_post_comments", f"/posts/{post_id}/comments", limit=5)
        if cm and cm.get("data"):
            for cmt in cm["data"]:
                conn.execute(
                    "INSERT OR REPLACE INTO comments(id, post_id, content, num_upvotes, created_at, raw) VALUES (?,?,?,?,?,?)",
                    (cmt.get("id"), post_id, cmt.get("content"), cmt.get("numUpvotes"), cmt.get("createdAt"), json.dumps(cmt)),
                )
    else:
        findings.append("  SKIPPED post-detail/comments: no popular post id")

    conn.commit()
    log_run(conn, "probe1_sanity", c.req_count, c.elapsed(), "\n".join(findings))
    conn.close()
    c.close()
    print(f"Probe 1 complete: {c.req_count} requests, {c.elapsed():.1f}s")
    for line in findings:
        print(line)


if __name__ == "__main__":
    main()
