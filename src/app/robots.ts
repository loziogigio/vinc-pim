import type { MetadataRoute } from "next";
import { SEO_CONFIG } from "@/lib/config/seo";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SEO_CONFIG.siteUrl.replace(/\/$/, "");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin/", "/api/", "/preview/"]
      }
    ],
    sitemap: [`${baseUrl}/sitemap.xml`]
  };
}
