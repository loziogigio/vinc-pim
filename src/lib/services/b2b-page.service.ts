/**
 * B2B Page Service
 *
 * CRUD operations for custom pages within B2B portals.
 * Pages are metadata records; actual content lives in HomeTemplate
 * documents via b2b-page-templates.ts.
 */

import { connectWithModels } from "@/lib/db/connection";
import {
  initB2BPageTemplate,
  deleteB2BPageTemplates,
  deleteAllB2BPageTemplates,
} from "@/lib/db/b2b-page-templates";
import type { IB2BPage } from "@/lib/db/models/b2b-page";
import { isValidLanguageCode, getDefaultLanguage } from "@/config/languages";

const DEFAULT_LANG = getDefaultLanguage().code;

// ============================================
// TYPES
// ============================================

export interface CreatePageInput {
  slug: string;
  title: string;
  lang?: string;
  show_in_nav?: boolean;
  sort_order?: number;
}

export interface UpdatePageInput {
  title?: string;
  slug?: string;
  lang?: string;
  status?: "active" | "inactive";
  show_in_nav?: boolean;
  sort_order?: number;
}

export interface ListPagesOptions {
  page?: number;
  limit?: number;
  lang?: string;
  status?: string;
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

export async function createPage(
  tenantDb: string,
  portalSlug: string,
  input: CreatePageInput
): Promise<IB2BPage> {
  const { B2BPage } = await connectWithModels(tenantDb);

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error("Slug must be lowercase alphanumeric with dashes");
  }

  // Check for duplicate
  const existing = await B2BPage.findOne({
    portal_slug: portalSlug,
    slug: input.slug,
  }).lean();
  if (existing) {
    throw new Error(`Page "${input.slug}" already exists for this portal`);
  }

  // Create page record
  const page = await B2BPage.create({
    portal_slug: portalSlug,
    slug: input.slug,
    title: input.title,
    lang: input.lang && isValidLanguageCode(input.lang) ? input.lang : DEFAULT_LANG,
    show_in_nav: input.show_in_nav ?? true,
    sort_order: input.sort_order ?? 0,
  });

  // Initialize empty page template
  await initB2BPageTemplate(portalSlug, input.slug, input.title, tenantDb);

  // TODO(b2b-sitemap): when b2b-sitemap.service.ts (the generator) exists, call regenerateSitemapDebounced(portalSlug) here — same hook points as the B2C service.

  return page.toObject() as IB2BPage;
}

export async function updatePage(
  tenantDb: string,
  portalSlug: string,
  pageSlug: string,
  input: UpdatePageInput
): Promise<IB2BPage> {
  const { B2BPage, HomeTemplate, B2BFormSubmission } = await connectWithModels(tenantDb);

  const newSlug = input.slug;

  // If slug is changing, validate and migrate related data
  if (newSlug && newSlug !== pageSlug) {
    if (!/^[a-z0-9-]+$/.test(newSlug)) {
      throw new Error("Slug must be lowercase alphanumeric with dashes");
    }
    const existing = await B2BPage.findOne({
      portal_slug: portalSlug,
      slug: newSlug,
    }).lean();
    if (existing) {
      throw new Error(`Page "${newSlug}" already exists for this portal`);
    }

    // Migrate template: create new, delete old
    const oldTemplateId = `b2b-${portalSlug}-page-${pageSlug}`;
    const newTemplateId = `b2b-${portalSlug}-page-${newSlug}`;
    const oldTemplate = await HomeTemplate.findOne({ templateId: oldTemplateId }).lean() as any;
    if (oldTemplate) {
      const { _id, ...templateData } = oldTemplate;
      await HomeTemplate.create({ ...templateData, templateId: newTemplateId });
      await HomeTemplate.deleteOne({ _id: oldTemplate._id });
    }

    // Migrate form submissions
    await B2BFormSubmission.updateMany(
      { portal_slug: portalSlug, page_slug: pageSlug },
      { $set: { page_slug: newSlug } }
    );
  }

  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (newSlug && newSlug !== pageSlug) updates.slug = newSlug;
  if (input.lang !== undefined && isValidLanguageCode(input.lang)) updates.lang = input.lang;
  if (input.status !== undefined) updates.status = input.status;
  if (input.show_in_nav !== undefined) updates.show_in_nav = input.show_in_nav;
  if (input.sort_order !== undefined) updates.sort_order = input.sort_order;

  const page = await B2BPage.findOneAndUpdate(
    { portal_slug: portalSlug, slug: pageSlug },
    { $set: updates },
    { new: true }
  ).lean();

  if (!page) throw new Error(`Page "${pageSlug}" not found`);

  // TODO(b2b-sitemap): when b2b-sitemap.service.ts (the generator) exists, call regenerateSitemapDebounced(portalSlug) here — same hook points as the B2C service.

  return page as unknown as IB2BPage;
}

export async function deletePage(
  tenantDb: string,
  portalSlug: string,
  pageSlug: string
): Promise<void> {
  const { B2BPage, B2BFormSubmission } = await connectWithModels(tenantDb);

  const page = await B2BPage.findOne({
    portal_slug: portalSlug,
    slug: pageSlug,
  }).lean();
  if (!page) throw new Error(`Page "${pageSlug}" not found`);

  // Delete page template
  await deleteB2BPageTemplates(portalSlug, pageSlug, tenantDb);

  // Delete form submissions for this page
  await B2BFormSubmission.deleteMany({
    portal_slug: portalSlug,
    page_slug: pageSlug,
  });

  // Delete page record
  await B2BPage.deleteOne({
    portal_slug: portalSlug,
    slug: pageSlug,
  });

  // TODO(b2b-sitemap): when b2b-sitemap.service.ts (the generator) exists, call regenerateSitemapDebounced(portalSlug) here — same hook points as the B2C service.
}

export interface PageWithTemplateInfo extends IB2BPage {
  template_status?: "draft" | "published";
  last_saved_at?: string | null;
  published_at?: string | null;
  has_unpublished_changes?: boolean;
}

export async function listPages(
  tenantDb: string,
  portalSlug: string,
  options: ListPagesOptions = {}
): Promise<{ items: PageWithTemplateInfo[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const { B2BPage, HomeTemplate } = await connectWithModels(tenantDb);

  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = { portal_slug: portalSlug };
  if (options.lang) filter.lang = options.lang;
  if (options.status) filter.status = options.status;

  const [items, total] = await Promise.all([
    B2BPage.find(filter)
      .sort({ sort_order: 1, created_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    B2BPage.countDocuments(filter),
  ]);

  // Enrich with template status (draft/published, timestamps)
  const templateIds = items.map(
    (p: any) => `b2b-${portalSlug}-page-${p.slug}`
  );
  const templates = await HomeTemplate.find({
    templateId: { $in: templateIds },
  })
    .select("templateId status lastSavedAt publishedAt")
    .lean();

  const templateMap = new Map(
    templates.map((t: any) => [t.templateId, t])
  );

  const enrichedItems: PageWithTemplateInfo[] = (items as unknown as IB2BPage[]).map(
    (p) => {
      const tpl = templateMap.get(
        `b2b-${portalSlug}-page-${p.slug}`
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

export async function duplicatePage(
  tenantDb: string,
  portalSlug: string,
  sourcePageSlug: string
): Promise<IB2BPage> {
  const { B2BPage, HomeTemplate } = await connectWithModels(tenantDb);

  const sourcePage = await B2BPage.findOne({
    portal_slug: portalSlug,
    slug: sourcePageSlug,
  }).lean() as any;
  if (!sourcePage) throw new Error(`Page "${sourcePageSlug}" not found`);

  // Generate unique slug: {slug}-copy, {slug}-copy-2, etc.
  let newSlug = `${sourcePageSlug}-copy`;
  let counter = 1;
  while (await B2BPage.findOne({ portal_slug: portalSlug, slug: newSlug }).lean()) {
    counter++;
    newSlug = `${sourcePageSlug}-copy-${counter}`;
  }

  // Create new page record
  const newPage = await B2BPage.create({
    portal_slug: portalSlug,
    slug: newSlug,
    title: `${sourcePage.title} (Copy)`,
    status: sourcePage.status,
    show_in_nav: false,
    sort_order: sourcePage.sort_order,
  });

  // Copy template content
  const sourceTemplateId = `b2b-${portalSlug}-page-${sourcePageSlug}`;
  const newTemplateId = `b2b-${portalSlug}-page-${newSlug}`;
  const sourceTemplate = await HomeTemplate.findOne({ templateId: sourceTemplateId }).lean() as any;

  if (sourceTemplate) {
    const now = new Date().toISOString();
    await HomeTemplate.create({
      templateId: newTemplateId,
      name: `${sourcePage.title} (Copy)`,
      version: 1,
      blocks: sourceTemplate.blocks || [],
      seo: sourceTemplate.seo || {},
      status: "draft",
      label: "Version 1",
      createdAt: now,
      lastSavedAt: now,
      createdBy: "b2b-admin",
      comment: `Duplicated from ${sourcePageSlug}`,
      isCurrent: true,
      isActive: true,
    });
  } else {
    await initB2BPageTemplate(portalSlug, newSlug, `${sourcePage.title} (Copy)`, tenantDb);
  }

  // TODO(b2b-sitemap): when b2b-sitemap.service.ts (the generator) exists, call regenerateSitemapDebounced(portalSlug) here — same hook points as the B2C service.

  return newPage.toObject() as IB2BPage;
}

export async function getPageBySlug(
  tenantDb: string,
  portalSlug: string,
  pageSlug: string
): Promise<IB2BPage | null> {
  const { B2BPage } = await connectWithModels(tenantDb);
  const page = await B2BPage.findOne({
    portal_slug: portalSlug,
    slug: pageSlug,
  }).lean();
  return page as unknown as IB2BPage | null;
}

/**
 * Delete all pages + templates + submissions for a B2B portal.
 * Called when a portal is deleted.
 */
export async function deleteAllPagesForPortal(
  tenantDb: string,
  portalSlug: string
): Promise<void> {
  const { B2BPage, B2BFormSubmission } = await connectWithModels(tenantDb);

  // Delete all page templates
  await deleteAllB2BPageTemplates(portalSlug, tenantDb);

  // Delete all form submissions
  await B2BFormSubmission.deleteMany({ portal_slug: portalSlug });

  // Delete all page records
  await B2BPage.deleteMany({ portal_slug: portalSlug });
}
