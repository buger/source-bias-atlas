import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Source Bias Atlas",
  description:
    "An interactive map of daily.dev's content sources, clustered by stylistic personality.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-30">
            <div className="px-4 py-3 flex items-center gap-6">
              <Link href="/" className="font-semibold tracking-tight text-ink hover:text-accent transition">
                <span className="text-accent">●</span> Source Bias Atlas
              </Link>
              <nav className="flex items-center gap-4 text-sm text-ink-muted">
                <Link href="/" className="hover:text-ink transition">Atlas</Link>
                <Link href="/compare" className="hover:text-ink transition">Compare</Link>
                <Link href="/diet" className="hover:text-ink transition">Diet</Link>
                <Link href="/about" className="hover:text-ink transition">About</Link>
              </nav>
              <a
                href="https://buger.github.io/source-originality-score/"
                className="ml-auto text-xs text-ink-muted hover:text-accent transition"
                title="Sibling experiment: who scoops, who echoes"
              >
                → Source Originality Score
              </a>
            </div>
          </header>
          <main className="flex-1 min-h-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
