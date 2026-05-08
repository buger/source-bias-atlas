"""Title-style features: hype, listicle, question, length stats."""
from __future__ import annotations

import re
import statistics
from collections.abc import Iterable

# Curated hype lexicon. Match as whole-word, case-insensitive.
HYPE_TERMS = [
    "revolutionary",
    "game-changing",
    "game changing",
    "mind-blowing",
    "mind blowing",
    "you won't believe",
    "you wont believe",
    "the only",
    "everyone is",
    "must-know",
    "must know",
    "secret",
    "crushing",
    "dominating",
    "shocking",
    "insane",
    "essential",
    "ultimate",
    "dies",
    "killed",
    "is dead",
]

# Pre-compile a single alternation regex (escape, longest-first to avoid partial shadowing).
_sorted_terms = sorted(HYPE_TERMS, key=len, reverse=True)
_HYPE_RE = re.compile(
    r"(?<![a-zA-Z])(?:" + "|".join(re.escape(t) for t in _sorted_terms) + r")(?![a-zA-Z])",
    re.IGNORECASE,
)
_LISTICLE_RE = re.compile(r"^\s*\d+\s+\S")


def _titles(posts: Iterable) -> list[str]:
    return [p.title for p in posts if p.title]


def hype_score(posts) -> float:
    """Combined hype-term hit fraction + exclamation-mark frequency."""
    titles = _titles(posts)
    if not titles:
        return 0.0
    hits = sum(1 for t in titles if _HYPE_RE.search(t))
    excl = sum(1 for t in titles if "!" in t)
    # Each title can contribute up to 2 "hype units"; scale to [0, 1].
    return (hits + excl) / (2 * len(titles))


def listicle_ratio(posts) -> float:
    titles = _titles(posts)
    if not titles:
        return 0.0
    return sum(1 for t in titles if _LISTICLE_RE.match(t)) / len(titles)


def question_ratio(posts) -> float:
    titles = _titles(posts)
    if not titles:
        return 0.0
    return sum(1 for t in titles if t.rstrip().endswith("?")) / len(titles)


def title_length_stats(posts) -> tuple[float, float]:
    """Return (mean, variance) of title character length."""
    lengths = [len(t) for t in _titles(posts)]
    if not lengths:
        return 0.0, 0.0
    mean = statistics.fmean(lengths)
    var = statistics.pvariance(lengths) if len(lengths) > 1 else 0.0
    return mean, var
