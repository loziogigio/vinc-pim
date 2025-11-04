import { connectToDatabase } from "./connection";
import { B2BHomeTemplateModel, type HomeTemplateDocument } from "./models/home-template";
import { initializeHomeTemplate } from "./init-home-template";
import type { PageVersionTags } from "@/lib/types/blocks";

const HOME_TEMPLATE_ID = "home-page";

const logPrefix = "[home-templates]";

export type PublishMetadataInput = {
  campaign?: string | null;
  segment?: string | null;
  attributes?: Record<string, string | null | undefined>;
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

const normalizeAttributesInput = (attributes?: Record<string, string | null | undefined>) => {
  if (!attributes) return undefined;
  const result: Record<string, string> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    const normalized = normalizeStringInput(value);
    if (normalized) {
      result[key] = normalized;
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
 * Get all versions for a template
 */
async function getAllVersions(lean: boolean = true): Promise<HomeTemplateDocument[]> {
  const query = B2BHomeTemplateModel.find({ templateId: HOME_TEMPLATE_ID }).sort({ version: 1 });
  return lean ? query.lean<HomeTemplateDocument[]>() : query.exec();
}

/**
 * Get the current working version
 */
async function getCurrentVersion(lean: boolean = true): Promise<HomeTemplateDocument | null> {
  const query = B2BHomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID, isCurrent: true });
  return lean ? query.lean<HomeTemplateDocument | null>() : query.findOne().exec();
}

/**
 * Get the current published version
 */
async function getCurrentPublishedVersion(lean: boolean = true): Promise<HomeTemplateDocument | null> {
  const query = B2BHomeTemplateModel.findOne({ templateId: HOME_TEMPLATE_ID, isCurrentPublished: true });
  return lean ? query.lean<HomeTemplateDocument | null>() : query.findOne().exec();
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
export async function getOrCreateHomeTemplate(): Promise<HomeTemplateDocument> {
  await connectToDatabase();

  // Try to find current version
  let template = await getCurrentVersion(true);

  // If not found, check if any version exists
  if (!template) {
    const allVersions = await getAllVersions(true);
    if (allVersions.length > 0) {
      // Return the latest version
      template = allVersions[allVersions.length - 1];
    }
  }

  // If still not found, initialize empty template
  if (!template) {
    console.log("[getOrCreateHomeTemplate] Template not found, creating empty template...");
    const initialized = await initializeHomeTemplate();
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
export async function getHomeTemplateConfig(): Promise<any> {
  await connectToDatabase();

  const allVersions = await getAllVersions(true);

  if (allVersions.length === 0) {
    // Initialize if no versions exist
    await initializeHomeTemplate();
    return getHomeTemplateConfig();
  }

  const currentVersion = allVersions.find((v) => v.isCurrent);
  const currentPublished = allVersions.find((v) => v.isCurrentPublished);

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
}): Promise<any> {
  await connectToDatabase();

  const { blocks, seo } = input;

  console.log(`[saveHomeTemplateDraft] ===== SAVE REQUEST =====`);
  console.log(`[saveHomeTemplateDraft] Blocks count: ${blocks.length}`);

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
  let currentVersion = await getCurrentVersion(false);

  if (!currentVersion) {
    // No current version exists, check if any version exists
    const allVersions = await getAllVersions(false);
    if (allVersions.length === 0) {
      // Create version 1
      console.log(`[saveHomeTemplateDraft] No versions exist, creating version 1`);
      currentVersion = await B2BHomeTemplateModel.create({
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
      // Mark latest version as current
      const latest = allVersions[allVersions.length - 1];
      await B2BHomeTemplateModel.updateOne(
        { _id: latest._id },
        { $set: { isCurrent: true } }
      );
      currentVersion = await B2BHomeTemplateModel.findById(latest._id);
    }
  }

  if (!currentVersion) {
    throw new Error("Failed to get or create current version");
  }

  // Update the current version
  if (currentVersion.status === "published") {
    // Hotfix: Allow saving over published version (updates it directly)
    console.log(`[saveHomeTemplateDraft] HOTFIX: Updating published version ${currentVersion.version}`);
  } else {
    // Update the existing draft version
    console.log(`[saveHomeTemplateDraft] Updating existing draft version ${currentVersion.version}`);
  }

  await B2BHomeTemplateModel.updateOne(
    { _id: currentVersion._id },
    {
      $set: {
        blocks: sanitizedBlocks,
        seo: seo || {},
        lastSavedAt: now
      }
    }
  );

  console.log(`[saveHomeTemplateDraft] Saved version ${currentVersion.version}`);

  // Return updated config
  return getHomeTemplateConfig();
}

/**
 * Publish home template draft
 */
export async function publishHomeTemplate(metadata?: PublishMetadataInput): Promise<any> {
  await connectToDatabase();

  const currentVersion = await getCurrentVersion(false);

  if (!currentVersion) {
    throw new Error("No current version to publish");
  }

  console.log(`[publishHomeTemplate] Publishing version ${currentVersion.version}`);

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

  const tagsUpdate = buildTagsFromInput(metadata);
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
      // Clear isDefault from all other versions
      await B2BHomeTemplateModel.updateMany(
        { templateId: HOME_TEMPLATE_ID, _id: { $ne: currentVersion._id } },
        { $set: { isDefault: false } }
      );
      updates.isDefault = true;
    } else {
      updates.isDefault = false;
    }
  } else {
    // Check if there's any other default published version
    const otherDefault = await B2BHomeTemplateModel.findOne({
      templateId: HOME_TEMPLATE_ID,
      _id: { $ne: currentVersion._id },
      status: "published",
      isDefault: true
    });

    if (!otherDefault) {
      // This should be the default
      updates.isDefault = true;
    }
  }

  await B2BHomeTemplateModel.updateOne(
    { _id: currentVersion._id },
    { $set: updates }
  );

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags();

  console.log(`[publishHomeTemplate] Published version ${currentVersion.version}`);

  return getHomeTemplateConfig();
}

/**
 * Update isCurrentPublished flags based on isDefault and priority
 */
async function updateCurrentPublishedFlags(): Promise<void> {
  const allVersions = await getAllVersions(false);
  const defaultPublished = findDefaultPublishedVersion(allVersions);

  // Clear all isCurrentPublished flags
  await B2BHomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrentPublished: false } }
  );

  // Set the current published version
  if (defaultPublished) {
    await B2BHomeTemplateModel.updateOne(
      { _id: defaultPublished._id },
      { $set: { isCurrentPublished: true } }
    );
  }
}

/**
 * Load a specific home template version for editing.
 * Simply switches the isCurrent pointer.
 */
export async function loadHomeTemplateVersion(version: number): Promise<any> {
  await connectToDatabase();

  const targetVersion = await B2BHomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  });

  if (!targetVersion) {
    throw new Error(`Version ${version} not found`);
  }

  // Clear isCurrent from all versions
  await B2BHomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Set isCurrent on target version
  await B2BHomeTemplateModel.updateOne(
    { _id: targetVersion._id },
    { $set: { isCurrent: true } }
  );

  console.log(`[loadHomeTemplateVersion] Switched to version ${version}`);

  return getHomeTemplateConfig();
}

/**
 * Start a new draft version based on the latest published (or current) version
 */
export async function startNewHomeTemplateVersion(): Promise<any> {
  await connectToDatabase();

  const allVersions = await getAllVersions(true);

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
  await B2BHomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Create new version
  const newVersion = await B2BHomeTemplateModel.create({
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

  return getHomeTemplateConfig();
}

/**
 * Delete a historical home template version.
 */
export async function deleteHomeTemplateVersion(version: number): Promise<any> {
  await connectToDatabase();

  const targetVersion = await B2BHomeTemplateModel.findOne({
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

  await B2BHomeTemplateModel.deleteOne({ _id: targetVersion._id });

  console.log(`[deleteHomeTemplateVersion] Deleted version ${version}`);

  // Update current published flags
  await updateCurrentPublishedFlags();

  return getHomeTemplateConfig();
}

/**
 * Duplicate an existing version into a new draft.
 */
export async function duplicateHomeTemplateVersion(sourceVersion: number): Promise<any> {
  await connectToDatabase();

  const source = await B2BHomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: sourceVersion
  });

  if (!source) {
    throw new Error(`Source version ${sourceVersion} not found`);
  }

  const allVersions = await getAllVersions(true);
  const maxVersion = Math.max(...allVersions.map((v) => v.version));
  const nextVersion = maxVersion + 1;

  const now = new Date().toISOString();

  // Clear isCurrent from all versions
  await B2BHomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );

  // Create new version
  const newVersion = await B2BHomeTemplateModel.create({
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

  return getHomeTemplateConfig();
}

/**
 * Rename a specific version.
 */
export async function renameHomeTemplateVersion(input: { version: number; label: string }): Promise<any> {
  await connectToDatabase();

  const { version, label } = input;

  const target = await B2BHomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  });

  if (!target) {
    throw new Error(`Version ${version} not found`);
  }

  const trimmed = (label ?? "").trim();
  target.label = trimmed.length > 0 ? trimmed : `Version ${version}`;

  await target.save();

  console.log(`[renameHomeTemplateVersion] Updated version ${version} label to "${target.label}"`);

  return getHomeTemplateConfig();
}

/**
 * Publish a specific version from history.
 */
export async function publishHomeTemplateVersion(
  version: number,
  metadata?: PublishMetadataInput
): Promise<any> {
  await connectToDatabase();

  const target = await B2BHomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  });

  if (!target) {
    throw new Error(`Version ${version} not found`);
  }

  const now = new Date().toISOString();

  target.status = "published";
  target.publishedAt = now;
  target.lastSavedAt = now;

  // Apply metadata
  const tagsUpdate = buildTagsFromInput(metadata);
  if (tagsUpdate.shouldUpdate) {
    target.tags = tagsUpdate.value;
    if (tagsUpdate.value?.campaign) {
      target.tag = tagsUpdate.value.campaign;
    } else {
      target.tag = undefined;
    }
  }

  if (metadata?.priority !== undefined) {
    target.priority = metadata.priority === null ? 0 : metadata.priority;
  }

  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined) {
    target.activeFrom = activeFrom === null ? undefined : activeFrom;
  }

  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined) {
    target.activeTo = activeTo === null ? undefined : activeTo;
  }

  if (metadata?.comment !== undefined) {
    const comment = normalizeStringInput(metadata.comment);
    target.comment = comment === null ? undefined : comment;
  }

  // Handle isDefault flag
  if (metadata?.isDefault !== undefined) {
    if (metadata.isDefault) {
      // Clear isDefault from all other versions
      await B2BHomeTemplateModel.updateMany(
        { templateId: HOME_TEMPLATE_ID, _id: { $ne: target._id } },
        { $set: { isDefault: false } }
      );
      target.isDefault = true;
    } else {
      target.isDefault = false;
    }
  } else {
    // Check if there's any other default published version
    const otherDefault = await B2BHomeTemplateModel.findOne({
      templateId: HOME_TEMPLATE_ID,
      _id: { $ne: target._id },
      status: "published",
      isDefault: true
    });

    if (!otherDefault) {
      target.isDefault = true;
    }
  }

  await target.save();

  // Set as current version
  await B2BHomeTemplateModel.updateMany(
    { templateId: HOME_TEMPLATE_ID },
    { $set: { isCurrent: false } }
  );
  await B2BHomeTemplateModel.updateOne(
    { _id: target._id },
    { $set: { isCurrent: true } }
  );

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags();

  console.log(`[publishHomeTemplateVersion] Published version ${version}`);

  return getHomeTemplateConfig();
}

/**
 * Unpublish a specific version.
 */
export async function unpublishHomeTemplateVersion(version: number): Promise<any> {
  await connectToDatabase();

  const target = await B2BHomeTemplateModel.findOne({
    templateId: HOME_TEMPLATE_ID,
    version: version
  });

  if (!target) {
    throw new Error(`Version ${version} not found`);
  }

  if (target.status !== "published") {
    throw new Error(`Version ${version} is not published`);
  }

  target.status = "draft";
  target.publishedAt = undefined;
  target.isDefault = false;

  await target.save();

  // Update isCurrentPublished flags
  await updateCurrentPublishedFlags();

  console.log(`[unpublishHomeTemplateVersion] Unpublished version ${version}`);

  return getHomeTemplateConfig();
}

/**
 * Get published home template for customer_web
 */
export async function getPublishedHomeTemplate(): Promise<any | null> {
  await connectToDatabase();

  const currentPublished = await getCurrentPublishedVersion(true);

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
export async function getLatestHomeTemplateVersion(): Promise<any | null> {
  await connectToDatabase();

  const current = await getCurrentVersion(true);

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
