// Geometric helpers for finding nearest / farthest sources by 2D coordinates.
// Currently unused by the app — neighbors are now precomputed at build time
// and shipped inline in /sources/<handle>.json. Kept for future client-side
// experiments (e.g. live re-ranking against the slim summary).

import type { SourceSummary } from "./atlas-types";

type Placed = SourceSummary & { x: number; y: number };

function isPlaced(s: SourceSummary): s is Placed {
  return Number.isFinite(s.x) && Number.isFinite(s.y);
}

function dist2(a: Placed, b: Placed) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function nearestSources(
  target: SourceSummary,
  all: SourceSummary[],
  k: number
): SourceSummary[] {
  if (!isPlaced(target)) return [];
  return all
    .filter(isPlaced)
    .filter((s) => s.id !== target.id)
    .map((s) => ({ s, d: dist2(target, s) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map((x) => x.s);
}

export function farthestSources(
  target: SourceSummary,
  all: SourceSummary[],
  k: number
): SourceSummary[] {
  if (!isPlaced(target)) return [];
  return all
    .filter(isPlaced)
    .filter((s) => s.id !== target.id)
    .map((s) => ({ s, d: dist2(target, s) }))
    .sort((a, b) => b.d - a.d)
    .slice(0, k)
    .map((x) => x.s);
}
