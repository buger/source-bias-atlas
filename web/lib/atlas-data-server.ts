// Server-side loaders for atlas artifacts. Used by server components and
// generateStaticParams() to read static JSON from disk at build time.
//
// Importing this module from a client component will fail (it pulls in fs).
// Use `web/lib/atlas-data.ts` for client-side fetches.

// NB: this module reads the filesystem; only import from server components,
// generateStaticParams, or route handlers. Client components must use
// `atlas-data.ts` instead.
import fs from "node:fs/promises";
import path from "node:path";
import type { AtlasSummary, ClustersIndex, SourceDetail } from "./atlas-types";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Match the python writer's filename rule. */
export function handleToFilename(handle: string): string {
  return handle.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[._]+|[._]+$/g, "");
}

export async function readSummary(): Promise<AtlasSummary> {
  const buf = await fs.readFile(path.join(PUBLIC_DIR, "atlas-summary.json"), "utf8");
  return JSON.parse(buf) as AtlasSummary;
}

export async function readClusters(): Promise<ClustersIndex> {
  const buf = await fs.readFile(path.join(PUBLIC_DIR, "clusters.json"), "utf8");
  return JSON.parse(buf) as ClustersIndex;
}

export async function readSourceByHandle(handle: string): Promise<SourceDetail | null> {
  const filename = handleToFilename(handle);
  try {
    const buf = await fs.readFile(
      path.join(PUBLIC_DIR, "sources", `${filename}.json`),
      "utf8"
    );
    return JSON.parse(buf) as SourceDetail;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
