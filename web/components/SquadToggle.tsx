"use client";

export default function SquadToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 h-9 px-1 text-sm text-ink-muted cursor-pointer select-none hover:text-ink transition-colors duration-150">
      <span className="relative inline-block">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block w-9 h-5 rounded-full bg-bg-elevated border border-line peer-checked:bg-accent/30 peer-checked:border-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-elevated transition-colors duration-150" />
        <span className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-ink-subtle peer-checked:bg-accent peer-checked:translate-x-4 transition-transform duration-150 pointer-events-none" />
      </span>
      Show squads
    </label>
  );
}
