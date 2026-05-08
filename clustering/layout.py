"""2D layout via UMAP (fallback PCA on tiny datasets).

Outputs:
  - coords: (n_publishers, 2) numpy array, normalized to ~[-10, 10]
  - layout_meta: dict describing axis semantics via top-correlated features
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np


# Below this row count UMAP returns degenerate layouts; switch to PCA.
UMAP_MIN_ROWS = 30
TARGET_RANGE = 10.0  # final coords scaled into [-TARGET_RANGE, TARGET_RANGE]


@dataclass
class LayoutResult:
    coords: np.ndarray            # (n, 2)
    method: str                   # "umap" | "pca"
    layout_meta: Dict


# Human-readable descriptions for axis interpretation. Tuned for the daily.dev
# feature space — not a strict ontology, just a cue for the frontend tooltip.
_FEATURE_HINTS = {
    "avg_read_time": ("deep / long-read", "skimmable"),
    "summary_length_avg": ("verbose summaries", "terse summaries"),
    "title_length_avg": ("descriptive titles", "punchy titles"),
    "title_length_var": ("inconsistent style", "consistent style"),
    "hype_score": ("hype-driven", "measured"),
    "listicle_ratio": ("listicle-heavy", "essay-style"),
    "question_ratio": ("question-led", "declarative"),
    "tag_entropy": ("generalist", "niche"),
    "tag_diversity": ("topic-spread", "topic-focused"),
    "top_tag_share": ("single-topic dominant", "topic-balanced"),
    "median_upvotes": ("popular", "low-engagement"),
    "comment_to_upvote_ratio": ("controversial / discussion-driving", "consumed silently"),
    "zero_engagement_share": ("ignored content", "always-engaged"),
    "posts_per_week": ("high-cadence firehose", "slow / curated"),
    "recency_skew": ("recently active", "archival / dormant"),
    "non_article_ratio": ("multimedia / non-article", "article-only"),
    "author_present_share": ("shows authors", "no author shown"),
}


def _normalize_coords(coords: np.ndarray, target: float = TARGET_RANGE) -> np.ndarray:
    """Center and scale so each axis spans roughly [-target, target]."""
    out = coords.astype(float).copy()
    for axis in range(out.shape[1]):
        col = out[:, axis]
        lo, hi = np.percentile(col, [1, 99])
        if hi - lo < 1e-9:
            out[:, axis] = 0.0
            continue
        center = (lo + hi) / 2
        half = (hi - lo) / 2
        out[:, axis] = (col - center) / half * target
    return out


def _axis_meta(
    coords: np.ndarray,
    feature_matrix: np.ndarray,
    feature_names: List[str],
    axis: int,
    exclude: set | None = None,
) -> Dict:
    """Compute axis label + top-correlated features.

    `exclude` is a set of feature names to skip when picking the strongest
    pos/neg labels. Used to make the second axis pick disjoint features
    from the first when UMAP folds along a single dominant gradient.
    """
    col = coords[:, axis]
    if col.std() < 1e-9:
        return {
            "positive": "(degenerate axis)",
            "negative": "(degenerate axis)",
            "top_correlated_features": [],
        }
    corrs: List[Tuple[str, float]] = []
    for i, name in enumerate(feature_names):
        feat = feature_matrix[:, i]
        if feat.std() < 1e-9:
            continue
        r = float(np.corrcoef(col, feat)[0, 1])
        if np.isfinite(r):
            corrs.append((name, r))
    corrs.sort(key=lambda x: abs(x[1]), reverse=True)
    top = corrs[:4]

    # Eligible features for label-picking exclude any names already used by a
    # prior axis. Even with the exclusion the displayed `top_correlated_features`
    # are unfiltered so the user can still inspect the true correlation list.
    eligible = [c for c in top if not exclude or c[0] not in exclude]
    if not eligible:
        eligible = top  # fallback: nothing else to pick

    # Prefer a single dominant feature for both ends of one axis so labels
    # read as one concept (e.g. "popular ↔ low-engagement"). Use the feature
    # with the strongest absolute correlation; only split into two features
    # if the runner-up is comparable in strength.
    eligible_abs_sorted = sorted(eligible, key=lambda x: -abs(x[1]))
    dominant = eligible_abs_sorted[0] if eligible_abs_sorted else None
    runner_up_abs = abs(eligible_abs_sorted[1][1]) if len(eligible_abs_sorted) > 1 else 0.0
    use_dominant_for_both = (
        dominant is not None and abs(dominant[1]) >= 1.3 * max(runner_up_abs, 1e-9)
    )

    if use_dominant_for_both:
        pos = dominant
        neg = dominant
    else:
        pos = max(eligible, key=lambda x: x[1]) if eligible else None
        neg = min(eligible, key=lambda x: x[1]) if eligible else None
        # Avoid the same feature on both ends if labels would collide
        if pos and neg and pos[0] == neg[0]:
            alt = [c for c in eligible if c[0] != pos[0]]
            if alt:
                neg = min(alt, key=lambda x: x[1])

    def _label(corr_pair, sign: str) -> str:
        if corr_pair is None:
            return "(no signal)"
        name, r = corr_pair
        hi_label, lo_label = _FEATURE_HINTS.get(name, (name, f"low {name}"))
        if sign == "positive":
            return hi_label if r > 0 else lo_label
        return lo_label if r > 0 else hi_label

    return {
        "positive": _label(pos, "positive"),
        "negative": _label(neg, "negative"),
        "top_correlated_features": [[n, round(r, 3)] for n, r in top],
        "_pos_feature": pos[0] if pos else None,
        "_neg_feature": neg[0] if neg else None,
    }


def layout_2d(
    feature_matrix: np.ndarray,
    feature_names: List[str],
    random_state: int = 42,
) -> LayoutResult:
    n = feature_matrix.shape[0]
    if n < UMAP_MIN_ROWS:
        # PCA fallback for small datasets - more stable than UMAP < ~30 rows.
        from sklearn.decomposition import PCA

        coords = PCA(n_components=2, random_state=random_state).fit_transform(
            feature_matrix
        )
        method = "pca"
    else:
        try:
            import umap
            from sklearn.decomposition import PCA as _PCA

            # Pre-rotate the feature space with PCA before UMAP. This decorrelates
            # the input — without it, UMAP folds along the single dominant gradient
            # (author_present_share / zero_engagement_share) and produces a
            # star/starfish shape with thin radial arms. After PCA, UMAP gets
            # roughly orthogonal inputs and lays things out more circularly while
            # preserving cluster structure.
            n_pca = min(8, feature_matrix.shape[1])
            X_pca = _PCA(n_components=n_pca, random_state=random_state).fit_transform(
                feature_matrix
            )

            reducer = umap.UMAP(
                n_neighbors=30,
                min_dist=0.5,
                metric="euclidean",
                random_state=random_state,
                n_components=2,
            )
            coords = reducer.fit_transform(X_pca)
            method = "umap"
        except Exception as e:  # pragma: no cover - safety net
            print(f"[layout] UMAP failed ({e}); falling back to PCA")
            from sklearn.decomposition import PCA

            coords = PCA(n_components=2, random_state=random_state).fit_transform(
                feature_matrix
            )
            method = "pca"

    coords = _normalize_coords(np.asarray(coords))

    # Compute axis labels with disjoint feature picks. UMAP often folds along
    # a single dominant gradient, so both x and y end up correlating with the
    # same handful of features. To avoid duplicate axis labels, the second
    # axis excludes the top-2 absolute correlates of the first axis (not just
    # the labelled ones — proxies count too).
    x_meta = _axis_meta(coords, feature_matrix, feature_names, axis=0)
    x_top_features = [n for n, _r in x_meta.get("top_correlated_features", [])][:2]
    used = set(x_top_features)
    if x_meta.get("_pos_feature"):
        used.add(x_meta["_pos_feature"])
    if x_meta.get("_neg_feature"):
        used.add(x_meta["_neg_feature"])
    y_meta = _axis_meta(
        coords, feature_matrix, feature_names, axis=1, exclude=used
    )
    # Strip private fields before persisting.
    for m in (x_meta, y_meta):
        m.pop("_pos_feature", None)
        m.pop("_neg_feature", None)

    meta = {
        "method": method,
        "n_points": int(n),
        "random_state": random_state,
        "x_axis": x_meta,
        "y_axis": y_meta,
    }
    return LayoutResult(coords=coords, method=method, layout_meta=meta)
