// src/test/api/blog-taxonomy-service.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { BlogCategorySchema } from "@/lib/db/models/blog-category";
import { BlogTagSchema } from "@/lib/db/models/blog-tag";
import { BlogPostSchema } from "@/lib/db/models/blog-post";

const BlogCategory = mongoose.models.BlogCategory || mongoose.model("BlogCategory", BlogCategorySchema);
const BlogTag = mongoose.models.BlogTag || mongoose.model("BlogTag", BlogTagSchema);
const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogCategory, BlogTag, BlogPost })),
}));

import {
  createBlogCategory, updateBlogCategory, deleteBlogCategory, listBlogCategories,
  createBlogTag, listBlogTags, recountBlogTaxonomy,
} from "@/lib/services/blog/blog-taxonomy.service";

const DB = "vinc-test-tenant";

describe("integration: blog-taxonomy.service", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("creates a category with an auto slug; rejects duplicate slug (409)", async () => {
    const cat = await createBlogCategory(DB, { name: { en: "News", it: "Notizie" } });
    expect(cat.slug).toBe("news");
    expect(cat.category_id).toMatch(/^bc_/);
    await expect(createBlogCategory(DB, { name: "News", slug: "news" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("updates and deletes a category", async () => {
    const cat = await createBlogCategory(DB, { name: "Temp", slug: "temp" });
    const upd = await updateBlogCategory(DB, cat.category_id, { display_order: 5, is_active: false });
    expect(upd.display_order).toBe(5);
    await deleteBlogCategory(DB, cat.category_id);
    const active = await listBlogCategories(DB, {});
    expect(active.find((c: any) => c.category_id === cat.category_id)).toBeUndefined();
  });

  it("creates a tag and lists active tags only by default", async () => {
    await createBlogTag(DB, { name: "Promo", slug: "promo" });
    await createBlogTag(DB, { name: "Hidden", slug: "hidden", is_active: false });
    const active = await listBlogTags(DB, {});
    expect(active.map((t: any) => t.slug)).toEqual(["promo"]);
  });

  it("recounts post_count from BlogPost references", async () => {
    const cat = await createBlogCategory(DB, { name: "Counted", slug: "counted" });
    await BlogPost.create({ post_id: "bp_a", slug: "a", channels: ["default"], default_locale: "en", category_ids: [cat.category_id], translations: [{ locale: "en", title: "A", status: "draft", current_version: 1 }] });
    await recountBlogTaxonomy(DB);
    const refreshed = await BlogCategory.findOne({ category_id: cat.category_id }).lean();
    expect(refreshed.post_count).toBe(1);
  });
});
