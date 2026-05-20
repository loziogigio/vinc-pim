// src/test/api/blog-post-service.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";
import { SalesChannelSchema } from "@/lib/db/models/sales-channel";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion =
  mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);
const SalesChannel =
  mongoose.models.SalesChannel || mongoose.model("SalesChannel", SalesChannelSchema);

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogPost, BlogPostVersion, SalesChannel })),
}));

import {
  createBlogPost,
  getBlogPost,
  listBlogPosts,
  updateBlogPost,
  deleteBlogPost,
} from "@/lib/services/blog/blog-post.service";

const DB = "vinc-test-tenant";

describe("integration: blog-post.service", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("creates a post with a slug, default-locale translation, and v1 content", async () => {
    const post = await createBlogPost(DB, { title: "My First Post", default_locale: "en" });
    expect(post.post_id).toMatch(/^bp_/);
    expect(post.slug).toBe("my-first-post");
    expect(post.translations[0].locale).toBe("en");

    const v1 = await BlogPostVersion.findOne({ post_id: post.post_id, locale: "en", version: 1 }).lean();
    expect(v1.is_current).toBe(true);
  });

  it("rejects a duplicate slug with status 409", async () => {
    await createBlogPost(DB, { title: "Dup", slug: "dup", default_locale: "en" });
    await expect(createBlogPost(DB, { title: "Dup 2", slug: "dup", default_locale: "en" }))
      .rejects.toMatchObject({ status: 409 });
  });

  it("lists posts paginated and projected to the requested locale", async () => {
    await createBlogPost(DB, { title: "Alpha", default_locale: "en" });
    await createBlogPost(DB, { title: "Beta", default_locale: "en" });
    const res = await listBlogPosts(DB, { page: 1, limit: 10, locale: "en" });
    expect(res.pagination.total).toBe(2);
    expect(res.items[0]).toHaveProperty("title");
    expect(res.items[0]).toHaveProperty("status");
  });

  it("filters the list by channel", async () => {
    await SalesChannel.create({ code: "b2c", name: "B2C" }); // channels are validated against saleschannels
    await createBlogPost(DB, { title: "Has b2c", channels: ["b2c"], default_locale: "en" });
    await createBlogPost(DB, { title: "Default only", default_locale: "en" });
    const res = await listBlogPosts(DB, { channel: "b2c" });
    expect(res.items).toHaveLength(1);
    expect(res.items[0].title).toBe("Has b2c");
  });

  it("update can change the slug and add a new locale (creating its v1)", async () => {
    const post = await createBlogPost(DB, { title: "Orig", default_locale: "en" });
    const updated = await updateBlogPost(DB, post.post_id, {
      slug: "renamed",
      translation: { locale: "it", title: "Originale" },
    });
    expect(updated.slug).toBe("renamed");
    expect(updated.translations.map((t: any) => t.locale).sort()).toEqual(["en", "it"]);
    const itV1 = await BlogPostVersion.findOne({ post_id: post.post_id, locale: "it", version: 1 }).lean();
    expect(itV1).toBeTruthy();
  });

  it("delete removes the post and all its versions", async () => {
    const post = await createBlogPost(DB, { title: "Bye", default_locale: "en" });
    await deleteBlogPost(DB, post.post_id);
    expect(await getBlogPost(DB, post.post_id)).toBeNull();
    expect(await BlogPostVersion.countDocuments({ post_id: post.post_id })).toBe(0);
  });
});
