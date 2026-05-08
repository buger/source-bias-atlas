"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { AtlasSummary, SourceSummary } from "@/lib/atlas-types";
import { loadSummary } from "@/lib/atlas-data";

const AtlasMap = dynamic(() => import("@/components/AtlasMap"), { ssr: false });

interface DietSliders {
  hype: number;       // 0..1, low → high
  depth: number;      // 0..1, low → high (avg_read_time)
  cadence: number;    // 0..1, rare → firehose (posts_per_week)
  generalist: number; // 0..1, niche → broad (tag_diversity)
}

const DEFAULTS: DietSliders = { hype: 0.5, depth: 0.5, cadence: 0.5, generalist: 0.5 };

export default function DietPage() {
  const [data, setData] = useState<AtlasSummary | null>(null);
  const [sliders, setSliders] = useState<DietSliders>(DEFAULTS);

  useEffect(() => {
    loadSummary().then(setData);
  }, []);

  // Determine which sources match (within tolerance) the slider profile.
  const matchingHandles = useMemo<Set<string> | null>(() => {
    if (!data) return null;
    const meta = data.feature_metadata;
    const norm = (v: number, min: number, max: number) =>
      max <= min ? 0 : Math.max(0, Math.min(1, (v - min) / (max - min)));

    const tolerance = 0.25;
    const out = new Set<string>();
    for (const s of data.sources) {
      const f = s.features_preview;
      const hype = norm(f.hype_score ?? 0, meta.hype_score.min, meta.hype_score.max);
      const depth = norm(
        f.avg_read_time ?? 0,
        meta.avg_read_time.min,
        meta.avg_read_time.max
      );
      const cadence = norm(
        f.posts_per_week ?? 0,
        meta.posts_per_week.min,
        meta.posts_per_week.max
      );
      const generalist = norm(
        f.tag_diversity ?? 0,
        meta.tag_diversity.min,
        meta.tag_diversity.max
      );
      if (
        Math.abs(hype - sliders.hype) < tolerance &&
        Math.abs(depth - sliders.depth) < tolerance &&
        Math.abs(cadence - sliders.cadence) < tolerance &&
        Math.abs(generalist - sliders.generalist) < tolerance
      ) {
        out.add(s.handle);
      }
    }
    return out;
  }, [data, sliders]);

  const matchingList = useMemo<SourceSummary[]>(() => {
    if (!data || !matchingHandles) return [];
    return data.sources.filter((s) => matchingHandles.has(s.handle));
  }, [data, matchingHandles]);

  if (!data) return <div className="p-8 text-ink-muted">Loading…</div>;

  return (
    <div className="grid md:grid-cols-[320px_1fr] h-[calc(100vh-57px)]">
      <aside className="border-r border-line bg-bg-elevated p-5 overflow-y-auto space-y-5">
        <div>
          <h1 className="text-xl font-bold mb-1">Build your reading diet</h1>
          <p className="text-xs text-ink-muted">
            Tune the dials. Sources that match your profile light up on the atlas.
          </p>
        </div>

        <Slider
          label="Hype"
          left="grounded"
          right="hyped"
          value={sliders.hype}
          onChange={(v) => setSliders({ ...sliders, hype: v })}
        />
        <Slider
          label="Depth"
          left="quick reads"
          right="long reads"
          value={sliders.depth}
          onChange={(v) => setSliders({ ...sliders, depth: v })}
        />
        <Slider
          label="Cadence"
          left="rare"
          right="firehose"
          value={sliders.cadence}
          onChange={(v) => setSliders({ ...sliders, cadence: v })}
        />
        <Slider
          label="Generalist"
          left="niche"
          right="broad"
          value={sliders.generalist}
          onChange={(v) => setSliders({ ...sliders, generalist: v })}
        />

        <div className="pt-3 border-t border-line">
          <div className="text-xs uppercase tracking-wide text-ink-muted mb-2">
            Matches ({matchingList.length})
          </div>
          {matchingList.length === 0 ? (
            <p className="text-xs text-ink-subtle">No sources match this profile. Loosen your dials.</p>
          ) : (
            <ul className="space-y-1 text-sm max-h-64 overflow-y-auto">
              {matchingList.map((s) => (
                <li key={s.id} className="text-ink-muted">
                  <span className="text-ink">{s.name}</span>{" "}
                  <span className="text-ink-subtle">@{s.handle}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => {
              const text = matchingList.map((s) => `@${s.handle}\t${s.name}`).join("\n");
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(text);
              }
            }}
            disabled={matchingList.length === 0}
            className="mt-3 w-full text-xs px-3 py-2 rounded border border-line hover:border-accent hover:text-accent disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-muted"
          >
            Copy as list (BYOT-friendly)
          </button>
        </div>
      </aside>
      <div className="relative min-w-0">
        <AtlasMap
          sources={data.sources.filter((s) => !s.is_squad)}
          clusters={data.clusters}
          highlightHandles={matchingHandles}
          activeClusterId={null}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  left,
  right,
  value,
  onChange,
}: {
  label: string;
  left: string;
  right: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-ink">{label}</span>
        <span className="text-xs text-ink-subtle">{Math.round(value * 100)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
      <div className="flex justify-between text-[10px] text-ink-subtle uppercase tracking-wide">
        <span>{left}</span>
        <span>{right}</span>
      </div>
    </div>
  );
}
