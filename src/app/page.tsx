import type { Metadata } from "next";
import { ServerBlockRenderer } from "@/components/renderer/ServerBlockRenderer";
import { getPageConfig } from "@/lib/db/pages";
import { generatePageMetadata } from "@/lib/seo/metadataGenerator";
import { generateStructuredData } from "@/lib/seo/structuredData";

// Force dynamic rendering to avoid MongoDB connection during Docker build
export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const pageConfig = await getPageConfig("home");

  if (!pageConfig) {
    return {} satisfies Metadata;
  }

  return generatePageMetadata(pageConfig);
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(generateStructuredData(pageConfig)) }}
      />
      <main className="mx-auto max-w-screen-xl space-y-12 px-4 py-10 md:px-6 md:py-16">
        {(() => {
          // Get the latest published version, or fall back to the current version
          const publishedVersion = pageConfig.currentPublishedVersion
            ? pageConfig.versions.find(v => v.version === pageConfig.currentPublishedVersion && v.status === "published")
            : null;
          const currentVersion = pageConfig.versions[pageConfig.versions.length - 1];
          const versionToRender = publishedVersion || currentVersion;
          const blocks = versionToRender?.blocks || [];

          return blocks
            .sort((a, b) => a.order - b.order)
            .map((block) => (
              <ServerBlockRenderer key={block.id} block={block} />
            ));
        })()}
      </main>
    </>
  );
}
