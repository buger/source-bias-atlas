"use client";

import { useEffect, useState } from "react";
import type { AtlasView } from "@/lib/atlas-types";

const STORAGE_KEY = "sba.umap-guide.seen";

export function umapGuideWasSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markUmapGuideSeen(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

interface Props {
  open: boolean;
  /** All available views — we surface the feature views as quick-switch CTAs. */
  views: AtlasView[];
  onClose: (opts?: { remember?: boolean }) => void;
  /** Switch atlas view (and close the modal). */
  onSwitchView: (id: string) => void;
}

/**
 * Auto-arranged (UMAP) explanation modal.
 *
 * Mirrors QuadrantGuide's animation pattern (rAF enter, ~200ms exit) and
 * "Don't show again" persistence. The key teaching addition vs. the inline
 * AxesPanel copy: a CTA list that switches the user into a feature view in
 * one click, where axes are literal.
 */
export default function UmapGuide({ open, views, onClose, onSwitchView }: Props) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (open) setRemember(true);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        triggerClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, remember]);

  const triggerClose = () => {
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose({ remember });
    }, 200);
  };

  const handleSwitch = (id: string) => {
    // Persist "seen" if the user opted in, then switch + close.
    if (remember) markUmapGuideSeen();
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onSwitchView(id);
    }, 200);
  };

  if (!open && !closing) return null;

  // Only feature views (Engagement × Discussion, Volume × Depth, etc.).
  const featureViews = views.filter((v) => v.source === "feature");

  return (
    <div
      className={[
        "fixed inset-0 z-40 flex items-center justify-center",
        "p-4 sm:p-6",
        "transition-opacity duration-300 ease-out",
        closing || !entered ? "opacity-0" : "opacity-100",
      ].join(" ")}
      aria-hidden={closing}
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close UMAP guide"
        onClick={triggerClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="umap-guide-title"
        className={[
          "relative w-full max-w-[640px] max-h-[calc(100vh-2rem)] overflow-y-auto",
          "rounded-xl border border-line bg-bg-elevated shadow-2xl",
          "p-5 sm:p-8",
          "transition-all duration-300 ease-out",
          closing || !entered
            ? "opacity-0 scale-95 translate-y-2"
            : "opacity-100 scale-100 translate-y-0",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-1">
          <h2
            id="umap-guide-title"
            className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight"
          >
            Auto-arranged (UMAP)
          </h2>
          <button
            onClick={triggerClose}
            aria-label="Close"
            className="text-ink-subtle hover:text-ink transition -mr-2 -mt-2 p-2 rounded"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <p className="text-[13px] sm:text-[14px] text-ink-muted leading-relaxed mb-5 sm:mb-6">
          How this layout works
        </p>

        {/* Body */}
        <div className="space-y-4 text-[13px] sm:text-[14px] text-ink-muted leading-relaxed">
          <div>
            <div className="text-ink font-medium mb-1">What it is</div>
            <p>
              A 2D embedding where similar sources are placed near each other.
              Re-running UMAP could rotate the entire layout — the x and y
              coordinates have <em>no canonical meaning</em>.
            </p>
          </div>

          <div>
            <div className="text-ink font-medium mb-1">What carries the signal</div>
            <p>
              Cluster colors and proximity to neighbors. <strong>Not</strong>{" "}
              &ldquo;up vs. down&rdquo; or &ldquo;left vs. right&rdquo;.
            </p>
          </div>

          {/* Visual hint */}
          <div className="rounded-lg border border-line bg-bg-panel/60 p-4">
            <UmapDiagram />
            <div className="mt-2 text-[11.5px] text-ink-subtle text-center">
              Tribes form blobs; nearby dots = similar sources.
            </div>
          </div>
        </div>

        {/* CTA: feature views */}
        {featureViews.length > 0 && (
          <div className="mt-6 pt-4 border-t border-line">
            <div className="text-[12px] uppercase tracking-wide text-ink-muted mb-1">
              Want sharp axes you can read literally?
            </div>
            <div className="text-[12.5px] text-ink-subtle mb-3">
              Try a feature view — every position has a concrete meaning.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {featureViews.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleSwitch(v.id)}
                  className="text-left rounded-lg border border-line bg-bg-panel/60 hover:bg-bg-panel hover:border-accent/60 transition-colors p-3 group"
                >
                  <div className="text-[13.5px] font-medium text-ink group-hover:text-accent transition-colors mb-0.5">
                    {v.label} →
                  </div>
                  <div className="text-[11.5px] text-ink-subtle leading-snug">
                    {v.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-line">
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-subtle hover:text-ink-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            <span>Don&apos;t show again</span>
          </label>
          <button
            onClick={triggerClose}
            className="px-4 py-1.5 rounded-md bg-accent text-bg text-[13px] font-medium hover:opacity-90 transition"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tiny inline diagram: two clusters with a "neighbors = similar" hint.
 * Pure SVG, no external deps.
 */
function UmapDiagram() {
  return (
    <svg
      viewBox="0 0 280 90"
      width="100%"
      height="90"
      role="img"
      aria-label="Two cluster blobs labeled tribe A and tribe B"
      className="block"
    >
      {/* Tribe A blob */}
      <ellipse cx="70" cy="48" rx="40" ry="28" fill="#7c5cff" fillOpacity="0.18" stroke="#7c5cff" strokeOpacity="0.55" />
      {/* dots inside A */}
      <circle cx="55" cy="40" r="3" fill="#7c5cff" />
      <circle cx="72" cy="36" r="3" fill="#7c5cff" />
      <circle cx="85" cy="50" r="3" fill="#7c5cff" />
      <circle cx="62" cy="58" r="3" fill="#7c5cff" />
      <circle cx="78" cy="62" r="3" fill="#7c5cff" />
      <text x="70" y="20" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">
        tribe A
      </text>

      {/* Tribe B blob */}
      <ellipse cx="210" cy="48" rx="40" ry="28" fill="#3ecbb1" fillOpacity="0.18" stroke="#3ecbb1" strokeOpacity="0.55" />
      <circle cx="195" cy="44" r="3" fill="#3ecbb1" />
      <circle cx="210" cy="38" r="3" fill="#3ecbb1" />
      <circle cx="225" cy="50" r="3" fill="#3ecbb1" />
      <circle cx="200" cy="58" r="3" fill="#3ecbb1" />
      <circle cx="220" cy="62" r="3" fill="#3ecbb1" />
      <text x="210" y="20" textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.7">
        tribe B
      </text>

      {/* "neighbors = similar" arrow inside tribe A */}
      <line x1="55" y1="40" x2="72" y2="36" stroke="currentColor" strokeOpacity="0.45" strokeWidth="1" strokeDasharray="2 2" />
      <text x="63" y="80" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">
        neighbors = similar
      </text>
    </svg>
  );
}
