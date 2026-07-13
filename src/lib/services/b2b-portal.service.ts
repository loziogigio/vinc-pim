/**
 * B2B Portal Service
 *
 * CRUD + read-through fallback for the b2bportals collection.
 * Mirrors src/lib/services/b2c-storefront.service.ts.
 *
 * Read-through fallback (applies only to getPortalBySlug):
 *   If no row exists in b2bportals for the requested slug,
 *   fall back to synthesizing the portal from b2bhomesettings
 *   via buildPortalFromHomeSettings. Never writes in this path.
 */

import type { IB2BPortal, IB2BPortalSynthesized } from "@/lib/types/b2b-portal";
import { DEFAULT_PORTAL_SLUG } from "@/lib/types/b2b-portal";
import { connectWithModels } from "@/lib/db/connection";
import { buildPortalFromHomeSettings } from "./b2b-portal-migration.service";
import { normalizeCategoryRootSegment } from "./b2b-seo-config.service";

export class B2BPortalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "B2BPortalValidationError";
  }
}

const MUTABLE_PORTAL_FIELDS = new Set<keyof IB2BPortal>([
  "name",
  "channel",
  "domains",
  "status",
  "branding",
  "header_config",
  "header_config_draft",
  "header_config_by_lang",
  "header_config_draft_by_lang",
  "footer",
  "footer_draft",
  "footer_by_lang",
  "footer_draft_by_lang",
  "meta_tags",
  "custom_scripts",
  "custom_css",
  "settings",
  "seo_config",
  "facet_config",
]);

function sanitizeSeoConfig(value: IB2BPortal["seo_config"]): IB2BPortal["seo_config"] {
  if (!value || typeof value !== "object") return undefined;
  const categoryRoot: Record<string, string> = {};
  for (const [locale, rawSegment] of Object.entries(value.category_root || {})) {
    if (rawSegment === undefined || rawSegment === "") continue;
    const segment = normalizeCategoryRootSegment(rawSegment);
    if (!segment) {
      throw new B2BPortalValidationError(
        `Category root for "${locale}" must be one URL segment without slashes`,
      );
    }
    categoryRoot[locale] = segment;
  }

  const validatePaths = (paths: unknown, field: string): string[] | undefined => {
    if (paths === undefined) return undefined;
    if (!Array.isArray(paths) || paths.length > 100) {
      throw new B2BPortalValidationError(`${field} must be an array of at most 100 paths`);
    }
    const normalized = paths.map((path) => String(path).trim()).filter(Boolean);
    if (normalized.some((path) => !path.startsWith("/") || /[\r\n]/.test(path))) {
      throw new B2BPortalValidationError(`${field} entries must start with /`);
    }
    return [...new Set(normalized)];
  };

  const robots = value.robots
    ? {
        noindex: value.robots.noindex === true,
        allow: validatePaths(value.robots.allow, "Robots allow"),
        disallow: validatePaths(value.robots.disallow, "Robots disallow"),
      }
    : undefined;

  return {
    ...(Object.keys(categoryRoot).length > 0 ? { category_root: categoryRoot } : {}),
    ...(robots ? { robots } : {}),
  };
}

function sanitizeCustomScripts(
  scripts: IB2BPortal["custom_scripts"],
): IB2BPortal["custom_scripts"] {
  if (!Array.isArray(scripts)) {
    throw new B2BPortalValidationError("Custom scripts must be an array");
  }
  if (scripts.length > 20) {
    throw new B2BPortalValidationError("Maximum 20 custom scripts allowed");
  }

  return scripts.map((script) => {
    const label = script.label?.trim();
    const src = script.src?.trim() || undefined;
    const inlineCode = script.inline_code?.trim() || undefined;
    if (!label) throw new B2BPortalValidationError("Each script must have a label");
    if (!src && !inlineCode) {
      throw new B2BPortalValidationError(
        `Script "${label}" needs either an HTTPS URL or inline code`,
      );
    }
    if (src) {
      try {
        if (new URL(src).protocol !== "https:") throw new Error("not https");
      } catch {
        throw new B2BPortalValidationError(
          `Script "${label}" URL must be a valid HTTPS URL`,
        );
      }
    }
    if (inlineCode && inlineCode.length > 100_000) {
      throw new B2BPortalValidationError(`Script "${label}" inline code is too large`);
    }
    return {
      label,
      ...(src ? { src } : {}),
      ...(inlineCode ? { inline_code: inlineCode } : {}),
      placement: script.placement,
      loading_strategy: script.loading_strategy,
      enabled: script.enabled !== false,
    };
  });
}

export function sanitizePortalPatch(
  patch: Partial<IB2BPortal>,
): Partial<IB2BPortal> {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) {
    throw new B2BPortalValidationError("Portal patch must be an object");
  }
  const sanitized: Partial<IB2BPortal> = {};
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey as keyof IB2BPortal;
    if (!MUTABLE_PORTAL_FIELDS.has(key) || value === undefined) continue;
    (sanitized as Record<string, unknown>)[key] = value;
  }

  if (sanitized.name !== undefined) sanitized.name = sanitized.name.trim();
  if (sanitized.channel !== undefined) sanitized.channel = sanitized.channel.trim();
  if (sanitized.custom_scripts !== undefined) {
    sanitized.custom_scripts = sanitizeCustomScripts(sanitized.custom_scripts);
  }
  if (sanitized.seo_config !== undefined) {
    sanitized.seo_config = sanitizeSeoConfig(sanitized.seo_config);
  }
  return sanitized;
}

interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export async function listPortals(
  dbName: string,
  opts: ListOptions = {},
): Promise<{
  items: IB2BPortal[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  const { B2BPortal } = await connectWithModels(dbName);
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.search) {
    filter.$or = [
      { name: { $regex: opts.search, $options: "i" } },
      { slug: { $regex: opts.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    B2BPortal.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ created_at: -1 })
      .lean<IB2BPortal[]>(),
    B2BPortal.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getPortalBySlug(
  dbName: string,
  slug: string,
  tenantDisplayName: string,
): Promise<(IB2BPortal | IB2BPortalSynthesized) | null> {
  const { B2BPortal, HomeSettings } = await connectWithModels(dbName);
  const doc = await B2BPortal.findOne({ slug }).lean<IB2BPortal | null>();
  if (doc) return doc;

  // Read-through fallback for unmigrated tenants. Only for the default slug.
  if (slug !== DEFAULT_PORTAL_SLUG) return null;

  const settings = await HomeSettings.findOne({}).lean();
  if (!settings) return null;

  const synthesized = buildPortalFromHomeSettings(settings as any, tenantDisplayName);
  return { ...synthesized, synthesized: true as const };
}

export async function createPortal(
  dbName: string,
  input: Partial<IB2BPortal> & { slug: string; name: string; channel: string },
): Promise<IB2BPortal> {
  const { B2BPortal } = await connectWithModels(dbName);
  const existing = await B2BPortal.findOne({ slug: input.slug }).lean();
  if (existing) {
    throw new Error(`Portal with slug "${input.slug}" already exists`);
  }
  const doc = await B2BPortal.create(input);
  return doc.toObject() as IB2BPortal;
}

export async function updatePortal(
  dbName: string,
  slug: string,
  patch: Partial<IB2BPortal>,
): Promise<IB2BPortal | null> {
  const { B2BPortal } = await connectWithModels(dbName);
  const sanitized = sanitizePortalPatch(patch);
  const doc = await B2BPortal.findOneAndUpdate(
    { slug },
    { $set: sanitized },
    { new: true, runValidators: true },
  ).lean<IB2BPortal | null>();
  return doc;
}

export async function deletePortal(dbName: string, slug: string): Promise<boolean> {
  const { B2BPortal } = await connectWithModels(dbName);
  const res = await B2BPortal.deleteOne({ slug });
  return res.deletedCount === 1;
}

/**
 * Get a portal by domain (for public API lookup).
 *
 * Mirrors getStorefrontByDomain from b2c-storefront.service.
 * Supports both object-format domains ({ domain: "..." }) and
 * legacy plain-string array entries.
 */
export async function getPortalByDomain(
  dbName: string,
  domain: string,
): Promise<IB2BPortal | null> {
  const { B2BPortal } = await connectWithModels(dbName);
  const normalizedDomain = domain.trim().toLowerCase();
  const escaped = normalizedDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urlRegex = new RegExp(`^https?://${escaped}(:\\d+)?/?$`, "i");

  const result = await B2BPortal.collection.findOne({
    status: "active",
    $or: [
      { "domains.domain": normalizedDomain },
      { "domains.domain": { $regex: urlRegex } },
      { domains: normalizedDomain },
      { domains: { $regex: urlRegex } },
    ],
  });

  return result as IB2BPortal | null;
}
