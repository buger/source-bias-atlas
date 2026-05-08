/** @type {import('next').NextConfig} */
// Static export config for GitHub Pages.
//
// basePath / NEXT_PUBLIC_BASE_PATH are read at build time. For local
// development they default to "" so http://localhost:3000 keeps working.
// In CI we set NEXT_PUBLIC_BASE_PATH=/source-bias-atlas to match the
// Pages URL.

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: basePath || undefined,
  // Avoid lint failing the production build (we lint locally / in CI separately
  // but don't want a stylistic rule to block a static export).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
