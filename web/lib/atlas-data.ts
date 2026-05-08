// Loaders for the split atlas artifacts.
//
// Three artifacts under public/:
//   - /atlas-summary.json  : map view + tooltip data (~570 KB)
//   - /clusters.json       : just clusters/layout/feature_metadata (~5 KB)
//   - /sources/<handle>.json : full per-source detail (5-30 KB each)
//
// Client-side loaders use fetch() with cache: "no-store" (we learned
// force-cache is a footgun on Vercel). Each loader memoizes its promise so
// repeat calls within a session don't re-fetch.
//
// The per-handle SourceDetail loader memoizes per handle (avoid loading
// every source's JSON into memory).

import type {
  AtlasSummary,
  ClustersIndex,
  Cluster,
  SourceDetail,
  SourceSummary,
} from "./atlas-types";

let summaryCache: Promise<AtlasSummary> | null = null;
let clustersCache: Promise<ClustersIndex> | null = null;
const sourceCache = new Map<string, Promise<SourceDetail>>();

// In production we deploy under /<repo-name>/ on GitHub Pages, so all fetches
// of static JSON have to be prefixed. NEXT_PUBLIC_BASE_PATH is inlined at
// build time by Next; locally it's empty so /atlas-summary.json works.
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

/** Filename-safe encoding of a handle for the static /sources/{handle}.json file. */
export function handleToFilename(handle: string): string {
  // Match the python writer (re.sub(r"[^A-Za-z0-9._-]", "_", handle)).
  return handle.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[._]+|[._]+$/g, "");
}

export function loadSummary(): Promise<AtlasSummary> {
  if (summaryCache) return summaryCache;
  summaryCache = fetch(`${BASE_PATH}/atlas-summary.json`, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch /atlas-summary.json: ${r.status}`);
      return r.json() as Promise<AtlasSummary>;
    })
    .catch((err) => {
      summaryCache = null;
      throw err;
    });
  return summaryCache;
}

export function loadClusters(): Promise<ClustersIndex> {
  if (clustersCache) return clustersCache;
  clustersCache = fetch(`${BASE_PATH}/clusters.json`, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch /clusters.json: ${r.status}`);
      return r.json() as Promise<ClustersIndex>;
    })
    .catch((err) => {
      clustersCache = null;
      throw err;
    });
  return clustersCache;
}

export function loadSource(handle: string): Promise<SourceDetail> {
  const key = handleToFilename(handle);
  const cached = sourceCache.get(key);
  if (cached) return cached;
  const p = fetch(`${BASE_PATH}/sources/${encodeURIComponent(key)}.json`, { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch /sources/${key}.json: ${r.status}`);
      return r.json() as Promise<SourceDetail>;
    })
    .catch((err) => {
      sourceCache.delete(key);
      throw err;
    });
  sourceCache.set(key, p);
  return p;
}

/** Look up a SourceSummary by handle. */
export function findSourceByHandle(
  data: AtlasSummary,
  handle: string
): SourceSummary | undefined {
  return data.sources.find((s) => s.handle === handle);
}

export function clusterById(
  data: { clusters: Cluster[] },
  id: number
): Cluster | undefined {
  return data.clusters.find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Legacy alias: some older code paths called loadAtlas(). Keep it pointing at
// the slim summary so anything not yet migrated still gets a working object.
// New code should call loadSummary() directly.
// ---------------------------------------------------------------------------
export const loadAtlas = loadSummary;
