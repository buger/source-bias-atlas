"use client";

import Tooltip from "./Tooltip";
import type { FeatureMeta } from "@/lib/atlas-types";

interface Props {
  label: string;
  meta?: FeatureMeta;
  /** Optional className on the wrapper. */
  className?: string;
  /** Tooltip placement. */
  placement?: "top" | "bottom" | "left" | "right";
}

/**
 * Renders a feature label followed by a small ⓘ trigger that reveals
 * the feature's description on hover/focus.
 */
export default function FeatureLabel({ label, meta, className, placement = "top" }: Props) {
  const description = meta?.description;
  return (
    <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <span>{label}</span>
      {description ? (
        <Tooltip content={description} placement={placement}>
          <span
            aria-label={`About ${label}`}
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-ink-subtle/60 text-ink-subtle text-[9px] leading-none cursor-help hover:text-ink hover:border-ink transition"
          >
            i
          </span>
        </Tooltip>
      ) : null}
    </span>
  );
}
