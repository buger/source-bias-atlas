# Source Bias Atlas — Crawler

Production crawler for daily.dev's content sources. Builds `crawler/atlas.db`
from scratch (does not touch `probe/probe.db`). Designed against the findings
in `../probe/REPORT.md`.

## Run

```bash
cd /Users/leonidbugaev/go/src/dailydev_hackaton/source-bias-atlas

# Full run (Phase A then Phase B). Resumable — safe to Ctrl-C and restart.
.venv/bin/python -m crawler.run

# Health summary
.venv/bin/python -m crawler.run --status

# Run only Phase A (discovery) or Phase B (characterization)
.venv/bin/python -m crawler.run --phase a
.venv/bin/python -m crawler.run --phase b

# Generate RUN_REPORT.md from current DB state
.venv/bin/python -m crawler.run --report
```

## Phases

**Phase A — Discovery.** Walks `/tags/` (962 tags), paginates each tag feed
3 pages deep, and exhausts `/feeds/popular` and `/feeds/discussed?period=30`.
Records every source seen with an `is_squad` heuristic flag. Posts collected
during discovery are persisted (count toward characterization).

**Phase B — Per-source.** For every non-Squad source not yet characterized,
paginates `/feeds/source/{handle}?limit=50` until: `hasNextPage=false`, OR
200 posts collected (10 pages), OR firehose detected (page ≥6 with median
upvotes < 1).

## Output schema

See `schema.sql`. Tables: `tags`, `sources`, `posts`, `crawl_runs`,
`tag_progress`, `feed_progress`. Posts include the full `raw_json` blob for
forensic review.

## Operational notes

- **Rate limit:** 1.05 s/req via `probe.common.Client`. The probe never hit 429.
- **Budget:** hard cap 9,000 requests (in `client.py:BUDGET_CAP`). Stops cleanly.
- **Idempotent:** `INSERT OR IGNORE` on stable IDs. Reruns add only new data.
- **Resumable:** `tag_progress` and `feed_progress` track per-tag/per-feed state;
  Phase B skips sources where `last_crawled_at` is already set.
- **Crash-safe:** commits to sqlite every page.
- **Squad filter:** in `squad_filter.py`. Sources are flagged, never deleted.

## Expected output

Per acceptance criteria after a full run:
- ≥ 1,500 unique non-Squad sources
- ≥ 200,000 posts
- Most non-firehose sources flagged `is_exhausted = 1`
- `progress.log` and `crawl_runs` populated
