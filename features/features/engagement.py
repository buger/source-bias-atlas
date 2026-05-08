"""Engagement features: upvotes, comments, viral, zero-engagement, read_time."""
from __future__ import annotations

import statistics

VIRAL_UPVOTE_THRESHOLD = 100  # documented choice; see README


def _ints(posts, attr: str) -> list[int]:
    return [getattr(p, attr) for p in posts if getattr(p, attr) is not None]


def avg_read_time(posts) -> float:
    vs = _ints(posts, "read_time")
    return statistics.fmean(vs) if vs else 0.0


def avg_upvotes(posts) -> float:
    vs = _ints(posts, "num_upvotes")
    return statistics.fmean(vs) if vs else 0.0


def median_upvotes(posts) -> float:
    vs = _ints(posts, "num_upvotes")
    return float(statistics.median(vs)) if vs else 0.0


def avg_comments(posts) -> float:
    vs = _ints(posts, "num_comments")
    return statistics.fmean(vs) if vs else 0.0


def comment_to_upvote_ratio(posts) -> float:
    sc = sum(_ints(posts, "num_comments"))
    su = sum(_ints(posts, "num_upvotes"))
    return (sc + 1) / (su + 1)


def zero_engagement_share(posts) -> float:
    if not posts:
        return 0.0
    n = sum(
        1
        for p in posts
        if (p.num_upvotes or 0) == 0 and (p.num_comments or 0) == 0
    )
    return n / len(posts)


def viral_share(posts, threshold: int = VIRAL_UPVOTE_THRESHOLD) -> float:
    if not posts:
        return 0.0
    return sum(1 for p in posts if (p.num_upvotes or 0) > threshold) / len(posts)
