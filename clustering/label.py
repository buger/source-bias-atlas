"""Generate human-readable cluster labels + colors.

For each cluster:
  1. Pick top 2 most distinctive tags across its sources (post-count weighted).
  2. Pick top 2 features by absolute z-score deviation from global mean.
  3. Render: "<tag1>/<tag2> - <feature_descriptor>".
Allow manual overrides via clustering/cluster_overrides.json.
"""
from __future__ import annotations

import json
import os
from collections import Counter
from typing import Dict, List, Tuple

import numpy as np


# Maps "<feature>:<direction>" -> short adjective. Direction is "high"/"low"
# *after* log+z transforms, so "high posts_per_week" means above the global
# log-mean cadence.
FEATURE_DESCRIPTORS = {
    "hype_score:high": "hype-driven",
    "hype_score:low": "measured",
    "listicle_ratio:high": "listicle-heavy",
    "listicle_ratio:low": "essay-style",
    "question_ratio:high": "question-led",
    "question_ratio:low": "declarative",
    "title_length_avg:high": "verbose-titled",
    "title_length_avg:low": "punchy-titled",
    "title_length_var:high": "inconsistent style",
    "title_length_var:low": "consistent style",
    "summary_length_avg:high": "rich-summary",
    "summary_length_avg:low": "thin-summary",
    "tag_entropy:high": "generalist",
    "tag_entropy:low": "niche",
    "tag_diversity:high": "topic-spread",
    "tag_diversity:low": "topic-narrow",
    "top_tag_share:high": "single-topic",
    "top_tag_share:low": "topic-balanced",
    "avg_read_time:high": "deep / long-read",
    "avg_read_time:low": "skimmable",
    "median_upvotes:high": "popular",
    "median_upvotes:low": "low-engagement",
    "comment_to_upvote_ratio:high": "discussion-driving",
    "comment_to_upvote_ratio:low": "consumed-silently",
    "zero_engagement_share:high": "ignored",
    "zero_engagement_share:low": "always-engaged",
    "posts_per_week:high": "high-cadence",
    "posts_per_week:low": "slow-cadence",
    "recency_skew:high": "recently-active",
    "recency_skew:low": "archival",
    "non_article_ratio:high": "multimedia",
    "non_article_ratio:low": "article-only",
    "author_present_share:high": "personal / bylined",
    "author_present_share:low": "anonymous",
}


# Tableau 10, then a couple extras for safety. Perceptually distinct.
PALETTE = [
    "#4E79A7", "#F28E2B", "#E15759", "#76B7B2", "#59A14F",
    "#EDC948", "#B07AA1", "#FF9DA7", "#9C755F", "#BAB0AC",
    "#86BCB6", "#FABFD2",
]


def _cluster_top_tags(
    cluster_source_ids: List[str], enrich_data: Dict, post_counts: Dict[str, int]
) -> List[Tuple[str, int]]:
    counter: Counter[str] = Counter()
    for sid in cluster_source_ids:
        weight = max(post_counts.get(sid, 1), 1)
        for tag, cnt in enrich_data.get(sid, {}).get("top_tags", []):
            # Each source contributes its top tags weighted by its post count
            # (so a 900-post HN doesn't get drowned by a 10-post blog, but
            # also doesn't completely dominate via tag count alone).
            counter[tag] += cnt * np.log1p(weight)
    return [(t, int(c)) for t, c in counter.most_common(8)]


def _distinctive_features(
    cluster_rows: np.ndarray,         # scaled feature matrix rows for cluster
    feature_names: List[str],
    top_k: int = 2,
) -> List[Tuple[str, str, float]]:
    """Return list of (feature_name, direction, signed_z) sorted by |z|.

    Since the global feature matrix is z-scored (mean=0, std=1 across all
    publishers), the cluster mean *is* the deviation in standardized units.
    """
    centroid = cluster_rows.mean(axis=0)  # (k,)
    order = np.argsort(-np.abs(centroid))
    out: List[Tuple[str, str, float]] = []
    for idx in order[: top_k * 3]:  # consider extras, dedupe by descriptor
        if abs(centroid[idx]) < 0.4:  # ignore weak deviations
            continue
        direction = "high" if centroid[idx] > 0 else "low"
        out.append((feature_names[idx], direction, float(centroid[idx])))
        if len(out) >= top_k:
            break
    return out


def _render_label(top_tags: List[Tuple[str, int]], distinctive) -> str:
    tag_part = "/".join(t for t, _ in top_tags[:2]) if top_tags else "mixed"
    if not distinctive:
        return f"{tag_part} - mixed"
    descriptors = []
    for name, direction, _z in distinctive:
        key = f"{name}:{direction}"
        descriptors.append(FEATURE_DESCRIPTORS.get(key, f"{direction} {name}"))
    desc_part = ", ".join(descriptors)
    return f"{tag_part} - {desc_part}"


def label_clusters(
    labels: np.ndarray,
    feature_matrix: np.ndarray,
    feature_names: List[str],
    source_ids: List[str],
    enrich_data: Dict,
    post_counts: Dict[str, int],
    overrides_path: str | None = None,
):
    """Return list of {id, label, top_tags, color, distinctive_features}."""
    overrides: Dict[str, str] = {}
    if overrides_path and os.path.exists(overrides_path):
        try:
            with open(overrides_path, "r") as f:
                overrides = json.load(f) or {}
        except Exception as e:
            print(f"[label] could not parse overrides ({e}); ignoring")

    out = []
    k = int(labels.max() + 1) if len(labels) else 0
    for cid in range(k):
        mask = labels == cid
        rows = feature_matrix[mask]
        sids = [source_ids[i] for i in np.where(mask)[0]]
        tags = _cluster_top_tags(sids, enrich_data, post_counts)
        distinctive = _distinctive_features(rows, feature_names)
        auto_label = _render_label(tags, distinctive)
        final_label = overrides.get(str(cid), auto_label)
        out.append(
            {
                "id": int(cid),
                "label": final_label,
                "auto_label": auto_label,
                "top_tags": [[t, c] for t, c in tags],
                "distinctive_features": [
                    {"feature": n, "direction": d, "z": round(z, 3)}
                    for n, d, z in distinctive
                ],
                "color": PALETTE[cid % len(PALETTE)],
                "size": int(mask.sum()),
            }
        )
    return out
