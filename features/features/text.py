"""Text-shape features: summary length, tag entropy/diversity/top-tag share."""
from __future__ import annotations

import math
import statistics
from collections import Counter


def summary_length_avg(posts) -> float:
    lens = [len(p.summary) for p in posts if p.summary]
    return statistics.fmean(lens) if lens else 0.0


def _tag_counter(posts) -> Counter:
    c: Counter[str] = Counter()
    for p in posts:
        for t in p.tags:
            c[t] += 1
    return c


def tag_entropy(posts) -> float:
    """Shannon entropy in nats over the tag distribution. 0 if no tags."""
    counts = _tag_counter(posts)
    total = sum(counts.values())
    if total == 0:
        return 0.0
    h = 0.0
    for c in counts.values():
        p = c / total
        h -= p * math.log(p)
    return h


def tag_diversity(posts) -> float:
    """Unique tags per post. Higher = source spans more topics."""
    counts = _tag_counter(posts)
    if not posts:
        return 0.0
    return len(counts) / len(posts)


def top_tag_share(posts) -> float:
    """Share of *posts* whose own top tag (first in list) is the source's most common tag."""
    counts = _tag_counter(posts)
    if not counts:
        return 0.0
    top_tag, _ = counts.most_common(1)[0]
    n_with_top = sum(1 for p in posts if p.tags and p.tags[0] == top_tag)
    return n_with_top / len(posts)
