import { connectWithModels, autoDetectTenantDb } from "./connection";
import type { ProductTemplateDocument } from "./models/product-template";
import type mongoose from "mongoose";

/**
 * Get the ProductTemplate model for the current tenant database
 * Uses auto-detection from headers/session if tenantDb not provided
 */
async function getProductTemplateModel(tenantDb?: string): Promise<mongoose.Model<ProductTemplateDocument>> {
  const dbName = tenantDb ?? await autoDetectTenantDb();
  const models = await connectWithModels(dbName);
  return models.ProductTemplate as mongoose.Model<ProductTemplateDocument>;
}

/**
 * Get or create a product-specific template
 * Used by product-builder when editing a specific product
 */
export const getOrCreateProductTemplate = async (
  productId: string,
  tenantDb?: string
): Promise<ProductTemplateDocument> => {
  const ProductTemplateModel = await getProductTemplateModel(tenantDb);

  const templateId = `product-${productId}`;

  // Try to find existing template
  let template = await ProductTemplateModel.findOne({
    templateId
  }).lean<ProductTemplateDocument | null>();

  // If not found, create a new one
  if (!template) {
    const now = new Date();
    const created = await ProductTemplateModel.create({
      templateId,
      name: `Product Detail - ${productId}`,
      type: "product",
      priority: 20,
      matchCriteria: {
        productIds: [productId]
      },
      versions: [],
      currentVersion: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    template = created.toObject() as ProductTemplateDocument;
  }

  return template;
};

/**
 * Get or create default product template
 */
export const getOrCreateDefaultTemplate = async (tenantDb?: string): Promise<ProductTemplateDocument> => {
  const ProductTemplateModel = await getProductTemplateModel(tenantDb);

  let template = await ProductTemplateModel.findOne({
    templateId: "default-product-detail",
    type: "default"
  }).lean<ProductTemplateDocument | null>();

  if (!template) {
    const now = new Date();
    const created = await ProductTemplateModel.create({
      templateId: "default-product-detail",
      name: "Default Product Detail Template",
      type: "default",
      priority: 0,
      matchCriteria: {},
      versions: [],
      currentVersion: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    });
    template = created.toObject() as ProductTemplateDocument;
  }

  return template;
};

/**
 * Get product template config for product-builder
 * Returns in PageConfig format that the builder expects
 */
export const getProductTemplateConfig = async (productId: string, tenantDb?: string): Promise<any> => {
  const template = productId === "default"
    ? await getOrCreateDefaultTemplate(tenantDb)
    : await getOrCreateProductTemplate(productId, tenantDb);

  // Transform to PageConfig format expected by builder
  return {
    slug: template.templateId,
    name: template.name,
    versions: template.versions || [],
    currentVersion: template.currentVersion || 0,
    currentPublishedVersion: template.currentPublishedVersion,
    createdAt: template.createdAt instanceof Date ? template.createdAt.toISOString() : template.createdAt,
    updatedAt: template.updatedAt instanceof Date ? template.updatedAt.toISOString() : template.updatedAt
  };
};

/**
 * Save product template (used by save-draft API)
 */
export const saveProductTemplate = async (input: {
  slug: string;
  blocks: any[];
  seo?: any;
}, tenantDb?: string): Promise<any> => {
  const ProductTemplateModel = await getProductTemplateModel(tenantDb);

  const { slug, blocks, seo } = input;

  // Extract productId from slug
  // Handles: "product-detail-cr6001" -> "cr6001", "product-detail" -> "default", "product-cr6001" -> "cr6001"
  let productId = "default";
  if (slug === "product-detail") {
    productId = "default";
  } else if (slug.startsWith("product-detail-")) {
    productId = slug.replace(/^product-detail-/, '');
  } else if (slug.startsWith("product-")) {
    productId = slug.replace(/^product-/, '');
  }

  const template = productId === "default"
    ? await getOrCreateDefaultTemplate(tenantDb)
    : await getOrCreateProductTemplate(productId, tenantDb);

  const now = new Date().toISOString();

  // Calculate next version number
  const versions = template.versions || [];
  const maxVersion = versions.reduce(
    (max: number, v: any) => Math.max(max, v.version || 0),
    0
  );
  const nextVersion = maxVersion + 1;

  // Sanitize blocks
  const sanitizedBlocks = blocks.map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {}
  }));

  // Create new version
  const newVersion = {
    version: nextVersion,
    blocks: sanitizedBlocks,
    seo: seo || {},
    status: "draft" as const,
    createdAt: now,
    lastSavedAt: now,
    createdBy: "b2b-admin",
    comment: `Version ${nextVersion}`
  };

  // Update template
  const updatedVersions = [...versions, newVersion];

  await ProductTemplateModel.updateOne(
    { templateId: template.templateId },
    {
      $set: {
        versions: updatedVersions,
        currentVersion: nextVersion,
        updatedAt: now
      }
    }
  );

  // Return updated config
  return getProductTemplateConfig(productId, tenantDb);
};

/**
 * Publish product template draft
 */
export const publishProductTemplate = async (slug: string, tenantDb?: string): Promise<any> => {
  const ProductTemplateModel = await getProductTemplateModel(tenantDb);

  // Extract productId from slug (same logic as saveProductTemplate)
  let productId = "default";
  if (slug === "product-detail") {
    productId = "default";
  } else if (slug.startsWith("product-detail-")) {
    productId = slug.replace(/^product-detail-/, '');
  } else if (slug.startsWith("product-")) {
    productId = slug.replace(/^product-/, '');
  }

  // Build the templateId used in MongoDB
  const templateId = productId === "default" ? "default-product-detail" : `product-${productId}`;

  const template = await ProductTemplateModel.findOne({
    templateId
  });

  if (!template) {
    throw new Error(`Template not found: ${slug}`);
  }

  const currentVersion = template.currentVersion || 0;
  if (currentVersion === 0) {
    throw new Error("No draft version to publish");
  }

  const versions = template.versions || [];
  const versionToPublish = versions.find((v: any) => v.version === currentVersion);

  if (!versionToPublish) {
    throw new Error(`Version ${currentVersion} not found`);
  }

  if (versionToPublish.status === "published") {
    throw new Error(`Version ${currentVersion} is already published`);
  }

  // Update version status
  const now = new Date().toISOString();
  const updatedVersions = versions.map((v: any) =>
    v.version === currentVersion
      ? { ...v, status: "published", publishedAt: now, lastSavedAt: now }
      : v
  );

  await ProductTemplateModel.updateOne(
    { templateId },
    {
      $set: {
        versions: updatedVersions,
        currentPublishedVersion: currentVersion,
        updatedAt: now
      }
    }
  );

  return getProductTemplateConfig(productId, tenantDb);
};
