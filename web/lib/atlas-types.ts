// Source Bias Atlas — frontend/data-pipeline contract.
// The build pipeline produces THREE static artifacts under public/:
//   - atlas-summary.json  (slim per-source map data, clusters, layout, feature_metadata)
//   - clusters.json       (clusters + layout + feature_metadata + stats — for /about)
//   - sources/<handle>.json  (full per-source detail for /source/[handle] pages)

export type FeatureKey =
  | "hype_score"
  | "listicle_ratio"
  | "question_ratio"
  | "avg_read_time"
  | "summary_length_avg"
  | "title_length_avg"
  | "title_length_var"
  | "tag_entropy"
  | "tag_diversity"
  | "top_tag_share"
  | "avg_upvotes"
  | "median_upvotes"
  | "avg_comments"
  | "comment_to_upvote_ratio"
  | "zero_engagement_share"
  | "viral_share"
  | "posts_per_week"
  | "non_article_ratio"
  | "author_present_share"
  | "recency_skew";

export interface FeatureMeta {
  label: string;
  description: string;
  min: number;
  max: number;
  /** for radar polarity: does a higher value mean "more of the thing"? */
  higher_is: "more" | "less";
}

export interface Cluster {
  id: number;
  label: string;
  size: number;
  centroid: { x: number; y: number };
  color: string; // hex
}

export interface RecentPost {
  id: string;
  title: string | null;
  url: string | null;
  comments_permalink: string | null;
  summary: string | null;
  image: string | null;
  num_upvotes: number;
  num_comments: number;
  created_at: string;
}

export interface AxisMeta {
  positive: string;
  negative: string;
  top_correlated_features: [string, number][];
}

export interface LayoutMeta {
  method?: string;
  n_points?: number;
  random_state?: number;
  x_axis: AxisMeta;
  y_axis: AxisMeta;
}

export interface AtlasStats {
  total_sources: number;
  publishers: number;
  squads: number;
  on_grid: number;
}

/** A single feature axis used by an alternate atlas view. */
export interface ViewAxis {
  feature: FeatureKey;
  positive_label: string;
  negative_label: string;
  /** apply log1p before linear normalize? Use for very long-tailed features. */
  log1p?: boolean;
}

export interface QuadrantInfo {
  title: string;
  description: string;
}

export interface ViewQuadrants {
  top_right: QuadrantInfo;
  top_left: QuadrantInfo;
  bottom_right: QuadrantInfo;
  bottom_left: QuadrantInfo;
}

/** A named projection of the source space onto a 2D plane. */
export interface AtlasView {
  id: string;
  label: string;
  description: string;
  /** "auto" reuses UMAP source.x / source.y; "feature" uses view_coords[id]. */
  source: "umap" | "feature";
  x_axis?: ViewAxis;
  y_axis?: ViewAxis;
  /** Per-quadrant interpretive guide. Null for "auto" (axes are post-hoc). */
  quadrants?: ViewQuadrants | null;
}

/** Slim per-source record used by the atlas map and tooltips. */
export interface SourceSummary {
  id: string;
  handle: string;
  name: string;
  is_squad: boolean;
  x: number | null;
  y: number | null;
  cluster_id: number;
  posts_collected: number;
  image: string | null;
  features_preview: {
    posts_per_week?: number;
    median_upvotes?: number;
    author_present_share?: number;
    hype_score?: number;
    avg_read_time?: number;
    tag_diversity?: number;
  };
  top_tags_preview: [string, number][];
  /** Per-view (id -> [x, y]) for non-auto views. Missing for "auto". */
  view_coords?: Record<string, [number, number]>;
}

/** Full per-source record used by /source/[handle]. */
export interface SourceDetail {
  version: "1";
  id: string;
  handle: string;
  name: string;
  image: string | null;
  description: string | null;
  is_squad: boolean;
  x: number | null;
  y: number | null;
  cluster_id: number;
  posts_collected: number;
  newest_post_at: string;
  oldest_post_at: string;
  features: Record<FeatureKey, number>;
  top_tags: [string, number][];
  sample_titles: {
    representative: string[];
    outlier: string[];
  };
  recent_posts: RecentPost[];
  /** Top posts by engagement (num_upvotes + 5*num_comments). May be empty. */
  top_posts?: RecentPost[];
  similar_handles: string[];
  opposite_handles: string[];
  /** Pre-resolved summary data for the 5 nearest neighbors. */
  similar: SourceSummary[];
  /** Pre-resolved summary data for the 5 farthest neighbors. */
  opposite: SourceSummary[];
}

/** Top-level shape of `/atlas-summary.json`. */
export interface AtlasSummary {
  version: "1";
  generated_at: string;
  clusters: Cluster[];
  layout_meta?: LayoutMeta;
  feature_metadata: Record<FeatureKey, FeatureMeta>;
  sources: SourceSummary[];
  stats: AtlasStats;
  /** Available 2D projections. The "auto" entry uses UMAP layout. */
  views?: AtlasView[];
}

/** Top-level shape of `/clusters.json`. */
export interface ClustersIndex {
  version: "1";
  generated_at: string;
  clusters: Cluster[];
  layout_meta?: LayoutMeta;
  feature_metadata: Record<FeatureKey, FeatureMeta>;
  stats: AtlasStats;
}

// -------------------------------------------------------------------------
// Back-compat aliases for any consumers still on the old vocabulary.
// `Source` used to mean "the full record with features + tags + posts +
// coords"; it now corresponds to SourceDetail. AtlasData no longer maps to
// any single artifact (it's been split), so we keep the alias as a marker
// for legacy code paths but consumers should migrate to AtlasSummary /
// SourceDetail / ClustersIndex explicitly.
// -------------------------------------------------------------------------
export type Source = SourceDetail;
export type AtlasData = AtlasSummary;

/** Subset of features displayed on radar charts (most informative). */
export const RADAR_FEATURES: FeatureKey[] = [
  "hype_score",
  "listicle_ratio",
  "question_ratio",
  "avg_read_time",
  "tag_diversity",
  "viral_share",
  "posts_per_week",
  "comment_to_upvote_ratio",
];
