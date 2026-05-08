"use client";

import type { FeatureKey, FeatureMeta, SourceDetail } from "@/lib/atlas-types";
import { normalize } from "@/lib/formatting";
import FeatureLabel from "./FeatureLabel";

interface Props {
  a: SourceDetail;
  b: SourceDetail;
  metadata: Record<FeatureKey, FeatureMeta>;
  features: FeatureKey[];
  colorA: string;
  colorB: string;
}

export default function FeatureBar({ a, b, metadata, features, colorA, colorB }: Props) {
  return (
    <div className="space-y-3">
      {features.map((key) => {
        const meta = metadata[key];
        const va = a.features[key] ?? 0;
        const vb = b.features[key] ?? 0;
        const na = normalize(va, meta?.min ?? 0, meta?.max ?? 1);
        const nb = normalize(vb, meta?.min ?? 0, meta?.max ?? 1);
        // who "wins" depending on polarity
        const aIsHigher = va > vb;
        const winner =
          va === vb ? "tie" :
          meta?.higher_is === "less"
            ? (aIsHigher ? "b" : "a")
            : (aIsHigher ? "a" : "b");

        return (
          <div key={key} className="grid grid-cols-[1fr_2fr_1fr] gap-3 items-center">
            <div className="text-xs text-ink-muted text-right truncate flex justify-end">
              <FeatureLabel label={meta?.label ?? key} meta={meta} placement="right" />
            </div>
            <div className="space-y-1">
              <Bar value={na} color={colorA} label={va.toFixed(2)} />
              <Bar value={nb} color={colorB} label={vb.toFixed(2)} />
            </div>
            <div>
              {winner !== "tie" && (
                <span
                  className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{
                    background: winner === "a" ? `${colorA}33` : `${colorB}33`,
                    color: winner === "a" ? colorA : colorB,
                    border: `1px solid ${winner === "a" ? colorA : colorB}66`,
                  }}
                >
                  {winner === "a" ? a.handle : b.handle}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="relative h-4 bg-bg rounded overflow-hidden">
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
      />
      <span className="absolute inset-y-0 right-1.5 flex items-center text-[10px] text-ink-muted">
        {label}
      </span>
    </div>
  );
}
