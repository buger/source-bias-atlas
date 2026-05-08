# Source Bias Atlas

An interactive cluster map of [daily.dev](https://daily.dev) content sources, grouped by stylistic personality (hype vs. depth, generalist vs. niche, cadence, etc.). Pan, zoom, search, swap views, drill into a source, compare two sources side-by-side, or build a "reading diet" by tuning sliders.

**Live:** https://buger.github.io/source-bias-atlas/

Sibling project: **[Source Originality Score](https://buger.github.io/source-originality-score/)** — who breaks each story first.

## What's inside

```
crawler/      # daily.dev source + post crawler (Python, DuckDB)
features/     # per-source feature extraction
clustering/   # UMAP + KMeans + per-feature views
probe/        # API exploration scripts (kept for reproducibility)
web/          # Next.js 14 app (the static site)
```

The `web/public/` directory holds the committed artifacts that the site reads at build time:

- `atlas-summary.json` — map view + per-source summaries
- `clusters.json` — cluster metadata (labels, colors)
- `sources/<handle>.json` — full per-source detail (~1,360 files)

## Deploy

Push to `main`. The GitHub Actions workflow at `.github/workflows/deploy.yml` builds with `next export` and publishes `web/out/` to GitHub Pages.

## Run locally

```bash
cd web
pnpm install
pnpm dev    # http://localhost:3000
```

## Rebuild data

```bash
# 1. crawl daily.dev for sources + recent posts
DAILYDEV_TOKEN=… python crawler/run.py

# 2. extract features per source
python features/build.py

# 3. cluster + lay out
python clustering/run.py

# 4. dump JSON artifacts into web/public/
python clustering/export_web.py
```

## Caveats

- Feature definitions are deliberate but not authoritative — "hype" is a synthetic score, not a moral judgment.
- The atlas is a snapshot in time; daily.dev posts churn.
- Tags come straight from daily.dev; we don't normalize.

## License

MIT — see `LICENSE`.
