"""Orchestrator: produce clustering/atlas.json matching the M4 contract.

Usage:
  python -m clustering.build_atlas \
      --features features/features.parquet \
      --db probe/probe.db \
      --out clustering/atlas.json
"""
from __future__ import annotations

import argparse
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

# Allow running both as a module and as a script.
if __package__ in (None, ""):
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.dirname(here))
    from clustering.preprocess import preprocess
    from clustering.layout import layout_2d
    from clustering.cluster import cluster as run_cluster
    from clustering.enrich import enrich
    from clustering.label import label_clusters
else:
    from .preprocess import preprocess
    from .layout import layout_2d
    from .cluster import cluster as run_cluster
    from .enrich import enrich
    from .label import label_clusters


# Schema-defined feature keys (from M4 contract). These appear in atlas.json
# regardless of whether they were used for clustering.
FEATURE_KEYS = [
    "hype_score", "listicle_ratio", "question_ratio",
    "avg_read_time", "summary_length_avg", "title_length_avg", "title_length_var",
    "tag_entropy", "tag_diversity", "top_tag_share",
    "avg_upvotes", "median_upvotes", "avg_comments",
    "comment_to_upvote_ratio", "zero_engagement_share", "viral_share",
    "posts_per_week", "non_article_ratio", "author_present_share", "recency_skew",
]


# ---------------------------------------------------------------------------
# Atlas views: alternate 2D projections built from feature pairs.
# The "auto" view reuses the UMAP layout. The other four pin each axis to a
# specific feature with hi/lo human labels. We pre-compute coords at build
# time so the frontend can switch views without re-running normalization.
# ---------------------------------------------------------------------------
ATLAS_VIEWS: List[Dict] = [
    {
        "id": "auto",
        "label": "Auto-arranged (UMAP)",
        "description": (
            "Algorithmic 2D layout — similar sources cluster together. "
            "Best for discovering tribes."
        ),
        "source": "umap",
        # No fixed quadrants for the auto view — axes are post-hoc projections,
        # not orthogonal feature dimensions. The cluster colors carry the story.
        "quadrants": None,
    },
    {
        "id": "engagement_style",
        "label": "Engagement × Discussion",
        "description": (
            "How upvoted is this source, and how much discussion does it drive?"
        ),
        "source": "feature",
        "x_axis": {
            # avg_upvotes has 1,256 unique values across 1,361 sources (vs.
            # only 44 for median_upvotes — 59% tied at 0). Median is more
            # robust statistically but produces a discrete-with-massive-ties
            # axis that looks like noise on the map. Avg gives a real gradient.
            "feature": "avg_upvotes",
            "positive_label": "popular",
            "negative_label": "low-engagement",
            "log1p": True,
        },
        "y_axis": {
            "feature": "comment_to_upvote_ratio",
            "positive_label": "discussion-driving",
            "negative_label": "consumed silently",
        },
        "quadrants": {
            "top_right": {
                "title": "Hot takes",
                "description": "Wildly upvoted AND debated. The rare, controversial firehoses."
            },
            "top_left": {
                "title": "Niche debate",
                "description": "Small audience, lots of arguing — comments come thick relative to upvotes."
            },
            "bottom_right": {
                "title": "Tutorials & reference",
                "description": "Popular content people upvote and bookmark, but rarely comment on."
            },
            "bottom_left": {
                "title": "Quiet voices",
                "description": "Small reach, no traction. Undiscovered gems or genuinely inactive."
            }
        }
    },
    {
        "id": "cadence_depth",
        "label": "Volume × Depth",
        "description": "How much content does it have, and how deep is each post?",
        "source": "feature",
        "x_axis": {
            "feature": "post_count",
            "positive_label": "firehose / large archive",
            "negative_label": "small archive",
            "log1p": True,
        },
        "y_axis": {
            "feature": "avg_read_time",
            "positive_label": "deep / long-read",
            "negative_label": "skimmable",
        },
        "quadrants": {
            "top_right": {
                "title": "Heavyweight publishers",
                "description": "Massive archive of long-form content. Rare and impressive."
            },
            "top_left": {
                "title": "Personal essayists",
                "description": "Boutique writers, occasional 15-minute reads. Quality over quantity."
            },
            "bottom_right": {
                "title": "News firehoses",
                "description": "Aggregators and high-volume press. Lots of short posts. (Hacker News, TechCrunch.)"
            },
            "bottom_left": {
                "title": "Quick-bite blogs",
                "description": "Small archive of short posts — videos, Twitter-style, micro-blogs."
            }
        }
    },
    {
        "id": "hype_variety",
        "label": "Hype × Variety",
        "description": "Clickbait energy vs. how broad the topic spread is.",
        "source": "feature",
        "x_axis": {
            "feature": "hype_score",
            "positive_label": "hype-driven",
            "negative_label": "measured",
        },
        "y_axis": {
            "feature": "tag_entropy",
            "positive_label": "generalist",
            "negative_label": "niche / topic-narrow",
        },
        "quadrants": {
            "top_right": {
                "title": "Hype machines",
                "description": "Clickbait covering everything. Tabloid-style tech press."
            },
            "top_left": {
                "title": "Quality generalists",
                "description": "Broad coverage without the breathless clickbait. (HN, Lobsters, The Verge.)"
            },
            "bottom_right": {
                "title": "Single-topic hype",
                "description": "Narrow focus + clickbait energy. AI-hype YouTubers, niche evangelists."
            },
            "bottom_left": {
                "title": "Specialist craftsmen",
                "description": "Single-topic, no hype. Where most niche dev blogs and corporate eng blogs sit."
            }
        }
    },
    {
        "id": "title_style",
        "label": "Title style quadrant",
        "description": (
            "What kind of titles does this source write?"
        ),
        "source": "feature",
        "x_axis": {
            "feature": "question_ratio",
            "positive_label": "question-led",
            "negative_label": "declarative",
        },
        "y_axis": {
            "feature": "listicle_ratio",
            "positive_label": "listicle-heavy",
            "negative_label": "essay-style",
        },
        "quadrants": {
            "top_right": {
                "title": "BuzzFeed for devs",
                "description": "\"10 Things You Won't Believe About React?\" Maximum clickbait."
            },
            "top_left": {
                "title": "Listicle SEO",
                "description": "Fact-list grinders optimized for search. (geekflare, kdnuggets, wpkube.)"
            },
            "bottom_right": {
                "title": "Curious essayists",
                "description": "Open questions explored in long form. Rare and interesting."
            },
            "bottom_left": {
                "title": "Traditional articles",
                "description": "Most of the map sits here — straightforward declarative tech writing."
            }
        }
    },
]


def _compute_view_coords(
    df: pd.DataFrame,
    views: List[Dict],
) -> Dict[str, Dict[str, Tuple[float, float]]]:
    """For each feature-based view, compute per-source (x, y) in [-10, 10].

    Returns: { source_id: { view_id: (x, y) } }.

    Reads features directly from the full features DataFrame (df_all from
    preprocess), which contains both publishers AND squads — so squads get
    real coords in feature views even though they're off-grid in UMAP.

    NB: the feature-preview that ships in atlas-summary.json is intentionally
    slim (six fields). We compute view coords here from the full feature
    matrix instead of extending features_preview, keeping the wire payload
    small while still letting the frontend render any view.
    """
    out: Dict[str, Dict[str, Tuple[float, float]]] = {}

    for view in views:
        if view.get("source") != "feature":
            continue
        view_id = view["id"]
        x_axis = view.get("x_axis") or {}
        y_axis = view.get("y_axis") or {}

        def axis_values(axis: Dict) -> np.ndarray:
            feat = axis["feature"]
            if feat == "comment_to_upvote_ratio":
                # Special-case: the canonical feature uses Laplace smoothing
                # `(comments+1)/(upvotes+1)` which puts truly-dead sources
                # (0/0 → 1.0) at the top of the discussion axis, polluting it.
                # For the view, recompute as comments per upvote with a floor
                # of 1 upvote — dead sources go to 0 (bottom = consumed silently),
                # active discussion sources still rank high.
                if "avg_comments" in df.columns and "avg_upvotes" in df.columns:
                    a_c = df["avg_comments"].astype(float).to_numpy()
                    a_u = df["avg_upvotes"].astype(float).to_numpy()
                    a_c = np.where(np.isfinite(a_c), a_c, 0.0)
                    a_u = np.where(np.isfinite(a_u), a_u, 0.0)
                    vals = a_c / np.maximum(a_u, 1.0)
                else:
                    vals = df[feat].astype(float).to_numpy(copy=True)
                    vals = np.where(np.isfinite(vals), vals, 0.0)
            elif feat not in df.columns:
                # Should not happen with the canonical features parquet, but
                # fall back to zeros to keep build green.
                vals = np.zeros(len(df), dtype=float)
            else:
                vals = df[feat].astype(float).to_numpy(copy=True)
                # NaN -> 0.0 (rare; preprocess fills, but be defensive).
                vals = np.where(np.isfinite(vals), vals, 0.0)
            if axis.get("log1p"):
                # log1p safe on non-negative; clamp negatives to 0 first.
                vals = np.log1p(np.clip(vals, 0.0, None))
            return vals

        xs = axis_values(x_axis)
        ys = axis_values(y_axis)

        def scale(arr: np.ndarray) -> np.ndarray:
            """Ordinal-rank scaling to [-10, 10].

            Linear min-max scaling on skewed features crushes everyone to one
            end. Average-rank scaling fixes the skew but still produces ties
            on heavily-discrete features (median_upvotes integer values), which
            shows up as vertical stripes on the map.

            Ordinal ranks give each source a unique position, breaking ties
            by stable secondary order. Sources with the same feature value
            spread into a small band instead of stacking on a single x-stripe.
            The overall ordering still tracks the feature monotonically.
            """
            n = arr.size
            if n == 0:
                return arr.copy()
            if n == 1:
                return np.zeros_like(arr)
            # Stable sort: equal values keep their original (input) order, so
            # ties are broken deterministically and reproducibly.
            order = np.argsort(arr, kind="stable")
            ranks = np.empty(n, dtype=float)
            ranks[order] = np.arange(n, dtype=float)
            return ranks / (n - 1) * 20.0 - 10.0

        xs_s = scale(xs)
        ys_s = scale(ys)

        for i, sid in enumerate(df["source_id"].tolist()):
            sid_s = str(sid)
            slot = out.setdefault(sid_s, {})
            slot[view_id] = (
                round(float(xs_s[i]), 4),
                round(float(ys_s[i]), 4),
            )

    return out


FEATURE_METADATA_BASE = {
    "hype_score": ("Hype score",
        "Fraction of titles using hype lexicon or exclamation marks; higher = more clickbait energy.",
        "more"),
    "listicle_ratio": ("Listicle ratio",
        "Fraction of titles that start with a number (e.g. '7 things...').", "more"),
    "question_ratio": ("Question ratio", "Fraction of titles ending in '?'.", "more"),
    "avg_read_time": ("Avg read time (min)",
        "Mean read time across posts. Higher = longer-form content.", "more"),
    "summary_length_avg": ("Avg summary length",
        "Mean character length of the post summary field.", "more"),
    "title_length_avg": ("Avg title length",
        "Mean character length of titles.", "more"),
    "title_length_var": ("Title-length variance",
        "Population variance of title length. High = inconsistent style.", "more"),
    "tag_entropy": ("Tag entropy",
        "Shannon entropy of the source's tag distribution. High = generalist.", "more"),
    "tag_diversity": ("Tag diversity",
        "Unique-tag count divided by post count. High = topic spread.", "more"),
    "top_tag_share": ("Top-tag share",
        "Share of posts whose first tag equals the source's most common tag. High = topic-focused.", "more"),
    "avg_upvotes": ("Avg upvotes", "Mean number of upvotes per post.", "more"),
    "median_upvotes": ("Median upvotes",
        "Median upvotes per post (robust to viral outliers).", "more"),
    "avg_comments": ("Avg comments", "Mean number of comments per post.", "more"),
    "comment_to_upvote_ratio": ("Comment/upvote ratio",
        "(Σ comments + 1) / (Σ upvotes + 1). High = controversial/discussion-driven.", "more"),
    "zero_engagement_share": ("Zero-engagement share",
        "Fraction of posts with both 0 upvotes and 0 comments.", "less"),
    "viral_share": ("Viral share",
        "Fraction of posts with > 100 upvotes.", "more"),
    "posts_per_week": ("Posts per week",
        "Publishing cadence: posts per 7 days over the observed span.", "more"),
    "non_article_ratio": ("Non-article ratio",
        "Fraction of posts that are not type=article (videos, polls, freeform, etc.).", "more"),
    "author_present_share": ("Author present share",
        "Fraction of posts where the API exposes an author name (i.e. the source's RSS feed includes <author> metadata). High = bylined feed; low = unbylined. Measures feed metadata, NOT authorship truth — a personal blog with a stripped-down RSS still scores 0.", "more"),
    "recency_skew": ("Recency skew",
        "Posts in last 90 days / posts older. High = recently active source.", "more"),
}


def _safe_float(x):
    if x is None:
        return None
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    return v


def _build_feature_metadata(df: pd.DataFrame) -> Dict[str, Dict]:
    meta = {}
    for key in FEATURE_KEYS:
        label, desc, higher_is = FEATURE_METADATA_BASE[key]
        if key in df.columns:
            col = df[key].astype(float)
            mn = _safe_float(col.min()) or 0.0
            mx = _safe_float(col.max()) or 0.0
        else:
            mn, mx = 0.0, 0.0
        meta[key] = {
            "label": label,
            "description": desc,
            "min": round(mn, 6),
            "max": round(mx, 6),
            "higher_is": higher_is,
        }
    return meta


def _coerce_iso(val) -> str:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return ""
    s = str(val).strip()
    if not s or s.lower() == "nan":
        return ""
    return s


def _build_sources(
    df: pd.DataFrame,
    publisher_ids: List[str],
    coords: np.ndarray,
    cluster_labels: np.ndarray,
    enrich_data: Dict,
    view_coords_by_id: Dict[str, Dict[str, Tuple[float, float]]] | None = None,
) -> List[Dict]:
    coord_by_id = {sid: coords[i] for i, sid in enumerate(publisher_ids)}
    cluster_by_id = {sid: int(cluster_labels[i]) for i, sid in enumerate(publisher_ids)}

    sources: List[Dict] = []
    for _, row in df.iterrows():
        sid = row["source_id"]
        is_squad = bool(row["is_squad"])

        # Coordinates: publishers from layout, squads off-grid.
        if sid in coord_by_id:
            x = float(coord_by_id[sid][0])
            y = float(coord_by_id[sid][1])
            cluster_id = cluster_by_id[sid]
        else:
            x = float("nan")
            y = float("nan")
            cluster_id = -1  # unclustered (squads)

        features = {}
        for key in FEATURE_KEYS:
            v = _safe_float(row.get(key))
            features[key] = v if v is not None else 0.0

        # JSON-safe coordinates: NaN -> null (json strict mode would crash).
        x_out = None if not math.isfinite(x) else round(x, 4)
        y_out = None if not math.isfinite(y) else round(y, 4)

        enrich_entry = enrich_data.get(sid, {"top_tags": [], "sample_titles": {"representative": [], "outlier": []}, "recent_posts": []})

        def _opt_str(v):
            if v is None:
                return None
            if isinstance(v, float) and math.isnan(v):
                return None
            s = str(v).strip()
            if not s or s.lower() == "nan":
                return None
            return s

        # Per-view alternate coords (only feature views; "auto" uses x/y above).
        view_coords: Dict[str, List[float]] = {}
        if view_coords_by_id is not None:
            entry = view_coords_by_id.get(str(sid))
            if entry:
                for vid, (vx, vy) in entry.items():
                    view_coords[vid] = [vx, vy]

        sources.append(
            {
                "id": str(sid),
                "handle": _opt_str(row.get("handle")) or "",
                "name": _opt_str(row.get("source_name")) or _opt_str(row.get("name")) or _opt_str(row.get("handle")) or "",
                "image": _opt_str(row.get("source_image")),
                "description": _opt_str(row.get("source_description")),
                "is_squad": is_squad,
                "x": x_out,
                "y": y_out,
                "cluster_id": cluster_id,
                "posts_collected": int(row.get("post_count") or 0),
                "newest_post_at": _coerce_iso(row.get("newest_post_at")),
                "oldest_post_at": _coerce_iso(row.get("oldest_post_at")),
                "features": {k: round(v, 6) for k, v in features.items()},
                "top_tags": enrich_entry.get("top_tags", []),
                "sample_titles": enrich_entry.get("sample_titles", {"representative": [], "outlier": []}),
                "recent_posts": enrich_entry.get("recent_posts", []),
                "view_coords": view_coords,
            }
        )
    return sources


def _build_clusters(cluster_descs, centroids_2d):
    out = []
    for desc in cluster_descs:
        cid = desc["id"]
        cx = float(centroids_2d[cid][0])
        cy = float(centroids_2d[cid][1])
        out.append(
            {
                "id": cid,
                "label": desc["label"],
                "auto_label": desc["auto_label"],
                "size": desc["size"],
                "centroid": {"x": round(cx, 4), "y": round(cy, 4)},
                "color": desc["color"],
                "top_tags": desc["top_tags"],
                "distinctive_features": desc["distinctive_features"],
            }
        )
    return out


def _validate(atlas: Dict) -> List[str]:
    """Strict self-check. Returns list of error strings (empty = pass)."""
    errors: List[str] = []
    for k in ("version", "generated_at", "feature_metadata", "clusters", "sources"):
        if k not in atlas:
            errors.append(f"missing top-level key: {k}")
    for key in FEATURE_KEYS:
        if key not in atlas.get("feature_metadata", {}):
            errors.append(f"feature_metadata missing key: {key}")

    on_grid_count = 0
    cluster_size_sum = 0
    for src in atlas.get("sources", []):
        for fk in FEATURE_KEYS:
            if fk not in src.get("features", {}):
                errors.append(f"source {src.get('id')}: features missing {fk}")
        if src.get("x") is not None and src.get("y") is not None:
            on_grid_count += 1
        # NaN guard: features
        for fk, v in src.get("features", {}).items():
            if v is None or (isinstance(v, float) and not math.isfinite(v)):
                errors.append(f"source {src.get('id')} feature {fk} not finite")

    for c in atlas.get("clusters", []):
        cluster_size_sum += int(c.get("size", 0))

    # Cluster sizes should sum to all on-grid sources (publishers + squads
    # included in clustering). Some sources may legitimately be off-grid.
    if cluster_size_sum != on_grid_count:
        errors.append(
            f"cluster sizes {cluster_size_sum} != on-grid sources {on_grid_count}"
        )
    return errors


def _write_check_report(atlas: Dict, errors: List[str], path: str):
    publishers = [s for s in atlas["sources"] if not s["is_squad"]]
    squads = [s for s in atlas["sources"] if s["is_squad"]]
    lines = []
    lines.append("# Atlas self-check\n")
    lines.append(f"- generated_at: `{atlas['generated_at']}`")
    lines.append(f"- total sources: **{len(atlas['sources'])}**")
    lines.append(f"- publishers: **{len(publishers)}**")
    lines.append(f"- squads (off-grid): **{len(squads)}**")
    lines.append(f"- clusters: **{len(atlas['clusters'])}**")
    lines.append(f"- feature metadata keys: **{len(atlas['feature_metadata'])}**")
    lines.append("")
    lines.append("## Validation")
    if errors:
        lines.append(f"FAILED ({len(errors)} errors):")
        for e in errors:
            lines.append(f"- {e}")
    else:
        lines.append("PASSED - schema OK, no NaN/Inf, cluster sizes balance.")
    lines.append("")
    lines.append("## Clusters")
    lines.append("| id | size | color | label |")
    lines.append("|---:|---:|---|---|")
    for c in atlas["clusters"]:
        lines.append(f"| {c['id']} | {c['size']} | {c['color']} | {c['label']} |")
    lines.append("")
    lines.append("## Cluster top tags")
    for c in atlas["clusters"]:
        tags = ", ".join(f"{t}({n})" for t, n in c.get("top_tags", [])[:6])
        lines.append(f"- **{c['id']} ({c['label']})**: {tags or '(none)'}")
    lines.append("")
    lines.append("## Squads (excluded from clustering)")
    for s in squads:
        lines.append(f"- `{s['handle']}` — {s['name']} ({s['posts_collected']} posts)")
    with open(path, "w") as f:
        f.write("\n".join(lines))


# ---------------------------------------------------------------------------
# Split-output writers: atlas-summary.json, clusters.json, sources/<handle>.json
# ---------------------------------------------------------------------------

# Filename-safe: only [A-Za-z0-9._-]. Anything else -> "_".
_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]")


def _safe_filename(handle: str, fallback_id: str) -> str:
    """Return a filesystem-safe filename stem for a source.

    Handles can contain slashes/spaces/etc (especially squads). We strip those
    to underscores. If the result is empty or starts with a dot, fall back to
    the source id.
    """
    if not handle:
        return fallback_id
    cleaned = _SAFE_FILENAME_RE.sub("_", handle)
    cleaned = cleaned.strip("._")
    return cleaned or fallback_id


def _stats(atlas: Dict) -> Dict:
    publishers = sum(1 for s in atlas["sources"] if not s["is_squad"])
    squads = sum(1 for s in atlas["sources"] if s["is_squad"])
    on_grid = sum(1 for s in atlas["sources"] if s.get("x") is not None and s.get("y") is not None)
    return {
        "total_sources": len(atlas["sources"]),
        "publishers": publishers,
        "squads": squads,
        "on_grid": on_grid,
    }


def _slim_clusters(atlas_clusters: List[Dict]) -> List[Dict]:
    """Strip auto_label/distinctive_features that we don't need on the wire."""
    out = []
    for c in atlas_clusters:
        out.append(
            {
                "id": c["id"],
                "label": c["label"],
                "size": c["size"],
                "centroid": c["centroid"],
                "color": c["color"],
            }
        )
    return out


def _source_summary(src: Dict) -> Dict:
    feats = src.get("features", {})
    summ = {
        "id": src["id"],
        "handle": src["handle"],
        "name": src["name"],
        "is_squad": bool(src["is_squad"]),
        "x": src.get("x"),
        "y": src.get("y"),
        "cluster_id": src.get("cluster_id", -1),
        "posts_collected": src.get("posts_collected", 0),
        "image": src.get("image"),
        # The preview covers the four tooltip-essentials (hype, cadence,
        # author-present, median-upvotes) plus the two extra dials the /diet
        # page reads (avg_read_time, tag_diversity). Keeping it compact stops
        # us from shipping the full 20-feature vector for every source.
        "features_preview": {
            "posts_per_week": feats.get("posts_per_week"),
            "median_upvotes": feats.get("median_upvotes"),
            "author_present_share": feats.get("author_present_share"),
            "hype_score": feats.get("hype_score"),
            "avg_read_time": feats.get("avg_read_time"),
            "tag_diversity": feats.get("tag_diversity"),
        },
        "top_tags_preview": list(src.get("top_tags", []))[:3],
    }
    vc = src.get("view_coords")
    if vc:
        summ["view_coords"] = vc
    return summ


def _compute_neighbors(
    src: Dict,
    sources: List[Dict],
    feature_keys: List[str],
    k: int = 5,
) -> Tuple[List[str], List[str]]:
    """Return (similar_handles, opposite_handles) for src.

    Publishers (with valid x/y): 5 nearest + 5 farthest by 2D layout distance.
    Squads (off-grid): 5 nearest + 5 farthest by feature-space cosine distance,
      restricted to all sources (publishers + squads). Falls back to first 5
      squads if cosine isn't computable.
    """
    sid = src["id"]
    sx, sy = src.get("x"), src.get("y")
    on_grid = sx is not None and sy is not None

    if on_grid:
        scored = []
        for o in sources:
            if o["id"] == sid:
                continue
            ox, oy = o.get("x"), o.get("y")
            if ox is None or oy is None:
                continue
            dx = sx - ox
            dy = sy - oy
            scored.append((dx * dx + dy * dy, o["handle"]))
        scored.sort()
        nearest = [h for _, h in scored[:k]]
        farthest = [h for _, h in scored[-k:][::-1]]
        return nearest, farthest

    # Off-grid (squad). Use cosine distance on the shared feature vector.
    s_vec = np.array([float(src.get("features", {}).get(fk, 0.0)) for fk in feature_keys])
    s_norm = float(np.linalg.norm(s_vec))
    if s_norm < 1e-9:
        # Fall back: just first k other sources.
        others = [o["handle"] for o in sources if o["id"] != sid][: 2 * k]
        return others[:k], others[k : 2 * k]

    scored = []
    for o in sources:
        if o["id"] == sid:
            continue
        o_vec = np.array([float(o.get("features", {}).get(fk, 0.0)) for fk in feature_keys])
        o_norm = float(np.linalg.norm(o_vec))
        if o_norm < 1e-9:
            continue
        cos = float(np.dot(s_vec, o_vec) / (s_norm * o_norm))
        # cosine distance = 1 - cos; nearest = smallest distance.
        scored.append((1.0 - cos, o["handle"]))
    scored.sort()
    nearest = [h for _, h in scored[:k]]
    farthest = [h for _, h in scored[-k:][::-1]]
    return nearest, farthest


def write_split_outputs(atlas: Dict, public_dir: str) -> Dict[str, int]:
    """Write atlas-summary.json + clusters.json + sources/*.json.

    Returns size stats {summary_bytes, clusters_bytes, source_count, source_bytes_total}.
    """
    os.makedirs(public_dir, exist_ok=True)
    sources_dir = os.path.join(public_dir, "sources")
    os.makedirs(sources_dir, exist_ok=True)

    feature_keys = list(atlas["feature_metadata"].keys())
    slim_clusters = _slim_clusters(atlas["clusters"])
    stats = _stats(atlas)
    layout_meta = atlas.get("layout_meta")

    # Build a lookup from id/handle -> SourceSummary for resolving neighbors.
    summaries_by_handle: Dict[str, Dict] = {}
    summaries_list: List[Dict] = []
    for src in atlas["sources"]:
        summ = _source_summary(src)
        summaries_list.append(summ)
        summaries_by_handle[summ["handle"]] = summ

    # 1. atlas-summary.json
    summary_blob = {
        "version": "1",
        "generated_at": atlas["generated_at"],
        "clusters": slim_clusters,
        "layout_meta": layout_meta,
        "feature_metadata": atlas["feature_metadata"],
        "views": atlas.get("views", []),
        "sources": summaries_list,
        "stats": stats,
    }
    summary_path = os.path.join(public_dir, "atlas-summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary_blob, f, allow_nan=False, separators=(",", ":"))
    summary_bytes = os.path.getsize(summary_path)

    # 2. clusters.json
    clusters_blob = {
        "version": "1",
        "generated_at": atlas["generated_at"],
        "clusters": slim_clusters,
        "layout_meta": layout_meta,
        "feature_metadata": atlas["feature_metadata"],
        "stats": stats,
    }
    clusters_path = os.path.join(public_dir, "clusters.json")
    with open(clusters_path, "w") as f:
        json.dump(clusters_blob, f, allow_nan=False, separators=(",", ":"))
    clusters_bytes = os.path.getsize(clusters_path)

    # 3. sources/<handle>.json (one per source)
    source_count = 0
    source_bytes_total = 0
    used_filenames: Dict[str, str] = {}
    for src in atlas["sources"]:
        stem = _safe_filename(src.get("handle") or "", str(src.get("id") or ""))
        # Collision handling: if two sources collapse to the same filename, suffix with id.
        if stem in used_filenames and used_filenames[stem] != src["id"]:
            stem = f"{stem}_{src['id']}"
        used_filenames[stem] = src["id"]

        nearest, farthest = _compute_neighbors(src, atlas["sources"], feature_keys, k=5)
        # Resolve to summary objects so the source page can render SourceCards
        # without a second fetch (ref: design choice "include resolved summary").
        similar_resolved = [summaries_by_handle[h] for h in nearest if h in summaries_by_handle]
        opposite_resolved = [summaries_by_handle[h] for h in farthest if h in summaries_by_handle]

        detail = {
            "version": "1",
            "id": src["id"],
            "handle": src["handle"],
            "name": src["name"],
            "image": src.get("image"),
            "description": src.get("description"),
            "is_squad": bool(src["is_squad"]),
            "x": src.get("x"),
            "y": src.get("y"),
            "cluster_id": src.get("cluster_id", -1),
            "posts_collected": src.get("posts_collected", 0),
            "newest_post_at": src.get("newest_post_at", ""),
            "oldest_post_at": src.get("oldest_post_at", ""),
            "features": src.get("features", {}),
            "view_coords": src.get("view_coords", {}),
            "top_tags": src.get("top_tags", []),
            "sample_titles": src.get("sample_titles", {"representative": [], "outlier": []}),
            "recent_posts": src.get("recent_posts", []),
            "similar_handles": nearest,
            "opposite_handles": farthest,
            "similar": similar_resolved,
            "opposite": opposite_resolved,
        }
        path = os.path.join(sources_dir, f"{stem}.json")
        with open(path, "w") as f:
            json.dump(detail, f, allow_nan=False, separators=(",", ":"))
        source_count += 1
        source_bytes_total += os.path.getsize(path)

    return {
        "summary_bytes": summary_bytes,
        "clusters_bytes": clusters_bytes,
        "source_count": source_count,
        "source_bytes_total": source_bytes_total,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", default="features/features.parquet")
    ap.add_argument("--db", default="probe/probe.db")
    ap.add_argument("--out", default="clustering/atlas.json")
    ap.add_argument(
        "--overrides",
        default="clustering/cluster_overrides.json",
        help="optional JSON file mapping cluster_id (str) -> custom label",
    )
    ap.add_argument(
        "--meta-out",
        default="clustering/layout_meta.json",
        help="path for layout axis metadata",
    )
    ap.add_argument(
        "--check-out",
        default="clustering/atlas_check.md",
    )
    ap.add_argument("--copy-to-web", action="store_true",
        help="if web/public/ exists, also copy atlas.json there")
    args = ap.parse_args()

    print(f"[atlas] reading features: {args.features}")
    pre = preprocess(args.features, args.db)
    n_pub = len(pre.source_ids)
    n_squad = int(pre.df_all["is_squad"].sum())
    print(f"[atlas] publishers={n_pub}, squads={n_squad}, features={len(pre.feature_names)}")

    print("[atlas] running 2D layout...")
    layout = layout_2d(pre.feature_matrix, pre.feature_names)
    print(f"[atlas] layout method: {layout.method}")

    print("[atlas] clustering...")
    clu = run_cluster(pre.feature_matrix, layout.coords)
    n_clusters = int(clu.labels.max() + 1)
    print(f"[atlas] cluster method: {clu.method}, k={n_clusters}, "
          f"noise reassigned: {clu.noise_reassigned}")

    print("[atlas] enriching with top tags + sample titles...")
    title_avg_map = dict(zip(pre.df_all["source_id"], pre.df_all["title_length_avg"]))
    all_ids_for_enrich = pre.df_all["source_id"].tolist()
    enrich_data = enrich(args.db, all_ids_for_enrich, title_avg_map)

    print("[atlas] labeling clusters...")
    post_counts = dict(zip(pre.df_all["source_id"], pre.df_all["post_count"]))
    cluster_descs = label_clusters(
        labels=clu.labels,
        feature_matrix=pre.feature_matrix,
        feature_names=pre.feature_names,
        source_ids=pre.source_ids,
        enrich_data=enrich_data,
        post_counts=post_counts,
        overrides_path=args.overrides,
    )

    print("[atlas] assembling atlas.json...")
    print("[atlas] computing alternate view coords...")
    view_coords_by_id = _compute_view_coords(pre.df_all, ATLAS_VIEWS)
    atlas = {
        "version": "1",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "feature_metadata": _build_feature_metadata(pre.df_all),
        "clusters": _build_clusters(cluster_descs, clu.centroids_2d),
        "views": ATLAS_VIEWS,
        "sources": _build_sources(
            pre.df_all,
            pre.source_ids,
            layout.coords,
            clu.labels,
            enrich_data,
            view_coords_by_id=view_coords_by_id,
        ),
        "layout_meta": layout.layout_meta,
        "pipeline_meta": {
            "preprocess_features": pre.feature_names,
            "log1p_columns": [
                f for f, m in zip(pre.feature_names, pre.feature_log1p_mask) if m
            ],
            "cluster_method": clu.method,
            "noise_reassigned": clu.noise_reassigned,
            "random_state": 42,
        },
    }

    # Validation pass.
    errors = _validate(atlas)
    if errors:
        print("[atlas] VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
    else:
        print("[atlas] validation passed.")

    # Write outputs.
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as f:
        # `allow_nan=False` would raise on stray NaN; we already replaced them
        # with None upstream, so it's a useful tripwire.
        json.dump(atlas, f, indent=2, allow_nan=False)
    print(f"[atlas] wrote {args.out} ({os.path.getsize(args.out):,} bytes)")

    with open(args.meta_out, "w") as f:
        json.dump(layout.layout_meta, f, indent=2, allow_nan=False)
    print(f"[atlas] wrote {args.meta_out}")

    _write_check_report(atlas, errors, args.check_out)
    print(f"[atlas] wrote {args.check_out}")

    # Ensure overrides file exists (blank object) so users can hand-edit.
    if not os.path.exists(args.overrides):
        with open(args.overrides, "w") as f:
            json.dump({}, f, indent=2)
        print(f"[atlas] created blank overrides file: {args.overrides}")

    # Optional: write split static artifacts into web/public/ if it exists.
    # New shape: atlas-summary.json + clusters.json + sources/<handle>.json
    # (replaces the single 18 MB atlas.json that used to live there).
    if args.copy_to_web:
        web_public = os.path.join("web", "public")
        if os.path.isdir(web_public):
            stats = write_split_outputs(atlas, web_public)
            print(
                f"[atlas] split outputs: summary={stats['summary_bytes']:,}b "
                f"clusters={stats['clusters_bytes']:,}b "
                f"sources={stats['source_count']} files "
                f"({stats['source_bytes_total']:,}b total)"
            )
            # Remove the legacy giant atlas.json from web/public if present —
            # it's been superseded by the split artifacts.
            legacy = os.path.join(web_public, "atlas.json")
            if os.path.exists(legacy):
                os.remove(legacy)
                print(f"[atlas] removed legacy {legacy}")
        else:
            print("[atlas] web/public/ does not exist yet; skipping web copy.")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
