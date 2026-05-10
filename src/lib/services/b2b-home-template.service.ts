/**
 * B2B Home Template Service
 *
 * Wraps the shared HomeTemplate model with a portal_slug filter
 * applied to every query. Mirrors the API contract of
 * src/app/api/home-template/route.ts and src/lib/db/home-templates.ts
 * so the existing page builder can reuse the same response shape,
 * but scoped to a specific B2B portal.
 */

import { connectWithModels } from "@/lib/db/connection";
import type { PageVersionTags } from "@/lib/types/blocks";

/** The fixed templateId used for the home page within every portal. */
const TEMPLATE_ID = "home";

const logPrefix = "[b2b-home-template.service]";

// ─── Serialization helpers ────────────────────────────────────────────────────

/** Converts a Mongoose Map or plain object `tags.attributes` to a plain object. */
const serializeVersionForResponse = (version: any) => {
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

// ─── Public interface ─────────────────────────────────────────────────────────

/** The PageConfig shape expected by the home-page builder (mirrors the legacy route). */
export interface HomeTemplatePageConfig {
  slug: string;
  name: string;
  versions: any[];
  currentVersion: number;
  currentPublishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Get the full home-template configuration for a specific portal.
 *
 * Returns the PageConfig shape the builder expects. When no template
 * documents exist yet (e.g. brand-new portal) an empty shape is returned
 * rather than auto-creating a stub — the write routes handle initialisation.
 *
 * @param dbName   Tenant database name (e.g. "vinc-hidros-it").
 * @param portalSlug  Portal slug (e.g. "default", "beta").
 */
export async function getHomeTemplate(
  dbName: string,
  portalSlug: string,
): Promise<HomeTemplatePageConfig> {
  const { HomeTemplate } = await connectWithModels(dbName);

  const docs = await HomeTemplate.find({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
  })
    .sort({ version: 1 })
    .lean();

  if (docs.length === 0) {
    const now = new Date().toISOString();
    return {
      slug: "home",
      name: "Home Page",
      versions: [],
      currentVersion: 0,
      currentPublishedVersion: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  const current = docs.find((d: any) => d.isCurrent === true);
  const currentPublished = docs.find((d: any) => d.isCurrentPublished === true);

  const normalizedVersions = docs.map((v: any) =>
    serializeVersionForResponse({
      ...v,
      label: v.label ?? v.comment ?? `Version ${v.version}`,
    }),
  );

  return {
    slug: "home",
    name: docs[0]?.name ?? "Home Page",
    versions: normalizedVersions,
    currentVersion: current?.version ?? docs[docs.length - 1]?.version ?? 0,
    currentPublishedVersion: currentPublished?.version ?? null,
    createdAt: docs[0]?.createdAt ?? new Date().toISOString(),
    updatedAt: docs[docs.length - 1]?.lastSavedAt ?? new Date().toISOString(),
  };
}

/**
 * Load a specific version as the "current" working version for a portal.
 * Switches the isCurrent pointer and returns the updated PageConfig.
 *
 * @param dbName   Tenant database name.
 * @param portalSlug  Portal slug.
 * @param version  Version number to make current.
 */
export async function loadHomeTemplateVersion(
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

  // Clear isCurrent from all versions in this portal
  await HomeTemplate.updateMany(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID },
    { $set: { isCurrent: false } },
  );

  await HomeTemplate.updateOne(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID, version },
    { $set: { isCurrent: true } },
  );

  console.log(`${logPrefix} [loadVersion] portal="${portalSlug}" version=${version}`);

  return getHomeTemplate(dbName, portalSlug);
}

// ─── Tag/metadata helpers (ported from src/lib/db/home-templates.ts) ──────────

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

const normalizeStringInput = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAttributesInput = (
  attributes?: Record<string, string | string[] | null | undefined>,
): Record<string, string | string[]> | null | undefined => {
  if (!attributes) return undefined;
  const result: Record<string, string | string[]> = {};
  Object.entries(attributes).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      const filtered = value.filter((v) => typeof v === "string" && v.trim().length > 0);
      if (filtered.length > 0) result[key] = filtered;
    } else {
      const normalized = normalizeStringInput(value);
      if (normalized) result[key] = normalized;
    }
  });
  return Object.keys(result).length > 0 ? result : null;
};

const normalizeDateInput = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const shouldUpdateTags = (input?: PublishMetadataInput) =>
  input &&
  (input.campaign !== undefined || input.segment !== undefined || input.attributes !== undefined);

const buildTagsFromInput = (
  input?: PublishMetadataInput,
): { shouldUpdate: boolean; value?: PageVersionTags } => {
  if (!shouldUpdateTags(input)) return { shouldUpdate: false };

  const campaign = normalizeStringInput(input!.campaign);
  const segment = normalizeStringInput(input!.segment);
  const attributes = normalizeAttributesInput(input!.attributes);

  if (!campaign && !segment && !attributes) return { shouldUpdate: true, value: undefined };

  const tags: PageVersionTags = {};
  if (campaign) tags.campaign = campaign;
  if (segment) tags.segment = segment;
  if (attributes) tags.attributes = attributes;

  return { shouldUpdate: true, value: tags };
};

const cloneTags = (tags?: PageVersionTags | { attributes?: any }): PageVersionTags | undefined => {
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
 * Updates the isCurrentPublished flag across all versions for a portal.
 * Mirrors the logic in src/lib/db/home-templates.ts updateCurrentPublishedFlags.
 */
async function updateCurrentPublishedFlags(
  dbName: string,
  portalSlug: string,
): Promise<void> {
  const { HomeTemplate } = await connectWithModels(dbName);
  const allVersions = await HomeTemplate.find({
    portal_slug: portalSlug,
    templateId: TEMPLATE_ID,
  })
    .sort({ version: 1 })
    .lean();

  // Find the default published version (mirrors findDefaultPublishedVersion)
  const published = (allVersions as any[]).filter((v) => v.status === "published");
  let defaultPublished: any | null = null;
  if (published.length > 0) {
    defaultPublished = published.find((v) => v.isDefault) ?? null;
    if (!defaultPublished) {
      defaultPublished = [...published].sort((a, b) => {
        const diff = (b.priority ?? 0) - (a.priority ?? 0);
        return diff !== 0 ? diff : (b.version ?? 0) - (a.version ?? 0);
      })[0] ?? null;
    }
  }

  // Clear all isCurrentPublished for this portal
  await HomeTemplate.updateMany(
    { portal_slug: portalSlug, templateId: TEMPLATE_ID },
    { $set: { isCurrentPublished: false } },
  );

  if (defaultPublished) {
    await HomeTemplate.updateOne(
      { portal_slug: portalSlug, templateId: TEMPLATE_ID, version: defaultPublished.version },
      { $set: { isCurrentPublished: true } },
    );
  }
}

// ─── Write functions ──────────────────────────────────────────────────────────

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
