# Source Bias Atlas - clustering & atlas.json (M3)

Bridge between feature extraction (M2) and the frontend (M4). Reads the parquet
that M2 produced, clusters publishers in feature space, lays them out in 2D,
attaches per-source enrichment, and emits the canonical `atlas.json` that M4
loads.

## Run

From the `source-bias-atlas/` root:

```bash
# Probe data (current default - 64 publishers + 5 squads):
.venv/bin/python -m clustering.build_atlas \
    --features features/features.parquet \
    --db probe/probe.db \
    --out clustering/atlas.json

# After the crawler finishes - re-run M2 against atlas.db, then:
.venv/bin/python -m clustering.build_atlas \
    --features features/features_atlas.parquet \
    --db crawler/atlas.db \
    --out clustering/atlas.json

# Optional: also write into web/public/ for the frontend:
.venv/bin/python -m clustering.build_atlas ... --copy-to-web
```

The pipeline is deterministic (`random_state=42`). Re-running with the same
inputs yields byte-identical outputs.

## Outputs

| File | Description |
|---|---|
| `clustering/atlas.json` | Canonical M4 contract artifact. ~150 KB on probe data. |
| `clustering/layout_meta.json` | Axis interpretation (top-correlated features per axis). |
| `clustering/atlas_check.md` | Validation summary + cluster table + per-cluster top tags. |
| `clustering/cluster_overrides.json` | User-editable map `{"<cluster_id>": "Custom label"}`. Empty by default; consulted on every run. |

## Pipeline

```
preprocess.py   drop redundant features, log1p skewed cols, z-score, weight
                high-signal 0-1 features 1.5x. Squads excluded from matrix.
layout.py       UMAP -> 2D (PCA fallback if n < 30). Coords normalized to
                ~[-10, 10]. Axis labels derived from feature correlations.
cluster.py      HDBSCAN on the SCALED feature matrix. Falls back to KMeans
                (silhouette-picked from k in {4..9}) if HDBSCAN finds too
                much noise, only one valid cluster, or one cluster with
                >70% of points. HDBSCAN noise is reassigned to nearest
                cluster by 2D position.
label.py        Auto-label = top tags + most distinctive features (largest
                |z-score deviation|). Feature -> adjective lookup table.
                Honors clustering/cluster_overrides.json for manual labels.
enrich.py       Per-source top tags (from tags JSON), 3 representative
                titles (most-upvoted), 1 outlier title (rarest type, or
                farthest-from-mean length).
build_atlas.py  Orchestrator. Validates schema, writes atlas.json + meta.
```

## Manual cluster labels

After a run, look at `clustering/atlas_check.md`. If an auto-label feels off,
edit `clustering/cluster_overrides.json`:

```json
{
  "0": "Web/JS tutorials - high cadence, listicle-heavy",
  "3": "Aggregator firehoses - high volume, low engagement"
}
```

Keys are stringified cluster ids (`"0"`, `"1"`, ...). Re-run `build_atlas` and
your labels appear in the next `atlas.json` while `auto_label` is preserved
alongside for reference.

## Schema (M4 contract)

```typescript
interface AtlasData {
  version: "1";
  generated_at: string;            // ISO8601 UTC
  feature_metadata: Record<FeatureKey, FeatureMeta>;
  clusters: Cluster[];
  sources: Source[];
  // extras (not strictly part of the contract; ok to ignore in M4):
  layout_meta: { x_axis: AxisMeta, y_axis: AxisMeta, ... };
  pipeline_meta: { ... };
}
```

`FeatureKey` is the full 20-feature set defined by M2; every source emits a
value for every key (raw, not z-scored). Squads are included with
`is_squad: true`, `x: null`, `y: null`, `cluster_id: -1` so the frontend can
choose to hide them.

## Constraints

- No network. No API calls. Pure offline computation.
- All randomness seeded (`random_state=42`).
- `--db` and `--features` are the only knobs needed to swap probe -> full atlas.
- Reads (read-only): `features/features.parquet`, `probe/probe.db`,
  `crawler/atlas.db`.
- Writes only into `clustering/`. With `--copy-to-web`, also writes
  `web/public/atlas.json` (idempotent overwrite of the M4-side stub).
