#!/usr/bin/env node
/**
 * Generate a 1200x630 OG image for Source Bias Atlas.
 *
 * Renders an SVG (dark theme with cluster-dot decoration), then shells out to
 * rsvg-convert (preferred) or sharp (fallback) to write a PNG to public/og.png.
 *
 * Why SVG-first: deck.gl/UMAP rendering at build time is overkill and pulls
 * in heavy dependencies. The OG image is decorative — a stylised cluster
 * scatter that hints at the product without claiming to be the live data.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(PROJECT_ROOT, "public");
const SVG_PATH = join(PUBLIC_DIR, "og.svg");
const PNG_PATH = join(PUBLIC_DIR, "og.png");

if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });

// --- Pseudo-random cluster scatter ---------------------------------------
// Deterministic seed so the OG image stays stable across builds.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const CLUSTER_COLORS = [
  "#ff5b1f", // accent orange
  "#7c5cff", // accent alt purple
  "#ffb86b", // warm
  "#5fd0bf", // teal
  "#f55b88", // pink
  "#5b9eff", // blue
  "#c2c5ce", // ink
];

const rng = makeRng(20260507);
// Place ~7 cluster centres, each spawning a halo of dots.
const CLUSTERS = Array.from({ length: 7 }, (_, i) => ({
  cx: 760 + Math.cos((i / 7) * Math.PI * 2) * (160 + rng() * 60),
  cy: 360 + Math.sin((i / 7) * Math.PI * 2) * (140 + rng() * 60),
  r: 40 + rng() * 30,
  count: 14 + Math.floor(rng() * 18),
  color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
}));

const dotsSvg = CLUSTERS.flatMap((cluster) => {
  const dots = [];
  for (let i = 0; i < cluster.count; i++) {
    // gaussian-ish via two-uniform sum
    const angle = rng() * Math.PI * 2;
    const radius = (rng() + rng()) * 0.5 * cluster.r;
    const x = cluster.cx + Math.cos(angle) * radius;
    const y = cluster.cy + Math.sin(angle) * radius;
    const size = 2.5 + rng() * 4;
    const opacity = 0.55 + rng() * 0.4;
    dots.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${size.toFixed(1)}" fill="${cluster.color}" fill-opacity="${opacity.toFixed(2)}"/>`,
    );
  }
  // bright cluster centre dot
  dots.push(
    `<circle cx="${cluster.cx.toFixed(1)}" cy="${cluster.cy.toFixed(1)}" r="6" fill="${cluster.color}"/>`,
    `<circle cx="${cluster.cx.toFixed(1)}" cy="${cluster.cy.toFixed(1)}" r="14" fill="none" stroke="${cluster.color}" stroke-opacity="0.35" stroke-width="1.5"/>`,
  );
  return dots;
}).join("\n");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="bgglow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="#1a1e27" stop-opacity="1"/>
      <stop offset="100%" stop-color="#0b0d12" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#ff5b1f"/>
      <stop offset="100%" stop-color="#ffb86b"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- background -->
  <rect width="1200" height="630" fill="url(#bgglow)"/>

  <!-- subtle grid -->
  <g stroke="#262b36" stroke-width="1" stroke-opacity="0.5">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 60}" x2="1200" y2="${i * 60}"/>`).join("")}
    ${Array.from({ length: 21 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="630"/>`).join("")}
  </g>

  <!-- decorative cluster scatter (right side) -->
  <g filter="url(#glow)">
    ${dotsSvg}
  </g>

  <!-- left text block -->
  <g>
    <!-- brand pill -->
    <g transform="translate(70 80)">
      <circle cx="8" cy="8" r="7" fill="#ff5b1f"/>
      <text x="24" y="13" fill="#9aa0ac" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="16" font-weight="500" letter-spacing="0.04em">SOURCE BIAS ATLAS</text>
    </g>

    <!-- headline -->
    <text x="70" y="220" fill="#e6e8ec" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="78" font-weight="700" letter-spacing="-0.02em">A map of</text>
    <text x="70" y="305" fill="#e6e8ec" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="78" font-weight="700" letter-spacing="-0.02em">daily.dev&apos;s</text>
    <text x="70" y="390" fill="url(#accent)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="78" font-weight="700" letter-spacing="-0.02em">content sources.</text>

    <!-- subtitle -->
    <text x="70" y="465" fill="#9aa0ac" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="400">Clustered by stylistic personality —</text>
    <text x="70" y="500" fill="#9aa0ac" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="26" font-weight="400">hype, depth, cadence, discussion.</text>

    <!-- footer line -->
    <line x1="70" y1="555" x2="220" y2="555" stroke="#ff5b1f" stroke-width="3"/>
    <text x="70" y="585" fill="#6a7180" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="16" font-weight="500" letter-spacing="0.04em">DAILY.DEV PUBLIC API HACKATHON · 2026</text>
  </g>
</svg>
`;

writeFileSync(SVG_PATH, svg, "utf8");
console.log(`Wrote ${SVG_PATH}`);

// --- Convert to PNG ------------------------------------------------------
const tryRsvg = spawnSync("rsvg-convert", [
  "-w",
  "1200",
  "-h",
  "630",
  "-o",
  PNG_PATH,
  SVG_PATH,
]);

if (tryRsvg.status === 0) {
  console.log(`Wrote ${PNG_PATH} (via rsvg-convert)`);
  process.exit(0);
}

console.error("rsvg-convert failed:", tryRsvg.stderr?.toString() ?? tryRsvg.error);
console.error("Falling back: keeping og.svg only (no PNG generated).");
process.exit(0);
