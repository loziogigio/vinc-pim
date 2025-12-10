import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
};

// Allow all hostnames - CDN URL is configured dynamically from MongoDB
const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "**"  // Allow all HTTPS hostnames
  },
  {
    protocol: "http",
    hostname: "**"  // Allow all HTTP hostnames
  }
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  output: 'standalone',
  ...(process.env.NODE_ENV === 'production' && {
    typescript: {
      ignoreBuildErrors: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
  }),
  images: {
    remotePatterns,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
  },
  // Increase body size limit for file uploads (50MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
