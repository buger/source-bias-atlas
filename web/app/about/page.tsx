"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  ClustersIndex,
  FeatureKey,
  FeatureMeta,
} from "@/lib/atlas-types";
import { loadClusters } from "@/lib/atlas-data";

function fmtDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function fmtRange(meta: FeatureMeta): string {
  const f = (n: number) => {
    if (!isFinite(n)) return "—";
    if (Math.abs(n) >= 100) return n.toFixed(0);
    if (Math.abs(n) >= 1) return n.toFixed(2);
    return n.toFixed(3);
  };
  return `${f(meta.min)} – ${f(meta.max)}`;
}

export default function AboutPage() {
  const [data, setData] = useState<ClustersIndex | null>(null);

  useEffect(() => {
    loadClusters().then(setData);
  }, []);

  const featureRows = useMemo(() => {
    if (!data) return [];
    return (Object.keys(data.feature_metadata) as FeatureKey[]).map((k) => ({
      key: k,
      meta: data.feature_metadata[k],
    }));
  }, [data]);

  const sourceCount = data ? data.stats.publishers : null;
  const totalSources = data ? data.stats.total_sources : null;

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 text-ink leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">About the Source Bias Atlas</h1>
      <p className="text-ink-muted text-sm mb-8">
        A 72-hour public-API hackathon project, built on top of daily.dev&apos;s public source feeds.
      </p>

      <Section title="What is this?">
        <p>
          The Source Bias Atlas is an interactive map of daily.dev&apos;s content sources, clustered by
          stylistic personality. Each dot is a source; sources that publish in similar styles —
          comparable hype, cadence, depth, topical focus — sit near each other. The clusters are
          discovered automatically from the data, not curated.
        </p>
        <p className="mt-3">
          The goal is to make the underlying &quot;texture&quot; of your feed visible: which sources
          lean clickbait-y, which are firehose news, which are deep technical longreads, which
          spark the most discussion.
        </p>
      </Section>

      <Section title="The data">
        <p>
          A source is one daily.dev feed surfaced via{" "}
          <code className="font-mono text-[12px] text-ink-muted">/feeds/source/{"{handle}"}</code>.
          For each source we collected recent posts (titles, summaries, tags, read-time, upvote and
          comment counts, post type, dates) and aggregated them into 20 numerical features.
        </p>
        <ul className="mt-3 list-disc pl-5 text-ink-muted text-sm">
          <li>
            Snapshot generated:{" "}
            <span className="text-ink">{data ? fmtDate(data.generated_at) : "loading…"}</span>
          </li>
          <li>
            Sources in atlas:{" "}
            <span className="text-ink">
              {sourceCount !== null ? sourceCount : "loading…"}
            </span>{" "}
            non-Squad
            {totalSources !== null && totalSources !== sourceCount
              ? ` (${totalSources} total including Squads)`
              : ""}
          </li>
          <li>
            Sources with fewer than ~10 recent posts in our sample are excluded for stability.
          </li>
        </ul>
      </Section>

      <Section title="How sources are characterized">
        <p>
          Each source becomes a 20-dimensional feature vector. Long-tailed counts (upvotes,
          comments, posts/week) are{" "}
          <code className="font-mono text-[12px] text-ink-muted">log1p</code>-transformed first;
          all features are then z-scored before clustering. Below is the full feature list with
          definitions, lifted from the atlas pipeline so it always stays in sync with what the
          atlas actually shows.
        </p>

        <div className="mt-4 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-bg-elevated text-ink-muted text-[11px] uppercase tracking-wide">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Feature</th>
                <th className="text-left px-3 py-2 font-semibold">Description</th>
                <th className="text-left px-3 py-2 font-semibold">Range (min – max)</th>
                <th className="text-left px-3 py-2 font-semibold">Polarity</th>
              </tr>
            </thead>
            <tbody>
              {featureRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-ink-subtle">
                    Loading feature metadata…
                  </td>
                </tr>
              ) : (
                featureRows.map(({ key, meta }) => (
                  <tr key={key} className="border-t border-line align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="text-ink">{meta.label}</div>
                      <code className="font-mono text-[11px] text-ink-subtle">{key}</code>
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{meta.description}</td>
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap font-mono text-[12px]">
                      {fmtRange(meta)}
                    </td>
                    <td className="px-3 py-2 text-ink-muted whitespace-nowrap">
                      higher = {meta.higher_is}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Callout title="A note on hype_score, since people ask">
          <p>
            <code className="font-mono text-[12px]">hype_score</code> is the fraction of titles
            that either contain a curated hype-lexicon phrase
            (e.g. <em>revolutionary</em>, <em>game-changing</em>, <em>you won&apos;t believe</em>,{" "}
            <em>insane</em>, <em>shocking</em>) or end with one or more exclamation marks.
            Higher = more clickbait energy.
          </p>
          <p className="mt-2 text-ink-muted text-[12px]">
            Source of truth:{" "}
            <code className="font-mono">features/features/title_style.py</code>.
            It&apos;s a heuristic, not an LLM judgment — easy to audit, easy to argue with.
          </p>
        </Callout>
      </Section>

      <Section title="How sources are clustered">
        <p>
          Clustering: K-means on the z-scored feature matrix. The number of clusters is chosen to
          balance silhouette and interpretability (typically 6–8). Cluster labels are then
          generated from the dominant features of each cluster centroid.
        </p>
        <p className="mt-3">
          2D layout: UMAP (n_neighbors and min_dist tuned for visual separation) over the same
          feature matrix. Random state is fixed so the layout is reproducible across runs.
          {data?.layout_meta?.random_state !== undefined && (
            <>
              {" "}
              The current snapshot was laid out with{" "}
              <code className="font-mono text-[12px] text-ink-muted">
                random_state = {data.layout_meta.random_state}
              </code>
              .
            </>
          )}
        </p>
      </Section>

      <Section title="What the axes mean">
        {data?.layout_meta ? (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-ink">
                <span className="text-ink-muted">X axis:</span>{" "}
                ← {data.layout_meta.x_axis.negative} / {data.layout_meta.x_axis.positive} →
              </div>
              <div className="text-[12px] text-ink-subtle">
                Top correlated features:{" "}
                {data.layout_meta.x_axis.top_correlated_features
                  .slice(0, 3)
                  .map(
                    ([f, r]) => `${f} (${r >= 0 ? "+" : ""}${r.toFixed(2)})`
                  )
                  .join(", ")}
              </div>
            </div>
            <div>
              <div className="text-ink">
                <span className="text-ink-muted">Y axis:</span>{" "}
                ↓ {data.layout_meta.y_axis.negative} / {data.layout_meta.y_axis.positive} ↑
              </div>
              <div className="text-[12px] text-ink-subtle">
                Top correlated features:{" "}
                {data.layout_meta.y_axis.top_correlated_features
                  .slice(0, 3)
                  .map(
                    ([f, r]) => `${f} (${r >= 0 ? "+" : ""}${r.toFixed(2)})`
                  )
                  .join(", ")}
              </div>
            </div>
            <p className="text-[12px] text-ink-subtle">
              Note: UMAP axes don&apos;t have absolute units — interpret distances and direction,
              not values.
            </p>
          </div>
        ) : (
          <p className="text-ink-subtle text-sm">Loading axis metadata…</p>
        )}
      </Section>

      <Section title="Limitations">
        <ul className="list-disc pl-5 text-ink-muted text-sm space-y-1">
          <li>Snapshot in time — not live; regenerated on demand.</li>
          <li>Skews toward sources with at least ~10 recent posts in our sample window.</li>
          <li>
            User-created Squads are excluded by default — toggle on the atlas to show them. They
            often have very thin samples and would dominate noise.
          </li>
          <li>
            Heuristic features only. No LLM is used in v1; everything is regex, counts, ratios and
            a small curated lexicon. That keeps it auditable.
          </li>
          <li>
            Engagement is post-level; we don&apos;t know who upvoted or why.
          </li>
        </ul>
      </Section>

      <Section title="Built for">
        <p>
          The daily.dev 72-hour Public API hackathon, 2026. No auth, no backend — the entire site
          is a static export driven by a small set of pre-built JSON artifacts.
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          <Link href="/" className="text-accent hover:underline">
            ← Back to the atlas
          </Link>
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-ink mb-3 border-b border-line pb-2">{title}</h2>
      <div className="text-[14.5px] text-ink">{children}</div>
    </section>
  );
}

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-4">
      <div className="text-[12px] uppercase tracking-wide text-accent mb-1">{title}</div>
      <div className="text-[14px] text-ink">{children}</div>
    </div>
  );
}
