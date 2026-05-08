"use client";

interface Props {
  onClick: () => void;
  visible: boolean;
}

/**
 * Floating "?" button anchored to the bottom-right of its positioned parent.
 * Use to re-open the welcome card after dismissal.
 */
export default function HelpButton({ onClick, visible }: Props) {
  if (!visible) return null;
  return (
    <button
      onClick={onClick}
      aria-label="Show help"
      title="Show help (press ?)"
      className="absolute bottom-4 right-4 z-20 w-9 h-9 rounded-full border border-line bg-bg-elevated/90 backdrop-blur text-ink-muted hover:text-ink hover:border-accent transition flex items-center justify-center shadow-lg"
    >
      <span className="text-[15px] font-semibold">?</span>
    </button>
  );
}
