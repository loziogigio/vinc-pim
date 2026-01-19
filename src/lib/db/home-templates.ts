import { connectWithModels, autoDetectTenantDb } from "./connection";
import type { HomeTemplateDocument } from "./models/home-template";
import { initializeHomeTemplate } from "./init-home-template";
import type { PageVersionTags } from "@/lib/types/blocks";
import type mongoose from "mongoose";

const HOME_TEMPLATE_ID = "home-page";

const logPrefix = "[home-templates]";

export type PublishMetadataInput = {
  campaign?: string | null;
  segment?: string | null;
  attributes?: Record<string, string | string[] | null | undefined>;
  priority?: number | null;
  isDefault?: boolean;
  activeFrom?: string | null;
  activeTo?: string | null;
  comment?: string | null;
};

const normalizeStringInput = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAttributesInput = (attributes?: Record<string, string | string[] | null | undefined>) => {
  if (!attributes) return undefined;
  const result: Record<string, string | string[]> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    // Handle array values (like addressStates)
    if (Array.isArray(value)) {
      const filteredArray = value.filter((v) => typeof v === "string" && v.trim().length > 0);
      if (filteredArray.length > 0) {
        result[key] = filteredArray;
      }
    } else {
      // Handle string values
      const normalized = normalizeStringInput(value);
      if (normalized) {
        result[key] = normalized;
      }
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

const normalizeDateInput = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const shouldUpdateTags = (input?: PublishMetadataInput) =>
  input &&
  (input.campaign !== undefined || input.segment !== undefined || input.attributes !== undefined);

const buildTagsFromInput = (input?: PublishMetadataInput): { shouldUpdate: boolean; value?: PageVersionTags } => {
  if (!shouldUpdateTags(input)) {
    return { shouldUpdate: false };
  }

  const campaign = normalizeStringInput(input!.campaign);
  const segment = normalizeStringInput(input!.segment);
  const attributes = normalizeAttributesInput(input!.attributes);

  if (!campaign && !segment && !attributes) {
    return { shouldUpdate: true, value: undefined };
  }

  const tags: PageVersionTags = {};
  if (campaign) tags.campaign = campaign;
  if (segment) tags.segment = segment;
  if (attributes) tags.attributes = attributes;

  return { shouldUpdate: true, value: tags };
};

const serializeVersionForResponse = (version: any) => {
  const tags = version.tags
    ? {
        ...version.tags,
        attributes:
          version.tags.attributes instanceof Map
            ? Object.fromEntries(version.tags.attributes.entries())
            : version.tags.attributes
      }
    : undefined;

  return {
    ...version,
    tags
  };
};

const cloneTags = (tags?: PageVersionTags | { attributes?: any }) => {
  if (!tags) return undefined;
  const attributes =
    tags.attributes instanceof Map
      ? Object.fromEntries(tags.attributes.entries())
      : tags.attributes
      ? { ...tags.attributes }
      : undefined;
  const cloned: PageVersionTags = {};
  if ((tags as PageVersionTags).campaign) cloned.campaign = (tags as PageVersionTags).campaign;
  if ((tags as PageVersionTags).segment) cloned.segment = (tags as PageVersionTags).segment;
  if (attributes) cloned.attributes = { ...attributes };
  return cloned;
};

/**
 * Get the HomeTemplate model for the current tenant database
 * Uses auto-detection from headers/session if tenantDb not provided
 */
async function getHomeTemplateModel(tenantDb?: string): Promise<mongoose.Model<HomeTemplateDocument>> {
  const dbName = tenantDb ?? await autoDetectTenantDb();
  const models = await connectWithModels(dbName);
  return models.HomeTemplate as mongoose.Model<HomeTemplateDocument>;
}

/**
 * Get all versions for a template
 */
async function getAllVersions(lean: boolean = true, tenantDb?: string): Promise<HomeTemplateDocument[]> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);
  const query = HomeTemplateModel.find({ templateId: HOME_TEMPLATE_ID }).sort({ version: 1 });
  return lean ? query.lean<HomeTemplateDocument[]>() : query.exec();
}

/**
 * Get the current working version
 */
async function getCurrentVersion(lean: boolean = true, tenantDb?: string): Promise<HomeTemplateDocument | null> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);
  const query = HomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID, isCurrent: true });
  return lean ? query.lean<HomeTemplateDocument | null>() : query.exec();
}

/**
 * Get the current published version
 */
async function getCurrentPublishedVersion(lean: boolean = true, tenantDb?: string): Promise<HomeTemplateDocument | null> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);
  const query = HomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID, isCurrentPublished: true });
  return lean ? query.lean<HomeTemplateDocument | null>() : query.exec();
}

/**
 * Find the default published version (highest priority or latest)
 */
function findDefaultPublishedVersion(versions: HomeTemplateDocument[]): HomeTemplateDocument | null {
  const published = versions.filter((v) => v.status === "published");
  if (!published.length) {
    return null;
  }

  let defaultVersion = published.find((v) => v.isDefault);
  if (!defaultVersion) {
    const fallback = [...published].sort((a, b) => {
      const priorityDiff = (b.priority ?? 0) - (a.priority ?? 0);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.version ?? 0) - (a.version ?? 0);
    })[0];

    if (fallback) {
      defaultVersion = fallback;
    }
  }

  return defaultVersion || null;
}

/**
 * Get or create the home page template
 * Creates an empty template if it doesn't exist - no auto-population
 */
export async function getOrCreateHomeTemplate(tenantDb?: string): Promise<HomeTemplateDocument> {
  // Try to find current version
  let template = await getCurrentVersion(true, tenantDb);

  // If not found, check if any version exists
  if (!template) {
    const allVersions = await getAllVersions(true, tenantDb);
    if (allVersions.length > 0) {
      // Return the latest version
      template = allVersions[allVersions.length - 1];
    }
  }

  // If still not found, initialize empty template
  if (!template) {
    console.log("[getOrCreateHomeTemplate] Template not found, creating empty template...");
    const initialized = await initializeHomeTemplate(tenantDb);
    template = initialized.toObject ? initialized.toObject() : initialized;
  }

  if (!template) {
    throw new Error("Failed to get or create home template");
  }

  return template;
}

/**
 * Get home template configuration for home-builder
 * Returns in PageConfig format that the builder expects
 */
export async function getHomeTemplateConfig(tenantDb?: string): Promise<any> {
  const allVersions = await getAllVersions(true, tenantDb);

  if (allVersions.length === 0) {
    await initializeHomeTemplate(tenantDb);
    return getHomeTemplateConfig(tenantDb);
  }

  const currentVersion = allVersions.find((v) => v.isCurrent === true);
  const currentPublished = allVersions.find((v) => v.isCurrentPublished === true);

  const normalizedVersions = allVersions.map((version: any) =>
    serializeVersionForResponse({
      ...version,
      label: version.label ?? version.comment ?? `Version ${version.version}`
    })
  );

  // Convert to PageConfig format expected by builder
  return {
    slug: "home",
    name: allVersions[0]?.name || "Home Page",
    versions: normalizedVersions,
    currentVersion: currentVersion?.version || allVersions[allVersions.length - 1]?.version || 0,
    currentPublishedVersion: currentPublished?.version,
    createdAt: allVersions[0]?.createdAt || new Date().toISOString(),
    updatedAt: allVersions[allVersions.length - 1]?.lastSavedAt || new Date().toISOString()
  };
}

/**
 * Save home template draft
 */
export async function saveHomeTemplateDraft(input: {
  blocks: any[];
  seo?: any;
}, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const { blocks, seo } = input;
  const now = new Date().toISOString();

  // Sanitize blocks
  const sanitizedBlocks = blocks.map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {}
  }));

  // Find current version
  let currentVersion = await getCurrentVersion(false, tenantDb);

  if (!currentVersion) {
    const allVersions = await getAllVersions(false, tenantDb);
    if (allVersions.length === 0) {
      currentVersion = await HomeTemplateModel.create({
        templateId: HOME_TEMPLATE_ID,
        name: "Home Page",
        version: 1,
        blocks: sanitizedBlocks,
        seo: seo || {},
        status: "draft" as const,
        label: "Version 1",
        createdAt: now,
        lastSavedAt: now,
        createdBy: "b2b-admin",
        comment: "Version 1",
        isCurrent: true
      });
    } else {
      const latest = allVersions[allVersions.length - 1];
      await HomeTemplateModel.updateOne(
        { _id: latest._id },
        { $set: { isCurrent: true } }
      );
      currentVersion = await HomeTemplateModel.findById(latest._id);
    }
  }

  if (!currentVersion) {
    throw new Error("Failed to get or create current version");
  }

  // Use templateId + version to find the document (avoids ObjectId/string mismatch issues)
  await HomeTemplateModel.updateOne(
    { templateId: HOME_TEMPLATE_ID, version: currentVersion.version },
    {
      $set: {
        blocks: sanitizedBlocks,
        seo: seo || {},
        lastSavedAt: now
      }
    }
  );

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Publish home template draft
 */
export async function publishHomeTemplate(metadata?: PublishMetadataInput, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const currentVersion = await getCurrentVersion(false, tenantDb);

  if (!currentVersion) {
    throw new Error("No current version to publish");
  }

  if (currentVersion.status === "published") {
    throw new Error(`Version ${currentVersion.version} is already published`);
  }

  const now = new Date().toISOString();

  // Build update object
  const updates: any = {
    status: "published",
    publishedAt: now,
    lastSavedAt: now
  };

  console.log(`${logPrefix} Publishing version ${currentVersion.version}, metadata:`, JSON.stringify(metadata, null, 2));

  const tagsUpdate = buildTagsFromInput(metadata);
  console.log(`${logPrefix} Tags update:`, JSON.stringify(tagsUpdate, null, 2));

  if (tagsUpdate.shouldUpdate) {
    updates.tags = tagsUpdate.value;
    if (tagsUpdate.value?.campaign) {
      updates.tag = tagsUpdate.value.campaign;
    } else {
      updates.tag = undefined;
    }
  }

  if (metadata?.priority !== undefined) {
    updates.priority = metadata.priority === null ? 0 : metadata.priority;
  }

  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined) {
    updates.activeFrom = activeFrom === null ? undefined : activeFrom;
  }

  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined) {
    updates.activeTo = activeTo === null ? undefined : activeTo;
  }

  if (metadata?.comment !== undefined) {
    const comment = normalizeStringInput(metadata.comment);
    updates.comment = comment === null ? undefined : comment;
  }

  // Handle isDefault flag
  if (metadata?.isDefault !== undefined) {
    if (metadata.isDefault) {
      // Clear isDefault from all other versions (use version number instead of _id)
      await HomeTemplateModel.updateMany(
        { templateId: HOME_TEMPLATE_ID, version: { $ne: currentVersion.version } },
        { $set: { isDefault: false } }
      );
      updates.isDefault = true;
    } else {
      updates.isDefault = false;
    }
  } else {
    // Check if there's any other default published version
    const otherDefault = await HomeTemplateModel.findOne({
      templateId: HOME_TEMPLATE_ID,
      version: { $ne: currentVersion.version },
      status: "published",
      isDefault: true
    });

    if (!otherDefault) {
      // This should be the default
      updates.isDefault = true;
    }
  }

  console.log(`${logPrefix} Final updates to apply:`, JSON.stringify(updates, null, 2));

  // Use templateId + version to find document (avoids ObjectId/string mismatch issues)
  const updateResult = await HomeTemplateModel.updateOne(
    { templateId: HOME_TEMPLATE_ID, version: currentVersion.version },
    { $set: updates }
  );

  console.log(`${logPrefix} Update result: matched=${updateResult.matchedCount}, modified=${updateResult.modifiedCount}`);

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags(tenantDb);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Update isCurrentPublished flags based on isDefault and priority
 */
async function updateCurrentPublishedFlags(tenantDb?: string): Promise<void> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);
  const allVersions = await getAllVersions(true, tenantDb);
  const defaultPublished = findDefaultPublishedVersion(allVersions);

  // Clear all isCurrentPublished flags
  await HomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrentPublished: false } }
  );

  // Set the current published version
  if (defaultPublished) {
    await HomeTemplateModel.updateOne(
      { templateId: HOME_TEMPLATE_ID, version: defaultPublished.version },
      { $set: { isCurrentPublished: true } }
    );
  }
}

/**
 * Load a specific home template version for editing.
 * Simply switches the isCurrent pointer.
 */
export async function loadHomeTemplateVersion(version: number, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  // Check if version exists
  const targetVersion = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  }).lean();

  if (!targetVersion) {
    throw new Error(`Version ${version} not found`);
  }

  // Clear isCurrent from all versions
  await HomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Set isCurrent on target version using templateId + version (avoids ObjectId issues)
  await HomeTemplateModel.updateOne(
    { templateId: HOME_TEMPLATE_ID, version: version },
    { $set: { isCurrent: true } }
  );

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Start a new draft version based on the latest published (or current) version
 */
export async function startNewHomeTemplateVersion(tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const allVersions = await getAllVersions(true, tenantDb);

  if (allVersions.length === 0) {
    throw new Error("No template versions found");
  }

  // Find base version (current published or latest)
  const currentPublished = allVersions.find((v) => v.isCurrentPublished);
  const baseVersion = currentPublished || allVersions[allVersions.length - 1];

  const now = new Date().toISOString();

  const sanitizedBlocks = Array.isArray(baseVersion.blocks)
    ? baseVersion.blocks.map((block: any, index: number) => ({
        id: block.id || `block-${index}`,
        type: block.type,
        order: index,
        config: block.config || {},
        metadata: block.metadata || {}
      }))
    : [];

  const maxVersion = Math.max(...allVersions.map((v) => v.version));
  const nextVersion = maxVersion + 1;

  // Clear isCurrent from all versions
  await HomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Create new version
  const newVersion = await HomeTemplateModel.create({
    templateId: HOME_TEMPLATE_ID,
    name: baseVersion.name,
    version: nextVersion,
    blocks: sanitizedBlocks,
    seo: baseVersion.seo || {},
    status: "draft" as const,
    label: `Version ${nextVersion}`,
    createdAt: now,
    lastSavedAt: now,
    createdBy: "b2b-admin",
    comment: `Version ${nextVersion}`,
    tags: cloneTags(baseVersion.tags),
    tag: baseVersion.tag,
    priority: baseVersion.priority ?? 0,
    isDefault: false,
    activeFrom: baseVersion.activeFrom,
    activeTo: baseVersion.activeTo,
    isCurrent: true
  });

  console.log(`[startNewHomeTemplateVersion] Created version ${nextVersion}`);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Delete a historical home template version.
 */
export async function deleteHomeTemplateVersion(version: number, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const targetVersion = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  });

  if (!targetVersion) {
    throw new Error(`Version ${version} not found`);
  }

  if (targetVersion.isCurrent) {
    throw new Error("Cannot delete the current version");
  }

  if (targetVersion.isCurrentPublished) {
    throw new Error("Cannot delete the published version");
  }

  await HomeTemplateModel.deleteOne({ _id: targetVersion._id });

  console.log(`[deleteHomeTemplateVersion] Deleted version ${version}`);

  // Update current published flags
  await updateCurrentPublishedFlags(tenantDb);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Duplicate an existing version into a new draft.
 */
export async function duplicateHomeTemplateVersion(sourceVersion: number, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const source = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: sourceVersion
  });

  if (!source) {
    throw new Error(`Source version ${sourceVersion} not found`);
  }

  const allVersions = await getAllVersions(true, tenantDb);
  const maxVersion = Math.max(...allVersions.map((v) => v.version));
  const nextVersion = maxVersion + 1;

  const now = new Date().toISOString();

  // Clear isCurrent from all versions
  await HomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Create new version
  const newVersion = await HomeTemplateModel.create({
    templateId: HOME_TEMPLATE_ID,
    name: source.name,
    version: nextVersion,
    blocks: JSON.parse(JSON.stringify(source.blocks || [])),
    seo: source.seo ? JSON.parse(JSON.stringify(source.seo)) : undefined,
    status: "draft" as const,
    label: source.label ? `${source.label} (Copy)` : `Version ${nextVersion}`,
    createdAt: now,
    lastSavedAt: now,
    createdBy: source.createdBy || "b2b-admin",
    comment: `Version ${nextVersion} (duplicated from v${sourceVersion})`,
    tags: cloneTags(source.tags),
    tag: source.tag,
    priority: source.priority ?? 0,
    isDefault: false,
    activeFrom: source.activeFrom,
    activeTo: source.activeTo,
    isCurrent: true
  });

  console.log(`[duplicateHomeTemplateVersion] Created version ${nextVersion} from v${sourceVersion}`);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Rename a specific version.
 */
export async function renameHomeTemplateVersion(input: { version: number; label: string }, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const { version, label } = input;

  // Check if version exists
  const exists = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  }).lean();

  if (!exists) {
    throw new Error(`Version ${version} not found`);
  }

  const trimmed = (label ?? "").trim();
  const newLabel = trimmed.length > 0 ? trimmed : `Version ${version}`;

  // Use findOneAndUpdate to avoid _id type mismatch issues
  await HomeTemplateModel.findOneAndUpdate(
    { templateId: HOME_TEMPLATE_ID, version: version },
    { $set: { label: newLabel } }
  );

  console.log(`[renameHomeTemplateVersion] Updated version ${version} label to "${newLabel}"`);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Publish a specific version from history.
 */
export async function publishHomeTemplateVersion(
  version: number,
  metadata?: PublishMetadataInput,
  tenantDb?: string
): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  // Check if version exists
  const target = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  }).lean();

  if (!target) {
    throw new Error(`Version ${version} not found`);
  }

  const now = new Date().toISOString();

  // Build the update object
  const setFields: Record<string, any> = {
    status: "published",
    publishedAt: now,
    lastSavedAt: now
  };
  const unsetFields: Record<string, any> = {};

  // Apply metadata - tags
  const tagsUpdate = buildTagsFromInput(metadata);
  if (tagsUpdate.shouldUpdate) {
    if (tagsUpdate.value) {
      setFields.tags = tagsUpdate.value;
      if (tagsUpdate.value.campaign) {
        setFields.tag = tagsUpdate.value.campaign;
      } else {
        unsetFields.tag = 1;
      }
    } else {
      unsetFields.tags = 1;
      unsetFields.tag = 1;
    }
  }

  // Apply metadata - priority
  if (metadata?.priority !== undefined) {
    setFields.priority = metadata.priority === null ? 0 : metadata.priority;
  }

  // Apply metadata - activeFrom
  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined) {
    if (activeFrom === null) {
      unsetFields.activeFrom = 1;
    } else {
      setFields.activeFrom = activeFrom;
    }
  }

  // Apply metadata - activeTo
  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined) {
    if (activeTo === null) {
      unsetFields.activeTo = 1;
    } else {
      setFields.activeTo = activeTo;
    }
  }

  // Apply metadata - comment
  if (metadata?.comment !== undefined) {
    const comment = normalizeStringInput(metadata.comment);
    if (comment === null) {
      unsetFields.comment = 1;
    } else {
      setFields.comment = comment;
    }
  }

  // Handle isDefault flag
  if (metadata?.isDefault !== undefined) {
    if (metadata.isDefault) {
      // Clear isDefault from all other versions
      await HomeTemplateModel.updateMany(
        { templateId: HOME_TEMPLATE_ID, version: { $ne: version } },
        { $set: { isDefault: false } }
      );
      setFields.isDefault = true;
    } else {
      setFields.isDefault = false;
    }
  } else {
    // Check if there's any other default published version
    const otherDefault = await HomeTemplateModel.findOne({
      templateId: HOME_TEMPLATE_ID,
      version: { $ne: version },
      status: "published",
      isDefault: true
    }).lean();

    if (!otherDefault) {
      setFields.isDefault = true;
    }
  }

  // Build the update operation
  const updateOp: Record<string, any> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) {
    updateOp.$unset = unsetFields;
  }

  // Use findOneAndUpdate to avoid _id type mismatch issues
  await HomeTemplateModel.findOneAndUpdate(
    { templateId: HOME_TEMPLATE_ID, version: version },
    updateOp
  );

  // Set as current version
  await HomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );
  await HomeTemplateModel.updateOne(
    { templateId: HOME_TEMPLATE_ID, version: version },
    { $set: { isCurrent: true } }
  );

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags(tenantDb);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Unpublish a specific version.
 */
export async function unpublishHomeTemplateVersion(version: number, tenantDb?: string): Promise<any> {
  const HomeTemplateModel = await getHomeTemplateModel(tenantDb);

  const target = await HomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  }).lean();

  if (!target) {
    throw new Error(`Version ${version} not found`);
  }

  if (target.status !== "published") {
    throw new Error(`Version ${version} is not published`);
  }

  await HomeTemplateModel.findOneAndUpdate(
    { templateId: HOME_TEMPLATE_ID, version: version },
    {
      $set: {
        status: "draft",
        isDefault: false
      },
      $unset: {
        publishedAt: 1
      }
    }
  );

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags(tenantDb);

  return getHomeTemplateConfig(tenantDb);
}

/**
 * Get published home template for customer_web
 */
export async function getPublishedHomeTemplate(tenantDb?: string): Promise<any | null> {
  const currentPublished = await getCurrentPublishedVersion(true, tenantDb);

  if (!currentPublished || currentPublished.status !== "published") {
    return null;
  }

  const normalized = serializeVersionForResponse(currentPublished);

  return {
    blocks: normalized.blocks,
    seo: normalized.seo,
    version: normalized.version,
    publishedAt: normalized.publishedAt,
    tags: normalized.tags,
    priority: normalized.priority,
    isDefault: normalized.isDefault,
    activeFrom: normalized.activeFrom,
    activeTo: normalized.activeTo,
    comment: normalized.comment
  };
}

/**
 * Get the latest saved home template version (draft or published).
 * Used for preview mode so the admin can see draft content.
 */
export async function getLatestHomeTemplateVersion(tenantDb?: string): Promise<any | null> {
  const current = await getCurrentVersion(true, tenantDb);

  if (!current) {
    return null;
  }

  const normalized = serializeVersionForResponse(current);

  return {
    blocks: normalized.blocks,
    seo: normalized.seo,
    version: normalized.version,
    status: normalized.status,
    lastSavedAt: normalized.lastSavedAt,
    tags: normalized.tags,
    priority: normalized.priority,
    isDefault: normalized.isDefault,
    activeFrom: normalized.activeFrom,
    activeTo: normalized.activeTo,
    comment: normalized.comment
  };
}
