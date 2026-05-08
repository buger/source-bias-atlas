"""Post-type distribution and authorship presence."""
from __future__ import annotations

from collections import Counter

KNOWN_TYPES = ("article", "social:twitter", "video:youtube", "share", "freeform", "collection", "poll")


def type_distribution(posts) -> dict[str, float]:
    if not posts:
        return {t: 0.0 for t in KNOWN_TYPES}
    c = Counter(p.type or "unknown" for p in posts)
    n = len(posts)
    out = {t: c.get(t, 0) / n for t in KNOWN_TYPES}
    # Track 'unknown' bucket if non-trivial.
    other = sum(v for k, v in c.items() if k not in KNOWN_TYPES)
    if other:
        out["unknown"] = other / n
    return out


def non_article_ratio(posts) -> float:
    if not posts:
        return 0.0
    return sum(1 for p in posts if (p.type or "") != "article") / len(posts)


def author_present_share(posts) -> float:
    if not posts:
        return 0.0
    return sum(1 for p in posts if p.author_name) / len(posts)
