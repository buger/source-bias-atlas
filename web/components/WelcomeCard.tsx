"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LayoutMeta } from "@/lib/atlas-types";

const STORAGE_KEY = "sba.welcome.dismissed.v1";

interface Props {
  layoutMeta: LayoutMeta | undefined;
  /** Controlled-open. If undefined, the component manages its own state via localStorage. */
  open?: boolean;
  onClose?: () => void;
}

export default function WelcomeCard({ layoutMeta, open, onClose }: Props) {
  // Internal "should-show" state used only when uncontrolled.
  const [internalOpen, setInternalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);

  const isControlled = open !== undefined;
  const visible = isControlled ? !!open : internalOpen;

  // Trigger the enter transition on the next frame after mount.
  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    if (isControlled) return;
    if (typeof window === "undefined") return;
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setInternalOpen(true);
    } catch {
      setInternalOpen(true);
    }
  }, [isControlled]);

  const handleClose = () => {
    setClosing(true);
    // brief animation, then actually close
    window.setTimeout(() => {
      setClosing(false);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
      if (isControlled) {
        onClose?.();
      } else {
        setInternalOpen(false);
        onClose?.();
      }
    }, 180);
  };

  if (!visible && !closing) return null;

  const xText = layoutMeta
    ? `← ${layoutMeta.x_axis.negative} / ${layoutMeta.x_axis.positive} →`
    : null;
  const yText = layoutMeta
    ? `↓ ${layoutMeta.y_axis.negative} / ${layoutMeta.y_axis.positive} ↑`
    : null;

  return (
    // Parent is pointer-events-none so the user can still pan/zoom under the
    // unused empty space; the card itself enables pointer events.
    <div
      className="absolute inset-0 z-20 pointer-events-none flex items-end justify-end p-4"
      aria-hidden={closing}
    >
      <div
        role="dialog"
        aria-labelledby="welcome-title"
        className={[
          "pointer-events-auto",
          "w-[340px] max-w-[calc(100vw-2rem)]",
          "rounded-lg border border-line bg-bg-elevated/95 backdrop-blur",
          "shadow-2xl",
          "p-4",
          "transition-all duration-200 ease-out",
          closing || !entered ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 id="welcome-title" className="text-sm font-semibold text-ink">
            <span className="text-accent">●</span> Welcome to the Source Bias Atlas
          </h3>
          <button
            onClick={handleClose}
            aria-label="Dismiss welcome card"
            className="text-ink-subtle hover:text-ink transition -mr-1 -mt-1 p-1 rounded"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="text-[13px] text-ink-muted leading-relaxed mb-3">
          A map of daily.dev&apos;s content sources, clustered by stylistic personality.
          Similar sources sit close together.
        </p>

        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-subtle mb-1">
            What you can do
          </div>
          <ul className="text-[12.5px] text-ink-muted space-y-1 list-disc pl-4">
            <li>Click a dot to inspect that source</li>
            <li>Click a cluster name to focus its members</li>
            <li>Compare any two sources side-by-side</li>
          </ul>
        </div>

        {xText && yText && (
          <div className="mb-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-subtle mb-1">
              What the axes mean
            </div>
            <div className="text-[12px] text-ink-muted">{xText}</div>
            <div className="text-[12px] text-ink-muted">{yText}</div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-line">
          <Link
            href="/about"
            className="text-[12px] text-ink-subtle hover:text-accent transition"
          >
            Read more →
          </Link>
          <button
            onClick={handleClose}
            className="px-3 py-1.5 rounded-md bg-accent text-bg text-[12px] font-medium hover:opacity-90 transition"
          >
            Got it
          </button>
        </div>
      </div>

    </div>
  );
}

/** Helper: returns whether the welcome card has previously been dismissed. */
export function welcomeWasDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
