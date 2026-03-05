/**
 * B2C Page Service
 *
 * CRUD operations for custom pages within B2C storefronts.
 * Pages are metadata records; actual content lives in HomeTemplate
 * documents via b2c-page-templates.ts.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  initB2CPageTemplate,
  deleteB2CPageTemplates,
} from "@/lib/db/b2c-page-templates";
import type { IB2CPage } from "@/lib/db/models/b2c-page";

// ============================================
// TYPES
// ============================================

export interface CreatePageInput {
  slug: string;
  title: string;
  show_in_nav?: boolean;
  sort_order?: number;
}

export interface UpdatePageInput {
  title?: string;
  status?: "active" | "inactive";
  show_in_nav?: boolean;
  sort_order?: number;
}

export interface ListPagesOptions {
  page?: number;
  limit?: number;
  status?: string;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

export async function createPage(
  tenantDb: string,
  storefrontSlug: string,
  input: CreatePageInput
): Promise<IB2CPage> {
  const { B2CPage } = await connectWithModels(tenantDb);

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error("Slug must be lowercase alphanumeric with dashes");
  }

  // Check for duplicate
  const existing = await B2CPage.findOne({
    storefront_slug: storefrontSlug,
    slug: input.slug,
  }).lean();
  if (existing) {
    throw new Error(`Page "${input.slug}" already exists for this storefront`);
  }

  // Create page record
  const page = await B2CPage.create({
    storefront_slug: storefrontSlug,
    slug: input.slug,
    title: input.title,
    show_in_nav: input.show_in_nav ?? true,
    sort_order: input.sort_order ?? 0,
  });

  // Initialize empty page template
  await initB2CPageTemplate(storefrontSlug, input.slug, input.title, tenantDb);

  return page.toObject() as IB2CPage;
}

export async function updatePage(
  tenantDb: string,
  storefrontSlug: string,
  pageSlug: string,
  input: UpdatePageInput
): Promise<IB2CPage> {
  const { B2CPage } = await connectWithModels(tenantDb);

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.status !== undefined) updates.status = input.status;
  if (input.show_in_nav !== undefined) updates.show_in_nav = input.show_in_nav;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  const page = await B2CPage.findOneAndUpdate(
    { storefront_slug: storefrontSlug, slug: pageSlug },
    { $set: updates },
    { new: true }
  ).lean();

  if (!page) throw new Error(`Page "${pageSlug}" not found`);
  return page as unknown as IB2CPage;
}

export async function deletePage(
  tenantDb: string,
  storefrontSlug: string,
  pageSlug: string
): Promise<void> {
  const { B2CPage, FormSubmission } = await connectWithModels(tenantDb);

  const page = await B2CPage.findOne({
    storefront_slug: storefrontSlug,
    slug: pageSlug,
  }).lean();
  if (!page) throw new Error(`Page "${pageSlug}" not found`);

  // Delete page template
  await deleteB2CPageTemplates(storefrontSlug, pageSlug, tenantDb);

  // Delete form submissions for this page
  await FormSubmission.deleteMany({
    storefront_slug: storefrontSlug,
    page_slug: pageSlug,
  });

  // Delete page record
  await B2CPage.deleteOne({
    storefront_slug: storefrontSlug,
    slug: pageSlug,
  });
}

export interface PageWithTemplateInfo extends IB2CPage {
  template_status?: "draft" | "published";
  last_saved_at?: string | null;
  published_at?: string | null;
  has_unpublished_changes?: boolean;
}

export async function listPages(
  tenantDb: string,
  storefrontSlug: string,
  options: ListPagesOptions = {}
): Promise<{ items: PageWithTemplateInfo[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const { B2CPage, HomeTemplate } = await connectWithModels(tenantDb);

  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { storefront_slug: storefrontSlug };
  if (options.status) filter.status = options.status;

  const [items, total] = await Promise.all([
    B2CPage.find(filter)
      .sort({ sort_order: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    B2CPage.countDocuments(filter),
  ]);

  // Enrich with template status (draft/published, timestamps)
  const templateIds = items.map(
    (p: any) => `b2c-${storefrontSlug}-page-${p.slug}`
  );
  const templates = await HomeTemplate.find({
    templateId: { $in: templateIds },
  })
    .select("templateId status lastSavedAt publishedAt")
    .lean();

  const templateMap = new Map(
    templates.map((t: any) => [t.templateId, t])
  );

  const enrichedItems: PageWithTemplateInfo[] = (items as unknown as IB2CPage[]).map(
    (p) => {
      const tpl = templateMap.get(
        `b2c-${storefrontSlug}-page-${p.slug}`
      ) as any;
      return {
        ...p,
        template_status: tpl?.status || "draft",
        last_saved_at: tpl?.lastSavedAt || null,
        published_at: tpl?.publishedAt || null,
        has_unpublished_changes:
          tpl?.status === "draft" && !!tpl?.publishedAt,
      };
    }
  );

  return {
    items: enrichedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getPageBySlug(
  tenantDb: string,
  storefrontSlug: string,
  pageSlug: string
): Promise<IB2CPage | null> {
  const { B2CPage } = await connectWithModels(tenantDb);
  const page = await B2CPage.findOne({
    storefront_slug: storefrontSlug,
    slug: pageSlug,
  }).lean();
  return page as unknown as IB2CPage | null;
}

/**
 * Delete all pages + templates + submissions for a storefront
 * Called when a storefront is deleted.
 */
export async function deleteAllPagesForStorefront(
  tenantDb: string,
  storefrontSlug: string
): Promise<void> {
  const { B2CPage, FormSubmission } = await connectWithModels(tenantDb);
  const { deleteAllB2CPageTemplates } = await import("@/lib/db/b2c-page-templates");

  // Delete all page templates
  await deleteAllB2CPageTemplates(storefrontSlug, tenantDb);

  // Delete all form submissions
  await FormSubmission.deleteMany({ storefront_slug: storefrontSlug });

  // Delete all page records
  await B2CPage.deleteMany({ storefront_slug: storefrontSlug });
}
