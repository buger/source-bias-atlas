# Source Bias Atlas — Web

A static, no-auth, interactive map of daily.dev's content sources clustered by stylistic personality.

Built with Next.js 14 App Router, TypeScript, Tailwind, deck.gl (atlas), and recharts (radar/bars).

## Quick start

```bash
pnpm install
pnpm generate-mock     # writes public/atlas.json (only needed if missing)
pnpm dev               # http://localhost:3000
```

For a production build:

```bash
pnpm build
pnpm start
```

## Pages

- `/` — the atlas (deck.gl scatterplot + cluster legend, search, squad toggle)
- `/source/[handle]` — per-source detail (radar, top tags, sample titles, similar/opposite)
- `/compare?a=&b=` — two-source overlay radar + per-feature bars
- `/diet` — sliders that highlight matching sources on the atlas

## Data contract

The single source of truth is [`lib/atlas-types.ts`](./lib/atlas-types.ts). The app reads `public/atlas.json` at runtime; no API routes, no DB.

### Swap in real data

Replace `public/atlas.json` with a file that conforms to the `AtlasData` interface. That's it — no rebuild needed in dev mode (the file is fetched at runtime). For production, redeploy after replacing the file.

### Regenerate mock data

```bash
pnpm generate-mock
# or:
node scripts/generate-mock-atlas.mjs
```

Edit `scripts/generate-mock-atlas.mjs` to change cluster personalities, source counts, etc. The PRNG is seeded so output is deterministic.

## Deploy to Vercel

From this directory:

```bash
vercel --prod
```

> **Do NOT** put `DAILYDEV_TOKEN` (or any other API credentials) in Vercel env vars. This app is a static site — it never calls the daily.dev API at runtime. All data is baked into `public/atlas.json` at build time. Tokens belong in the crawler's environment, not the web's.

## Project structure

```
web/
  app/                     # App Router pages
    page.tsx               # / atlas
    source/[handle]/       # /source/[handle]
    compare/               # /compare?a=&b=
    diet/                  # /diet
    layout.tsx
    globals.css
  components/              # AtlasMap, Radar, Bar, Legend, Search, etc.
  lib/
    atlas-types.ts         # THE CONTRACT
    atlas-data.ts          # client-side loader + cache
    similarity.ts          # nearest/farthest in (x,y)
    formatting.ts          # number/date helpers
  public/
    atlas.json             # mock for now; replaced by pipeline later
  scripts/
    generate-mock-atlas.mjs
```

## Notes

- Visualization: deck.gl ScatterplotLayer with OrthographicView (no map tiles, just (x,y) embedding space).
- Color palette: dark theme; per-cluster accent colors, accessible-contrast text on dark backgrounds.
- Mobile (<640px): atlas still renders, but a "best viewed on desktop" banner appears and the sidebar is hidden.
- The radar normalizes each feature against its declared `[min,max]` from `feature_metadata`. Features marked `higher_is: "less"` (e.g. `top_tag_share`, `zero_engagement_share`) are inverted on the radar so larger area visually means "more of the personality dimension".
- Cluster colors come from `clusters[].color` in the data. The mock generator ships a high-contrast palette.

## Acceptance checks

- `pnpm install && pnpm build` succeeds with zero TS errors.
- `pnpm dev` runs on port 3000.
- All four routes render against the mock data.
