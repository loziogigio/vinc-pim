import type { PageConfig } from "@/lib/types/blocks";
import { SEO_CONFIG } from "@/lib/config/seo";

export const generateStructuredData = (pageConfig: PageConfig) => {
  const blocks = pageConfig.blocks.map((block) => ({
    "@type": "WebPageElement",
    name: block.type,
    position: block.order
  }));

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: pageConfig.name,
    url: `${SEO_CONFIG.siteUrl}${pageConfig.slug === "home" ? "" : `/${pageConfig.slug}`}`,
    description: pageConfig.seo?.description ?? SEO_CONFIG.defaultMetadata.defaultDescription,
    hasPart: blocks
  };
};
