import type { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/config/seo";
import type { PageConfig } from "@/lib/types/blocks";

const getHeroImage = (pageConfig: PageConfig): string | undefined => {
  const heroBlock = pageConfig.blocks.find((block) => block.type.startsWith("hero"));
  if (!heroBlock) return undefined;
  const config = heroBlock.config as { variant: string; [key: string]: unknown };
  switch (config.variant) {
    case "fullWidth":
      return (config.background as { src?: string })?.src;
    case "split":
      return typeof config.image === "string" ? (config.image as string) : undefined;
    case "carousel":
      return Array.isArray(config.slides) ? (config.slides as Array<{ image?: string }>)[0]?.image : undefined;
    default:
      return undefined;
  }
};

export const generatePageMetadata = (pageConfig: PageConfig): Metadata => {
  const seo = pageConfig.seo ?? {};
  const title = seo.title ?? SEO_CONFIG.defaultMetadata.defaultTitle;
  const description = seo.description ?? SEO_CONFIG.defaultMetadata.defaultDescription;
  const image = seo.image ?? getHeroImage(pageConfig) ?? SEO_CONFIG.defaultMetadata.defaultImage;
  const pageUrl = `${SEO_CONFIG.siteUrl}${pageConfig.slug === "home" ? "" : `/${pageConfig.slug}`}`;

  return {
    title,
    description,
    keywords: seo.keywords,
    openGraph: {
      type: "website",
      siteName: SEO_CONFIG.siteName,
      title: seo.ogTitle ?? title,
      description: seo.ogDescription ?? description,
      url: pageUrl,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title
            }
          ]
        : undefined,
      locale: SEO_CONFIG.locale
    },
    twitter: {
      card: "summary_large_image",
      site: SEO_CONFIG.social.twitterHandle,
      title: seo.ogTitle ?? title,
      description: seo.ogDescription ?? description,
      images: image ? [image] : undefined
    },
    alternates: {
      canonical: pageUrl
    }
  } satisfies Metadata;
};
