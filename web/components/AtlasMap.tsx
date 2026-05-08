"use client";

import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import DeckGL from "@deck.gl/react";
import {
  ScatterplotLayer,
  TextLayer,
  PolygonLayer,
  IconLayer,
} from "@deck.gl/layers";
import { OrthographicView, OrthographicViewport } from "@deck.gl/core";
import type {
  SourceSummary,
  Cluster,
  LayoutMeta,
  AtlasView,
} from "@/lib/atlas-types";

// The map only needs the slim SourceSummary shape. Locally alias as Source
// to keep the rest of the file readable.
type Source = SourceSummary;
import { convexHull, inflateHull, type Pt } from "@/lib/hull";

type RGBA = [number, number, number, number];

// How many label candidates we evaluate before giving up.
const LABEL_CANDIDATE_LIMIT = 40;
// Hard cap on visible labels regardless of zoom.
const LABEL_MAX = 14;
// Soft floor on visible labels at the default zoom.
const LABEL_MIN = 6;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return [r, g, b];
}

function darken(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(rgb[0] * (1 - amount)),
    Math.round(rgb[1] * (1 - amount)),
    Math.round(rgb[2] * (1 - amount)),
  ];
}

function lighten(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.round(rgb[0] + (255 - rgb[0]) * amount),
    Math.round(rgb[1] + (255 - rgb[1]) * amount),
    Math.round(rgb[2] + (255 - rgb[2]) * amount),
  ];
}

/** sqrt-scaled radius in [3,14] px. */
function dotRadius(posts: number): number {
  // Empirically tuned. sqrt(4825) ≈ 69, sqrt(10) ≈ 3.16.
  // Map sqrt(posts) from [3, 70] -> [3, 14].
  const v = Math.sqrt(Math.max(0, posts));
  const t = Math.min(1, Math.max(0, (v - 3) / (70 - 3)));
  return 3 + t * (14 - 3);
}

/** Estimated screen-space label rectangle width (px) from name. */
function labelWidthPx(name: string): number {
  return name.length * 6.5 + 12;
}
const LABEL_HEIGHT_PX = 16;

interface ViewState {
  target: [number, number, number];
  zoom: number;
}

interface Props {
  sources: Source[];
  clusters: Cluster[];
  highlightHandles?: Set<string> | null; // null/empty = highlight all
  activeClusterId?: number | null;
  onSourceClick?: (s: Source) => void;
  layoutMeta?: LayoutMeta | null;
  /** Currently selected projection (id). Defaults to "auto". */
  viewId?: string;
  /** All available views (provided by AtlasSummary). */
  views?: AtlasView[];
}

// Pre-built square-icon data URL used by the squad IconLayer. White on transparent
// so deck.gl's mask-color tint produces the cluster hue.
const SQUARE_ICON_URL =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect x="3" y="3" width="26" height="26" rx="3" ry="3" fill="#ffffff"/></svg>`
  );

const SQUARE_ICON = {
  url: SQUARE_ICON_URL,
  id: "squad-square",
  width: 32,
  height: 32,
  mask: true,
};

export default function AtlasMap({
  sources: rawSources,
  clusters,
  highlightHandles,
  activeClusterId,
  onSourceClick,
  layoutMeta,
  viewId = "auto",
  views = [],
}: Props) {
  // Resolve the active view (falls back to "auto" if id is unknown).
  const activeView = useMemo<AtlasView | null>(
    () => views.find((v) => v.id === viewId) ?? null,
    [views, viewId]
  );

  // Project source coords through the active view. For "auto" we keep the
  // UMAP x/y already on the source; for feature views we substitute with the
  // pre-computed view_coords[viewId] (or null if unavailable).
  const sources = useMemo<Source[]>(() => {
    if (viewId === "auto") return rawSources;
    return rawSources.map((s) => {
      const c = s.view_coords?.[viewId];
      const xy: { x: number | null; y: number | null } =
        c && Number.isFinite(c[0]) && Number.isFinite(c[1])
          ? { x: c[0], y: c[1] }
          : { x: null, y: null };
      return { ...s, x: xy.x, y: xy.y };
    });
  }, [rawSources, viewId]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const clusterColorById = useMemo(() => {
    const m = new Map<number, [number, number, number]>();
    for (const c of clusters) m.set(c.id, hexToRgb(c.color));
    return m;
  }, [clusters]);

  // Pad bbox by 15% so dots don't crowd the edges. The fit uses all plottable
  // sources (publishers + squads when in a feature view) so the initial
  // viewport hugs the whole layout, not just publishers.
  const initialViewState = useMemo<ViewState>(() => {
    const placed = sources.filter(
      (s) => Number.isFinite(s.x) && Number.isFinite(s.y)
    );
    if (placed.length === 0) {
      return { target: [0, 0, 0], zoom: 5 };
    }
    const xs = placed.map((s) => s.x as number);
    const ys = placed.map((s) => s.y as number);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rangeX = Math.max(maxX - minX, 0.5);
    const rangeY = Math.max(maxY - minY, 0.5);
    const padded = Math.max(rangeX, rangeY) * 1.15;
    const zoom = Math.log2(Math.min(size.w, size.h) / padded) || 5;
    return { target: [cx, cy, 0], zoom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, size.w, size.h, viewId]);

  // Live view state. Initialized from initialViewState; updated by deck on pan/zoom.
  const [viewState, setViewState] = useState<ViewState>(initialViewState);
  // Reset live view state whenever the input data resets the initial view.
  useEffect(() => {
    setViewState(initialViewState);
  }, [initialViewState]);

  const isActive = useCallback(
    (s: Source) => activeClusterId == null || activeClusterId === s.cluster_id,
    [activeClusterId]
  );
  const isHighlighted = useCallback(
    (s: Source) =>
      !highlightHandles || highlightHandles.size === 0 || highlightHandles.has(s.handle),
    [highlightHandles]
  );

  // Drop sources without valid coords. After this filter every entry has
  // numeric x/y, so we cast away the `null`.
  type PlacedSource = Source & { x: number; y: number };
  const plottable = useMemo<PlacedSource[]>(
    () =>
      sources.filter(
        (s) => Number.isFinite(s.x) && Number.isFinite(s.y)
      ) as PlacedSource[],
    [sources]
  );

  const publishers = useMemo(
    () => plottable.filter((s) => !s.is_squad),
    [plottable]
  );
  const squads = useMemo(
    () => plottable.filter((s) => s.is_squad),
    [plottable]
  );

  // Top-of-cluster: highest posts_collected publisher per cluster_id.
  const topByCluster = useMemo(() => {
    const m = new Map<number, Source>();
    for (const s of publishers) {
      const cur = m.get(s.cluster_id);
      if (!cur || s.posts_collected > cur.posts_collected) m.set(s.cluster_id, s);
    }
    return new Set(Array.from(m.values()).map((s) => s.handle));
  }, [publishers]);

  // Outliers: publishers far from their cluster centroid (top ~3% by distance, min dist threshold).
  // Centroids are computed from the *current view's* publisher positions
  // rather than the canonical UMAP centroids on `clusters[]`, so feature
  // views get a sensible outlier set.
  const outlierHandles = useMemo(() => {
    const centroidById = new Map<number, { x: number; y: number }>();
    const sums = new Map<number, { x: number; y: number; n: number }>();
    for (const s of publishers) {
      const cur = sums.get(s.cluster_id);
      if (cur) {
        cur.x += s.x;
        cur.y += s.y;
        cur.n += 1;
      } else {
        sums.set(s.cluster_id, { x: s.x, y: s.y, n: 1 });
      }
    }
    for (const [id, { x, y, n }] of sums.entries()) {
      centroidById.set(id, { x: x / n, y: y / n });
    }
    const dists = publishers.map((s) => {
      const c = centroidById.get(s.cluster_id);
      if (!c) return { handle: s.handle, d: 0 };
      const dx = s.x - c.x;
      const dy = s.y - c.y;
      return { handle: s.handle, d: Math.hypot(dx, dy) };
    });
    if (dists.length === 0) return new Set<string>();
    const sorted = [...dists].sort((a, b) => b.d - a.d);
    // Take top 3% but at least the cutoff distance must be > p75 + 1.5 * IQR.
    const ds = sorted.map((x) => x.d).sort((a, b) => a - b);
    const q1 = ds[Math.floor(ds.length * 0.25)] ?? 0;
    const q3 = ds[Math.floor(ds.length * 0.75)] ?? 0;
    const iqr = q3 - q1;
    const cutoff = q3 + 1.5 * iqr;
    const out = new Set<string>();
    const cap = Math.max(3, Math.ceil(dists.length * 0.03));
    for (const { handle, d } of sorted) {
      if (out.size >= cap) break;
      if (d <= cutoff) break;
      out.add(handle);
    }
    return out;
  }, [publishers]);

  // Cluster hulls (publishers only — keeps shapes tighter; squads are scattered).
  const hullPolygons = useMemo(() => {
    const byCluster = new Map<number, Pt[]>();
    for (const s of publishers) {
      let arr = byCluster.get(s.cluster_id);
      if (!arr) {
        arr = [];
        byCluster.set(s.cluster_id, arr);
      }
      arr.push([s.x, s.y]);
    }
    const polys: { id: number; color: [number, number, number]; polygon: Pt[] }[] = [];
    for (const [id, pts] of byCluster.entries()) {
      if (pts.length < 3) continue;
      const hull = convexHull(pts);
      if (hull.length < 3) continue;
      const inflated = inflateHull(hull, 0.4);
      const color = clusterColorById.get(id) ?? [200, 200, 200];
      polys.push({ id, color, polygon: inflated });
    }
    return polys;
  }, [publishers, clusterColorById]);

  // Project a world (x,y) to screen pixels using current viewState + canvas size.
  const project = useMemo(() => {
    if (size.w === 0 || size.h === 0) return null;
    const vp = new OrthographicViewport({
      width: size.w,
      height: size.h,
      target: viewState.target,
      zoom: viewState.zoom,
      flipY: false,
    });
    return (x: number, y: number): [number, number] => {
      const p = vp.project([x, y]);
      return [p[0], p[1]];
    };
  }, [size.w, size.h, viewState.target, viewState.zoom]);

  // Collision-aware label set, recomputed on viewState change.
  // Only publishers get labels (squads are highlighted via shape).
  const labeledHandles = useMemo(() => {
    if (!project) return new Set<string>();
    // Active filter: still consider all candidates so search/cluster reveals new labels.
    const candidates = [...publishers]
      .sort((a, b) => b.posts_collected - a.posts_collected)
      .slice(0, LABEL_CANDIDATE_LIMIT);

    type Rect = { x0: number; y0: number; x1: number; y1: number };
    const placed: Rect[] = [];
    const out = new Set<string>();

    // Allow more labels at higher zoom — viewport edge bound is broader.
    const zoomBoost = Math.max(0, Math.min(8, viewState.zoom - initialViewState.zoom));
    const limit = Math.min(LABEL_MAX, LABEL_MIN + Math.round(zoomBoost * 1.5));

    for (const s of candidates) {
      if (out.size >= limit) break;
      const [sx, sy] = project(s.x, s.y);
      // Off-screen with margin? skip but don't count against limit.
      if (sx < -50 || sx > size.w + 50 || sy < -50 || sy > size.h + 50) continue;

      const r = dotRadius(s.posts_collected);
      // Label sits up-right of the dot.
      const lx0 = sx + r + 4;
      const ly0 = sy - r - 4 - LABEL_HEIGHT_PX;
      const lx1 = lx0 + labelWidthPx(s.name);
      const ly1 = ly0 + LABEL_HEIGHT_PX;
      const rect: Rect = { x0: lx0, y0: ly0, x1: lx1, y1: ly1 };

      let collides = false;
      for (const p of placed) {
        if (
          rect.x0 < p.x1 &&
          rect.x1 > p.x0 &&
          rect.y0 < p.y1 &&
          rect.y1 > p.y0
        ) {
          collides = true;
          break;
        }
      }
      if (collides) continue;
      placed.push(rect);
      out.add(s.handle);
    }
    return out;
  }, [publishers, project, viewState.zoom, initialViewState.zoom, size.w, size.h]);

  const labeledSources = useMemo(
    () => publishers.filter((s) => labeledHandles.has(s.handle)),
    [publishers, labeledHandles]
  );

  const getDotFill = useCallback(
    (s: Source): RGBA => {
      const base = clusterColorById.get(s.cluster_id) ?? [200, 200, 200];
      const dim = !(isActive(s) && isHighlighted(s));
      const isHover = hoveredHandle === s.handle;
      // Default fill alpha 0.85 = 217. Hover -> full.
      const alpha = dim ? 36 : isHover ? 255 : 217;
      return [base[0], base[1], base[2], alpha];
    },
    [clusterColorById, isActive, isHighlighted, hoveredHandle]
  );

  const getDotStroke = useCallback(
    (s: Source): RGBA => {
      const base = clusterColorById.get(s.cluster_id) ?? [200, 200, 200];
      const dim = !(isActive(s) && isHighlighted(s));
      const isHover = hoveredHandle === s.handle;
      if (isHover) return [255, 255, 255, 230];
      const dk = darken(base, 0.55);
      return [dk[0], dk[1], dk[2], dim ? 30 : 110];
    },
    [clusterColorById, isActive, isHighlighted, hoveredHandle]
  );

  const getLabelColor = useCallback(
    (s: Source): RGBA => {
      const base = clusterColorById.get(s.cluster_id) ?? [200, 200, 200];
      const tinted = lighten(base, 0.6);
      const searching = !!(highlightHandles && highlightHandles.size > 0);
      const matchesSearch = searching && highlightHandles!.has(s.handle);
      const inActiveCluster = isActive(s);
      let alpha: number;
      if (matchesSearch) alpha = 255;
      else if (searching) alpha = 60;
      else if (!inActiveCluster) alpha = 50;
      else alpha = 235;
      return [tinted[0], tinted[1], tinted[2], alpha];
    },
    [clusterColorById, highlightHandles, isActive]
  );

  const getLabelBgColor = useCallback(
    (s: Source): RGBA => {
      const searching = !!(highlightHandles && highlightHandles.size > 0);
      const matchesSearch = searching && highlightHandles!.has(s.handle);
      const inActiveCluster = isActive(s);
      let alpha: number;
      if (matchesSearch) alpha = 220;
      else if (searching) alpha = 60;
      else if (!inActiveCluster) alpha = 50;
      else alpha = 200;
      return [19, 22, 29, alpha];
    },
    [highlightHandles, isActive]
  );

  const layers = useMemo(() => {
    const out: any[] = [];

    // 1. Cluster hulls (back-most).
    if (hullPolygons.length > 0) {
      out.push(
        new PolygonLayer({
          id: "cluster-hulls",
          data: hullPolygons,
          pickable: false,
          stroked: false,
          filled: true,
          getPolygon: (d: { polygon: Pt[] }) => d.polygon,
          getFillColor: (d: { id: number; color: [number, number, number] }) => {
            const dim = activeClusterId != null && d.id !== activeClusterId;
            const a = dim ? 6 : 18; // ~0.024 / 0.07
            return [d.color[0], d.color[1], d.color[2], a];
          },
          updateTriggers: {
            getFillColor: [activeClusterId],
          },
        })
      );
    }

    // 2. Outlier ring underlay (drawn under the dot, larger radius, no fill).
    out.push(
      new ScatterplotLayer<PlacedSource>({
        id: "outlier-rings",
        data: publishers.filter((s) => outlierHandles.has(s.handle)),
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: "pixels",
        radiusMinPixels: 6,
        radiusMaxPixels: 30,
        lineWidthUnits: "pixels",
        getPosition: (s) => [s.x, s.y, 0],
        getRadius: (s) => dotRadius(s.posts_collected) + 5,
        getLineColor: (s): RGBA => {
          const base = clusterColorById.get(s.cluster_id) ?? [200, 200, 200];
          const dim = activeClusterId != null && s.cluster_id !== activeClusterId;
          return [base[0], base[1], base[2], dim ? 40 : 150];
        },
        getLineWidth: 1.5,
        updateTriggers: {
          getLineColor: [activeClusterId],
        },
      })
    );

    // 3. Top-of-cluster gold rings (above outlier rings, below dots).
    out.push(
      new ScatterplotLayer<PlacedSource>({
        id: "top-cluster-rings",
        data: publishers.filter((s) => topByCluster.has(s.handle)),
        pickable: false,
        stroked: true,
        filled: false,
        radiusUnits: "pixels",
        radiusMinPixels: 8,
        radiusMaxPixels: 32,
        lineWidthUnits: "pixels",
        getPosition: (s) => [s.x, s.y, 0],
        getRadius: (s) => dotRadius(s.posts_collected) + 3.5,
        getLineColor: (s): RGBA => {
          const dim = activeClusterId != null && s.cluster_id !== activeClusterId;
          return [240, 196, 73, dim ? 50 : 215]; // warm gold
        },
        getLineWidth: 1.5,
        updateTriggers: {
          getLineColor: [activeClusterId],
        },
      })
    );

    // 4. Main publisher dots.
    out.push(
      new ScatterplotLayer<PlacedSource>({
        id: "sources",
        data: publishers,
        pickable: true,
        stroked: true,
        filled: true,
        radiusUnits: "pixels",
        radiusMinPixels: 3,
        radiusMaxPixels: 14,
        lineWidthUnits: "pixels",
        getPosition: (s) => [s.x, s.y, 0],
        getRadius: (s) => dotRadius(s.posts_collected),
        getFillColor: getDotFill,
        getLineColor: getDotStroke,
        getLineWidth: (s) => (hoveredHandle === s.handle ? 1.5 : 1),
        updateTriggers: {
          getFillColor: [activeClusterId, highlightHandles, hoveredHandle],
          getLineColor: [activeClusterId, highlightHandles, hoveredHandle],
          getLineWidth: [hoveredHandle],
        },
        onClick: (info) => {
          if (info.object && onSourceClick) onSourceClick(info.object as Source);
        },
        onHover: (info) => {
          setHoveredHandle(info.object ? (info.object as Source).handle : null);
        },
      })
    );

    // 5. Squads as squares via IconLayer (only when present).
    if (squads.length > 0) {
      out.push(
        new IconLayer<PlacedSource>({
          id: "squads",
          data: squads,
          pickable: true,
          getIcon: () => SQUARE_ICON,
          getPosition: (s) => [s.x, s.y, 0],
          // Slight bump so squads read at a similar visual weight to small dots.
          getSize: (s) => Math.max(12, dotRadius(s.posts_collected) * 1.6 + 4),
          sizeUnits: "pixels",
          getColor: (s): RGBA => {
            const base = clusterColorById.get(s.cluster_id) ?? [200, 200, 200];
            const dim = activeClusterId != null && s.cluster_id !== activeClusterId;
            const search = highlightHandles && highlightHandles.size > 0;
            const matched = search && highlightHandles!.has(s.handle);
            let alpha = 220;
            if (search && !matched) alpha = 50;
            else if (dim) alpha = 50;
            else if (hoveredHandle === s.handle) alpha = 255;
            return [base[0], base[1], base[2], alpha];
          },
          updateTriggers: {
            getColor: [activeClusterId, highlightHandles, hoveredHandle],
          },
          onClick: (info) => {
            if (info.object && onSourceClick) onSourceClick(info.object as Source);
          },
          onHover: (info) => {
            setHoveredHandle(info.object ? (info.object as Source).handle : null);
          },
        })
      );
    }

    // 6. Labels (above everything).
    out.push(
      new TextLayer<PlacedSource>({
        id: "source-labels",
        data: labeledSources,
        pickable: false,
        getPosition: (s) => [s.x, s.y, 0],
        getText: (s) => s.name,
        getPixelOffset: (s) => {
          const r = dotRadius(s.posts_collected);
          return [r + 4, -(r + 4)];
        },
        getColor: getLabelColor,
        getSize: 11,
        sizeUnits: "pixels",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        fontWeight: 500,
        getTextAnchor: "start",
        getAlignmentBaseline: "bottom",
        background: true,
        getBackgroundColor: getLabelBgColor,
        backgroundPadding: [4, 2, 4, 2],
        outlineColor: [0, 0, 0, 180],
        outlineWidth: 0,
        characterSet: "auto",
        updateTriggers: {
          getColor: [activeClusterId, highlightHandles],
          getBackgroundColor: [activeClusterId, highlightHandles],
        },
      })
    );

    return out;
  }, [
    hullPolygons,
    publishers,
    squads,
    outlierHandles,
    topByCluster,
    labeledSources,
    clusterColorById,
    activeClusterId,
    highlightHandles,
    hoveredHandle,
    getDotFill,
    getDotStroke,
    getLabelColor,
    getLabelBgColor,
    onSourceClick,
  ]);

  const getTooltip = useCallback(
    (info: { object?: Source | null }) => {
      const s = info.object;
      if (!s) return null;
      const cluster = clusters.find((c) => c.id === s.cluster_id);
      const tags = (s.top_tags_preview ?? []).slice(0, 3).map((t) => t[0]).join(", ");
      const isTopOfCluster = topByCluster.has(s.handle);
      const isOutlier = outlierHandles.has(s.handle);
      const badges: string[] = [];
      if (s.is_squad) badges.push("Squad");
      if (isTopOfCluster) badges.push("Top of cluster");
      if (isOutlier) badges.push("Outlier");
      const badgeHtml = badges.length
        ? `<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;">${badges
            .map(
              (b) =>
                `<span style="font-size:10px;padding:1px 6px;border-radius:9999px;background:#262b36;color:#cdd2dc;">${escapeHtml(
                  b
                )}</span>`
            )
            .join("")}</div>`
        : "";
      return {
        html: `
        <div style="font-family: ui-sans-serif, system-ui; font-size: 12px; color: #e6e8ec;">
          <div style="font-weight: 600; color: ${cluster?.color ?? "#fff"};">${escapeHtml(s.name)}</div>
          <div style="opacity: 0.7;">@${escapeHtml(s.handle)}</div>
          <div style="margin-top: 4px;">${escapeHtml(cluster?.label ?? "")}</div>
          <div style="opacity: 0.7;">${escapeHtml(tags)}</div>
          <div style="opacity: 0.5; margin-top: 4px;">${s.posts_collected} posts</div>
          ${badgeHtml}
        </div>`,
        style: {
          background: "rgba(19,22,29,0.95)",
          border: "1px solid #262b36",
          borderRadius: "6px",
          padding: "8px 10px",
        },
      };
    },
    [clusters, topByCluster, outlierHandles]
  );

  return (
    <div ref={containerRef} className="relative w-full h-full bg-bg overflow-hidden">
      <GridBackground />
      <DeckGL
        views={new OrthographicView({ flipY: false })}
        viewState={viewState as unknown as Record<string, unknown>}
        onViewStateChange={({ viewState: vs }: { viewState: any }) => {
          setViewState({
            target: vs.target ?? [0, 0, 0],
            zoom: typeof vs.zoom === "number" ? vs.zoom : 5,
          });
        }}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
        style={{ position: "absolute", inset: "0" }}
      />
      {(() => {
        // Pick axis labels from the active view if it's a feature view;
        // otherwise fall back to the auto/UMAP layout meta.
        if (activeView && activeView.source === "feature" && activeView.x_axis && activeView.y_axis) {
          return (
            <AxisLabels
              x_pos={activeView.x_axis.positive_label}
              x_neg={activeView.x_axis.negative_label}
              y_pos={activeView.y_axis.positive_label}
              y_neg={activeView.y_axis.negative_label}
            />
          );
        }
        // For the UMAP/auto view we deliberately omit canvas-edge axis labels:
        // UMAP coordinates are not a real x/y axis (re-running rotates the whole
        // layout). Showing labels misleads users into reading them as features.
        // The sidebar AxesPanel explains the loose correlations honestly.
        return null;
      })()}
      <Legend hasSquads={squads.length > 0} />
    </div>
  );
}

function Legend({ hasSquads }: { hasSquads: boolean }) {
  return (
    <div
      className="absolute bottom-3 right-3 bg-bg-elevated/85 border border-line rounded-md text-[10px] text-ink-muted px-2.5 py-2 pointer-events-none select-none leading-snug"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-3 h-3 rounded-full border-2 border-[#f0c449]" />
        <span>Top of cluster</span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-3 h-3 rounded-full border border-[#9aa3b3]" />
        <span>Outlier</span>
      </div>
      {hasSquads && (
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3"
            style={{ background: "#9aa3b3", borderRadius: "2px" }}
          />
          <span>Squad</span>
        </div>
      )}
    </div>
  );
}

function AxisLabels({
  x_pos,
  x_neg,
  y_pos,
  y_neg,
}: {
  x_pos: string;
  x_neg: string;
  y_pos: string;
  y_neg: string;
}) {
  const baseClass =
    "absolute pointer-events-none text-ink-subtle uppercase tracking-wider select-none";
  const style: React.CSSProperties = {
    fontSize: "10px",
    letterSpacing: "0.12em",
  };
  return (
    <>
      {/* Right edge: x positive */}
      <div
        className={`${baseClass} right-3 top-1/2 -translate-y-1/2`}
        style={style}
      >
        → {x_pos}
      </div>
      {/* Left edge: x negative */}
      <div
        className={`${baseClass} left-3 top-1/2 -translate-y-1/2`}
        style={style}
      >
        {x_neg} ←
      </div>
      {/* Top edge: y positive */}
      <div
        className={`${baseClass} top-3 left-1/2 -translate-x-1/2`}
        style={style}
      >
        ↑ {y_pos}
      </div>
      {/* Bottom edge: y negative */}
      <div
        className={`${baseClass} bottom-3 left-1/2 -translate-x-1/2`}
        style={style}
      >
        ↓ {y_neg}
      </div>
    </>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function GridBackground() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none opacity-30"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern id="atlas-grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#262b36" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#atlas-grid)" />
    </svg>
  );
}
