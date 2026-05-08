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
import SquadToggle from "@/components/SquadToggle";
import ViewSwitcher from "@/components/ViewSwitcher";
import WelcomeCard, { welcomeWasDismissed } from "@/components/WelcomeCard";
import HelpButton from "@/components/HelpButton";
import QuadrantGuide, {
  quadrantGuideWasSeen,
  markQuadrantGuideSeen,
} from "@/components/QuadrantGuide";
import QuadrantGuideButton from "@/components/QuadrantGuideButton";

const AtlasMap = dynamic(() => import("@/components/AtlasMap"), { ssr: false });

export default function HomePage() {
  // useSearchParams() needs to be inside a Suspense boundary on Next 14 for
  // static prerender. Keep the boundary at the page entry so the rest of the
  // component tree remains unaffected.
  return (
    <Suspense fallback={<div className="p-8 text-ink-muted">Loading atlas…</div>}>
      <HomePageInner />
    </Suspense>
  );
}

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<AtlasSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeClusterId, setActiveClusterId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showSquads, setShowSquads] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Welcome card visibility. Initialized after mount from localStorage.
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  // Quadrant guide modal state. Tracks the view it's currently showing for.
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideViewId, setGuideViewId] = useState<string | null>(null);

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

  const visibleSources = useMemo(() => {
    if (!data) return [];
    return data.sources.filter((s) => showSquads || !s.is_squad);
  }, [data, showSquads]);

  // Per-cluster publisher / squad counts. Driven from the raw atlas data so
  // the legend doesn't shift when the search box filters down `visibleSources`.
  const publisherCountByCluster = useMemo(() => {
    const m = new Map<number, number>();
    if (!data) return m;
    for (const s of data.sources) {
      if (s.is_squad) continue;
      m.set(s.cluster_id, (m.get(s.cluster_id) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const squadCountByCluster = useMemo(() => {
    const m = new Map<number, number>();
    if (!data) return m;
    for (const s of data.sources) {
      if (!s.is_squad) continue;
      if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) continue;
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
    return <div className="p-8 text-ink-muted">Loading atlas…</div>;
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
            squadCountByCluster={showSquads ? squadCountByCluster : undefined}
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
          <div className="flex-1 min-w-[160px] max-w-md">
            <SearchBox value={search} onChange={setSearch} />
          </div>
          {views.length > 0 && (
            <ViewSwitcher views={views} value={viewId} onChange={setViewId} />
          )}
          <QuadrantGuideButton
            visible={hasQuadrantGuide}
            onClick={() => {
              setGuideViewId(viewId);
              setGuideOpen(true);
            }}
          />

          <SquadToggle enabled={showSquads} onChange={setShowSquads} />
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

  // Auto / UMAP view: original feature-correlation read-out.
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
        What the axes mean
      </div>
      {view?.description && (
        <div className="text-[11px] text-ink-subtle/90 mb-3">
          {view.description}
        </div>
      )}
      <div className="mb-2">
        <div className="text-ink-muted">
          ← {meta.x_axis.negative} / {meta.x_axis.positive} →
        </div>
        <div className="text-[10px] text-ink-subtle/80">{fmtPair(xTop)}</div>
      </div>
      <div>
        <div className="text-ink-muted">
          ↓ {meta.y_axis.negative} / {meta.y_axis.positive} ↑
        </div>
        <div className="text-[10px] text-ink-subtle/80">{fmtPair(yTop)}</div>
      </div>
    </div>
  );
}

