import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages uses the static export; Vercel serves the native Next output.
  output: process.env.VERCEL === "1" ? undefined : "export",
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  agentRules: false,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
