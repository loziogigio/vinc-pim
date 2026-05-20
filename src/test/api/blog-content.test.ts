// src/test/api/blog-content.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion =
  mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogPost, BlogPostVersion })),
}));

import {
  getBlogContent,
  saveBlogContentDraft,
  publishBlogContent,
  loadBlogContentVersion,
  deleteBlogContentVersion,
  duplicateBlogContentVersion,
} from "@/lib/services/blog/blog-content.service";

const DB = "vinc-test-tenant";

async function seedPost(postId = "bp_1", locale = "en") {
  await BlogPost.create({
    post_id: postId,
    slug: "first-post",
    channels: ["default"],
    default_locale: locale,
    translations: [{ locale, title: "First", status: "draft", current_version: 1 }],
  });
}

describe("integration: blog-content.service", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("save-draft creates version 1 and getBlogContent returns it", async () => {
    await seedPost();
    const cfg = await saveBlogContentDraft(DB, "bp_1", "en", {
      blocks: [{ type: "content-rich-text", config: { content: "<p>Hi</p>" } }],
      seo: { title: "T" },
    });
    expect(cfg.currentVersion).toBe(1);
    expect(cfg.currentPublishedVersion).toBeNull();
    expect(cfg.versions[0].blocks[0].type).toBe("content-rich-text");

    const post = await BlogPost.findOne({ post_id: "bp_1" }).lean();
    expect(post.translations[0].current_version).toBe(1);
    expect(post.translations[0].status).toBe("draft");
  });

  it("publish marks the version published and updates the translation pointer", async () => {
    await seedPost();
    await saveBlogContentDraft(DB, "bp_1", "en", { blocks: [], seo: {} });
    const cfg = await publishBlogContent(DB, "bp_1", "en");
    expect(cfg.currentPublishedVersion).toBe(1);

    const v = await BlogPostVersion.findOne({ post_id: "bp_1", locale: "en", version: 1 }).lean();
    expect(v.status).toBe("published");
    expect(v.is_current_published).toBe(true);

    const post = await BlogPost.findOne({ post_id: "bp_1" }).lean();
    expect(post.translations[0].status).toBe("published");
    expect(post.translations[0].published_version).toBe(1);
    expect(post.translations[0].published_at).toBeTruthy();
  });

  it("save-draft after publish forks a new draft version, leaving the published one live", async () => {
    await seedPost();
    await saveBlogContentDraft(DB, "bp_1", "en", { blocks: [], seo: {} });
    await publishBlogContent(DB, "bp_1", "en");
    const cfg = await saveBlogContentDraft(DB, "bp_1", "en", {
      blocks: [{ type: "content-rich-text", config: {} }],
      seo: {},
    });
    expect(cfg.currentVersion).toBe(2);
    expect(cfg.currentPublishedVersion).toBe(1);
  });

  it("publishing 'en' does not touch 'it'", async () => {
    await BlogPost.create({
      post_id: "bp_2", slug: "two", channels: ["default"], default_locale: "en",
      translations: [
        { locale: "en", title: "EN", status: "draft", current_version: 1 },
        { locale: "it", title: "IT", status: "draft", current_version: 1 },
      ],
    });
    await saveBlogContentDraft(DB, "bp_2", "en", { blocks: [], seo: {} });
    await saveBlogContentDraft(DB, "bp_2", "it", { blocks: [], seo: {} });
    await publishBlogContent(DB, "bp_2", "en");

    const post = await BlogPost.findOne({ post_id: "bp_2" }).lean();
    const en = post.translations.find((t: any) => t.locale === "en");
    const it = post.translations.find((t: any) => t.locale === "it");
    expect(en.status).toBe("published");
    expect(it.status).toBe("draft");
  });

  it("loadVersion switches is_current; delete guards current/published; duplicate forks a draft", async () => {
    await seedPost();
    await saveBlogContentDraft(DB, "bp_1", "en", { blocks: [], seo: {} }); // v1
    await publishBlogContent(DB, "bp_1", "en");                            // v1 published
    await saveBlogContentDraft(DB, "bp_1", "en", { blocks: [], seo: {} }); // v2 draft (current)

    await expect(deleteBlogContentVersion(DB, "bp_1", "en", 2)).rejects.toThrow(/current/);
    await expect(deleteBlogContentVersion(DB, "bp_1", "en", 1)).rejects.toThrow(/published/);

    const dup = await duplicateBlogContentVersion(DB, "bp_1", "en", 1);
    expect(dup.currentVersion).toBe(3);

    const loaded = await loadBlogContentVersion(DB, "bp_1", "en", 1);
    expect(loaded.currentVersion).toBe(1);
  });
});
