"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  AtlasSummary,
  AtlasView,
  LayoutMeta,
  SourceSummary,
} from "@/lib/atlas-types";
import { loadSummary } from "@/lib/atlas-data";
import ClusterLegend from "@/components/ClusterLegend";
import SearchBox from "@/components/SearchBox";
import ViewSwitcher from "@/components/ViewSwitcher";
import WelcomeCard, { welcomeWasDismissed } from "@/components/WelcomeCard";
import HelpButton from "@/components/HelpButton";
import QuadrantGuide, {
  quadrantGuideWasSeen,
  markQuadrantGuideSeen,
} from "@/components/QuadrantGuide";
import QuadrantGuideButton from "@/components/QuadrantGuideButton";
import UmapGuide, {
  umapGuideWasSeen,
  markUmapGuideSeen,
} from "@/components/UmapGuide";

const AtlasMap = dynamic(() => import("@/components/AtlasMap"), { ssr: false });

export default function HomePage() {
  // useSearchParams() needs to be inside a Suspense boundary on Next 14 for
  // static prerender. Keep the boundary at the page entry so the rest of the
  // component tree remains unaffected.
  return (
    <Suspense fallback={<AtlasSkeleton />}>
      <HomePageInner />
    </Suspense>
  );
}

function AtlasSkeleton() {
  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-57px)]">
      <aside className="hidden md:block w-64 flex-shrink-0 border-r border-line bg-bg-elevated p-4">
        <div className="h-3 w-20 bg-line/60 rounded mb-3 animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <div
              className="w-3 h-3 rounded-full bg-line/60 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
            <div
              className="h-3 flex-1 rounded bg-line/40 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            />
          </div>
        ))}
      </aside>
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0">
          {/* faint scattered dots placeholder */}
          {Array.from({ length: 60 }).map((_, i) => {
            const x = (i * 137) % 100;
            const y = (i * 79) % 100;
            const size = 4 + (i % 5);
            return (
              <span
                key={i}
                className="absolute rounded-full bg-line/50 animate-pulse"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  animationDelay: `${(i % 8) * 120}ms`,
                }}
              />
            );
          })}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-ink-subtle text-sm flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            <span>Loading atlas…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AtlasSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  // Welcome card visibility. Initialized after mount from localStorage.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  // Quadrant guide modal state. Tracks the view it's currently showing for.
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideViewId, setGuideViewId] = useState<string | null>(null);
  // UMAP / auto-view guide modal state.
  const [umapGuideOpen, setUmapGuideOpen] = useState(false);

  // Active atlas view id, persisted in the URL (?view=...).
  const views: AtlasView[] = useMemo(() => data?.views ?? [], [data]);
  const urlView = searchParams.get("view");
  const viewId = useMemo(() => {
    if (urlView && views.some((v) => v.id === urlView)) return urlView;
    return "auto";
  }, [urlView, views]);

  const setViewId = (next: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (next === "auto") {
      params.delete("view");
    } else {
      params.set("view", next);
    }
    const qs = params.toString();
    router.replace(qs ? `/?${qs}` : "/", { scroll: false });
  };

  useEffect(() => {
    loadSummary().then(setData).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // First-visit welcome card; if dismissed previously, show "?" button instead.
  useEffect(() => {
    const dismissed = welcomeWasDismissed();
    setWelcomeOpen(!dismissed);
    setHelpVisible(dismissed);
  }, []);

  // Active view object (memoized).
  const activeView: AtlasView | null = useMemo(
    () => views.find((v) => v.id === viewId) ?? null,
    [views, viewId],
  );
  const hasQuadrantGuide = !!(
    activeView && activeView.quadrants && activeView.x_axis && activeView.y_axis
  );

  // Auto-open the quadrant guide when switching to a not-yet-seen feature view.
  // Skipped while the welcome card is still up to avoid stacking modals.
  useEffect(() => {
    if (!hasQuadrantGuide) {
      // Switched to auto / a view without quadrants — close any open guide.
      if (guideOpen) {
        setGuideOpen(false);
        setGuideViewId(null);
      }
      return;
    }
    if (welcomeOpen) return;
    if (quadrantGuideWasSeen(viewId)) return;
    setGuideViewId(viewId);
    setGuideOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, hasQuadrantGuide, welcomeOpen]);

  // Auto-open the UMAP guide on the "auto" view, when not seen and welcome closed.
  useEffect(() => {
    if (viewId !== "auto") {
      if (umapGuideOpen) setUmapGuideOpen(false);
      return;
    }
    if (welcomeOpen) return;
    if (umapGuideWasSeen()) return;
    setUmapGuideOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId, welcomeOpen]);

  // "?" key re-opens the welcome card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Skip when typing in inputs/textareas/contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setWelcomeOpen(true);
        setHelpVisible(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The Atlas is a publisher map; squads are filtered out at the source list
  // stage, so AtlasMap and downstream code never sees them.
  const visibleSources = useMemo(() => {
    if (!data) return [];
    return data.sources.filter((s) => !s.is_squad);
  }, [data]);

  // Per-cluster publisher counts. Driven from the raw atlas data so the
  // legend doesn't shift when the search box filters down `visibleSources`.
  const publisherCountByCluster = useMemo(() => {
    const m = new Map<number, number>();
    if (!data) return m;
    for (const s of data.sources) {
      if (s.is_squad) continue;
      m.set(s.cluster_id, (m.get(s.cluster_id) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const highlightHandles = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    const out = new Set<string>();
    for (const s of visibleSources) {
      if (
        s.name.toLowerCase().includes(q) ||
        s.handle.toLowerCase().includes(q)
      ) {
        out.add(s.handle);
      }
    }
    return out;
  }, [visibleSources, search]);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Failed to load atlas</h1>
        <p className="text-ink-muted text-sm">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <AtlasSkeleton />;
  }

  const onSourceClick = (s: SourceSummary) => {
    router.push(`/source/${s.handle}`);
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-57px)]">
      {!isMobile && (
        <aside className="w-64 flex-shrink-0 border-r border-line bg-bg-elevated p-4 overflow-y-auto">
          <ClusterLegend
            clusters={data.clusters}
            activeId={activeClusterId}
            onSelect={setActiveClusterId}
            publisherCountByCluster={publisherCountByCluster}
          />
          <AxesPanel
            meta={data.layout_meta}
            view={activeView}
            onOpenGuide={() => {
              setGuideViewId(viewId);
              setGuideOpen(true);
            }}
          />
        </aside>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center gap-3 p-3 border-b border-line bg-bg-elevated/50">
          <div className="w-full sm:w-auto sm:flex-1 min-w-[160px] sm:max-w-xs">
            <SearchBox value={search} onChange={setSearch} />
          </div>
          {views.length > 0 && (
            <div className="w-full sm:w-auto sm:flex-1 min-w-0">
              <ViewSwitcher views={views} value={viewId} onChange={setViewId} />
            </div>
          )}
          <QuadrantGuideButton
            visible={hasQuadrantGuide}
            onClick={() => {
              setGuideViewId(viewId);
              setGuideOpen(true);
            }}
          />
          <QuadrantGuideButton
            visible={viewId === "auto"}
            onClick={() => setUmapGuideOpen(true)}
          />
          <span className="text-xs text-ink-subtle ml-auto">
            {highlightHandles ? `${highlightHandles.size} match` : `${visibleSources.length} sources`}
          </span>
        </div>
        {isMobile && (
          <div className="bg-accent/10 border-b border-accent/30 text-xs text-ink-muted p-2 text-center">
            Best viewed on desktop. The atlas is shrunk for mobile.
          </div>
        )}
        <div className="flex-1 min-h-0 relative">
          <AtlasMap
            sources={visibleSources}
            clusters={data.clusters}
            highlightHandles={highlightHandles}
            activeClusterId={activeClusterId}
            onSourceClick={onSourceClick}
            layoutMeta={data.layout_meta ?? null}
            viewId={viewId}
            views={views}
          />
          <WelcomeCard
            layoutMeta={data.layout_meta}
            open={welcomeOpen}
            onClose={() => {
              setWelcomeOpen(false);
              setHelpVisible(true);
            }}
          />
          <HelpButton
            visible={helpVisible && !welcomeOpen}
            onClick={() => {
              setWelcomeOpen(true);
              setHelpVisible(false);
            }}
          />
        </div>
        <QuadrantGuide
          view={
            guideViewId ? views.find((v) => v.id === guideViewId) ?? null : null
          }
          open={guideOpen}
          onClose={({ remember } = {}) => {
            if (remember && guideViewId) {
              markQuadrantGuideSeen(guideViewId);
            }
            setGuideOpen(false);
          }}
        />
        <UmapGuide
          open={umapGuideOpen}
          views={views}
          onClose={({ remember } = {}) => {
            if (remember) markUmapGuideSeen();
            setUmapGuideOpen(false);
          }}
          onSwitchView={(id) => {
            setUmapGuideOpen(false);
            setViewId(id);
          }}
        />
      </div>
    </div>
  );
}

const FEATURE_LABEL_MAP: Record<string, string> = {
  zero_engagement_share: "zero-engagement share",
  median_upvotes: "median upvotes",
  top_tag_share: "top-tag share",
  recency_skew: "recency skew",
  question_ratio: "question ratio",
  non_article_ratio: "non-article ratio",
  hype_score: "hype score",
  listicle_ratio: "listicle ratio",
  avg_read_time: "avg read time",
  tag_diversity: "tag diversity",
  tag_entropy: "tag entropy",
  viral_share: "viral share",
  posts_per_week: "posts/week",
  comment_to_upvote_ratio: "comment/upvote ratio",
};

function prettyFeature(name: string): string {
  return FEATURE_LABEL_MAP[name] ?? name.replace(/_/g, " ");
}

function AxesPanel({
  meta,
  view,
  onOpenGuide,
}: {
  meta: LayoutMeta | undefined;
  view: AtlasView | null;
  onOpenGuide: () => void;
}) {
  // Feature view: show the chosen feature names + hi/lo labels + quadrants.
  if (view && view.source === "feature" && view.x_axis && view.y_axis) {
    return (
      <div className="mt-6 text-xs text-ink-subtle leading-relaxed">
        <div className="uppercase tracking-wide text-ink-muted mb-2">
          What the axes mean
        </div>
        <div className="text-[11px] text-ink-subtle/90 mb-3">
          {view.description}
        </div>
        <div className="mb-2">
          <div className="text-ink-muted">
            ← {view.x_axis.negative_label} / {view.x_axis.positive_label} →
          </div>
          <div className="text-[10px] text-ink-subtle/80">
            {prettyFeature(view.x_axis.feature)}
            {view.x_axis.log1p ? " (log scale)" : ""}
          </div>
        </div>
        <div>
          <div className="text-ink-muted">
            ↓ {view.y_axis.negative_label} / {view.y_axis.positive_label} ↑
          </div>
          <div className="text-[10px] text-ink-subtle/80">
            {prettyFeature(view.y_axis.feature)}
            {view.y_axis.log1p ? " (log scale)" : ""}
          </div>
        </div>

        {view.quadrants && (
          <div className="mt-5 border-t border-line pt-4">
            <button
              type="button"
              onClick={onOpenGuide}
              className="text-[12px] text-ink-muted hover:text-accent transition"
            >
              View quadrant guide →
            </button>
          </div>
        )}
      </div>
    );
  }

  // Auto / UMAP view: this is NOT a feature-axis view — it's a 2D embedding.
  // Position has no canonical meaning; clusters and proximity carry the signal.
  if (!meta) return null;
  const xTop = meta.x_axis.top_correlated_features.slice(0, 2);
  const yTop = meta.y_axis.top_correlated_features.slice(0, 2);
  const fmtPair = (pairs: [string, number][]) =>
    pairs
      .map(([name, r]) => `${prettyFeature(name)} (${r >= 0 ? "+" : ""}${r.toFixed(2)})`)
      .join(", ");
  return (
    <div className="mt-6 text-xs text-ink-subtle leading-relaxed">
      <div className="uppercase tracking-wide text-ink-muted mb-2">
        How this layout works
      </div>
      <div className="text-[11px] text-ink-subtle/90 mb-3">
        UMAP places <em>similar sources</em> near each other. The axes are
        not real coordinates — re-running UMAP could rotate the whole map and
        the result would be equally valid. <strong>Clusters and neighborhoods
        carry the signal, not x or y values.</strong>
      </div>
      <div className="text-[11px] text-ink-subtle/90 mb-3">
        For sharp axes you can read literally,{" "}
        <span className="text-ink-muted">switch to a feature view</span>{" "}
        (Engagement × Discussion, Volume × Depth, etc.).
      </div>
      <div className="mt-3 border-t border-line pt-3">
        <div className="uppercase tracking-wide text-ink-muted/80 mb-2 text-[10px]">
          Loose correlations
        </div>
        <div className="text-[10px] text-ink-subtle/70 mb-2 italic">
          Strongest features that drift along each direction. Weak signal —
          UMAP is non-linear.
        </div>
        <div className="mb-2">
          <div className="text-ink-muted">
            ← {meta.x_axis.negative} / {meta.x_axis.positive} →
          </div>
          <div className="text-[10px] text-ink-subtle/70">{fmtPair(xTop)}</div>
        </div>
        <div>
          <div className="text-ink-muted">
            ↓ {meta.y_axis.negative} / {meta.y_axis.positive} ↑
          </div>
          <div className="text-[10px] text-ink-subtle/70">{fmtPair(yTop)}</div>
        </div>
      </div>
    </div>
  );
}

