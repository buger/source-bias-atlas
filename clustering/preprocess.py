"""Preprocess M2 feature parquet for clustering.

Steps (per M2 recommendations in features/README.md):
  1. Drop redundant engagement features (avg_upvotes, avg_comments, viral_share).
  2. log1p transform skewed columns before scaling.
  3. z-score everything.
  4. Up-weight high-signal 0-1 features by 1.5x.
  5. Filter out is_squad rows from the clustering matrix (kept in side table).

Returns a `(n_publishers, k_features)` numpy array, the parallel index of
source_ids, the list of feature column names actually used, and the full
dataframe (with is_squad flag) so downstream steps can carry metadata.
"""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from typing import List, Tuple

import numpy as np
import pandas as pd


# Per features/README.md "Findings": engagement features are one latent
# dimension. We keep median_upvotes (robust), comment_to_upvote_ratio
# (controversy axis), and zero_engagement_share (coverage axis).
DROP_REDUNDANT = ["avg_upvotes", "viral_share", "avg_comments"]

# Long-tailed columns from skew inspection. log1p before z-score.
LOG1P_COLUMNS = [
    "posts_per_week",
    "recency_skew",
    "median_upvotes",
    "title_length_var",
    "avg_read_time",
    "tag_diversity",
]

# Already in 0-1 land but flagged as high-signal in features_report.md.
# NOTE: non_article_ratio removed from upweight on the full crawler dataset —
# it dominated UMAP and collapsed both axes onto a single dimension. Keeping
# author_present_share + top_tag_share which are genuinely cross-cutting.
HIGH_SIGNAL_BOOLEAN = ["author_present_share", "top_tag_share"]
HIGH_SIGNAL_WEIGHT = 1.5

# Numeric features used for clustering. Type_* columns are kept as informational
# but the type-distribution signal already feeds non_article_ratio, so we keep
# only non_article_ratio + author_present_share from that family in the matrix.
CLUSTER_FEATURES = [
    "hype_score",
    "listicle_ratio",
    "question_ratio",
    "title_length_avg",
    "title_length_var",
    "summary_length_avg",
    "tag_entropy",
    "tag_diversity",
    "top_tag_share",
    "avg_read_time",
    "median_upvotes",
    "comment_to_upvote_ratio",
    "zero_engagement_share",
    "posts_per_week",
    "recency_skew",
    "non_article_ratio",
    "author_present_share",
]


@dataclass
class PreprocessResult:
    feature_matrix: np.ndarray      # (n_publishers, k)
    source_ids: List[str]           # parallel to feature_matrix rows
    feature_names: List[str]        # column order in feature_matrix
    feature_means: np.ndarray       # (k,) raw-space means used by scaler
    feature_stds: np.ndarray        # (k,)
    feature_log1p_mask: np.ndarray  # (k,) bool, True => log1p applied
    df_all: pd.DataFrame            # full df incl. squads with is_squad flag


def attach_source_metadata(features_df: pd.DataFrame, db_path: str) -> pd.DataFrame:
    """Pull is_squad / image / description / first+last post times from the DB."""
    conn = sqlite3.connect(db_path)
    try:
        srcs = pd.read_sql(
            "SELECT id AS source_id, name AS source_name, "
            "description AS source_description, image AS source_image "
            "FROM sources",
            conn,
        )
        # Posts table has both source_id and timestamps; use whichever resolves.
        posts = pd.read_sql(
            "SELECT source_id, "
            "MIN(COALESCE(NULLIF(published_at,''), created_at)) AS oldest_post_at, "
            "MAX(COALESCE(NULLIF(published_at,''), created_at)) AS newest_post_at "
            "FROM posts GROUP BY source_id",
            conn,
        )
    finally:
        conn.close()

    df = features_df.merge(srcs, on="source_id", how="left").merge(
        posts, on="source_id", how="left"
    )
    # Heuristic: probe.db has no is_squad column. Squads' images live under
    # /squads/, publisher logos under /logos/ on media.daily.dev. The crawler
    # may add an is_squad column later — prefer that if present.
    if "is_squad" not in df.columns:
        df["is_squad"] = (
            df["source_image"].fillna("").str.contains("/squads/", regex=False)
        )
    df["is_squad"] = df["is_squad"].fillna(False).astype(bool)
    return df


def preprocess(features_path: str, db_path: str) -> PreprocessResult:
    raw = pd.read_parquet(features_path)
    df = attach_source_metadata(raw, db_path)

    # Both publishers and squads participate in the layout. Squads have the
    # same feature shape; they're a real slice of daily.dev's ecosystem and
    # the user wants them on the map. is_squad flag is preserved so the
    # frontend can render them differently and the "Show squads" toggle works.
    publishers = df.copy()

    # Order columns consistently.
    feature_names = [c for c in CLUSTER_FEATURES if c in publishers.columns]
    missing = set(CLUSTER_FEATURES) - set(feature_names)
    if missing:
        # Hard error - surface schema drift early.
        raise RuntimeError(f"feature parquet missing required columns: {missing}")

    X = publishers[feature_names].astype(float).to_numpy(copy=True)
    X = np.array(X, copy=True)  # ensure writeable

    log_mask = np.array([f in LOG1P_COLUMNS for f in feature_names])
    if log_mask.any():
        X[:, log_mask] = np.log1p(np.clip(X[:, log_mask], a_min=0, a_max=None))

    means = X.mean(axis=0)
    stds = X.std(axis=0, ddof=0)
    stds = np.where(stds < 1e-9, 1.0, stds)  # guard against constant columns
    Xz = (X - means) / stds

    # Up-weight high-signal boolean-ish features.
    for i, f in enumerate(feature_names):
        if f in HIGH_SIGNAL_BOOLEAN:
            Xz[:, i] *= HIGH_SIGNAL_WEIGHT

    return PreprocessResult(
        feature_matrix=Xz,
        source_ids=publishers["source_id"].tolist(),
        feature_names=feature_names,
        feature_means=means,
        feature_stds=stds,
        feature_log1p_mask=log_mask,
        df_all=df.reset_index(drop=True),
    )


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default="features/features.parquet")
    ap.add_argument("--db", default="probe/probe.db")
    args = ap.parse_args()
    res = preprocess(args.features, args.db)
    print(f"matrix: {res.feature_matrix.shape}")
    print(f"publishers: {len(res.source_ids)}")
    print(f"squads (excluded): {int(res.df_all['is_squad'].sum())}")
    print(f"features: {res.feature_names}")
