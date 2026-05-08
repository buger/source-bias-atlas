"use client";

import type { AtlasView } from "@/lib/atlas-types";
import Tooltip from "@/components/Tooltip";

interface Props {
  views: AtlasView[];
  value: string;
  onChange: (id: string) => void;
}

/**
 * Compact view picker. Uses a native <select> for simplicity and
 * accessibility (avoids a custom dropdown). The current view's
 * description is exposed via a small "?" tooltip next to the picker.
 */
export default function ViewSwitcher({ views, value, onChange }: Props) {
  const current = views.find((v) => v.id === value);
  return (
    <div className="inline-flex items-center gap-2 text-sm text-ink-muted">
      <label htmlFor="atlas-view-select" className="select-none text-ink-subtle">
        View
      </label>
      <select
        id="atlas-view-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-bg-elevated border border-line rounded-md px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none cursor-pointer"
      >
        {views.map((v) => (
          <option key={v.id} value={v.id} title={v.description}>
            {v.label}
          </option>
        ))}
      </select>
      {current && (
        <Tooltip content={current.description} placement="bottom">
          <span
            aria-label="View description"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-line text-[10px] text-ink-subtle cursor-help"
          >
            ?
          </span>
        </Tooltip>
      )}
    </div>
  );
}
