"use client";

import { usePathname } from "next/navigation";

interface FooterProps {
  projectName: string;
  siblingHref: string;
  siblingLabel: string;
  githubRepo: string;
}

/**
 * Subtle footer shared across pages.
 *
 * Hidden on the home route ("/") because the atlas occupies the full viewport
 * there; visible on every other route. Doesn't dominate visually.
 */
export default function Footer({
  projectName,
  siblingHref,
  siblingLabel,
  githubRepo,
}: FooterProps) {
  const pathname = usePathname();
  // Atlas home page renders a full-viewport canvas; suppress footer there.
  if (pathname === "/" || pathname === "") return null;

  return (
    <footer className="border-t border-line/70 bg-bg/40 mt-auto">
      <div className="px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-[11px] text-ink-subtle">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-1.5 h-1.5 rounded-full bg-accent/70"
          />
          <span className="text-ink-muted">{projectName}</span>
          <span className="hidden sm:inline">·</span>
          <span>Built for daily.dev&apos;s 2026 Public API Hackathon</span>
        </div>
        <div className="flex items-center gap-3 sm:ml-auto">
          <a
            href={siblingHref}
            className="hover:text-ink transition-colors duration-150"
            title="Sibling project"
          >
            {siblingLabel} →
          </a>
          <span aria-hidden className="text-ink-subtle/40">·</span>
          <a
            href={githubRepo}
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition-colors duration-150"
          >
            GitHub
          </a>
          <span aria-hidden className="text-ink-subtle/40">·</span>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
