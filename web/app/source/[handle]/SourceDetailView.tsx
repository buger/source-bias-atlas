"use client";

import Link from "next/link";
import type {
  Cluster,
  FeatureKey,
  FeatureMeta,
  RecentPost,
  SourceDetail,
} from "@/lib/atlas-types";
import { RADAR_FEATURES } from "@/lib/atlas-types";
import { compactNumber, relativeTime } from "@/lib/formatting";
import FeatureRadar from "@/components/FeatureRadar";
import SourceCard from "@/components/SourceCard";

function PostsSection({
  title,
  subtitle,
  posts,
}: {
  title: string;
  subtitle?: string;
  posts: RecentPost[];
}) {
  return (
    <section>
      <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">
        {title}
      </h2>
      {subtitle && (
        <p className="text-xs text-ink-subtle mb-3">{subtitle}</p>
      )}
      <ul className="space-y-3">
        {posts.map((p) => {
          const href = p.comments_permalink || p.url;
          const Title = (
            <span className="text-ink leading-snug">{p.title ?? "(untitled)"}</span>
          );
          return (
            <li
              key={p.id}
              className="rounded-lg border border-line bg-bg-elevated p-3 hover:border-line-strong transition"
            >
              <div className="flex gap-3">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image}
                    alt=""
                    className="w-20 h-14 rounded object-cover flex-shrink-0 border border-line"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    {href ? (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block hover:text-accent transition flex-1 min-w-0"
                      >
                        {Title}
                      </a>
                    ) : (
                      <div className="flex-1 min-w-0">{Title}</div>
                    )}
                    <div className="flex-shrink-0 text-xs text-ink-subtle whitespace-nowrap">
                      {relativeTime(p.created_at)}
                    </div>
                  </div>
                  {p.summary && (
                    <p className="mt-1.5 text-xs text-ink-muted line-clamp-2">
                      {p.summary}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                    <span>↑ {compactNumber(p.num_upvotes)}</span>
                    <span>💬 {compactNumber(p.num_comments)}</span>
                    {p.comments_permalink && (
                      <a
                        href={p.comments_permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink-subtle hover:text-accent transition"
                      >
                        on daily.dev →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function SourceDetailView({
  source,
  clusters,
  featureMetadata,
}: {
  source: SourceDetail;
  clusters: Cluster[];
  featureMetadata: Record<FeatureKey, FeatureMeta>;
}) {
  const cluster = clusters.find((c) => c.id === source.cluster_id);
  const clusterById = (id: number) => clusters.find((c) => c.id === id);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="flex flex-wrap items-start gap-4 border-b border-line pb-6">
        <div className="w-14 h-14 rounded-lg bg-bg-panel border border-line flex items-center justify-center text-xl text-ink-muted">
          {source.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-ink truncate">{source.name}</h1>
          <div className="text-ink-muted text-sm">@{source.handle}</div>
          {source.description && (
            <p className="mt-2 text-sm text-ink-muted max-w-2xl">{source.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
            <span>{compactNumber(source.posts_collected)} posts collected</span>
            <span>·</span>
            <span>newest {relativeTime(source.newest_post_at)}</span>
            {cluster && (
              <>
                <span>·</span>
                <Link
                  href={`/?cluster=${cluster.id}`}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border"
                  style={{ borderColor: `${cluster.color}80`, color: cluster.color }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: cluster.color }}
                  />
                  {cluster.label}
                </Link>
              </>
            )}
            {source.is_squad && (
              <span className="px-2 py-0.5 rounded-full border border-accent/40 text-accent text-[10px] uppercase tracking-wide">
                Squad
              </span>
            )}
          </div>
        </div>
        <div>
          <Link
            href={`/compare?a=${source.handle}`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line text-sm hover:border-accent hover:text-accent transition"
          >
            Compare →
          </Link>
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="rounded-lg border border-line bg-bg-elevated p-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Personality</h2>
          <FeatureRadar
            metadata={featureMetadata}
            features={RADAR_FEATURES}
            series={[
              {
                name: source.handle,
                color: cluster?.color ?? "#ff5b1f",
                source,
              },
            ]}
          />
        </div>
        <div className="rounded-lg border border-line bg-bg-elevated p-4">
          <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Top tags</h2>
          <div className="flex flex-wrap gap-2">
            {source.top_tags.map(([tag, n]) => (
              <span
                key={tag}
                className="text-xs px-2 py-1 rounded-full bg-bg-panel border border-line text-ink-muted"
              >
                {tag}
                <span className="ml-1 text-ink-subtle">{compactNumber(n)}</span>
              </span>
            ))}
          </div>

          <h2 className="text-sm uppercase tracking-wide text-ink-muted mt-6 mb-2">
            Representative titles
          </h2>
          <ul className="space-y-2 text-sm text-ink">
            {source.sample_titles.representative.map((t, i) => (
              <li key={i} className="border-l-2 pl-3 border-line">
                {t}
              </li>
            ))}
          </ul>

          <h2 className="text-sm uppercase tracking-wide text-ink-muted mt-6 mb-2">
            Outlier titles
          </h2>
          <ul className="space-y-2 text-sm text-ink-muted italic">
            {source.sample_titles.outlier.map((t, i) => (
              <li key={i} className="border-l-2 pl-3 border-accent/40">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {source.top_posts && source.top_posts.length > 0 && (
        <PostsSection
          title="Top posts"
          subtitle="Highest engagement (upvotes + comments) ever, across this source's archive."
          posts={source.top_posts}
        />
      )}

      {source.recent_posts && source.recent_posts.length > 0 && (
        <PostsSection
          title="Recent posts"
          subtitle="Latest published. Very-fresh items (< 3 days) without engagement are skipped when older posts exist."
          posts={source.recent_posts}
        />
      )}

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-3">
          Similar sources
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {source.similar.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              cluster={clusterById(s.cluster_id)}
              variant="compact"
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-1">
          Opposite sources
        </h2>
        <p className="text-xs text-ink-subtle mb-3">
          You might find these jarring after reading {source.name}.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {source.opposite.map((s) => (
            <SourceCard
              key={s.id}
              source={s}
              cluster={clusterById(s.cluster_id)}
              variant="compact"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
