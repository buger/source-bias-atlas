"use client";

import type { Cluster } from "@/lib/atlas-types";

export default function ClusterLegend({
  clusters,
  activeId,
  onSelect,
  publisherCountByCluster,
}: {
  clusters: Cluster[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
  /** When provided, override `cluster.size` (which is publishers + squads from atlas.json). */
  publisherCountByCluster?: Map<number, number>;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-ink-subtle">
          Clusters
        </div>
        {activeId != null && (
          <button
            onClick={() => onSelect(null)}
            className="text-[10px] uppercase tracking-wide text-ink-subtle hover:text-accent transition-colors duration-150"
          >
            Clear
          </button>
        )}
      </div>
      {clusters.map((c) => {
        const active = activeId === c.id;
        const dim = activeId != null && !active;
        const pubCount = publisherCountByCluster?.get(c.id) ?? c.size;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(active ? null : c.id)}
            aria-pressed={active}
            className={`group w-full text-left flex items-start gap-2 px-2 py-1.5 rounded text-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              active
                ? "bg-bg-panel text-ink shadow-inner"
                : "text-ink-muted hover:bg-bg-elevated hover:text-ink"
            } ${dim ? "opacity-40 hover:opacity-70" : ""}`}
            title={active ? "Click to clear filter" : c.label}
          >
            <span
              className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 transition-transform duration-150 ${
                active ? "scale-125 ring-2 ring-offset-2 ring-offset-bg-elevated" : "group-hover:scale-110"
              }`}
              style={{
                background: c.color,
                ...(active ? { boxShadow: `0 0 0 2px ${c.color}` } : {}),
              }}
            />
            <span
              className="flex-1 leading-snug break-words"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {c.label}
            </span>
            <span className="text-xs text-ink-subtle mt-0.5 flex-shrink-0 text-right whitespace-nowrap">
              {pubCount}
            </span>
          </button>
        );
      })}
    </div>
  );
}
