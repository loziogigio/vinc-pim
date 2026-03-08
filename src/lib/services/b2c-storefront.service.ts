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
import { regenerateB2CConfigDebounced } from "@/lib/services/traefik-config.service";
import type {
  IB2CStorefront,
  IB2CStorefrontBranding,
  IB2CStorefrontHeader,
  IB2CStorefrontFooter,
  IB2CStorefrontMetaTags,
  IStorefrontDomain,
} from "@/lib/db/models/b2c-storefront";
import type { HeaderConfig } from "@/lib/types/home-settings";

const logPrefix = "[b2c-storefront]";

// ============================================
// TYPES
// ============================================

export interface CreateStorefrontInput {
  name: string;
  slug: string;
  /** Sales channel code — mandatory, links storefront to its channel */
  channel: string;
  domains?: (IStorefrontDomain | string)[];
  branding?: IB2CStorefrontBranding;
  header?: IB2CStorefrontHeader;
  footer?: IB2CStorefrontFooter;
  settings?: {
    default_language?: string;
    theme?: string;
  };
}

export interface UpdateStorefrontInput {
  name?: string;
  channel?: string;
  domains?: (IStorefrontDomain | string)[];
  status?: "active" | "inactive";
  branding?: IB2CStorefrontBranding;
  header?: IB2CStorefrontHeader;
  header_config?: HeaderConfig;
  header_config_draft?: HeaderConfig;
  footer?: IB2CStorefrontFooter;
  footer_draft?: IB2CStorefrontFooter;
  meta_tags?: IB2CStorefrontMetaTags;
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

function normalizeDomains(
  domains?: (IStorefrontDomain | string)[]
): IStorefrontDomain[] {
  if (!domains || domains.length === 0) return [];
  const normalized = domains
    .map((d) => {
      // Handle legacy plain-string format (e.g., "http://localhost:3000")
      if (typeof d === "string") {
        return { domain: d.trim().toLowerCase(), is_primary: false };
      }
      return {
        domain: (d.domain || "").trim().toLowerCase(),
        is_primary: !!d.is_primary,
      };
    })
    .filter((d) => d.domain.length > 0);
  // Ensure at most one primary — keep only the first is_primary: true
  let foundPrimary = false;
  for (const d of normalized) {
    if (d.is_primary) {
      if (foundPrimary) d.is_primary = false;
      foundPrimary = true;
    }
  }
  return normalized;
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

  // Check channel uniqueness (one storefront per channel)
  const channelCode = input.channel.trim().toLowerCase();
  const channelConflict = await B2CStorefront.findOne({ channel: channelCode }).lean();
  if (channelConflict) {
    throw new Error(
      `Channel "${channelCode}" is already assigned to storefront "${(channelConflict as any).name}"`
    );
  }

  // Check domain conflicts
  const domains = normalizeDomains(input.domains);
  const domainValues = domains.map((d) => d.domain);
  if (domainValues.length > 0) {
    const domainConflict = await B2CStorefront.findOne({
      "domains.domain": { $in: domainValues },
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
    channel: channelCode,
    domains,
    status: "active",
    branding: input.branding || {},
    header: input.header || { show_search: true, show_cart: true, show_account: true },
    footer: input.footer || {},
    settings: input.settings || {},
  });

  // Initialize empty home template for this storefront
  await initB2CHomeTemplate(input.slug, input.name, tenantDb);

  console.log(
    `${logPrefix} Created storefront "${input.name}" (slug: ${input.slug})`
  );

  // Regenerate Traefik B2C config if storefront has primary domains
  if (domains.some((d) => d.is_primary)) {
    regenerateB2CConfigDebounced();
  }

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
    const domains = normalizeDomains(input.domains);
    const domainValues = domains.map((d) => d.domain);
    if (domainValues.length > 0) {
      const domainConflict = await B2CStorefront.findOne({
        slug: { $ne: slug },
        "domains.domain": { $in: domainValues },
      }).lean();
      if (domainConflict) {
        throw new Error(
          `One or more domains are already assigned to storefront "${(domainConflict as any).name}"`
        );
      }
    }
    storefront.domains = domains as any;
  }

  if (input.name !== undefined) storefront.name = input.name.trim();
  if (input.channel !== undefined) {
    const newChannel = input.channel.trim().toLowerCase();
    if (newChannel && newChannel !== storefront.channel) {
      const channelConflict = await B2CStorefront.findOne({
        slug: { $ne: slug },
        channel: newChannel,
      }).lean();
      if (channelConflict) {
        throw new Error(
          `Channel "${newChannel}" is already assigned to storefront "${(channelConflict as any).name}"`
        );
      }
      storefront.channel = newChannel;
    }
  }
  if (input.status !== undefined) storefront.status = input.status;
  if (input.branding !== undefined) {
    storefront.branding = { ...storefront.branding, ...input.branding };
  }
  if (input.header !== undefined) {
    storefront.header = { ...storefront.header, ...input.header };
  }
  if (input.footer !== undefined) {
    storefront.footer = { ...storefront.footer, ...input.footer };
  }
  if (input.header_config !== undefined) {
    (storefront as any).header_config = input.header_config;
  }
  if (input.header_config_draft !== undefined) {
    (storefront as any).header_config_draft = input.header_config_draft;
  }
  if (input.footer_draft !== undefined) {
    (storefront as any).footer_draft = input.footer_draft;
  }
  if (input.meta_tags !== undefined) {
    (storefront as any).meta_tags = { ...(storefront as any).meta_tags, ...input.meta_tags };
  }
  if (input.settings !== undefined) {
    storefront.settings = { ...storefront.settings, ...input.settings };
  }

  await storefront.save();

  console.log(`${logPrefix} Updated storefront "${slug}"`);

  // Regenerate Traefik B2C config when domains or status change
  if (input.domains !== undefined || input.status !== undefined) {
    regenerateB2CConfigDebounced();
  }

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

  // Delete custom pages, page templates, and form submissions
  const { deleteAllPagesForStorefront } = await import("@/lib/services/b2c-page.service");
  await deleteAllPagesForStorefront(tenantDb, slug);

  // Delete storefront record
  await B2CStorefront.deleteOne({ slug });

  console.log(`${logPrefix} Deleted storefront "${slug}" and all its data`);

  // Regenerate Traefik B2C config to remove deleted storefront's domains
  regenerateB2CConfigDebounced();
}

/**
 * List storefronts with pagination
 */
export async function listStorefronts(
  tenantDb: string,
  options: { page?: number; limit?: number; search?: string; status?: string } = {}
): Promise<StorefrontListResult> {
  const { B2CStorefront } = await connectWithModels(tenantDb);
  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (options.status) {
    query.status = options.status;
  }
  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: "i" } },
      { slug: { $regex: options.search, $options: "i" } },
      { "domains.domain": { $regex: options.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    B2CStorefront.find(query)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean<IB2CStorefront[]>(),
    B2CStorefront.countDocuments(query),
  ]);

  return {
    items,
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
  const escaped = normalizedDomain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const urlRegex = new RegExp(`^https?://${escaped}(:\\d+)?/?$`, "i");

  // Use raw collection query to bypass Mongoose subdocument casting.
  // The DB may have legacy string domains alongside new object domains.
  const result = await B2CStorefront.collection.findOne({
    status: "active",
    $or: [
      // Object format — exact hostname match
      { "domains.domain": normalizedDomain },
      // Object format — full URL stored in domain field
      { "domains.domain": { $regex: urlRegex } },
      // Legacy string format — domains is array of plain strings
      { domains: normalizedDomain },
      { domains: { $regex: urlRegex } },
    ],
  });

  return result as IB2CStorefront | null;
}

/**
 * Get the primary domain URL for a storefront linked to a given channel code.
 * Returns null if no storefront or no domains are configured.
 */
export async function getStorefrontPrimaryDomain(
  tenantDb: string,
  channelCode: string
): Promise<string | null> {
  try {
    const { B2CStorefront } = await connectWithModels(tenantDb);
    const storefront = await B2CStorefront.findOne({
      channel: channelCode,
      status: "active",
    }).lean() as IB2CStorefront | null;

    if (!storefront?.domains?.length) return null;

    const primary = storefront.domains.find((d) => d.is_primary);
    const domain = primary?.domain || storefront.domains[0]?.domain;
    if (!domain) return null;

    return domain.startsWith("http") ? domain : `https://${domain}`;
  } catch (error) {
    console.warn(`${logPrefix} Failed to resolve primary domain for channel "${channelCode}":`, error);
    return null;
  }
}
