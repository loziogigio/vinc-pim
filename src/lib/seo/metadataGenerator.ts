import type { Metadata } from "next";
import { SEO_CONFIG } from "@/lib/config/seo";
import type { PageConfig } from "@/lib/types/blocks";

const getHeroImage = (pageConfig: PageConfig): string | undefined => {
  // Get the latest published version, or fall back to the current version
  const publishedVersion = pageConfig.currentPublishedVersion
    ? pageConfig.versions.find(v => v.version === pageConfig.currentPublishedVersion && v.status === "published")
    : null;
  const currentVersion = pageConfig.versions[pageConfig.versions.length - 1];
  const versionToRender = publishedVersion || currentVersion;
  const blocks = versionToRender?.blocks || [];

  const heroBlock = blocks.find((block) => block.type.startsWith("hero"));
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
  // Get SEO from the latest published version, or fall back to the current version
  const publishedVersion = pageConfig.currentPublishedVersion
    ? pageConfig.versions.find(v => v.version === pageConfig.currentPublishedVersion && v.status === "published")
    : null;
  const currentVersion = pageConfig.versions[pageConfig.versions.length - 1];
  const versionToRender = publishedVersion || currentVersion;

  const seo = versionToRender?.seo ?? {};
  const title = seo.title ?? SEO_CONFIG.defaultMetadata.defaultTitle;
  const description = seo.description ?? SEO_CONFIG.defaultMetadata.defaultDescription;
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? SEO_CONFIG.siteUrl).replace(/\/$/, "");
  const image = seo.image ?? getHeroImage(pageConfig) ?? SEO_CONFIG.defaultMetadata.defaultImage;
  const fallbackOgImage = `${baseUrl}/api/og?title=${encodeURIComponent(title)}&description=${encodeURIComponent(description)}`;
  const resolvedImage = image ?? fallbackOgImage;
  const pageUrl = `${baseUrl}${pageConfig.slug === "home" ? "" : `/${pageConfig.slug}`}`;

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
      images: resolvedImage
        ? [
            {
              url: resolvedImage,
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
      images: resolvedImage ? [resolvedImage] : undefined
    },
    alternates: {
      canonical: pageUrl
    }
  } satisfies Metadata;
};
