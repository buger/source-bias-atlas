"use client";

import type { Cluster } from "@/lib/atlas-types";

export default function ClusterLegend({
  clusters,
  activeId,
  onSelect,
  squadCountByCluster,
  publisherCountByCluster,
}: {
  clusters: Cluster[];
  activeId: number | null;
  onSelect: (id: number | null) => void;
  /** When provided, "+N squads" is suffixed onto each cluster row. */
  squadCountByCluster?: Map<number, number>;
  /** When provided, override `cluster.size` (which is publishers + squads from atlas.json). */
  publisherCountByCluster?: Map<number, number>;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-ink-subtle mb-2">Clusters</div>
      {clusters.map((c) => {
        const active = activeId === c.id;
        const dim = activeId != null && !active;
        const pubCount = publisherCountByCluster?.get(c.id) ?? c.size;
        const squadCount = squadCountByCluster?.get(c.id) ?? 0;
        return (
          <button
            key={c.id}
            onClick={() => onSelect(active ? null : c.id)}
            className={`w-full text-left flex items-start gap-2 px-2 py-1.5 rounded text-sm transition ${
              active ? "bg-bg-panel text-ink" : "text-ink-muted hover:bg-bg-elevated"
            } ${dim ? "opacity-40" : ""}`}
            title={c.label}
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ background: c.color }}
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
              {squadCount > 0 && (
                <span className="text-accent/80"> +{squadCount}</span>
              )}
            </span>
          </button>
        );
      })}
      {activeId != null && (
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-ink-subtle hover:text-ink mt-2"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
