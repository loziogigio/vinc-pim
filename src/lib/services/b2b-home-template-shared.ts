/**
 * B2B Home Template — shared internals
 *
 * Constants, types, and private helpers shared between the read service
 * (b2b-home-template.service.ts) and the write service
 * (b2b-home-template-write.service.ts).
 *
 * Nothing in this file is part of the public API — import from
 * b2b-home-template.service.ts instead.
 */

import { connectWithModels } from "@/lib/db/connection";
import type { PageVersionTags } from "@/lib/types/blocks";

/** The fixed templateId used for the home page within every portal. */
export const TEMPLATE_ID = "home";

export const logPrefix = "[b2b-home-template.service]";

// ─── Public-interface types (re-exported via the main service) ────────────────

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

// ─── Serialization helpers ────────────────────────────────────────────────────

/** Converts a Mongoose Map or plain object `tags.attributes` to a plain object. */
export const serializeVersionForResponse = (version: any) => {
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

// ─── Tag / metadata helpers ───────────────────────────────────────────────────

export const normalizeStringInput = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeAttributesInput = (
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

export const normalizeDateInput = (value?: string | null): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const shouldUpdateTags = (input?: PublishMetadataInput) =>
  input &&
  (input.campaign !== undefined || input.segment !== undefined || input.attributes !== undefined);

export const buildTagsFromInput = (
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

export const cloneTags = (tags?: PageVersionTags | { attributes?: any }): PageVersionTags | undefined => {
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

// ─── Flag recalculation ───────────────────────────────────────────────────────

/**
 * Updates the isCurrentPublished flag across all versions for a portal.
 * Mirrors the logic in src/lib/db/home-templates.ts updateCurrentPublishedFlags.
 */
export async function updateCurrentPublishedFlags(
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
