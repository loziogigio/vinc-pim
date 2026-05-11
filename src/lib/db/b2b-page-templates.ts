/**
 * B2B Page Templates
 *
 * Reuses the same HomeTemplate collection (b2bhometemplates) but scoped
 * per portal page via templateId: "b2b-{portal}-page-{pageSlug}".
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

function buildB2BPageTemplateId(portalSlug: string, pageSlug: string): string {
  return `b2b-${portalSlug}-page-${pageSlug}`;
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
 * Initialize an empty page template for a new custom B2B portal page
 */
export async function initB2BPageTemplate(
  portalSlug: string,
  pageSlug: string,
  pageTitle: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
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
 * Delete all template documents for a B2B portal page
 */
export async function deleteB2BPageTemplates(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
  const Model = await getModel(tenantDb);
  await Model.deleteMany({ templateId });
}

/**
 * Delete all page templates for an entire B2B portal (used on portal deletion)
 */
export async function deleteAllB2BPageTemplates(
  portalSlug: string,
  tenantDb: string
): Promise<void> {
  const Model = await getModel(tenantDb);
  // Match all page templates for this portal
  await Model.deleteMany({
    templateId: { $regex: `^b2b-${portalSlug}-page-` },
  });
}

/**
 * Get page template config for the builder (PageConfig format)
 */
export async function getB2BPageTemplateConfig(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
  const Model = await getModel(tenantDb);

  let doc = await Model.findOne({ templateId }).lean();

  if (!doc) {
    // Auto-init if missing
    await initB2BPageTemplate(portalSlug, pageSlug, pageSlug, tenantDb);
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
 * Save draft blocks for a B2B portal page
 */
export async function saveB2BPageTemplateDraft(
  portalSlug: string,
  pageSlug: string,
  input: { blocks: any[]; seo?: any },
  tenantDb: string
): Promise<any> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
  const Model = await getModel(tenantDb);
  const { blocks, seo } = input;
  const now = new Date().toISOString();

  const sanitizedBlocks = blocks.map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {},
    ...(block.layout && { layout: block.layout }),
    ...(block.zone && { zone: block.zone }),
    ...(block.tabLabel && { tabLabel: block.tabLabel }),
    ...(block.tabIcon && { tabIcon: block.tabIcon }),
    ...(block.showTitle !== undefined && { showTitle: block.showTitle }),
    ...(block.titleAlignment && { titleAlignment: block.titleAlignment }),
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

  return getB2BPageTemplateConfig(portalSlug, pageSlug, tenantDb);
}

/**
 * Publish the B2B portal page (sets status to published)
 */
export async function publishB2BPageTemplate(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
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

  return getB2BPageTemplateConfig(portalSlug, pageSlug, tenantDb);
}

/**
 * Unpublish the B2B portal page (revert to draft)
 */
export async function unpublishB2BPageTemplate(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
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

  return getB2BPageTemplateConfig(portalSlug, pageSlug, tenantDb);
}

/**
 * Get latest page template (draft or published) for preview mode
 */
export async function getLatestB2BPageTemplate(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any | null> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
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
 * Get published page template for a B2B portal frontend consumer
 */
export async function getPublishedB2BPageTemplate(
  portalSlug: string,
  pageSlug: string,
  tenantDb: string
): Promise<any | null> {
  const templateId = buildB2BPageTemplateId(portalSlug, pageSlug);
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
