import type { PageConfig } from "@/lib/types/blocks";
import { SEO_CONFIG } from "@/lib/config/seo";

export const generateStructuredData = (pageConfig: PageConfig) => {
  // Get the latest published version, or fall back to the current version
  const publishedVersion = pageConfig.currentPublishedVersion
    ? pageConfig.versions.find(v => v.version === pageConfig.currentPublishedVersion && v.status === "published")
    : null;
  const currentVersion = pageConfig.versions[pageConfig.versions.length - 1];
  const versionToRender = publishedVersion || currentVersion;
  const blocks = versionToRender?.blocks || [];

  const blockElements = blocks.map((block) => ({
    "@type": "WebPageElement",
    name: block.type,
    position: block.order
  }));

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageConfig.name,
    url: `${SEO_CONFIG.siteUrl}${pageConfig.slug === "home" ? "" : `/${pageConfig.slug}`}`,
    description: versionToRender?.seo?.description ?? SEO_CONFIG.defaultMetadata.defaultDescription,
    hasPart: blockElements
  };
};
