import { redirect } from "next/navigation";
import { ServerBlockRenderer } from "@/components/renderer/ServerBlockRenderer";
import { cache } from "@/lib/db/cache";
import { getPageConfig } from "@/lib/db/pages";
import { getAdminSession } from "@/lib/auth/session";
import type { PageConfig } from "@/lib/types/blocks";

export const revalidate = 0;

const fetchPreviewConfig = async (slug: string): Promise<PageConfig | null> => {
  const draft = await cache.get<PageConfig>(`preview:${slug}`);
  if (draft) {
    return draft;
  }

  return getPageConfig(slug);
};

// Helper to get human-readable block type name
const getBlockTypeName = (variantId: string): string => {
  const typeMap: Record<string, string> = {
    "hero-full-width": "Hero - Full Width",
    "hero-split": "Hero - Split Layout",
    "hero-carousel": "Hero - Carousel",
    "product-slider": "Product Slider",
    "product-grid": "Product Grid",
    "category-grid": "Category Grid",
    "category-carousel": "Category Carousel",
    "content-rich-text": "Rich Text",
    "content-features": "Features Section",
    "content-testimonials": "Testimonials"
  };
  return typeMap[variantId] || variantId;
};

type PreviewPageProps = {
  searchParams?: Promise<{ slug?: string; embed?: string }>;
};

export default async function PreviewPage({ searchParams }: PreviewPageProps) {
  const session = await getAdminSession();
  if (!session.isLoggedIn) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const slug = params?.slug ?? "home";
  const isEmbed = params?.embed === "true";
  const config = await fetchPreviewConfig(slug);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="rounded-3xl border bg-background px-6 py-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold">No preview available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Configure and save blocks from the builder to generate a preview.
          </p>
        </div>
      </div>
    );
  }

  // Use current version blocks for preview (latest version in array)
  const currentVersionData = config.versions[config.versions.length - 1];
  const blocks = currentVersionData?.blocks || [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-screen-xl space-y-12 px-4 py-10 md:px-6 md:py-16">
        {blocks
          .sort((a, b) => a.order - b.order)
          .map((block, index) => (
            <div key={block.id} className="group relative">
              {/* Section label - only show in embed mode */}
              {isEmbed && (
                <div className="absolute -top-7 left-0 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="inline-flex items-center gap-2 rounded-md bg-slate-900/75 px-2.5 py-1 text-xs font-medium text-white shadow-sm backdrop-blur-sm">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                      {index + 1}
                    </span>
                    <span>{getBlockTypeName(block.variantId)}</span>
                  </div>
                </div>
              )}
              <ServerBlockRenderer block={block} />
            </div>
          ))}
      </main>
    </div>
  );
}
