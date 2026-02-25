/**
 * B2C Home Templates
 *
 * Reuses the same HomeTemplate collection (b2bhometemplates) but scoped
 * per storefront via templateId: "b2c-{storefront-slug}".
 *
 * Each B2C storefront gets its own independent set of home template versions
 * with full draft/publish/version management — identical flow to the B2B home builder.
 */

import { connectWithModels } from "./connection";
import type { HomeTemplateDocument } from "./models/home-template";
import type { PageVersionTags } from "@/lib/types/blocks";
import type mongoose from "mongoose";

// ============================================
// HELPERS
// ============================================

/** Build the templateId for a B2C storefront */
function buildTemplateId(storefrontSlug: string): string {
  return `b2c-${storefrontSlug}`;
}

const normalizeStringInput = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAttributesInput = (
  attributes?: Record<string, string | string[] | null | undefined>
) => {
  if (!attributes) return undefined;
  const result: Record<string, string | string[]> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (v) => typeof v === "string" && v.trim().length > 0
      );
      if (filtered.length > 0) result[key] = filtered;
    } else {
      const normalized = normalizeStringInput(value);
      if (normalized) result[key] = normalized;
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

const normalizeDateInput = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const shouldUpdateTags = (input?: PublishMetadataInput) =>
  input &&
  (input.campaign !== undefined ||
    input.segment !== undefined ||
    input.attributes !== undefined);

const buildTagsFromInput = (
  input?: PublishMetadataInput
): { shouldUpdate: boolean; value?: PageVersionTags } => {
  if (!shouldUpdateTags(input)) return { shouldUpdate: false };

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

const serializeVersion = (version: any) => {
  const tags = version.tags
    ? {
        ...version.tags,
        attributes:
          version.tags.attributes instanceof Map
            ? Object.fromEntries(version.tags.attributes.entries())
            : version.tags.attributes,
      }
    : undefined;
  return { ...version, tags };
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
  if ((tags as PageVersionTags).campaign)
    cloned.campaign = (tags as PageVersionTags).campaign;
  if ((tags as PageVersionTags).segment)
    cloned.segment = (tags as PageVersionTags).segment;
  if (attributes) cloned.attributes = { ...attributes };
  return cloned;
};

// ============================================
// TYPES
// ============================================

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

// ============================================
// INTERNAL - model & query helpers
// ============================================

async function getModel(
  tenantDb: string
): Promise<mongoose.Model<HomeTemplateDocument>> {
  const models = await connectWithModels(tenantDb);
  return models.HomeTemplate as mongoose.Model<HomeTemplateDocument>;
}

async function getAllVersions(
  templateId: string,
  tenantDb: string
): Promise<HomeTemplateDocument[]> {
  const Model = await getModel(tenantDb);
  return Model.find({ templateId }).sort({ version: 1 }).lean();
}

async function getCurrentVersion(
  templateId: string,
  tenantDb: string,
  lean = true
): Promise<HomeTemplateDocument | null> {
  const Model = await getModel(tenantDb);
  const q = Model.findOne({ templateId, isCurrent: true });
  return lean ? q.lean() : q.exec();
}

async function getCurrentPublished(
  templateId: string,
  tenantDb: string
): Promise<HomeTemplateDocument | null> {
  const Model = await getModel(tenantDb);
  return Model.findOne({ templateId, isCurrentPublished: true }).lean();
}

function findDefaultPublished(
  versions: HomeTemplateDocument[]
): HomeTemplateDocument | null {
  const published = versions.filter((v) => v.status === "published");
  if (!published.length) return null;

  let defaultV = published.find((v) => v.isDefault);
  if (!defaultV) {
    defaultV = [...published].sort((a, b) => {
      const pd = (b.priority ?? 0) - (a.priority ?? 0);
      return pd !== 0 ? pd : (b.version ?? 0) - (a.version ?? 0);
    })[0];
  }
  return defaultV || null;
}

async function updateCurrentPublishedFlags(
  templateId: string,
  tenantDb: string
): Promise<void> {
  const Model = await getModel(tenantDb);
  const allVersions = await getAllVersions(templateId, tenantDb);
  const defaultPublished = findDefaultPublished(allVersions);

  await Model.updateMany({ templateId }, { $set: { isCurrentPublished: false } });

  if (defaultPublished) {
    await Model.updateOne(
      { templateId, version: defaultPublished.version },
      { $set: { isCurrentPublished: true } }
    );
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Initialize an empty home template for a new B2C storefront
 */
export async function initB2CHomeTemplate(
  storefrontSlug: string,
  storefrontName: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);

  const existing = await Model.findOne({ templateId }).lean();
  if (existing) return;

  const now = new Date().toISOString();
  await Model.create({
    templateId,
    name: `${storefrontName} - Home`,
    version: 1,
    blocks: [],
    seo: {},
    status: "draft" as const,
    label: "Version 1",
    createdAt: now,
    lastSavedAt: now,
    createdBy: "system",
    comment: "Empty home page template",
    isCurrent: true,
    isActive: true,
  });
}

/**
 * Delete all home template versions for a storefront
 */
export async function deleteB2CHomeTemplates(
  storefrontSlug: string,
  tenantDb: string
): Promise<void> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);
  await Model.deleteMany({ templateId });
}

/**
 * Get home template config (PageConfig format) for the builder
 */
export async function getB2CHomeTemplateConfig(
  storefrontSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const allVersions = await getAllVersions(templateId, tenantDb);

  if (allVersions.length === 0) {
    // Auto-init if missing
    await initB2CHomeTemplate(storefrontSlug, storefrontSlug, tenantDb);
    return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
  }

  const current = allVersions.find((v) => v.isCurrent === true);
  const currentPub = allVersions.find((v) => v.isCurrentPublished === true);

  const normalizedVersions = allVersions.map((v: any) =>
    serializeVersion({
      ...v,
      label: v.label ?? v.comment ?? `Version ${v.version}`,
    })
  );

  return {
    slug: `b2c-${storefrontSlug}`,
    name: allVersions[0]?.name || `${storefrontSlug} - Home`,
    versions: normalizedVersions,
    currentVersion:
      current?.version ||
      allVersions[allVersions.length - 1]?.version ||
      0,
    currentPublishedVersion: currentPub?.version,
    createdAt: allVersions[0]?.createdAt || new Date().toISOString(),
    updatedAt:
      allVersions[allVersions.length - 1]?.lastSavedAt ||
      new Date().toISOString(),
  };
}

/**
 * Save draft for a B2C storefront home template
 */
export async function saveB2CHomeTemplateDraft(
  storefrontSlug: string,
  input: { blocks: any[]; seo?: any },
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);
  const { blocks, seo } = input;
  const now = new Date().toISOString();

  const sanitizedBlocks = blocks.map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {},
  }));

  let currentVersion = await getCurrentVersion(templateId, tenantDb, false);

  if (!currentVersion) {
    const all = await getAllVersions(templateId, tenantDb);
    if (all.length === 0) {
      currentVersion = await Model.create({
        templateId,
        name: `${storefrontSlug} - Home`,
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
      const latest = all[all.length - 1];
      await Model.updateOne(
        { templateId, version: latest.version },
        { $set: { isCurrent: true } }
      );
      currentVersion = await Model.findOne({
        templateId,
        version: latest.version,
      });
    }
  }

  if (!currentVersion) throw new Error("Failed to get or create current version");

  await Model.updateOne(
    { templateId, version: currentVersion.version },
    { $set: { blocks: sanitizedBlocks, seo: seo || {}, lastSavedAt: now } }
  );

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Publish the current draft
 */
export async function publishB2CHomeTemplate(
  storefrontSlug: string,
  metadata?: PublishMetadataInput,
  tenantDb?: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb!);
  const currentVersion = await getCurrentVersion(templateId, tenantDb!, false);

  if (!currentVersion) throw new Error("No current version to publish");
  if (currentVersion.status === "published")
    throw new Error(`Version ${currentVersion.version} is already published`);

  const now = new Date().toISOString();
  const updates: any = { status: "published", publishedAt: now, lastSavedAt: now };

  const tagsUpdate = buildTagsFromInput(metadata);
  if (tagsUpdate.shouldUpdate) {
    updates.tags = tagsUpdate.value;
    updates.tag = tagsUpdate.value?.campaign ?? undefined;
  }

  if (metadata?.priority !== undefined)
    updates.priority = metadata.priority === null ? 0 : metadata.priority;

  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined)
    updates.activeFrom = activeFrom === null ? undefined : activeFrom;

  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined)
    updates.activeTo = activeTo === null ? undefined : activeTo;

  if (metadata?.comment !== undefined) {
    const comment = normalizeStringInput(metadata.comment);
    updates.comment = comment === null ? undefined : comment;
  }

  if (metadata?.isDefault !== undefined) {
    if (metadata.isDefault) {
      await Model.updateMany(
        { templateId, version: { $ne: currentVersion.version } },
        { $set: { isDefault: false } }
      );
      updates.isDefault = true;
    } else {
      updates.isDefault = false;
    }
  } else {
    const otherDefault = await Model.findOne({
      templateId,
      version: { $ne: currentVersion.version },
      status: "published",
      isDefault: true,
    });
    if (!otherDefault) updates.isDefault = true;
  }

  await Model.updateOne(
    { templateId, version: currentVersion.version },
    { $set: updates }
  );

  await updateCurrentPublishedFlags(templateId, tenantDb!);
  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb!);
}

/**
 * Load a specific version for editing
 */
export async function loadB2CHomeTemplateVersion(
  storefrontSlug: string,
  version: number,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);

  const target = await Model.findOne({ templateId, version }).lean();
  if (!target) throw new Error(`Version ${version} not found`);

  await Model.updateMany({ templateId }, { $set: { isCurrent: false } });
  await Model.updateOne({ templateId, version }, { $set: { isCurrent: true } });

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Start a new draft version based on latest published or current
 */
export async function startNewB2CHomeTemplateVersion(
  storefrontSlug: string,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);
  const allVersions = await getAllVersions(templateId, tenantDb);

  if (allVersions.length === 0) throw new Error("No template versions found");

  const currentPublished = allVersions.find((v) => v.isCurrentPublished);
  const baseVersion = currentPublished || allVersions[allVersions.length - 1];

  const now = new Date().toISOString();
  const sanitizedBlocks = Array.isArray(baseVersion.blocks)
    ? baseVersion.blocks.map((block: any, i: number) => ({
        id: block.id || `block-${i}`,
        type: block.type,
        order: i,
        config: block.config || {},
        metadata: block.metadata || {},
      }))
    : [];

  const nextVersion = Math.max(...allVersions.map((v) => v.version)) + 1;

  await Model.updateMany({ templateId }, { $set: { isCurrent: false } });
  await Model.create({
    templateId,
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
    isCurrent: true,
  });

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Delete a version from history
 */
export async function deleteB2CHomeTemplateVersion(
  storefrontSlug: string,
  version: number,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);

  const target = await Model.findOne({ templateId, version });
  if (!target) throw new Error(`Version ${version} not found`);
  if (target.isCurrent) throw new Error("Cannot delete the current version");
  if (target.isCurrentPublished) throw new Error("Cannot delete the published version");

  await Model.deleteOne({ _id: target._id });
  await updateCurrentPublishedFlags(templateId, tenantDb);

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Duplicate a version into a new draft
 */
export async function duplicateB2CHomeTemplateVersion(
  storefrontSlug: string,
  sourceVersion: number,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);

  const source = await Model.findOne({ templateId, version: sourceVersion });
  if (!source) throw new Error(`Source version ${sourceVersion} not found`);

  const allVersions = await getAllVersions(templateId, tenantDb);
  const nextVersion = Math.max(...allVersions.map((v) => v.version)) + 1;
  const now = new Date().toISOString();

  await Model.updateMany({ templateId }, { $set: { isCurrent: false } });
  await Model.create({
    templateId,
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
    isCurrent: true,
  });

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Rename a version
 */
export async function renameB2CHomeTemplateVersion(
  storefrontSlug: string,
  input: { version: number; label: string },
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);
  const { version, label } = input;

  const exists = await Model.findOne({ templateId, version }).lean();
  if (!exists) throw new Error(`Version ${version} not found`);

  const trimmed = (label ?? "").trim();
  const newLabel = trimmed.length > 0 ? trimmed : `Version ${version}`;

  await Model.findOneAndUpdate(
    { templateId, version },
    { $set: { label: newLabel } }
  );

  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Publish a specific version from history
 */
export async function publishB2CHomeTemplateVersion(
  storefrontSlug: string,
  version: number,
  metadata?: PublishMetadataInput,
  tenantDb?: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb!);

  const target = await Model.findOne({ templateId, version }).lean();
  if (!target) throw new Error(`Version ${version} not found`);

  const now = new Date().toISOString();
  const setFields: Record<string, any> = {
    status: "published",
    publishedAt: now,
    lastSavedAt: now,
  };
  const unsetFields: Record<string, any> = {};

  const tagsUpdate = buildTagsFromInput(metadata);
  if (tagsUpdate.shouldUpdate) {
    if (tagsUpdate.value) {
      setFields.tags = tagsUpdate.value;
      if (tagsUpdate.value.campaign) setFields.tag = tagsUpdate.value.campaign;
      else unsetFields.tag = 1;
    } else {
      unsetFields.tags = 1;
      unsetFields.tag = 1;
    }
  }

  if (metadata?.priority !== undefined)
    setFields.priority = metadata.priority === null ? 0 : metadata.priority;

  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined) {
    if (activeFrom === null) unsetFields.activeFrom = 1;
    else setFields.activeFrom = activeFrom;
  }
  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined) {
    if (activeTo === null) unsetFields.activeTo = 1;
    else setFields.activeTo = activeTo;
  }

  if (metadata?.comment !== undefined) {
    const comment = normalizeStringInput(metadata.comment);
    if (comment === null) unsetFields.comment = 1;
    else setFields.comment = comment;
  }

  if (metadata?.isDefault !== undefined) {
    if (metadata.isDefault) {
      await Model.updateMany(
        { templateId, version: { $ne: version } },
        { $set: { isDefault: false } }
      );
      setFields.isDefault = true;
    } else {
      setFields.isDefault = false;
    }
  } else {
    const otherDefault = await Model.findOne({
      templateId,
      version: { $ne: version },
      status: "published",
      isDefault: true,
    }).lean();
    if (!otherDefault) setFields.isDefault = true;
  }

  const updateOp: Record<string, any> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) updateOp.$unset = unsetFields;

  await Model.findOneAndUpdate({ templateId, version }, updateOp);

  await Model.updateMany({ templateId }, { $set: { isCurrent: false } });
  await Model.updateOne(
    { templateId, version },
    { $set: { isCurrent: true } }
  );

  await updateCurrentPublishedFlags(templateId, tenantDb!);
  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb!);
}

/**
 * Unpublish a version
 */
export async function unpublishB2CHomeTemplateVersion(
  storefrontSlug: string,
  version: number,
  tenantDb: string
): Promise<any> {
  const templateId = buildTemplateId(storefrontSlug);
  const Model = await getModel(tenantDb);

  const target = await Model.findOne({ templateId, version }).lean();
  if (!target) throw new Error(`Version ${version} not found`);
  if (target.status !== "published")
    throw new Error(`Version ${version} is not published`);

  await Model.findOneAndUpdate(
    { templateId, version },
    {
      $set: { status: "draft", isDefault: false },
      $unset: { publishedAt: 1 },
    }
  );

  await updateCurrentPublishedFlags(templateId, tenantDb);
  return getB2CHomeTemplateConfig(storefrontSlug, tenantDb);
}

/**
 * Get published home template for a B2C frontend consumer
 */
export async function getPublishedB2CHomeTemplate(
  storefrontSlug: string,
  tenantDb: string
): Promise<any | null> {
  const templateId = buildTemplateId(storefrontSlug);
  const currentPublished = await getCurrentPublished(templateId, tenantDb);

  if (!currentPublished || currentPublished.status !== "published") return null;

  const normalized = serializeVersion(currentPublished);
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
    comment: normalized.comment,
  };
}
