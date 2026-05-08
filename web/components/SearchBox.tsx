"use client";

export default function SearchBox({
  value,
  onChange,
  placeholder = "Search sources…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-elevated border border-line rounded-md px-3 py-1.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink text-sm"
        >
          ×
        </button>
      )}
    </div>
  );
}
