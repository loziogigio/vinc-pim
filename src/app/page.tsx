import type { Metadata } from "next";
import { ServerBlockRenderer } from "@/components/renderer/ServerBlockRenderer";
import { getPageConfig } from "@/lib/db/pages";
import { SEO_CONFIG } from "@/lib/config/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const pageConfig = await getPageConfig("home");

  if (!pageConfig) {
    return {
      title: SEO_CONFIG.defaultMetadata.defaultTitle,
      description: SEO_CONFIG.defaultMetadata.defaultDescription
    } satisfies Metadata;
  }

  const seo = pageConfig.seo ?? {};
  const title = seo.title ?? SEO_CONFIG.defaultMetadata.defaultTitle;
  const description = seo.description ?? SEO_CONFIG.defaultMetadata.defaultDescription;
  const heroBlock = pageConfig.blocks.find((block) => block.type.startsWith("hero"));

  let heroImage: string | undefined;
  if (heroBlock) {
    const config = heroBlock.config;
    if (config && typeof config === "object" && "variant" in config) {
      const variant = (config as { variant: string }).variant;
      if (variant === "fullWidth" && "background" in config) {
        heroImage = (config as { background?: { src?: string } }).background?.src;
      }
      if (variant === "carousel" && Array.isArray((config as { slides?: Array<{ image?: string }> }).slides)) {
        heroImage = (config as { slides?: Array<{ image?: string }> }).slides?.[0]?.image;
      }
    }
  }

  const image = seo.image ?? heroImage ?? SEO_CONFIG.defaultMetadata.defaultImage;

  return {
    title,
    description,
    keywords: seo.keywords,
    openGraph: {
      type: "website",
      siteName: SEO_CONFIG.siteName,
      title: seo.ogTitle ?? title,
      description: seo.ogDescription ?? description,
      url: `${SEO_CONFIG.siteUrl}`,
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 630,
              alt: title
            }
          ]
        : undefined
    },
    twitter: {
      card: "summary_large_image",
      site: SEO_CONFIG.social.twitterHandle,
      title: seo.ogTitle ?? title,
      description: seo.ogDescription ?? description,
      images: image ? [image] : undefined
    }
  } satisfies Metadata;
}

export default async function HomePage() {
  const pageConfig = await getPageConfig("home");

  if (!pageConfig) {
    return (
      <main className="mx-auto max-w-screen-xl px-4 py-16 md:px-6">
        <h1 className="text-3xl font-semibold">Homepage not configured</h1>
        <p className="mt-2 text-muted-foreground">
          The storefront has not been initialised yet. Configure your first blocks from the admin builder.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-screen-xl space-y-12 px-4 py-10 md:px-6 md:py-16">
      {pageConfig.blocks
        .sort((a, b) => a.order - b.order)
        .map((block) => (
          <ServerBlockRenderer key={block.id} block={block} />
        ))}
    </main>
  );
}
