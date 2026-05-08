"use client";

import { useEffect, useState } from "react";
import type { AtlasView, QuadrantInfo } from "@/lib/atlas-types";

const STORAGE_PREFIX = "sba.quadrant-seen.";

function storageKey(viewId: string): string {
  return `${STORAGE_PREFIX}${viewId}`;
}

export function quadrantGuideWasSeen(viewId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(viewId)) === "1";
  } catch {
    return false;
  }
}

export function markQuadrantGuideSeen(viewId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(viewId), "1");
  } catch {
    /* ignore */
  }
}

interface Props {
  view: AtlasView | null;
  open: boolean;
  onClose: (opts?: { remember?: boolean }) => void;
}

/**
 * Centered modal explaining the 2x2 quadrant interpretation of a feature view.
 * Mirrors WelcomeCard's animation pattern: rAF-triggered enter, ~200ms exit.
 */
export default function QuadrantGuide({ view, open, onClose }: Props) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [remember, setRemember] = useState(true);

  // Reset "remember" each time the modal re-opens.
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

  // ESC to close.
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

  if (!open && !closing) return null;
  if (!view || !view.quadrants || !view.x_axis || !view.y_axis) return null;

  const { quadrants, x_axis, y_axis } = view;

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
        aria-label="Close quadrant guide"
        onClick={triggerClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default"
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quadrant-guide-title"
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
            id="quadrant-guide-title"
            className="text-[20px] sm:text-[22px] font-semibold text-ink leading-tight"
          >
            {view.label}
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
          {view.description}
        </p>

        {/* Matrix with axis arrows */}
        <div className="grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-x-2 gap-y-2 sm:gap-x-3 sm:gap-y-3">
          {/* top-left empty */}
          <div />
          {/* top: y positive */}
          <div className="flex flex-col items-center text-[11px] sm:text-[12px] uppercase tracking-wide text-ink-muted">
            <span aria-hidden className="text-accent text-base leading-none mb-0.5">↑</span>
            <span className="text-center">{y_axis.positive_label}</span>
          </div>
          <div />

          {/* left: x negative */}
          <div className="flex flex-col items-center justify-center text-[11px] sm:text-[12px] uppercase tracking-wide text-ink-muted gap-1 max-w-[72px] sm:max-w-[88px]">
            <span className="text-center leading-tight">{x_axis.negative_label}</span>
            <span aria-hidden className="text-accent text-base leading-none">←</span>
          </div>

          {/* the 2x2 grid sits in the center cell */}
          <div className="grid grid-cols-2 grid-rows-2 gap-2 sm:gap-3">
            <QuadrantCell
              corner="↖ TOP-LEFT"
              info={quadrants.top_left}
            />
            <QuadrantCell
              corner="↗ TOP-RIGHT"
              info={quadrants.top_right}
            />
            <QuadrantCell
              corner="↙ BOTTOM-LEFT"
              info={quadrants.bottom_left}
            />
            <QuadrantCell
              corner="↘ BOTTOM-RIGHT"
              info={quadrants.bottom_right}
            />
          </div>

          {/* right: x positive */}
          <div className="flex flex-col items-center justify-center text-[11px] sm:text-[12px] uppercase tracking-wide text-ink-muted gap-1 max-w-[72px] sm:max-w-[88px]">
            <span aria-hidden className="text-accent text-base leading-none">→</span>
            <span className="text-center leading-tight">{x_axis.positive_label}</span>
          </div>

          {/* bottom-left empty */}
          <div />
          {/* bottom: y negative */}
          <div className="flex flex-col items-center text-[11px] sm:text-[12px] uppercase tracking-wide text-ink-muted">
            <span className="text-center">{y_axis.negative_label}</span>
            <span aria-hidden className="text-accent text-base leading-none mt-0.5">↓</span>
          </div>
          <div />
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-line">
          <label className="inline-flex items-center gap-2 text-[12px] text-ink-subtle hover:text-ink-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-accent w-3.5 h-3.5"
            />
            <span>Don&apos;t show again for this view</span>
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

function QuadrantCell({
  corner,
  info,
}: {
  corner: string;
  info: QuadrantInfo;
}) {
  return (
    <div className="rounded-lg border border-line bg-bg-panel/60 p-3 sm:p-4 transition-colors hover:border-accent/60 hover:bg-bg-panel">
      <div className="text-[11px] sm:text-[12px] uppercase tracking-wide text-ink-subtle mb-1.5">
        {corner}
      </div>
      <div className="text-[15px] sm:text-[17px] font-semibold text-ink leading-tight mb-1">
        {info.title}
      </div>
      <div className="text-[12.5px] sm:text-[13.5px] text-ink-muted leading-snug">
        {info.description}
      </div>
    </div>
  );
}
