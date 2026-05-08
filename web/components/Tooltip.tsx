"use client";

import { useId, useState, useRef, useEffect } from "react";

interface Props {
  content: string;
  children: React.ReactNode;
  /** "top" | "bottom" | "left" | "right" — where the bubble appears. Default "top". */
  placement?: "top" | "bottom" | "left" | "right";
}

/**
 * Lightweight, dependency-free tooltip.
 * - Wraps an inline trigger.
 * - Shows on hover and keyboard focus.
 * - Linked via aria-describedby for screen readers.
 */
export default function Tooltip({ content, children, placement = "top" }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const placementClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute z-50 ${placementClasses[placement]} pointer-events-none`}
        >
          <span
            className="block rounded-md border border-line bg-bg-elevated text-ink text-[12px] leading-snug px-2.5 py-1.5 shadow-lg"
            style={{ width: "max-content", maxWidth: 280 }}
          >
            {content}
          </span>
        </span>
      )}
    </span>
  );
}
