/**
 * B2B Home Template — version-management write operations
 *
 * deleteVersionInPortal, duplicateVersionInPortal, startNewVersionInPortal,
 * unpublishVersionInPortal, updateVersionInPortal, publishVersionInPortal.
 *
 * All are imported and re-exported by b2b-home-template.service.ts so that
 * existing route imports stay unchanged.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  TEMPLATE_ID,
  logPrefix,
  type HomeTemplatePageConfig,
  type PublishMetadataInput,
  normalizeStringInput,
  normalizeDateInput,
  buildTagsFromInput,
  cloneTags,
  updateCurrentPublishedFlags,
} from "./b2b-home-template-shared";
import { getHomeTemplate } from "./b2b-home-template.service";

/**
 * Delete a specific version from a portal.
 *
 * Cannot delete the current version or the currently published version.
 * Recalculates isCurrentPublished flags after deletion.
 *
 * Mirrors: deleteHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function deleteVersionInPortal(
  dbName: string,
  portalSlug: string,
  version: number,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const target = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    version,
  });

  if (!target) {
    throw new Error(`Version ${version} not found for portal "${portalSlug}"`);
  }

  if (target.isCurrent) {
    throw new Error("Cannot delete the current version");
  }

  if (target.isCurrentPublished) {
    throw new Error("Cannot delete the published version");
  }

  await HomeTemplate.deleteOne({ _id: target._id });

  console.log(`${logPrefix} [deleteVersion] portal="${portalSlug}" deleted v${version}`);

  await updateCurrentPublishedFlags(dbName, portalSlug);

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Duplicate an existing version into a new draft for a portal.
 *
 * Clones blocks, seo, tags, and scheduling fields. The new version
 * becomes the current working version (isCurrent=true).
 *
 * Mirrors: duplicateHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function duplicateVersionInPortal(
  dbName: string,
  portalSlug: string,
  sourceVersion: number,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const source = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    version: sourceVersion,
  });

  if (!source) {
    throw new Error(`Source version ${sourceVersion} not found for portal "${portalSlug}"`);
  }

  const allVersions = await HomeTemplate.find({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
  }).lean();

  const maxVersion = Math.max(...(allVersions as any[]).map((v: any) => v.version));
  const nextVersion = maxVersion + 1;
  const now = new Date().toISOString();

  // Clear isCurrent from all versions in this portal
  await HomeTemplate.updateMany(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID },
    { $set: { isCurrent: false } },
  );

  await HomeTemplate.create({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
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

  console.log(
    `${logPrefix} [duplicateVersion] portal="${portalSlug}" created v${nextVersion} from v${sourceVersion}`,
  );

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Start a new draft version based on the latest published (or current) version.
 *
 * Copies blocks, seo, tags, and scheduling from the base version. The new
 * version becomes the current working version (isCurrent=true).
 *
 * Mirrors: startNewHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function startNewVersionInPortal(
  dbName: string,
  portalSlug: string,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const allVersions = await HomeTemplate.find({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
  })
    .sort({ version: 1 })
    .lean();

  if ((allVersions as any[]).length === 0) {
    throw new Error("No template versions found for portal");
  }

  // Use the currently published version as base, or fall back to latest
  const currentPublished = (allVersions as any[]).find((v: any) => v.isCurrentPublished);
  const baseVersion: any = currentPublished ?? (allVersions as any[])[allVersions.length - 1];

  const maxVersion = Math.max(...(allVersions as any[]).map((v: any) => v.version));
  const nextVersion = maxVersion + 1;
  const now = new Date().toISOString();

  const sanitizedBlocks = Array.isArray(baseVersion.blocks)
    ? baseVersion.blocks.map((block: any, index: number) => ({
        id: block.id || `block-${index}`,
        type: block.type,
        order: index,
        config: block.config || {},
        metadata: block.metadata || {},
      }))
    : [];

  // Clear isCurrent from all versions in this portal
  await HomeTemplate.updateMany(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID },
    { $set: { isCurrent: false } },
  );

  await HomeTemplate.create({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
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

  console.log(`${logPrefix} [startNewVersion] portal="${portalSlug}" created v${nextVersion}`);

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Unpublish a specific version for a portal, reverting it to draft status.
 *
 * Clears publishedAt, sets status="draft", isDefault=false. Recalculates
 * isCurrentPublished flags after the change.
 *
 * Mirrors: unpublishHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function unpublishVersionInPortal(
  dbName: string,
  portalSlug: string,
  version: number,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const target = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    version,
  }).lean();

  if (!target) {
    throw new Error(`Version ${version} not found for portal "${portalSlug}"`);
  }

  if ((target as any).status !== "published") {
    throw new Error(`Version ${version} is not published`);
  }

  await HomeTemplate.findOneAndUpdate(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version },
    {
      $set: { status: "draft", isDefault: false },
      $unset: { publishedAt: 1 },
    },
  );

  await updateCurrentPublishedFlags(dbName, portalSlug);

  console.log(`${logPrefix} [unpublishVersion] portal="${portalSlug}" unpublished v${version}`);

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Update metadata (label) on a specific version for a portal.
 *
 * Currently supports renaming via the `label` field. Trims the label and
 * falls back to "Version N" if the result is empty.
 *
 * Mirrors: renameHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function updateVersionInPortal(
  dbName: string,
  portalSlug: string,
  version: number,
  patch: { label?: string },
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const exists = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    version,
  }).lean();

  if (!exists) {
    throw new Error(`Version ${version} not found for portal "${portalSlug}"`);
  }

  const trimmed = (patch.label ?? "").trim();
  const newLabel = trimmed.length > 0 ? trimmed : `Version ${version}`;

  await HomeTemplate.findOneAndUpdate(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version },
    { $set: { label: newLabel } },
  );

  console.log(
    `${logPrefix} [updateVersion] portal="${portalSlug}" v${version} label="${newLabel}"`,
  );

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Publish a specific (not necessarily current) version for the given portal.
 *
 * Publishes the target version, handles tag/priority/scheduling metadata,
 * sets it as isCurrent, and recalculates isCurrentPublished flags.
 *
 * Mirrors: publishHomeTemplateVersion in src/lib/db/home-templates.ts
 */
export async function publishVersionInPortal(
  dbName: string,
  portalSlug: string,
  version: number,
  payload: Record<string, unknown>,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const target = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    version,
  }).lean();

  if (!target) {
    throw new Error(`Version ${version} not found for portal "${portalSlug}"`);
  }

  const now = new Date().toISOString();
  const metadata = payload as PublishMetadataInput;

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

  if (metadata?.priority !== undefined) {
    setFields.priority = metadata.priority === null ? 0 : metadata.priority;
  }

  const activeFrom = normalizeDateInput(metadata?.activeFrom);
  if (activeFrom !== undefined) {
    if (activeFrom === null) {
      unsetFields.activeFrom = 1;
    } else {
      setFields.activeFrom = activeFrom;
    }
  }

  const activeTo = normalizeDateInput(metadata?.activeTo);
  if (activeTo !== undefined) {
    if (activeTo === null) {
      unsetFields.activeTo = 1;
    } else {
      setFields.activeTo = activeTo;
    }
  }

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
      await HomeTemplate.updateMany(
        { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: { $ne: version } },
        { $set: { isDefault: false } },
      );
      setFields.isDefault = true;
    } else {
      setFields.isDefault = false;
    }
  } else {
    const otherDefault = await HomeTemplate.findOne({
      portal_slug: portalSlug,
      templateId: TEMPLATE_ID,
      version: { $ne: version },
      status: "published",
      isDefault: true,
    }).lean();
    if (!otherDefault) {
      setFields.isDefault = true;
    }
  }

  const updateOp: Record<string, any> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) {
    updateOp.$unset = unsetFields;
  }

  await HomeTemplate.findOneAndUpdate(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version },
    updateOp,
  );

  // Make this version the current working version
  await HomeTemplate.updateMany(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID },
    { $set: { isCurrent: false } },
  );
  await HomeTemplate.updateOne(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version },
    { $set: { isCurrent: true } },
  );

  await updateCurrentPublishedFlags(dbName, portalSlug);

  console.log(
    `${logPrefix} [publishVersion] portal="${portalSlug}" published v${version}`,
  );

  return getHomeTemplate(dbName, portalSlug);
}
