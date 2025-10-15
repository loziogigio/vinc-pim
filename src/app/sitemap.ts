import type { MetadataRoute } from "next";
import { SEO_CONFIG } from "@/lib/config/seo";
import { getAllPages } from "@/lib/db/pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = SEO_CONFIG.siteUrl.replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date()
    }
  ];

  try {
    const pages = await getAllPages();
    for (const page of pages) {
      const url = `${baseUrl}${page.slug === "home" ? "" : `/${page.slug}`}`;
      entries.push({
        url,
        lastModified: new Date(page.updatedAt)
      });
    }
  } catch (error) {
    console.error("Failed to build sitemap", error);
  }

  return entries;
}
