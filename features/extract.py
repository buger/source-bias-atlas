"""Source Bias Atlas — feature extraction orchestrator.

Usage:
    python features/extract.py --db probe/probe.db --out features/features.parquet

Loads posts/sources from a sqlite database (works on both probe.db and the
canonical atlas.db), computes per-source feature vectors for every source
with >= MIN_POSTS posts, and writes parquet + csv + a markdown report.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import pandas as pd

# allow `python features/extract.py` to import sibling modules
sys.path.insert(0, str(Path(__file__).resolve().parent))

from read_db import load_db  # noqa: E402
from schema import FeatureVector  # noqa: E402
from features.cadence import cadence, firehose_flag, recency_skew  # noqa: E402
from features.engagement import (  # noqa: E402
    avg_comments,
    avg_read_time,
    avg_upvotes,
    comment_to_upvote_ratio,
    median_upvotes,
    viral_share,
    zero_engagement_share,
)
from features.text import (  # noqa: E402
    summary_length_avg,
    tag_diversity,
    tag_entropy,
    top_tag_share,
)
from features.title_style import (  # noqa: E402
    hype_score,
    listicle_ratio,
    question_ratio,
    title_length_stats,
)
from features.types import (  # noqa: E402
    author_present_share,
    non_article_ratio,
    type_distribution,
)

MIN_POSTS = 10


def compute_features_for_source(source, posts) -> FeatureVector:
    """Compute the full feature vector for one source."""
    pw, span_days, unreliable = cadence(posts)
    med_up = median_upvotes(posts)
    tl_avg, tl_var = title_length_stats(posts)

    return FeatureVector(
        source_id=source.id,
        handle=source.handle,
        name=source.name,
        post_count=len(posts),
        span_days=span_days,
        # title style
        hype_score=hype_score(posts),
        listicle_ratio=listicle_ratio(posts),
        question_ratio=question_ratio(posts),
        title_length_avg=tl_avg,
        title_length_var=tl_var,
        # text
        summary_length_avg=summary_length_avg(posts),
        tag_entropy=tag_entropy(posts),
        tag_diversity=tag_diversity(posts),
        top_tag_share=top_tag_share(posts),
        # engagement
        avg_read_time=avg_read_time(posts),
        avg_upvotes=avg_upvotes(posts),
        median_upvotes=med_up,
        avg_comments=avg_comments(posts),
        comment_to_upvote_ratio=comment_to_upvote_ratio(posts),
        zero_engagement_share=zero_engagement_share(posts),
        viral_share=viral_share(posts),
        # cadence
        posts_per_week=pw,
        cadence_unreliable=unreliable,
        firehose_flag=firehose_flag(pw, med_up),
        recency_skew=recency_skew(posts),
        # types & authorship
        non_article_ratio=non_article_ratio(posts),
        author_present_share=author_present_share(posts),
        type_distribution=type_distribution(posts),
    )


def build_dataframe(db_path: str) -> tuple[pd.DataFrame, list[str]]:
    """Run the pipeline. Returns (features_df, insufficient_handles)."""
    sources, posts = load_db(db_path)
    by_source: dict[str, list] = defaultdict(list)
    for p in posts:
        by_source[p.source_id].append(p)

    sources_by_id = {s.id: s for s in sources}

    rows: list[dict] = []
    insufficient: list[str] = []

    # Iterate over source ids that actually have posts (covers cases where
    # sources table is missing entries, which can happen in probe.db).
    seen_ids = set(by_source.keys())
    for sid in seen_ids:
        ps = by_source[sid]
        src = sources_by_id.get(sid)
        if src is None:
            # Synthesize a minimal source row from the posts.
            from schema import SourceRow

            src = SourceRow(
                id=sid,
                handle=ps[0].source_handle or sid,
                name=None,
                description=None,
                image=None,
            )
        if len(ps) < MIN_POSTS:
            insufficient.append(src.handle)
            continue
        fv = compute_features_for_source(src, ps)
        rows.append(fv.to_row())

    df = pd.DataFrame(rows)
    if df.empty:
        return df, insufficient
    df = df.sort_values("handle").reset_index(drop=True)
    return df, insufficient


# ---------- report generation ----------

SCALAR_FEATURES = [
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
    "avg_upvotes",
    "median_upvotes",
    "avg_comments",
    "comment_to_upvote_ratio",
    "zero_engagement_share",
    "viral_share",
    "posts_per_week",
    "recency_skew",
    "non_article_ratio",
    "author_present_share",
]


def _ascii_hist(values: np.ndarray, bins: int = 10, width: int = 30) -> str:
    if len(values) == 0:
        return "(empty)"
    finite = values[np.isfinite(values)]
    if len(finite) == 0 or finite.min() == finite.max():
        return f"(constant = {finite[0] if len(finite) else 'NaN'})"
    counts, edges = np.histogram(finite, bins=bins)
    peak = counts.max() or 1
    out = []
    for i, c in enumerate(counts):
        bar = "#" * int(round(c / peak * width))
        out.append(f"  [{edges[i]:8.3f}, {edges[i + 1]:8.3f})  {bar} {c}")
    return "\n".join(out)


def write_report(df: pd.DataFrame, insufficient: list[str], path: Path) -> None:
    lines: list[str] = []
    lines.append("# Source Bias Atlas — Feature Report\n")
    lines.append(f"- Sources surviving `>= {MIN_POSTS}` posts: **{len(df)}**")
    lines.append(f"- Sources dropped to insufficient_data: **{len(insufficient)}**\n")

    # Variance ranking
    lines.append("## Most informative features (by normalized variance)\n")
    var_rows = []
    for col in SCALAR_FEATURES:
        if col not in df.columns:
            continue
        s = df[col].astype(float)
        if s.std(ddof=0) == 0:
            var_rows.append((col, 0.0, "constant"))
            continue
        # std after z-score is 1 by construction; use coefficient of variation
        # *and* raw std to rank. Mean-of-abs(z) is unhelpful. Use IQR-normalized
        # spread instead: (q75 - q25) / |median+eps|, falling back to plain std.
        std = float(s.std(ddof=0))
        rng = float(s.max() - s.min())
        var_rows.append((col, std, f"std={std:.3f} range={rng:.3f}"))
    var_rows.sort(key=lambda r: -r[1])
    for col, _, info in var_rows:
        lines.append(f"- `{col}` — {info}")
    lines.append("")

    # Histograms
    lines.append("## Histograms\n")
    for col in SCALAR_FEATURES:
        if col not in df.columns:
            continue
        lines.append(f"### `{col}`\n```")
        lines.append(_ascii_hist(df[col].to_numpy(dtype=float)))
        lines.append("```\n")

    # Correlation matrix
    lines.append("## Pearson correlation matrix\n")
    corr_cols = [c for c in SCALAR_FEATURES if c in df.columns and df[c].std(ddof=0) > 0]
    corr = df[corr_cols].corr(method="pearson")
    # Top redundant pairs
    pairs = []
    for i, a in enumerate(corr_cols):
        for b in corr_cols[i + 1 :]:
            r = corr.loc[a, b]
            if pd.notna(r):
                pairs.append((a, b, float(r)))
    pairs.sort(key=lambda x: -abs(x[2]))
    lines.append("Top 10 absolute correlations:\n")
    for a, b, r in pairs[:10]:
        lines.append(f"- `{a}` ↔ `{b}` : r = {r:+.3f}")
    lines.append("")
    # Compact textual matrix
    lines.append("```")
    lines.append(corr.round(2).to_string())
    lines.append("```\n")

    # Top/bottom 5 per feature
    lines.append("## Top 5 / bottom 5 per feature\n")
    for col in SCALAR_FEATURES:
        if col not in df.columns or df[col].std(ddof=0) == 0:
            continue
        lines.append(f"### `{col}`")
        top = df.nlargest(5, col)[["handle", col]]
        bot = df.nsmallest(5, col)[["handle", col]]
        lines.append("Top:")
        for _, r in top.iterrows():
            lines.append(f"  - {r['handle']}: {r[col]:.4f}")
        lines.append("Bottom:")
        for _, r in bot.iterrows():
            lines.append(f"  - {r['handle']}: {r[col]:.4f}")
        lines.append("")

    # Outliers — sources extreme on >= 3 features
    lines.append("## Multi-dimensional outliers\n")
    z = df[corr_cols].apply(lambda s: (s - s.mean()) / (s.std(ddof=0) or 1.0))
    extreme_count = (z.abs() > 2.0).sum(axis=1)
    df2 = df.assign(_extreme=extreme_count).sort_values("_extreme", ascending=False)
    weird = df2[df2["_extreme"] >= 3][["handle", "_extreme"]].head(10)
    if weird.empty:
        lines.append("(none with ≥3 extreme dimensions)")
    else:
        for _, r in weird.iterrows():
            lines.append(f"- {r['handle']}: extreme on {int(r['_extreme'])} features")
    lines.append("")

    # Insufficient-data list
    lines.append("## Sources dropped (< 10 posts)\n")
    if insufficient:
        lines.append(", ".join(sorted(insufficient)))
    else:
        lines.append("(none)")
    lines.append("")

    path.write_text("\n".join(lines), encoding="utf-8")


# ---------- main ----------


def main() -> int:
    parser = argparse.ArgumentParser(description="Source Bias Atlas feature extractor")
    parser.add_argument("--db", required=True, help="Path to sqlite DB (probe.db or atlas.db)")
    parser.add_argument(
        "--out",
        default=str(Path(__file__).resolve().parent / "features.parquet"),
        help="Output parquet path",
    )
    args = parser.parse_args()

    out_path = Path(args.out).resolve()
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[features] loading {args.db}", file=sys.stderr)
    df, insufficient = build_dataframe(args.db)
    if df.empty:
        print("[features] no sources with >= MIN_POSTS posts; nothing to write", file=sys.stderr)
        return 1

    print(
        f"[features] computed {len(df)} feature vectors "
        f"({len(insufficient)} sources dropped)",
        file=sys.stderr,
    )

    df.to_parquet(out_path, index=False)
    csv_path = out_path.with_suffix(".csv")
    df.to_csv(csv_path, index=False)

    # Insufficient list as a sidecar.
    (out_dir / "insufficient_data.json").write_text(
        json.dumps(sorted(insufficient), indent=2), encoding="utf-8"
    )

    write_report(df, insufficient, out_dir / "features_report.md")

    print(f"[features] wrote {out_path}", file=sys.stderr)
    print(f"[features] wrote {csv_path}", file=sys.stderr)
    print(f"[features] wrote {out_dir / 'features_report.md'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
