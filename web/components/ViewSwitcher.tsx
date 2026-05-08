"use client";

import type { AtlasView } from "@/lib/atlas-types";

interface Props {
  views: AtlasView[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Horizontal segmented control. Each view is a pill button; the active
 * button is filled with the accent. On narrow viewports the row scrolls
 * horizontally with snap, so buttons keep their natural width instead of
 * wrapping or getting squished.
 */
export default function ViewSwitcher({ views, value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Atlas view"
      className="flex items-center gap-1.5 overflow-x-auto snap-x snap-mandatory -mx-1 px-1 max-w-full
                 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {views.map((v) => {
        const active = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={v.description}
            onClick={() => onChange(v.id)}
            className={[
              "snap-start flex-shrink-0 inline-flex items-center justify-center",
              "h-9 px-3 rounded-md text-sm whitespace-nowrap",
              "border transition-all duration-150",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              active
                ? "bg-accent border-accent text-white shadow-sm"
                : "bg-bg-elevated border-line text-ink-muted hover:text-ink hover:border-accent/70 hover:-translate-y-px",
            ].join(" ")}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
