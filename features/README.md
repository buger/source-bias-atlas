# Source Bias Atlas — Feature extraction (M2)

Per-source stylistic feature vectors, computed deterministically from the cached
sqlite database. Output feeds the M3 clustering / 2-D atlas step.

## Run

```bash
# from the source-bias-atlas/ root
python features/extract.py --db probe/probe.db --out features/features.parquet
```

Outputs (all written to `features/`):

- `features.parquet` — one row per source with ≥10 posts, all features as columns.
- `features.csv` — same data for eyeballing.
- `insufficient_data.json` — sorted list of source handles with <10 posts (dropped).
- `features_report.md` — auto-generated histograms, correlation matrix, top/bottom-5 per feature, multi-dim outliers.

The extractor is parameterized purely by `--db`, so when the crawler agent finishes its full crawl, you can repoint at `crawler/atlas.db` with no code changes:

```bash
python features/extract.py --db crawler/atlas.db --out features/features.parquet
```

`read_db.py` handles minor schema drift between the two DBs (e.g. `tags` vs `tags_json`, presence/absence of `source_handle`).

## Layout

```
features/
  README.md           (this file)
  schema.py           dataclasses: PostRow, SourceRow, FeatureVector
  read_db.py          loads + normalizes posts/sources from sqlite
  extract.py          orchestrator + CLI + report writer
  features/           one module per feature family
    title_style.py    hype, listicle, question, length stats
    text.py           summary length, tag entropy/diversity/top-tag share
    engagement.py     upvotes, comments, ratios, viral, zero
    cadence.py        posts/week, firehose flag, recency skew
    types.py          type distribution, non-article ratio, authorship
  features.parquet    output
  features.csv        output
  features_report.md  output
```

No LLM calls. No network. No randomness. No time-of-day-dependent logic
(`recency_skew` uses `max(post_time)` as its reference, not wall-clock).

## Filter

Sources are included iff they have ≥10 posts in the DB. Smaller sources are
recorded in `insufficient_data.json` and excluded. On `probe/probe.db` this
yields **69 sources** out of 757 with any posts.

## Feature dictionary

All scalar features are float, fully populated (no NaN). They are emitted in raw
units; clustering should z-score them downstream (we explicitly do **not**
z-score in `extract.py` so that the parquet remains interpretable).

### Title style (`features/title_style.py`)

| Feature | Definition |
|---|---|
| `hype_score` | `(titles_matching_hype_terms + titles_with_!) / (2 × n_titles)`. Hype lexicon: `revolutionary, game-changing, mind-blowing, you won't believe, the only, everyone is, must-know, secret, crushing, dominating, shocking, insane, essential, ultimate, dies, killed, is dead`. Matched whole-word, case-insensitive. |
| `listicle_ratio` | Fraction of titles matching `^\d+\s+\S` ("7 things…"). |
| `question_ratio` | Fraction of titles ending in `?`. |
| `title_length_avg` | Mean character length of titles. |
| `title_length_var` | Population variance of title length. High = inconsistent style. |

### Text (`features/text.py`)

| Feature | Definition |
|---|---|
| `summary_length_avg` | Mean character length of `summary`. |
| `tag_entropy` | Shannon entropy (nats) of the tag distribution across the source's posts. High = generalist. |
| `tag_diversity` | `unique_tags / post_count`. |
| `top_tag_share` | Fraction of posts whose first tag equals the source's most common tag. |

### Engagement (`features/engagement.py`)

| Feature | Definition |
|---|---|
| `avg_read_time` | Mean of `read_time` over posts where it's set. |
| `avg_upvotes` | Mean of `num_upvotes`. |
| `median_upvotes` | Median of `num_upvotes` (robust to viral outliers). |
| `avg_comments` | Mean of `num_comments`. |
| `comment_to_upvote_ratio` | `(Σ comments + 1) / (Σ upvotes + 1)`. High = controversial / discussion-driving. |
| `zero_engagement_share` | Fraction with `upvotes == 0 AND comments == 0`. |
| `viral_share` | Fraction with `upvotes > 100`. Threshold chosen as a 1-in-N heuristic for daily.dev's typical distribution; documented in `engagement.py:VIRAL_UPVOTE_THRESHOLD`. |

### Cadence (`features/cadence.py`)

| Feature | Definition |
|---|---|
| `span_days` | `max(post_time) − min(post_time)` in days. |
| `posts_per_week` | `post_count / span_days × 7`. |
| `cadence_unreliable` | True iff `span_days < 7`. |
| `firehose_flag` | True iff `posts_per_week > 20 AND median_upvotes < 5`. (Probe data caps `hn` at 975 posts so the live `posts_per_week` is suppressed; this will trip on the full atlas.) |
| `recency_skew` | `posts_in_last_90d / posts_older`, using `max(post_time)` as the reference (deterministic). All-recent sources saturate at `recent_count`. |

### Types & authorship (`features/types.py`)

| Feature | Definition |
|---|---|
| `type_<known>` | Fraction of posts of each known type: `article, social:twitter, video:youtube, share, freeform, collection, poll`. Colon → underscore in column names. |
| `type_unknown` | Fraction outside the known set (only emitted when nonzero). |
| `non_article_ratio` | `1 − fraction(type == "article")`. |
| `author_present_share` | Fraction with non-null `author_name`. |

## Findings on `probe/probe.db`

Pulled from the auto-generated `features_report.md`:

- 69 sources surviving, 688 dropped to `insufficient_data`.
- No degenerate (constant) features.
- No NaNs anywhere in the output.
- Heavily redundant pairs (r > 0.7): `avg_comments ↔ viral_share`, `avg_upvotes ↔ viral_share`, `avg_upvotes ↔ median_upvotes`, `avg_upvotes ↔ avg_comments`, `median_upvotes ↔ avg_comments`, `median_upvotes ↔ viral_share`. Engagement features are essentially one latent dimension; M3 should pick **one** of `{avg_upvotes, median_upvotes, viral_share, avg_comments}` and keep `comment_to_upvote_ratio` and `zero_engagement_share` as orthogonal signals.
- Highest-spread (after q90-q10 / range normalization, less sensitive to outliers than raw std): `non_article_ratio`, `zero_engagement_share`, `top_tag_share`, `tag_diversity`, `summary_length_avg`. These four carry most of the source-to-source signal.
- Spot-check sanity: `kittygiraudel` author_present=0.73 (mostly authored personal blog), `netflix` author=0 / non_article=0 / span≈8yr (corporate blog), `hn` author=0 / non_article=0.016 / summary=647c (firehose with full summaries).

## v2 hooks (deferred)

Schema is structured so adding LLM tone classification, embedding-based topic
vectors, or cross-source originality just means adding new modules to
`features/` and wiring them through `compute_features_for_source`. Nothing
about the parquet schema needs to change — pandas is happy to add columns.
