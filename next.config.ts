import type { NextConfig } from "next";
import createMDX from "@next/mdx";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
};

// Allow all HTTPS hostnames - CDN URL is configured dynamically from MongoDB
const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "**"  // Allow all HTTPS hostnames
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: false,
  output: 'standalone',
  // Enable MDX as a valid page/module extension for @next/mdx
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // Puppeteer uses native binaries — keep it as a Node.js external so the
  // standalone output includes the package rather than trying to bundle it
  serverExternalPackages: ['puppeteer', 'puppeteer-core'],
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

// Turbopack (Next 16 default) requires remark/rehype plugins to be passed
// as string names so they can be resolved by the Rust bundler.
const withMDX = createMDX({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: ['remark-gfm'],
    rehypePlugins: [
      'rehype-slug',
      ['rehype-autolink-headings', { behavior: 'wrap' }],
      [
        'rehype-pretty-code',
        {
          theme: { dark: 'github-dark-dimmed', light: 'github-light' },
          keepBackground: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
