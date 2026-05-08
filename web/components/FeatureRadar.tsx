"use client";

import {
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { FeatureKey, FeatureMeta, SourceDetail } from "@/lib/atlas-types";
import { RADAR_FEATURES } from "@/lib/atlas-types";
import { normalize } from "@/lib/formatting";
import FeatureLabel from "./FeatureLabel";

interface Series {
  name: string;
  color: string;
  source: SourceDetail;
}

export default function FeatureRadar({
  series,
  metadata,
  features = RADAR_FEATURES,
}: {
  series: Series[];
  metadata: Record<FeatureKey, FeatureMeta>;
  features?: FeatureKey[];
}) {
  const data = features.map((key) => {
    const meta = metadata[key];
    const row: Record<string, string | number> = { feature: meta?.label ?? key };
    for (const s of series) {
      const raw = s.source.features[key] ?? 0;
      const value = normalize(raw, meta?.min ?? 0, meta?.max ?? 1);
      // for "higher_is: less" features, invert so visually larger = "more of the personality dimension"
      row[s.name] = meta?.higher_is === "less" ? 1 - value : value;
    }
    return row;
  });

  return (
    <div className="w-full">
      <div className="w-full h-[360px]">
        <ResponsiveContainer>
          <RadarChart data={data} outerRadius="75%">
            <PolarGrid stroke="#262b36" />
            <PolarAngleAxis dataKey="feature" tick={{ fill: "#9aa0ac", fontSize: 11 }} />
            <PolarRadiusAxis
              domain={[0, 1]}
              tick={{ fill: "#6a7180", fontSize: 10 }}
              stroke="#262b36"
            />
            {series.map((s) => (
              <Radar
                key={s.name}
                name={s.name}
                dataKey={s.name}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.25}
                isAnimationActive={false}
              />
            ))}
            <Legend wrapperStyle={{ color: "#e6e8ec" }} />
            <Tooltip
              contentStyle={{
                background: "#13161d",
                border: "1px solid #262b36",
                borderRadius: 6,
                color: "#e6e8ec",
              }}
              formatter={(value: number) => value.toFixed(2)}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 px-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
        {features.map((key) => {
          const meta = metadata[key];
          return (
            <FeatureLabel
              key={key}
              label={meta?.label ?? key}
              meta={meta}
              placement="top"
            />
          );
        })}
      </div>
    </div>
  );
}
