import type { NextConfig } from "next";

type RemotePattern = {
  protocol: "http" | "https";
  hostname: string;
};

const remotePatterns: RemotePattern[] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com"
  }
];

const cdnEndpoint =
  process.env.NEXT_PUBLIC_CDN_ENDPOINT ??
  process.env.NEXT_PUBLIC_CDN_HOSTNAME ??
  process.env.CDN_ENDPOINT ??
  process.env.CDN_HOSTNAME ??
  "";

if (cdnEndpoint) {
  try {
    const cdnUrl = new URL(cdnEndpoint.startsWith("http") ? cdnEndpoint : `https://${cdnEndpoint}`);
    remotePatterns.push({
      protocol: cdnUrl.protocol.replace(":", "") as "http" | "https",
      hostname: cdnUrl.hostname
    });
  } catch {
    // ignore invalid CDN endpoint
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  images: {
    remotePatterns
  }
};

export default nextConfig;
