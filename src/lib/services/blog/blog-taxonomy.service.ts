// src/lib/services/blog/blog-taxonomy.service.ts
/**
 * Blog taxonomy service — editorial categories & tags (separate from PIM).
 */
import { nanoid } from "nanoid";
import { connectWithModels } from "@/lib/db/connection";
import { blogSlugify } from "@/lib/constants/blog";
import type { MultiLangString } from "@/lib/types/pim";

function httpError(message: string, status: number): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

function nameToString(name: MultiLangString | undefined): string {
  if (!name) return "";
  if (typeof name === "string") return name;
  return name.en || name.it || Object.values(name)[0] || "";
}

interface CategoryInput {
  name: MultiLangString; slug?: string; description?: MultiLangString;
  parent_id?: string; channels?: string[];
  seo?: { title?: string; description?: string; keywords?: string[] };
  display_order?: number; is_active?: boolean;
}
interface TagInput {
  name: MultiLangString; slug?: string; description?: MultiLangString;
  color?: string; display_order?: number; is_active?: boolean;
}

// ── Categories ──────────────────────────────────────────────────────────────
export async function listBlogCategories(tenantDb: string, opts: { includeInactive?: boolean }) {
  const { BlogCategory } = await connectWithModels(tenantDb);
  const query = opts.includeInactive ? {} : { is_active: true };
  return BlogCategory.find(query).sort({ display_order: 1 }).lean();
}

export async function createBlogCategory(tenantDb: string, input: CategoryInput) {
  const { BlogCategory } = await connectWithModels(tenantDb);
  const slug = blogSlugify(input.slug || nameToString(input.name));
  if (!slug) throw httpError("A valid slug or name is required", 400);
  if (await BlogCategory.findOne({ slug }).lean()) throw httpError("A category with this slug already exists", 409);
  const doc = await BlogCategory.create({
    category_id: `bc_${nanoid(8)}`, name: input.name, slug, description: input.description,
    parent_id: input.parent_id, channels: input.channels, seo: input.seo,
    display_order: input.display_order ?? 0, is_active: input.is_active ?? true, post_count: 0,
  });
  return doc.toObject();
}

export async function updateBlogCategory(tenantDb: string, categoryId: string, patch: Partial<CategoryInput>) {
  const { BlogCategory } = await connectWithModels(tenantDb);
  const cat: any = await BlogCategory.findOne({ category_id: categoryId });
  if (!cat) throw httpError("Category not found", 404);
  if (patch.slug !== undefined) {
    const slug = blogSlugify(patch.slug);
    if (slug !== cat.slug && (await BlogCategory.findOne({ slug }).lean())) {
      throw httpError("A category with this slug already exists", 409);
    }
    cat.slug = slug;
  }
  for (const f of ["name", "description", "parent_id", "channels", "seo", "display_order", "is_active"] as const) {
    if (patch[f] !== undefined) (cat as any)[f] = patch[f];
  }
  await cat.save();
  return cat.toObject();
}

export async function deleteBlogCategory(tenantDb: string, categoryId: string) {
  const { BlogCategory } = await connectWithModels(tenantDb);
  const res = await BlogCategory.deleteOne({ category_id: categoryId });
  if (res.deletedCount === 0) throw httpError("Category not found", 404);
}

// ── Tags ────────────────────────────────────────────────────────────────────
export async function listBlogTags(tenantDb: string, opts: { includeInactive?: boolean }) {
  const { BlogTag } = await connectWithModels(tenantDb);
  const query = opts.includeInactive ? {} : { is_active: true };
  return BlogTag.find(query).sort({ display_order: 1 }).lean();
}

export async function createBlogTag(tenantDb: string, input: TagInput) {
  const { BlogTag } = await connectWithModels(tenantDb);
  const slug = blogSlugify(input.slug || nameToString(input.name));
  if (!slug) throw httpError("A valid slug or name is required", 400);
  if (await BlogTag.findOne({ slug }).lean()) throw httpError("A tag with this slug already exists", 409);
  const doc = await BlogTag.create({
    tag_id: `bt_${nanoid(8)}`, name: input.name, slug, description: input.description,
    color: input.color, display_order: input.display_order ?? 0, is_active: input.is_active ?? true, post_count: 0,
  });
  return doc.toObject();
}

export async function updateBlogTag(tenantDb: string, tagId: string, patch: Partial<TagInput>) {
  const { BlogTag } = await connectWithModels(tenantDb);
  const tag: any = await BlogTag.findOne({ tag_id: tagId });
  if (!tag) throw httpError("Tag not found", 404);
  if (patch.slug !== undefined) {
    const slug = blogSlugify(patch.slug);
    if (slug !== tag.slug && (await BlogTag.findOne({ slug }).lean())) {
      throw httpError("A tag with this slug already exists", 409);
    }
    tag.slug = slug;
  }
  for (const f of ["name", "description", "color", "display_order", "is_active"] as const) {
    if (patch[f] !== undefined) (tag as any)[f] = patch[f];
  }
  await tag.save();
  return tag.toObject();
}

export async function deleteBlogTag(tenantDb: string, tagId: string) {
  const { BlogTag } = await connectWithModels(tenantDb);
  const res = await BlogTag.deleteOne({ tag_id: tagId });
  if (res.deletedCount === 0) throw httpError("Tag not found", 404);
}

/** Recompute cached post_count for every category & tag from BlogPost references. */
export async function recountBlogTaxonomy(tenantDb: string): Promise<void> {
  const { BlogCategory, BlogTag, BlogPost } = await connectWithModels(tenantDb);
  const cats: any[] = await BlogCategory.find().select("category_id").lean();
  for (const c of cats) {
    const count = await BlogPost.countDocuments({ category_ids: c.category_id });
    await BlogCategory.updateOne({ category_id: c.category_id }, { $set: { post_count: count } });
  }
  const tags: any[] = await BlogTag.find().select("tag_id").lean();
  for (const t of tags) {
    const count = await BlogPost.countDocuments({ tag_ids: t.tag_id });
    await BlogTag.updateOne({ tag_id: t.tag_id }, { $set: { post_count: count } });
  }
}
