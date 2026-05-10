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
