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
  const doc = await B2BPortal.findOneAndUpdate(
    { slug },
    { $set: patch },
    { new: true },
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
