/**
 * B2C Storefront Service
 *
 * CRUD operations for managing B2C storefronts within a tenant.
 * Each storefront can have multiple domains and its own home template.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  initB2CHomeTemplate,
  deleteB2CHomeTemplates,
} from "@/lib/db/b2c-home-templates";
import type { IB2CStorefront } from "@/lib/db/models/b2c-storefront";

const logPrefix = "[b2c-storefront]";

// ============================================
// TYPES
// ============================================

export interface CreateStorefrontInput {
  name: string;
  slug: string;
  domains?: string[];
  settings?: {
    default_language?: string;
    theme?: string;
  };
}

export interface UpdateStorefrontInput {
  name?: string;
  domains?: string[];
  status?: "active" | "inactive";
  settings?: {
    default_language?: string;
    theme?: string;
  };
}

export interface StorefrontListResult {
  items: IB2CStorefront[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// HELPERS
// ============================================

function normalizedomains(domains?: string[]): string[] {
  if (!domains) return [];
  return domains
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0);
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Create a new B2C storefront and initialize its home template
 */
export async function createStorefront(
  tenantDb: string,
  input: CreateStorefrontInput
): Promise<IB2CStorefront> {
  const { B2CStorefront } = await connectWithModels(tenantDb);

  // Check slug uniqueness
  const existing = await B2CStorefront.findOne({ slug: input.slug }).lean();
  if (existing) {
    throw new Error(`Storefront with slug "${input.slug}" already exists`);
  }

  // Check domain conflicts
  const domains = normalizedomains(input.domains);
  if (domains.length > 0) {
    const domainConflict = await B2CStorefront.findOne({
      domains: { $in: domains },
    }).lean();
    if (domainConflict) {
      throw new Error(
        `One or more domains are already assigned to storefront "${(domainConflict as any).name}"`
      );
    }
  }

  const storefront = await B2CStorefront.create({
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    domains,
    status: "active",
    settings: input.settings || {},
  });

  // Initialize empty home template for this storefront
  await initB2CHomeTemplate(input.slug, input.name, tenantDb);

  console.log(
    `${logPrefix} Created storefront "${input.name}" (slug: ${input.slug})`
  );

  return storefront.toObject();
}

/**
 * Update an existing storefront
 */
export async function updateStorefront(
  tenantDb: string,
  slug: string,
  input: UpdateStorefrontInput
): Promise<IB2CStorefront> {
  const { B2CStorefront } = await connectWithModels(tenantDb);

  const storefront = await B2CStorefront.findOne({ slug });
  if (!storefront) {
    throw new Error(`Storefront "${slug}" not found`);
  }

  // Check domain conflicts if domains are being updated
  if (input.domains !== undefined) {
    const domains = normalizedomains(input.domains);
    if (domains.length > 0) {
      const domainConflict = await B2CStorefront.findOne({
        slug: { $ne: slug },
        domains: { $in: domains },
      }).lean();
      if (domainConflict) {
        throw new Error(
          `One or more domains are already assigned to storefront "${(domainConflict as any).name}"`
        );
      }
    }
    storefront.domains = domains;
  }

  if (input.name !== undefined) storefront.name = input.name.trim();
  if (input.status !== undefined) storefront.status = input.status;
  if (input.settings !== undefined) {
    storefront.settings = {
      ...storefront.settings,
      ...input.settings,
    };
  }

  await storefront.save();

  console.log(`${logPrefix} Updated storefront "${slug}"`);
  return storefront.toObject();
}

/**
 * Delete a storefront and its home template data
 */
export async function deleteStorefront(
  tenantDb: string,
  slug: string
): Promise<void> {
  const { B2CStorefront } = await connectWithModels(tenantDb);

  const storefront = await B2CStorefront.findOne({ slug });
  if (!storefront) {
    throw new Error(`Storefront "${slug}" not found`);
  }

  // Delete home template versions
  await deleteB2CHomeTemplates(slug, tenantDb);

  // Delete storefront record
  await B2CStorefront.deleteOne({ slug });

  console.log(`${logPrefix} Deleted storefront "${slug}" and its templates`);
}

/**
 * List storefronts with pagination
 */
export async function listStorefronts(
  tenantDb: string,
  options: { page?: number; limit?: number; search?: string } = {}
): Promise<StorefrontListResult> {
  const { B2CStorefront } = await connectWithModels(tenantDb);
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: "i" } },
      { slug: { $regex: options.search, $options: "i" } },
      { domains: { $regex: options.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    B2CStorefront.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    B2CStorefront.countDocuments(query),
  ]);

  return {
    items: items as IB2CStorefront[],
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get a single storefront by slug
 */
export async function getStorefrontBySlug(
  tenantDb: string,
  slug: string
): Promise<IB2CStorefront | null> {
  const { B2CStorefront } = await connectWithModels(tenantDb);
  return B2CStorefront.findOne({ slug }).lean() as Promise<IB2CStorefront | null>;
}

/**
 * Get a storefront by domain (for public API lookup)
 */
export async function getStorefrontByDomain(
  tenantDb: string,
  domain: string
): Promise<IB2CStorefront | null> {
  const { B2CStorefront } = await connectWithModels(tenantDb);
  const normalizedDomain = domain.trim().toLowerCase();
  return B2CStorefront.findOne({
    domains: normalizedDomain,
    status: "active",
  }).lean() as Promise<IB2CStorefront | null>;
}
