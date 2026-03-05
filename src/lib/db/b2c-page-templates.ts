/**
 * B2C Page Templates
 *
 * Reuses the same HomeTemplate collection (b2bhometemplates) but scoped
 * per storefront page via templateId: "b2c-{storefront}-page-{pageSlug}".
 *
 * Simplified version management: one document per page (draft ↔ published toggle).
 * No version history or conditional targeting.
 */

import { connectWithModels } from "./connection";
import type { HomeTemplateDocument } from "./models/home-template";
import type mongoose from "mongoose";

// ============================================
// HELPERS
// ============================================

function buildTemplateId(storefrontSlug: string, pageSlug: string): string {
  return `b2c-${storefrontSlug}-page-${pageSlug}`;
}

async function getModel(
  tenantDb: string
): Promise<mongoose.Model<HomeTemplateDocument>> {
  const models = await connectWithModels(tenantDb);
  return models.HomeTemplate as mongoose.Model<HomeTemplateDocument>;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize an empty page template for a new custom page
 */
export async function initB2CPageTemplate(
  storefrontSlug: string,
  pageSlug: string,
  pageTitle: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  const existing = await Model.findOne({ templateId }).lean();
  if (existing) return;

  const now = new Date().toISOString();
  await Model.create({
    templateId,
    name: pageTitle,
    version: 1,
    blocks: [],
    seo: {},
    status: "draft" as const,
    label: "Version 1",
    createdAt: now,
    lastSavedAt: now,
    createdBy: "system",
    comment: "Empty page template",
    isCurrent: true,
    isActive: true,
  });
}

/**
 * Delete all template documents for a page
 */
export async function deleteB2CPageTemplates(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);
  await Model.deleteMany({ templateId });
}

/**
 * Delete all page templates for an entire storefront (used on storefront deletion)
 */
export async function deleteAllB2CPageTemplates(
  storefrontSlug: string,
  tenantDb: string
): Promise<void> {
  const Model = await getModel(tenantDb);
  // Match all page templates for this storefront
  await Model.deleteMany({
    templateId: { $regex: `^b2c-${storefrontSlug}-page-` },
  });
}

/**
 * Get page template config for the builder (PageConfig format)
 */
export async function getB2CPageTemplateConfig(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  let doc = await Model.findOne({ templateId }).lean();

  if (!doc) {
    // Auto-init if missing
    await initB2CPageTemplate(storefrontSlug, pageSlug, pageSlug, tenantDb);
    doc = await Model.findOne({ templateId }).lean();
    if (!doc) throw new Error("Failed to initialize page template");
  }

  return {
    slug: templateId,
    name: doc.name || pageSlug,
    versions: [
      {
        version: doc.version,
        blocks: doc.blocks || [],
        seo: doc.seo || {},
        status: doc.status,
        label: doc.label || "Version 1",
        createdAt: doc.createdAt,
        lastSavedAt: doc.lastSavedAt,
        publishedAt: doc.publishedAt,
        createdBy: doc.createdBy,
        comment: doc.comment,
      },
    ],
    currentVersion: doc.version,
    currentPublishedVersion: doc.status === "published" ? doc.version : undefined,
    createdAt: doc.createdAt || new Date().toISOString(),
    updatedAt: doc.lastSavedAt || new Date().toISOString(),
  };
}

/**
 * Save draft blocks for a page
 */
export async function saveB2CPageTemplateDraft(
  storefrontSlug: string,
  pageSlug: string,
  input: { blocks: any[]; seo?: any },
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);
  const { blocks, seo } = input;
  const now = new Date().toISOString();

  const sanitizedBlocks = blocks.map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {},
    layout: block.layout,
  }));

  const doc = await Model.findOne({ templateId });

  if (!doc) {
    await Model.create({
      templateId,
      name: pageSlug,
      version: 1,
      blocks: sanitizedBlocks,
      seo: seo || {},
      status: "draft" as const,
      label: "Version 1",
      createdAt: now,
      lastSavedAt: now,
      createdBy: "b2b-admin",
      isCurrent: true,
    });
  } else {
    await Model.updateOne(
      { templateId },
      {
        $set: {
          blocks: sanitizedBlocks,
          seo: seo || {},
          lastSavedAt: now,
          status: "draft",
        },
      }
    );
  }

  return getB2CPageTemplateConfig(storefrontSlug, pageSlug, tenantDb);
}

/**
 * Publish the page (sets status to published)
 */
export async function publishB2CPageTemplate(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  const doc = await Model.findOne({ templateId });
  if (!doc) throw new Error("Page template not found");

  const now = new Date().toISOString();
  await Model.updateOne(
    { templateId },
    {
      $set: {
        status: "published",
        publishedAt: now,
        lastSavedAt: now,
        isCurrentPublished: true,
        isDefault: true,
      },
    }
  );

  return getB2CPageTemplateConfig(storefrontSlug, pageSlug, tenantDb);
}

/**
 * Unpublish the page (revert to draft)
 */
export async function unpublishB2CPageTemplate(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  await Model.updateOne(
    { templateId },
    {
      $set: {
        status: "draft",
        isCurrentPublished: false,
        isDefault: false,
      },
      $unset: { publishedAt: 1 },
    }
  );

  return getB2CPageTemplateConfig(storefrontSlug, pageSlug, tenantDb);
}

/**
 * Get latest page template (draft or published) for preview mode
 */
export async function getLatestB2CPageTemplate(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any | null> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  const doc = await Model.findOne({ templateId }).lean();
  if (!doc) return null;

  return {
    blocks: doc.blocks || [],
    seo: doc.seo || {},
    version: doc.version,
    status: doc.status,
    publishedAt: doc.publishedAt,
    lastSavedAt: doc.lastSavedAt,
  };
}

/**
 * Get published page template for a B2C frontend consumer
 */
export async function getPublishedB2CPageTemplate(
  storefrontSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any | null> {
  const templateId = buildTemplateId(storefrontSlug, pageSlug);
  const Model = await getModel(tenantDb);

  const doc = await Model.findOne({ templateId, status: "published" }).lean();
  if (!doc) return null;

  return {
    blocks: doc.blocks || [],
    seo: doc.seo || {},
    version: doc.version,
    publishedAt: doc.publishedAt,
  };
}
