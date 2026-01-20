import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Optimize for production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Experimental optimizations
  experimental: {
    optimizeCss: true,
  },
  // Image optimization
  images: {
    formats: ["image/webp", "image/avif"],
  },
};

export default nextConfig;
