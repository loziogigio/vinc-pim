/**
 * B2B Home Template — core write operations
 *
 * saveDraftInPortal and publishCurrentInPortal.
 * Version-management write functions are in
 * b2b-home-template-version.service.ts.
 *
 * Both are imported and re-exported by b2b-home-template.service.ts so
 * that existing route imports stay unchanged.
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
  updateCurrentPublishedFlags,
} from "./b2b-home-template-shared";
import { getHomeTemplate } from "./b2b-home-template.service";

/**
 * Save a draft for the given portal.
 *
 * - If the current version is a draft → update its blocks, seo, lastSavedAt in-place.
 * - If the current version is published → create a new version (maxVersion+1), mark it isCurrent,
 *   and unset isCurrent on the prior version.
 * - If no version exists yet → create version 1 as a draft with isCurrent=true.
 *
 * Mirrors: saveHomeTemplateDraft in src/lib/db/home-templates.ts
 */
export async function saveDraftInPortal(
  dbName: string,
  portalSlug: string,
  payload: { blocks: unknown[]; seo?: unknown },
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);
  const { blocks, seo } = payload;
  const now = new Date().toISOString();

  // Sanitize blocks
  const sanitizedBlocks = (blocks as any[]).map((block, index) => ({
    id: block.id || `block-${index}`,
    type: block.type,
    order: index,
    config: block.config || {},
    metadata: block.metadata || {},
    ...(block.layout !== undefined && { layout: block.layout }),
    ...(block.zone !== undefined && { zone: block.zone }),
    ...(block.tabLabel !== undefined && { tabLabel: block.tabLabel }),
    ...(block.tabIcon !== undefined && { tabIcon: block.tabIcon }),
    ...(block.showTitle !== undefined && { showTitle: block.showTitle }),
    ...(block.titleAlignment !== undefined && { titleAlignment: block.titleAlignment }),
  }));

  // Find the current working version for this portal
  let currentVersion = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    isCurrent: true,
  });

  if (!currentVersion) {
    const allVersions = await HomeTemplate.find({
      portal_slug: portalSlug,
      templateId: TEMPLATE_ID,
    })
      .sort({ version: 1 })
      .lean();

    if ((allVersions as any[]).length === 0) {
      // No versions at all — create version 1
      currentVersion = await HomeTemplate.create({
        portal_slug: portalSlug,
        templateId: TEMPLATE_ID,
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
        isCurrent: true,
      });

      console.log(`${logPrefix} [saveDraft] portal="${portalSlug}" created v1`);
      return getHomeTemplate(dbName, portalSlug);
    } else {
      // Versions exist but none is current — set the latest as current
      const latest = (allVersions as any[])[allVersions.length - 1];
      await HomeTemplate.updateOne(
        { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: latest.version },
        { $set: { isCurrent: true } },
      );
      currentVersion = await HomeTemplate.findOne({
        portal_slug: portalSlug,
        templateId: TEMPLATE_ID,
        version: latest.version,
      });
    }
  }

  if (!currentVersion) {
    throw new Error("Failed to get or create current version");
  }

  if (currentVersion.status === "published") {
    // Current is published → create a new draft version
    const allVersions = await HomeTemplate.find({
      portal_slug: portalSlug,
      templateId: TEMPLATE_ID,
    })
      .lean();
    const maxVersion = Math.max(...(allVersions as any[]).map((v: any) => v.version));
    const nextVersion = maxVersion + 1;

    // Unset isCurrent on all versions
    await HomeTemplate.updateMany(
      { portal_slug: portalSlug, templateId: TEMPLATE_ID },
      { $set: { isCurrent: false } },
    );

    await HomeTemplate.create({
      portal_slug: portalSlug,
      templateId: TEMPLATE_ID,
      name: currentVersion.name,
      version: nextVersion,
      blocks: sanitizedBlocks,
      seo: seo || {},
      status: "draft" as const,
      label: `Version ${nextVersion}`,
      createdAt: now,
      lastSavedAt: now,
      createdBy: "b2b-admin",
      comment: `Version ${nextVersion}`,
      isCurrent: true,
    });

    console.log(
      `${logPrefix} [saveDraft] portal="${portalSlug}" created v${nextVersion} (prior was published)`,
    );
  } else {
    // Current is a draft → update in-place
    await HomeTemplate.updateOne(
      { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: currentVersion.version },
      { $set: { blocks: sanitizedBlocks, seo: seo || {}, lastSavedAt: now } },
    );

    console.log(
      `${logPrefix} [saveDraft] portal="${portalSlug}" updated draft v${currentVersion.version}`,
    );
  }

  return getHomeTemplate(dbName, portalSlug);
}

/**
 * Publish the current (isCurrent) version for the given portal.
 *
 * Marks its status="published", sets publishedAt, updates tag/priority/scheduling
 * fields from the optional payload, handles the isDefault flag, then calls
 * updateCurrentPublishedFlags to set isCurrentPublished correctly.
 *
 * Mirrors: publishHomeTemplate in src/lib/db/home-templates.ts
 */
export async function publishCurrentInPortal(
  dbName: string,
  portalSlug: string,
  payload: Record<string, unknown>,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const currentVersion = await HomeTemplate.findOne({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
    isCurrent: true,
  });

  if (!currentVersion) {
    throw new Error("No current version to publish");
  }

  if (currentVersion.status === "published") {
    throw new Error(`Version ${currentVersion.version} is already published`);
  }

  const now = new Date().toISOString();
  const metadata = payload as PublishMetadataInput;

  const updates: Record<string, any> = {
    status: "published",
    publishedAt: now,
    lastSavedAt: now,
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
      await HomeTemplate.updateMany(
        { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: { $ne: currentVersion.version } },
        { $set: { isDefault: false } },
      );
      updates.isDefault = true;
    } else {
      updates.isDefault = false;
    }
  } else {
    const otherDefault = await HomeTemplate.findOne({
      portal_slug: portalSlug,
      templateId: TEMPLATE_ID,
      version: { $ne: currentVersion.version },
      status: "published",
      isDefault: true,
    });
    if (!otherDefault) {
      updates.isDefault = true;
    }
  }

  await HomeTemplate.updateOne(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: currentVersion.version },
    { $set: updates },
  );

  await updateCurrentPublishedFlags(dbName, portalSlug);

  console.log(
    `${logPrefix} [publish] portal="${portalSlug}" published v${currentVersion.version}`,
  );

  return getHomeTemplate(dbName, portalSlug);
}
