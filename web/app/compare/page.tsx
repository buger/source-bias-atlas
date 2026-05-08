"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AtlasSummary,
  FeatureKey,
  SourceDetail,
} from "@/lib/atlas-types";
import { loadSummary, loadSource, clusterById } from "@/lib/atlas-data";
import FeatureRadar from "@/components/FeatureRadar";
import FeatureBar from "@/components/FeatureBar";
import SearchBox from "@/components/SearchBox";

function ComparePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const a = params.get("a") ?? "";
  const b = params.get("b") ?? "";

  const [data, setData] = useState<AtlasSummary | null>(null);
  const [sourceA, setSourceA] = useState<SourceDetail | null>(null);
  const [sourceB, setSourceB] = useState<SourceDetail | null>(null);
  const [searchA, setSearchA] = useState("");
  const [searchB, setSearchB] = useState("");

  useEffect(() => {
    loadSummary().then(setData);
  }, []);

  useEffect(() => {
    if (!a) {
      setSourceA(null);
      return;
    }
    let cancel = false;
    loadSource(a)
      .then((s) => {
        if (!cancel) setSourceA(s);
      })
      .catch(() => {
        if (!cancel) setSourceA(null);
      });
    return () => {
      cancel = true;
    };
  }, [a]);

  useEffect(() => {
    if (!b) {
      setSourceB(null);
      return;
    }
    let cancel = false;
    loadSource(b)
      .then((s) => {
        if (!cancel) setSourceB(s);
      })
      .catch(() => {
        if (!cancel) setSourceB(null);
      });
    return () => {
      cancel = true;
    };
  }, [b]);

  const setHandle = (slot: "a" | "b", handle: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(slot, handle);
    router.replace(`/compare?${next.toString()}`);
  };

  const matchesA = useMemo(() => {
    if (!data || !searchA.trim()) return [];
    const q = searchA.toLowerCase();
    return data.sources
      .filter((s) => s.handle.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [data, searchA]);
  const matchesB = useMemo(() => {
    if (!data || !searchB.trim()) return [];
    const q = searchB.toLowerCase();
    return data.sources
      .filter((s) => s.handle.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [data, searchB]);

  if (!data) return <div className="p-8 text-ink-muted">Loading…</div>;

  const suggestions: [string, string][] = [
    [data.sources[0]?.handle, data.sources[10]?.handle],
    [data.sources[5]?.handle, data.sources[20]?.handle],
    [data.sources[15]?.handle, data.sources[35]?.handle],
  ].filter(([x, y]) => x && y) as [string, string][];

  const colorA = sourceA ? clusterById(data, sourceA.cluster_id)?.color ?? "#ff5b1f" : "#ff5b1f";
  const colorB = sourceB ? clusterById(data, sourceB.cluster_id)?.color ?? "#7c5cff" : "#7c5cff";

  const features = Object.keys(data.feature_metadata) as FeatureKey[];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Compare two sources</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {(["a", "b"] as const).map((slot) => {
          const source = slot === "a" ? sourceA : sourceB;
          const search = slot === "a" ? searchA : searchB;
          const setSearch = slot === "a" ? setSearchA : setSearchB;
          const matches = slot === "a" ? matchesA : matchesB;
          const color = slot === "a" ? colorA : colorB;
          return (
            <div key={slot} className="rounded-lg border border-line bg-bg-elevated p-4">
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-xs uppercase tracking-wide font-semibold"
                  style={{ color }}
                >
                  Source {slot.toUpperCase()}
                </span>
                {source && (
                  <Link href={`/source/${source.handle}`} className="text-xs text-ink-subtle hover:text-ink">
                    Open →
                  </Link>
                )}
              </div>
              {source ? (
                <div>
                  <div className="text-lg font-semibold">{source.name}</div>
                  <div className="text-ink-muted text-sm">@{source.handle}</div>
                  <button
                    onClick={() => setHandle(slot, "")}
                    className="mt-3 text-xs text-ink-subtle hover:text-ink"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <SearchBox value={search} onChange={setSearch} placeholder="Type a handle…" />
                  <div className="mt-2 space-y-1">
                    {matches.map((m) => (
                      <button
                        key={m.handle}
                        onClick={() => {
                          setHandle(slot, m.handle);
                          setSearch("");
                        }}
                        className="w-full text-left text-sm px-2 py-1 rounded hover:bg-bg-panel"
                      >
                        <span className="text-ink">{m.name}</span>{" "}
                        <span className="text-ink-subtle">@{m.handle}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!sourceA || !sourceB ? (
        <div className="rounded-lg border border-line bg-bg-elevated p-4">
          <div className="text-sm text-ink-muted mb-2">Try a suggestion:</div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(([x, y], i) => (
              <Link
                key={i}
                href={`/compare?a=${x}&b=${y}`}
                className="text-xs px-3 py-1.5 rounded-full border border-line hover:border-accent hover:text-accent"
              >
                @{x} vs @{y}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-line bg-bg-elevated p-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Overlay radar</h2>
            <FeatureRadar
              metadata={data.feature_metadata}
              series={[
                { name: sourceA.handle, color: colorA, source: sourceA },
                { name: sourceB.handle, color: colorB, source: sourceB },
              ]}
            />
          </div>
          <div className="rounded-lg border border-line bg-bg-elevated p-4">
            <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-3">All metrics</h2>
            <FeatureBar
              a={sourceA}
              b={sourceB}
              metadata={data.feature_metadata}
              features={features}
              colorA={colorA}
              colorB={colorB}
            />
          </div>
          <div className="text-xs text-ink-subtle">
            Tip: take a screenshot to share. (PNG-export integration is a future enhancement.)
          </div>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading…</div>}>
      <ComparePageInner />
    </Suspense>
  );
}
