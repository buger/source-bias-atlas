"""Dataclasses describing the canonical input rows and the output feature vector."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any


@dataclass
class PostRow:
    """Canonical post row, normalized across probe.db and atlas.db."""

    id: str
    source_id: str
    source_handle: str
    title: str | None
    url: str | None
    summary: str | None
    type: str | None
    read_time: int | None
    num_upvotes: int | None
    num_comments: int | None
    created_at: str | None
    published_at: str | None
    author_name: str | None
    tags: list[str] = field(default_factory=list)


@dataclass
class SourceRow:
    """Canonical source row."""

    id: str
    handle: str
    name: str | None
    description: str | None
    image: str | None


@dataclass
class FeatureVector:
    """Per-source feature vector. Every scalar feature here is a single float."""

    source_id: str
    handle: str
    name: str | None
    post_count: int
    span_days: float

    # title style
    hype_score: float
    listicle_ratio: float
    question_ratio: float
    title_length_avg: float
    title_length_var: float

    # text
    summary_length_avg: float
    tag_entropy: float
    tag_diversity: float
    top_tag_share: float

    # engagement
    avg_read_time: float
    avg_upvotes: float
    median_upvotes: float
    avg_comments: float
    comment_to_upvote_ratio: float
    zero_engagement_share: float
    viral_share: float

    # cadence
    posts_per_week: float
    cadence_unreliable: bool
    firehose_flag: bool
    recency_skew: float

    # types & authorship
    non_article_ratio: float
    author_present_share: float
    type_distribution: dict[str, float] = field(default_factory=dict)

    def to_row(self) -> dict[str, Any]:
        d = asdict(self)
        td = d.pop("type_distribution") or {}
        for t, frac in td.items():
            d[f"type_{t.replace(':', '_')}"] = frac
        return d
