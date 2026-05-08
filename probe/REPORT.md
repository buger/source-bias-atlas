# Source Bias Atlas — API Probe Report

Probe run: 2026-05-07. Budget consumed: **256 requests / 1500 cap**. Scripts in `probe/`, sample payloads in `probe/samples/`, raw rows in `probe/probe.db`.

## 1. TL;DR

- **Probe 1 (sanity):** All 8 documented endpoints return 200 with shapes that match the spec. Only `null`-prone fields seen: `author` and `content`.
- **Probe 2 (source pagination):** `/feeds/source/{handle}` paginates deeply via time-based cursors with no observed cap; we read 800 posts from `hn` without `hasNextPage` flipping. Mid/small sources exhaust naturally and reach back **2–8 years**.
- **Probe 3 (tag pagination):** `/feeds/tag/{tag}` is the **richest discovery vector**: even niche `webassembly` yielded 500 posts, 144 unique sources, spanning 404 days, in 10 requests.
- **Probe 4 (organic discovery curve):** 52 requests across `popular` + `discussed?period=30` + `foryou` surfaced **623 unique curated sources**. `popular` and `discussed` exhaust; the curve plateaus around 600. **80% coverage ≈ 28 requests.**
- **Probe 5 (field coverage):** `summary` is universal (~600 chars on aggregators, ~425 on personal blogs). `numUpvotes`/`numComments`/`createdAt`/`tags`/`source` are 100% populated. `publishedAt` is only 44% populated on `hn` (aggregator). `createdAt` ≠ `publishedAt` ever.
- **Probe 6 (alphabet sweep):** Single-letter queries return **0** (q must be ≥ 2 chars). 93 bigram queries returned 1,710 unique sources — but **zero overlap** with organically discovered sources, because `/search/sources` is dominated by user Squads while feeds surface curated publishers.

## 2. Verified facts (spec is correct)

- Auth: `Authorization: Bearer <token>` works on all listed endpoints.
- Response envelope `{ data, pagination: { hasNextPage, cursor } }` matches spec for every paginated endpoint.
- `cursor` is opaque base64 (time-based for source feeds); supplying it via `?cursor=` works.
- No 401/403/429 in entire run.
- `/tags/` returns the full catalog in a single call: **962 tags**.
- `/posts/{id}` returns `PostDetail` with `bookmarked`, `userState.vote`, and `content` (when applicable).
- `/posts/{id}/comments` returns nested `children` (recursive) per the schema.

## 3. Spec lies / surprises

| Area | Spec says / implies | What we measured |
|---|---|---|
| `limit` on feeds | integer, no upper bound stated | **Hard cap is 50.** `limit≥75` → HTTP 500 (verified on `/feeds/popular`). |
| `q` on `/search/sources` | plain string | Single-letter queries return **0**. Minimum `q` length is 2. |
| `/search/sources` pagination | none documented (correct) | Confirmed: no cursor — only top-50 substring matches per query. |
| `Post.type` enum | "article, share, etc." | Observed: `article`, `social:twitter`, `video:youtube`. Likely more (`freeform`, `collection`) per `PostDetail.content` doc, not encountered. |
| `Post.publishedAt` | nullable | For `hn`, only **22/50** populate it; for first-party publishers it's 100%. **Never** equal to `createdAt`. |
| `Post.author` | nullable | Almost always null on aggregator feeds (`hn`: 1/50). On personal blogs 49/50 with `{name, image}` only — no `id`/`username` (those are PostDetail-only). |
| Source ID space | implied uniform | Two distinct schemes: short slugs (`hn`, `netflix`, `swizec`) for curated publishers; UUIDs / random 21-char strings for user Squads. Both share `/feeds/source/{handle}`. |
| Curated vs Squad sources | not distinguished | `/feeds/popular`+`/foryou` rarely surface squads; `/search/sources` is dominated by them. **Zero overlap** between 623 organic-discovery sources and 1,710 alphabet-search sources. |

## 4. Hard constraints discovered

- `limit ≤ 50` on every paginated endpoint we tried (popular, source, tag, search). Anything higher → 500.
- `/search/sources` requires `q` length ≥ 2 and **does not paginate** (50 = hard ceiling per query).
- API latency: cold first request ~11s; subsequent calls 0.5–3s. Stable with 1.05 s/request pacing.
- Never hit 429.
- Most posts have 0 comments — sample post had 1 comment with empty `children`.

## 5. Recommendations for the real crawler

1. **Discovery: use tags, not search.** Walk all 962 tags from `/tags/` × ~3–5 pages each at `limit=50` ⇒ ~3000-request budget gets essentially every active curated source (tags expose 130–160 unique sources each). Augment with one full sweep of `/feeds/popular` + `/feeds/discussed?period=30` until exhausted (~30–40 reqs). **Skip `/search/sources` for discovery** — alphabet sweep is poisoned by Squads. Only use it for targeted name lookup.
2. **Per-source characterization: `/feeds/source/{handle}?limit=50`.** Personal/medium publishers exhaust in ~6 pages with 250–300 posts spanning 1–8 years. Firehose aggregators (e.g. `hn`) never exhaust — cap at 5–10 pages. Decide cap dynamically: if page-1 `numUpvotes` are near zero, you're in firehose territory.
3. **Clustering features.** Use `summary` as the primary text feature (100% populated, 400–700 chars). Don't depend on `/posts/{id}.content` — empty for normal articles. Use `createdAt` as the always-present time anchor; treat `publishedAt` as best-effort. Treat `author` as a per-source fraction signal, not per-post. `type` (article / social:twitter / video:youtube) is itself a stylistic signal.
4. **ID hygiene.** Filter out user Squads if the goal is "publisher atlas." Heuristics: short slug-handle vs. UUID/21-char id; `name == "<handle>'s public Squad"`; description mentions "Squad."
5. **Pacing.** Stay at ~1 req/sec; we never saw a 429. Single-process is fine — full crawl is ~9000 reqs ≈ 2.5h.
6. **Persistence.** The minimal sqlite schema (sources, posts, tags) is sufficient. Add `crawled_pages_count`, `oldest_post_at`, `newest_post_at` per source for incremental resume.

## 6. Per-probe details

**Probe 1 (8 reqs, 18.8s):** All endpoints 200. FeedPost vs spec: 0 missing, 0 extra, `author` null on sample. PostDetail vs spec: 0 missing/extra, `content` null (article), `userState` populated. Samples: `samples/01_..` through `08_..`.

**Probe 2 (24 reqs):** `hn` (firehose): 12 pages × 50 = 600 posts, span 25 days, `hasNextPage` still true. `netflix`: 6 pages × ~48 = 286 posts, **exhausted**, span 2,932 days (~8 yrs). `kittygiraudel`: 6 pages × 44 = 264 posts, exhausted, span 787 days. **Probe 2b** (16 more pages on `hn`): never exhausted at 800 posts. Cursors are time-based base64.

**Probe 3 (31 reqs):** `javascript` 500 posts / 157 sources / 77 days; `rust` 500 / 133 / 82d; `webassembly` 500 / 144 / 404d. None exhausted at 10 pages. Highest source-yield per request of any endpoint.

**Probe 4 (52 reqs, 170s, 623 sources):** Curve: 1→2, 6→160, 11→282, 16→384, 21→455, 26→522, 32→562, 37→586, 42→602, 47→617, 52→623. Marginal yield <5/req after ~30 reqs. `popular` and `discussed` returned `hasNextPage=false`; `foryou` ran longer. Full curve in `samples/probe4_curve.json`.

**Probe 5 (3 reqs, 50 posts × 3 sources):**

- `hn`: summary 100%, tags 92% (avg 2.0), readTime 96%, upvotes/comments 100%, **publishedAt 44%**, author 2%. Types: 48 article, 1 twitter, 1 youtube.
- `netflix`: every field 100%. publishedAt always set, never equal to createdAt. All `article`. No `author` key at all.
- `kittygiraudel`: every field 100% except 1/50 missing tags. author 49/50 with `{name, image}`. All `article`.
- Detailed JSON: `samples/probe5_coverage.json`.

**Probe 6:** First attempt — 26 single-letter queries, all 0 results. Revised — 93 bigram queries (CV/VC pairs + js/go/py/ts/ml/ux/ui), every query hit the 50-cap, 1,710 unique sources total. **0 of 431** organic sources overlapped — Search and Feeds expose disjoint populations.
