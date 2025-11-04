import { connectToDatabase } from "./connection";
import { PageModel, type PageDocument } from "./models/page";
import { getHomeTemplateConfig } from "./home-templates";
import type { PageConfig, PageBlock, BlockConfig, PageVersion } from "@/lib/types/blocks";
import { pageConfigSchema } from "@/lib/validation/blockSchemas";
import { sanitizeBlock } from "@/lib/validation/sanitizers";

const serializeBlock = (
  block: {
    id: string;
    type: string;
    order?: number;
    config: unknown;
    metadata?: Record<string, unknown>;
    zone?: string;
    tabLabel?: string;
    tabIcon?: string;
  },
  pageSlug?: string
): PageBlock<BlockConfig> => {
  const serialized: any = {
    id: String(block.id),
    type: String(block.type),
    order: Number(block.order ?? 0),
    config: block.config as BlockConfig,
    metadata: block.metadata ?? {}
  };

  if (block.zone || pageSlug?.startsWith("product-detail")) {
    serialized.zone = (block.zone as PageBlock["zone"]) ?? "zone3";
  }

  if (block.tabLabel) {
    serialized.tabLabel = String(block.tabLabel);
  }

  if (block.tabIcon) {
    serialized.tabIcon = String(block.tabIcon);
  }

  // Debug logging for config serialization
  if (block.type === 'youtubeEmbed' || Object.keys(block.config || {}).length > 0) {
    console.log('[serializeBlock] Type:', block.type, 'Config keys:', Object.keys(block.config || {}));
    console.log('[serializeBlock] Full config:', JSON.stringify(block.config, null, 2));
  }

  return serialized;
};

const serializePage = (
  doc: Record<string, unknown> & {
    versions?: unknown[];
    currentVersion?: number | null;
    currentPublishedVersion?: number | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }
): PageConfig => {
  return {
    slug: String(doc.slug ?? ""),
    name: String(doc.name ?? ""),
    versions: Array.isArray(doc.versions)
      ? doc.versions.map((v: any) => ({
          version: v.version,
          blocks: Array.isArray(v.blocks)
            ? v.blocks.map((block: any) => serializeBlock(block, String(doc.slug ?? "")))
            : [],
          seo: v.seo,
          status: v.status,
          label: v.label,
          createdAt: v.createdAt,
          lastSavedAt: v.lastSavedAt,
          publishedAt: v.publishedAt,
          createdBy: v.createdBy,
          comment: v.comment
        }))
      : [],
    currentVersion: doc.currentVersion || 0,
    currentPublishedVersion: doc.currentPublishedVersion ?? undefined,
    createdAt: new Date(doc.createdAt ?? Date.now()).toISOString(),
    updatedAt: new Date(doc.updatedAt ?? Date.now()).toISOString()
  } as PageConfig;
};

const ensureDefaultHomepage = async () => {
  const existing = await PageModel.findOne({ slug: "home" }).lean<PageDocument | null>();
  if (existing) {
    return serializePage(existing);
  }

  const now = new Date();
  const newPage = await PageModel.create({
    slug: "home",
    name: "Homepage",
    versions: [],
    currentVersion: 0,
    currentPublishedVersion: undefined,
    createdAt: now,
    updatedAt: now
  });

  return serializePage(newPage.toObject());
};

const ensureDefaultProductDetail = async (slug: string) => {
  const existing = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (existing) {
    return serializePage(existing);
  }

  // Create a new empty product detail page
  const now = new Date();
  const isDefaultTemplate = slug === "product-detail";
  const pageName = isDefaultTemplate
    ? "Product Detail (Default Template)"
    : `Product Detail - ${slug.replace("product-detail-", "")}`;

  const newPage = await PageModel.create({
    slug,
    name: pageName,
    versions: [],
    currentVersion: 0,
    currentPublishedVersion: undefined,
    createdAt: now,
    updatedAt: now
  });

  return serializePage(newPage.toObject());
};

export const getPageConfig = async (slug: string): Promise<PageConfig> => {
  await connectToDatabase();

  if (slug === "home") {
    try {
      const homeTemplateConfig = await getHomeTemplateConfig();
      return homeTemplateConfig as PageConfig;
    } catch (error) {
      console.error("[getPageConfig] Failed to load home template config, falling back to PageModel:", error);
      return ensureDefaultHomepage();
    }
  }

  // Handle product detail pages (product-detail or product-detail-{productId})
  if (slug === "product-detail" || slug.startsWith("product-detail-")) {
    const config = await ensureDefaultProductDetail(slug);
    console.log('[getPageConfig] ===== LOAD REQUEST =====');
    console.log('[getPageConfig] Slug:', slug);
    console.log('[getPageConfig] Versions count:', config.versions.length);
    if (config.versions.length > 0) {
      const lastVersion = config.versions[config.versions.length - 1];
      console.log('[getPageConfig] Last version blocks:', lastVersion.blocks.length);
      if (lastVersion.blocks.length > 0) {
        console.log('[getPageConfig] First block:', JSON.stringify(lastVersion.blocks[0], null, 2));
      }
    }
    return config;
  }

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) {
    throw new Error("Page not found");
  }

  return serializePage(doc);
};

// Save - updates current version if it's a draft, or creates new version if current is published
export const savePage = async (input: {
  slug: string;
  blocks: PageBlock[];
  seo?: any;
}): Promise<PageConfig> => {
  await connectToDatabase();

  const { slug, blocks, seo } = input;

  console.log('[savePage] ===== SAVE REQUEST =====');
  console.log('[savePage] Slug:', slug);
  console.log('[savePage] Blocks count:', blocks.length);
  console.log('[savePage] First block:', JSON.stringify(blocks[0], null, 2));

  // Sanitize blocks
  const sanitizedBlocks = blocks.map((block) => sanitizeBlock(block));

  console.log('[savePage] After sanitization, first block:', JSON.stringify(sanitizedBlocks[0], null, 2));

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  const now = new Date();
  const nowISO = now.toISOString();

  if (!doc) {
    // Create new page with version 1 as draft
    const version1: PageVersion = {
      version: 1,
      blocks: sanitizedBlocks,
      seo,
      status: "draft",
      label: "Version 1",
      createdAt: nowISO,
      lastSavedAt: nowISO,
      createdBy: "admin",
      comment: "Version 1"
    };

    const newPage = await PageModel.create({
      slug,
      name: slug === "home" ? "Homepage" : slug,
      versions: [version1],
      currentVersion: 1,
      currentPublishedVersion: undefined,
      createdAt: now,
      updatedAt: now
    });

    return serializePage(newPage.toObject());
  }

  const versions = doc.versions || [];

  // Get the current working version by currentVersion number from doc
  const currentVersion = versions.find((v: any) => v.version === doc.currentVersion) as PageVersion | undefined;

  if (!currentVersion) {
    // No versions exist, create version 1 as draft
    const version1: PageVersion = {
      version: 1,
      blocks: sanitizedBlocks,
      seo,
      status: "draft",
      label: "Version 1",
      createdAt: nowISO,
      lastSavedAt: nowISO,
      createdBy: "admin",
      comment: "Version 1"
    };

    const updated = await PageModel.findOneAndUpdate(
      { slug },
      {
        versions: [version1],
        currentVersion: 1,
        updatedAt: now
      },
      { new: true }
    );

    if (!updated) throw new Error("Failed to save");
    return serializePage(updated.toObject());
  }

  if (currentVersion.status === "draft") {
    // Update existing draft version
    const updatedVersions = versions.map((v: any) =>
      v.version === currentVersion.version
        ? {
            ...v,
            blocks: sanitizedBlocks,
            seo,
            lastSavedAt: nowISO,
            label: v.label ?? v.comment ?? `Version ${currentVersion.version}`
          }
        : v
    );

    const updated = await PageModel.findOneAndUpdate(
      { slug },
      {
        versions: updatedVersions,
        updatedAt: now
      },
      { new: true }
    );

    if (!updated) throw new Error("Failed to save");
    return serializePage(updated.toObject());
  }

  // Current version is published, create new draft version
  // Calculate next version by finding max version number in versions array
  const maxVersion = versions.reduce((max: number, v: any) => Math.max(max, v.version || 0), 0);
  const nextVersion = maxVersion + 1;

  // Validate that this version doesn't already exist (prevents duplicates)
  const versionExists = versions.some((v: any) => v.version === nextVersion);
  if (versionExists) {
    throw new Error(`Version ${nextVersion} already exists. Data corruption detected.`);
  }

  const newVersion: PageVersion = {
    version: nextVersion,
    blocks: sanitizedBlocks,
    seo,
    status: "draft",
    label: `Version ${nextVersion}`,
    createdAt: nowISO,
    lastSavedAt: nowISO,
    createdBy: "admin",
    comment: `Version ${nextVersion}`
  };

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: [...versions, newVersion],
      currentVersion: nextVersion,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to save");
  return serializePage(updated.toObject());
};

// Hot Fix - updates a published version in-place without creating new version
export const hotfixPage = async (input: {
  slug: string;
  blocks: PageBlock[];
  seo?: any;
}): Promise<PageConfig> => {
  await connectToDatabase();

  const { slug, blocks, seo } = input;

  // Sanitize blocks
  const sanitizedBlocks = blocks.map((block) => sanitizeBlock(block));

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  const versions = doc.versions || [];
  const currentVersion = versions.find((v: any) => v.version === doc.currentVersion) as PageVersion | undefined;

  if (!currentVersion) {
    throw new Error(`No version ${doc.currentVersion} found to hotfix`);
  }

  if (currentVersion.status !== "published") {
    throw new Error(`Version ${currentVersion.version} is not published. Use regular save for draft versions.`);
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // Update the published version directly
  const updatedVersions = versions.map((v: any) =>
    v.version === currentVersion.version
      ? {
          ...v,
          blocks: sanitizedBlocks,
          seo,
          lastSavedAt: nowISO,
          label: v.label ?? v.comment ?? `Version ${currentVersion.version}`
          // Keep publishedAt, status, and other metadata unchanged
        }
      : v
  );

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: updatedVersions,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to apply hotfix");
  return serializePage(updated.toObject());
};

// Publish - marks current version as published
export const publishPage = async (slug: string): Promise<PageConfig> => {
  await connectToDatabase();

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  const versions = doc.versions || [];

  // Get the current working version by currentVersion number from doc
  const currentVersion = versions.find((v: any) => v.version === doc.currentVersion) as PageVersion | undefined;

  if (!currentVersion) {
    throw new Error(`No version ${doc.currentVersion} found to publish`);
  }

  if (currentVersion.status === "published") {
    throw new Error(`Version ${currentVersion.version} is already published. Create a new draft version to make changes.`);
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // Mark current version as published
  const updatedVersions = versions.map((v: any) =>
    v.version === currentVersion.version
      ? {
          ...v,
          status: "published",
          publishedAt: nowISO
        }
      : v
  );

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: updatedVersions,
      currentPublishedVersion: currentVersion.version,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to publish");
  return serializePage(updated.toObject());
};

// Load version - loads a specific version as the current working version
/**
 * Load a version for editing - just switches the current version pointer
 * Does NOT create a new version, just makes the selected version current
 */
export const loadVersion = async (slug: string, version: number): Promise<PageConfig> => {
  await connectToDatabase();

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  const versions = doc.versions || [];
  const targetVersion = versions.find((v: any) => v.version === version);

  if (!targetVersion) {
    throw new Error("Version not found");
  }

  const now = new Date();

  // Just update the currentVersion pointer to switch to this version
  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      currentVersion: version,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to load version");
  return serializePage(updated.toObject());
};

// Delete version - removes a version from history
export const deleteVersion = async (slug: string, version: number): Promise<PageConfig> => {
  await connectToDatabase();

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  // Cannot delete current version
  if (version === doc.currentVersion) {
    throw new Error("Cannot delete the current version");
  }

  // Cannot delete current published version
  if (version === doc.currentPublishedVersion) {
    throw new Error("Cannot delete the current published version");
  }

  const updatedVersions = (doc.versions || []).filter((v: any) => v.version !== version);

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: updatedVersions,
      updatedAt: new Date()
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to delete version");
  return serializePage(updated.toObject());
};

// Duplicate version - creates a new draft version with content from an existing version
export const duplicateVersion = async (slug: string, sourceVersion: number): Promise<PageConfig> => {
  await connectToDatabase();

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  const versions = doc.versions || [];

  // Find the source version to duplicate
  const sourceVersionData = versions.find((v: any) => v.version === sourceVersion);
  if (!sourceVersionData) {
    throw new Error(`Source version ${sourceVersion} not found`);
  }

  const now = new Date();
  const nowISO = now.toISOString();

  // Calculate next version number
  const maxVersion = versions.reduce((max: number, v: any) => Math.max(max, v.version || 0), 0);
  const nextVersion = maxVersion + 1;

  // Validate that this version doesn't already exist
  const versionExists = versions.some((v: any) => v.version === nextVersion);
  if (versionExists) {
    throw new Error(`Version ${nextVersion} already exists. Data corruption detected.`);
  }

  // Create new version with duplicated content
  const sourceData = sourceVersionData as any;
  const newVersion: PageVersion = {
    version: nextVersion,
    blocks: JSON.parse(JSON.stringify(sourceData.blocks)), // Deep clone blocks
    seo: sourceData.seo ? JSON.parse(JSON.stringify(sourceData.seo)) : undefined,
    status: "draft",
    label: sourceData.label ? `${sourceData.label} (Copy)` : `Version ${nextVersion}`,
    createdAt: nowISO,
    lastSavedAt: nowISO,
    createdBy: "admin",
    comment: `Version ${nextVersion} (duplicated from v${sourceVersion})`
  };

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: [...versions, newVersion],
      currentVersion: nextVersion,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to duplicate version");
  return serializePage(updated.toObject());
};

// Start new version - creates a new draft version from scratch
export const startNewVersion = async (slug: string): Promise<PageConfig> => {
  await connectToDatabase();

  const doc = await PageModel.findOne({ slug }).lean<PageDocument | null>();
  if (!doc) throw new Error("Page not found");

  const now = new Date();
  const nowISO = now.toISOString();

  // Calculate next version by finding max version number in versions array
  const versions = doc.versions || [];
  const maxVersion = versions.reduce((max: number, v: any) => Math.max(max, v.version || 0), 0);
  const nextVersion = maxVersion + 1;

  // Validate that this version doesn't already exist (prevents duplicates)
  const versionExists = versions.some((v: any) => v.version === nextVersion);
  if (versionExists) {
    throw new Error(`Version ${nextVersion} already exists. Data corruption detected.`);
  }

  const newVersion: PageVersion = {
    version: nextVersion,
    blocks: [],
    seo: undefined,
    status: "draft",
    label: `Version ${nextVersion}`,
    createdAt: nowISO,
    lastSavedAt: nowISO,
    createdBy: "admin",
    comment: `Version ${nextVersion}`
  };

  const updated = await PageModel.findOneAndUpdate(
    { slug },
    {
      versions: [...versions, newVersion],
      currentVersion: nextVersion,
      updatedAt: now
    },
    { new: true }
  );

  if (!updated) throw new Error("Failed to start new version");
  return serializePage(updated.toObject());
};

/**
 * Get all pages (for sitemap generation)
 */
export const getAllPages = async (): Promise<Array<{ slug: string; updatedAt: string }>> => {
  await connectToDatabase();
  const pages = await PageModel.find({}, { slug: 1, updatedAt: 1 }).lean();
  return pages.map(p => ({
    slug: p.slug,
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString()
  }));
};
