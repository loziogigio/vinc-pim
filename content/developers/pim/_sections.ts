import {
  Box,
  Package,
  FolderTree,
  Layers,
  BookA,
  Tag,
  Tags as TagsIcon,
  Menu,
  Languages,
  Cpu,
  Sliders,
  Sparkles,
  BookOpen,
  Upload,
  FileText,
  RefreshCw,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface PimDocSection {
  /** URL slug under /developers/pim/ — also matches the MDX filename (without extension). */
  slug: string;
  /** Title rendered in the sidebar and index grid. */
  title: string;
  /** One-line blurb for the sidebar tooltip / index grid. */
  description: string;
  /** Lucide icon (kept in sync with {@link ../../src/components/pim/PIMNavigation.tsx}). */
  icon: LucideIcon;
}

/**
 * Source of truth for the public PIM developer-docs navigation.
 *
 * Order mirrors the internal PIM sidebar so engineers jumping between
 * the app and the docs always see the same structure. Each slug maps
 * 1:1 to a file at `content/developers/pim/<slug>.mdx`.
 */
export const PIM_DOC_SECTIONS: PimDocSection[] = [
  {
    slug: "overview",
    title: "Overview",
    description: "High-level map of the PIM subsystem, data model, and auth.",
    icon: Box,
  },
  {
    slug: "products",
    title: "Products",
    description: "Create, read, update, publish, and bulk-manage PIM products.",
    icon: Package,
  },
  {
    slug: "categories",
    title: "Categories",
    description: "Tree-shaped taxonomy with SEO metadata and product assignments.",
    icon: FolderTree,
  },
  {
    slug: "collections",
    title: "Collections",
    description: "Curated product sets for merchandising and campaigns.",
    icon: Layers,
  },
  {
    slug: "synonyms",
    title: "Synonyms",
    description: "Solr synonym dictionaries that power search query expansion.",
    icon: BookA,
  },
  {
    slug: "brands",
    title: "Brands",
    description: "Manufacturer / brand entities referenced by products.",
    icon: Tag,
  },
  {
    slug: "tags",
    title: "Tags",
    description: "Free-form labels applied to products for filtering and curation.",
    icon: TagsIcon,
  },
  {
    slug: "menu-settings",
    title: "Menu Settings",
    description: "Storefront navigation and mega-menu configuration.",
    icon: Menu,
  },
  {
    slug: "languages",
    title: "Languages",
    description: "Locales the PIM content is translated into.",
    icon: Languages,
  },
  {
    slug: "product-types",
    title: "Product Types",
    description: "Typed product schemas that drive attribute sets and validation.",
    icon: Cpu,
  },
  {
    slug: "technical-specifications",
    title: "Technical Specifications",
    description: "Reusable attribute definitions attached to product types.",
    icon: Sliders,
  },
  {
    slug: "ai-enhancement",
    title: "AI Enhancement",
    description: "LLM-powered copy enrichment, translation, and media cleanup.",
    icon: Sparkles,
  },
  {
    slug: "documentation",
    title: "Documentation",
    description: "How the in-app docs module is structured (this surface).",
    icon: BookOpen,
  },
  {
    slug: "import",
    title: "Import",
    description: "CSV / Excel ingestion jobs for products, categories, and media.",
    icon: Upload,
  },
  {
    slug: "activity",
    title: "Activity",
    description: "Background-job activity feed and long-running operations.",
    icon: FileText,
  },
  {
    slug: "batch-sync",
    title: "Batch Sync",
    description: "Resync products to Solr and downstream channels in batches.",
    icon: RefreshCw,
  },
  {
    slug: "sources",
    title: "Sources",
    description: "Upstream data-source connectors (suppliers, PIMs, ERPs).",
    icon: Settings,
  },
];

export function getSection(slug: string): PimDocSection | undefined {
  return PIM_DOC_SECTIONS.find((s) => s.slug === slug);
}
