"use client";

interface Props {
  onClick: () => void;
  visible: boolean;
}

/**
 * Inline "Guide" pill, sits next to ViewSwitcher.
 * Hidden when there's no quadrant guide for the active view (e.g. auto/UMAP).
 */
export default function QuadrantGuideButton({ onClick, visible }: Props) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Open quadrant guide"
      title="Open quadrant guide"
      className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-line bg-bg-elevated text-sm text-ink-muted hover:text-ink hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 transition-colors duration-150"
    >
      <span
        aria-hidden
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-current text-[10px] font-semibold leading-none"
      >
        i
      </span>
      <span>Guide</span>
    </button>
  );
}
