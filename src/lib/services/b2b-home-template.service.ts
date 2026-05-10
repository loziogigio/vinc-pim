/**
 * B2B Home Template Service — public surface
 *
 * Wraps the shared HomeTemplate model with a portal_slug filter
 * applied to every query. Mirrors the API contract of
 * src/app/api/home-template/route.ts and src/lib/db/home-templates.ts
 * so the existing page builder can reuse the same response shape,
 * but scoped to a specific B2B portal.
 *
 * Read functions live here. Write functions are in
 * b2b-home-template-write.service.ts and re-exported below so that
 * all existing route imports stay unchanged.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  TEMPLATE_ID,
  serializeVersionForResponse,
  type HomeTemplatePageConfig,
} from "./b2b-home-template-shared";

// ─── Re-export shared types (routes import them from here) ────────────────────

export type { HomeTemplatePageConfig, PublishMetadataInput } from "./b2b-home-template-shared";

// ─── Re-export write functions (routes import them from here) ─────────────────

export {
  saveDraftInPortal,
  publishCurrentInPortal,
} from "./b2b-home-template-write.service";

export {
  deleteVersionInPortal,
  duplicateVersionInPortal,
  startNewVersionInPortal,
  unpublishVersionInPortal,
  updateVersionInPortal,
  publishVersionInPortal,
} from "./b2b-home-template-version.service";

// ─── Read functions ───────────────────────────────────────────────────────────

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
  const logPrefix = "[b2b-home-template.service]";
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
