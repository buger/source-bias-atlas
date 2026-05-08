"use client";

export default function SquadToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-muted cursor-pointer select-none">
      <span className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block w-9 h-5 rounded-full bg-bg-elevated border border-line peer-checked:bg-accent/40 peer-checked:border-accent transition" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-ink-muted peer-checked:bg-accent peer-checked:translate-x-4 transition" />
      </span>
      Show squads
    </label>
  );
}
