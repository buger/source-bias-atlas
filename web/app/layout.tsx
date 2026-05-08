import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Footer from "@/components/Footer";

const SITE_URL = "https://buger.github.io/source-bias-atlas/";
const SIBLING_URL = "https://buger.github.io/source-originality-score/";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const TITLE = "Source Bias Atlas — daily.dev";
const DESCRIPTION =
  "An interactive map of daily.dev's content sources, clustered by stylistic personality. See which sources are firehose news, which are deep technical longreads, which spark the most discussion.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Source Bias Atlas",
  },
  description: DESCRIPTION,
  applicationName: "Source Bias Atlas",
  keywords: [
    "daily.dev",
    "source atlas",
    "content clustering",
    "developer news",
    "media bias",
    "UMAP",
    "k-means",
    "hackathon",
  ],
  authors: [{ name: "Built for daily.dev's 2026 Public API Hackathon" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: TITLE,
    description: DESCRIPTION,
    siteName: "Source Bias Atlas",
    images: [
      {
        url: `${SITE_URL}og.png`,
        width: 1200,
        height: 630,
        alt: "Source Bias Atlas — clusters of daily.dev content sources",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}og.png`],
  },
  icons: {
    icon: `${BASE_PATH}/favicon.svg`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-line bg-bg/80 backdrop-blur sticky top-0 z-30">
            <div className="px-4 py-3 flex items-center gap-4 sm:gap-6">
              <Link
                href="/"
                prefetch
                className="font-semibold tracking-tight text-ink hover:text-accent transition-colors duration-150 flex items-center gap-2"
                aria-label="Source Bias Atlas — home"
              >
                <span
                  aria-hidden
                  className="inline-block w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(255,91,31,0.7)]"
                />
                <span className="hidden sm:inline">Source Bias Atlas</span>
                <span className="sm:hidden">SBA</span>
              </Link>
              <nav className="flex items-center gap-3 sm:gap-4 text-sm text-ink-muted">
                <Link href="/" prefetch className="hover:text-ink transition-colors duration-150">Atlas</Link>
                <Link href="/compare" prefetch className="hover:text-ink transition-colors duration-150">Compare</Link>
                <Link href="/diet" prefetch className="hover:text-ink transition-colors duration-150 hidden sm:inline">Diet</Link>
                <Link href="/about" prefetch className="hover:text-ink transition-colors duration-150">About</Link>
              </nav>
              <a
                href={SIBLING_URL}
                className="ml-auto hidden md:inline-flex items-center gap-1.5 rounded-md border border-line/70 bg-bg-elevated/60 px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:border-[#ff2e6a]/60 transition-colors duration-150"
                title="Sibling experiment: who scoops, who echoes"
              >
                <span
                  aria-hidden
                  className="inline-block w-1.5 h-1.5 rounded-full bg-[#ff2e6a]"
                />
                <span>Originality Score</span>
                <span aria-hidden>→</span>
              </a>
              <a
                href={SIBLING_URL}
                className="ml-auto md:hidden text-xs text-ink-muted hover:text-accent transition-colors duration-150"
                title="Sibling experiment"
                aria-label="Source Originality Score"
              >
                Originality →
              </a>
            </div>
          </header>
          <main className="flex-1 min-h-0">{children}</main>
          <Footer
            siblingHref={SIBLING_URL}
            siblingLabel="Source Originality Score"
            projectName="Source Bias Atlas"
            githubRepo="https://github.com/buger/source-bias-atlas"
          />
        </div>
      </body>
    </html>
  );
}
