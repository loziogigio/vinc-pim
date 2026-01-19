import { connectWithModels, autoDetectTenantDb } from "./connection";
import type { ProductTemplateDocument } from "./models/product-template-simple";
import type mongoose from "mongoose";

/**
 * Get priority value for match type
 */
function getPriorityForType(type: "sku" | "parentSku" | "standard"): number {
  if (type === "sku") return 30;
  if (type === "parentSku") return 20;
  return 10; // standard has lowest priority
}

/**
 * Get the ProductTemplateSimple model for the current tenant database
 * Uses auto-detection from headers/session if tenantDb not provided
 */
async function getProductTemplateSimpleModel(tenantDb?: string): Promise<mongoose.Model<ProductTemplateDocument>> {
  const dbName = tenantDb ?? await autoDetectTenantDb();
  const models = await connectWithModels(dbName);
  return models.ProductTemplateSimple as mongoose.Model<ProductTemplateDocument>;
}

/**
 * Get or create a product template
 * @param matchType - "sku" for specific SKU, "parentSku" for variant family, "standard" for default
 * @param value - The SKU or parentSKU value (use "default" for standard)
 */
export async function getOrCreateTemplate(
  matchType: "sku" | "parentSku" | "standard",
  value: string,
  tenantDb?: string
): Promise<ProductTemplateDocument> {
  const ProductTemplateModel = await getProductTemplateSimpleModel(tenantDb);

  const priority = getPriorityForType(matchType);

  // Try to find existing template
  let template = await ProductTemplateModel.findOne({
    "matchRules.type": matchType,
    "matchRules.value": value
  }).lean<ProductTemplateDocument | null>();

  // If not found, create a new one
  if (!template) {
    try {
      const now = new Date();
      const templateId = `tmpl-${matchType}-${value}`.toLowerCase();
      const name = matchType === "sku"
        ? `Product ${value}`
        : matchType === "parentSku"
        ? `${value} Family`
        : "Standard Template";

      const created = await ProductTemplateModel.create({
        templateId,
        name,
        matchRules: {
          type: matchType,
          value,
          priority
        },
        versions: [],
        currentVersion: 0,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });

      template = created.toObject() as ProductTemplateDocument;
    } catch (error: any) {
      // Handle duplicate key error (E11000) - template was created by another request
      if (error.code === 11000) {
        console.log(`[getOrCreateTemplate] Duplicate key detected, fetching existing template for ${matchType}:${value}`);

        // Retry the find - the template must exist now
        template = await ProductTemplateModel.findOne({
          "matchRules.type": matchType,
          "matchRules.value": value
        }).lean<ProductTemplateDocument | null>();

        if (!template) {
          throw new Error(`Template exists but could not be found: ${matchType}=${value}`);
        }
      } else {
        throw error;
      }
    }
  }

  return template;
}

/**
 * Get template configuration for product-builder
 * Returns in PageConfig format that the builder expects
 */
export async function getTemplateConfig(
  matchType: "sku" | "parentSku" | "standard",
  value: string,
  tenantDb?: string
): Promise<any> {
  const template = await getOrCreateTemplate(matchType, value, tenantDb);

  // Convert to PageConfig format expected by builder
  return {
    slug: `${matchType}-${value}`,
    name: template.name,
    versions: template.versions || [],
    currentVersion: template.currentVersion || 0,
    currentPublishedVersion: template.currentPublishedVersion,
    createdAt: template.createdAt?.toISOString() || new Date().toISOString(),
    updatedAt: template.updatedAt?.toISOString() || new Date().toISOString()
  };
}

/**
 * Save template draft
 */
export async function saveTemplateDraft(input: {
  matchType: "sku" | "parentSku" | "standard";
  value: string;
  blocks: any[];
  seo?: any;
}, tenantDb?: string): Promise<any> {
  const ProductTemplateModel = await getProductTemplateSimpleModel(tenantDb);

  const { matchType, value, blocks, seo } = input;

  console.log(`[saveTemplateDraft] ===== SAVE REQUEST =====`);
  console.log(`[saveTemplateDraft] matchType: ${matchType}, value: ${value}`);
  console.log(`[saveTemplateDraft] Blocks count: ${blocks.length}`);
  console.log(`[saveTemplateDraft] First block:`, JSON.stringify(blocks[0], null, 2));

  const template = await getOrCreateTemplate(matchType, value, tenantDb);

  console.log(`[saveTemplateDraft] Existing template found/created, current versions: ${template.versions?.length || 0}`);

  const now = new Date().toISOString();

  // Sanitize blocks - preserve zone, tabLabel, tabIcon for product detail pages
  const sanitizedBlocks = blocks.map((block, index) => {
    const sanitized: any = {
      id: block.id || `block-${index}`,
      type: block.type,
      order: index,
      config: block.config || {},
      metadata: block.metadata || {}
    };

    // Preserve zone for product detail pages
    if (block.zone) {
      sanitized.zone = block.zone;
    }

    // Preserve tab properties for zone3 blocks
    if (block.tabLabel) {
      sanitized.tabLabel = block.tabLabel;
    }
    if (block.tabIcon) {
      sanitized.tabIcon = block.tabIcon;
    }

    return sanitized;
  });

  console.log(`[saveTemplateDraft] After sanitization, first block:`, JSON.stringify(sanitizedBlocks[0], null, 2));

  const versions = template.versions || [];
  const currentVersion = template.currentVersion || 0;

  let updatedVersions: any[];
  let versionNumber: number;

  if (versions.length === 0) {
    // No versions exist - create version 1
    console.log(`[saveTemplateDraft] No versions exist, creating version 1`);
    versionNumber = 1;
    updatedVersions = [{
      version: versionNumber,
      blocks: sanitizedBlocks,
      seo: seo || {},
      status: "draft" as const,
      createdAt: now,
      lastSavedAt: now,
      createdBy: "b2b-admin",
      comment: `Version ${versionNumber}`
    }];
  } else {
    // Find current version
    const currentVersionData = versions.find((v: any) => v.version === currentVersion);

    if (!currentVersionData) {
      throw new Error(`Current version ${currentVersion} not found in template versions`);
    }

    if (currentVersionData.status === "published") {
      // Hotfix: Allow saving over published version (updates it directly)
      console.log(`[saveTemplateDraft] HOTFIX: Updating published version ${currentVersion}`);
      versionNumber = currentVersion;

      updatedVersions = versions.map((v: any) => {
        if (v.version === currentVersion) {
          return {
            ...v,
            blocks: sanitizedBlocks,
            seo: seo || {},
            lastSavedAt: now,
            publishedAt: v.publishedAt, // Preserve original publish date
            comment: v.comment || `Version ${currentVersion}`
          };
        }
        return v;
      });
    } else {
      // Update the existing draft version
      console.log(`[saveTemplateDraft] Updating existing draft version ${currentVersion}`);
      versionNumber = currentVersion;

      updatedVersions = versions.map((v: any) => {
        if (v.version === currentVersion) {
          return {
            ...v,
            blocks: sanitizedBlocks,
            seo: seo || {},
            lastSavedAt: now,
            comment: v.comment || `Version ${currentVersion}`
          };
        }
        return v;
      });
    }
  }

  console.log(`[saveTemplateDraft] Saving version ${versionNumber} with ${updatedVersions.length} total versions`);

  const updateResult = await ProductTemplateModel.updateOne(
    {
      "matchRules.type": matchType,
      "matchRules.value": value
    },
    {
      $set: {
        versions: updatedVersions,
        currentVersion: versionNumber,
        updatedAt: now
      }
    }
  );

  console.log(`[saveTemplateDraft] Update result:`, updateResult);

  // Return updated config
  const finalConfig = await getTemplateConfig(matchType, value, tenantDb);
  console.log(`[saveTemplateDraft] Final config versions: ${finalConfig.versions.length}`);

  return finalConfig;
}

/**
 * Publish template draft
 */
export async function publishTemplate(
  matchType: "sku" | "parentSku" | "standard",
  value: string,
  tenantDb?: string
): Promise<any> {
  const ProductTemplateModel = await getProductTemplateSimpleModel(tenantDb);

  const template = await ProductTemplateModel.findOne({
    "matchRules.type": matchType,
    "matchRules.value": value
  });

  if (!template) {
    throw new Error(`Template not found: ${matchType}=${value}`);
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
    {
      "matchRules.type": matchType,
      "matchRules.value": value
    },
    {
      $set: {
        versions: updatedVersions,
        currentPublishedVersion: currentVersion,
        updatedAt: now
      }
    }
  );

  return getTemplateConfig(matchType, value, tenantDb);
}
