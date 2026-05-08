// Per-source page. Server component that reads the pre-built static
// /sources/<handle>.json from disk at build time. The full atlas is never
// loaded for these pages — neighbors come pre-resolved in the JSON.

import Link from "next/link";
import { readSummary, readSourceByHandle } from "@/lib/atlas-data-server";
import SourceDetailView from "./SourceDetailView";

// SSG: emit one prerendered page for every source in the atlas summary.
export async function generateStaticParams() {
  const summary = await readSummary();
  return summary.sources.map((s) => ({ handle: s.handle }));
}

// Lock the route to fully static. Any unknown handle becomes a 404.
export const dynamicParams = false;

export default async function SourcePage({
  params,
}: {
  params: { handle: string };
}) {
  const handle = decodeURIComponent(params.handle);
  const [source, clusters] = await Promise.all([
    readSourceByHandle(handle),
    readSummary().then((s) => s.clusters),
  ]);

  if (!source) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Source not found</h1>
        <p className="text-ink-muted mt-2">
          No source with handle <code className="font-mono">@{handle}</code>.{" "}
          <Link href="/" className="text-accent hover:underline">
            Back to atlas
          </Link>
        </p>
      </div>
    );
  }

  // Need feature_metadata for the radar; pull from the summary blob.
  const summary = await readSummary();

  return (
    <SourceDetailView
      source={source}
      clusters={clusters}
      featureMetadata={summary.feature_metadata}
    />
  );
}

// No ISR — these pages are fully static.
export const revalidate = false;
