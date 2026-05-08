import Link from "next/link";
import type { SourceSummary, Cluster } from "@/lib/atlas-types";
import { compactNumber } from "@/lib/formatting";

export default function SourceCard({
  source,
  cluster,
  variant = "default",
}: {
  source: SourceSummary;
  cluster?: Cluster;
  variant?: "default" | "compact";
}) {
  const tags = source.top_tags_preview ?? [];
  return (
    <Link
      href={`/source/${source.handle}`}
      className="block rounded-lg border border-line bg-bg-elevated p-3 hover:border-accent/50 hover:bg-bg-panel transition"
    >
      <div className="flex items-baseline gap-2">
        <h3 className="font-semibold text-ink truncate">{source.name}</h3>
        <span className="text-ink-subtle text-xs">@{source.handle}</span>
      </div>
      {cluster && (
        <div className="mt-1 flex items-center gap-1.5 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: cluster.color }}
          />
          <span className="text-ink-muted">{cluster.label}</span>
        </div>
      )}
      {variant !== "compact" && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.slice(0, 3).map(([tag]) => (
            <span
              key={tag}
              className="text-[10px] uppercase tracking-wide text-ink-subtle bg-bg px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs text-ink-subtle">
        {compactNumber(source.posts_collected)} posts
      </div>
    </Link>
  );
}
