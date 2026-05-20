import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase, createParams } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion = mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() => Promise.resolve({ success: true, tenantId: "t", tenantDb: "vinc-test-tenant", userId: "u1" })),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogPost, BlogPostVersion })),
}));

import { GET as getContent } from "@/app/api/b2b/blog/posts/[postId]/content/route";
import { POST as saveDraft } from "@/app/api/b2b/blog/posts/[postId]/content/save-draft/route";
import { POST as publish } from "@/app/api/b2b/blog/posts/[postId]/content/publish/route";
import { NextRequest } from "next/server";

function makeReq(url: string, body?: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

async function seedPost() {
  await BlogPost.create({ post_id: "bp_1", slug: "p", channels: ["default"], default_locale: "en", translations: [{ locale: "en", title: "P", status: "draft", current_version: 1 }] });
}

describe("integration: Blog Content API", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("save-draft then GET content returns a PageConfig shape", async () => {
    await seedPost();
    await saveDraft(makeReq("/x?locale=en", { blocks: [{ type: "content-rich-text", config: {} }], seo: {} }), createParams({ postId: "bp_1" }));
    const res = await getContent(makeReq("/x?locale=en"), createParams({ postId: "bp_1" }));
    const cfg = await res.json();
    expect(cfg.currentVersion).toBe(1);
    expect(Array.isArray(cfg.versions)).toBe(true);
  });

  it("publish with no scheduled_at publishes now", async () => {
    await seedPost();
    await saveDraft(makeReq("/x?locale=en", { blocks: [], seo: {} }), createParams({ postId: "bp_1" }));
    const res = await publish(makeReq("/x?locale=en", {}), createParams({ postId: "bp_1" }));
    const cfg = await res.json();
    expect(cfg.currentPublishedVersion).toBe(1);
  });

  it("publish with a future scheduled_at marks the locale scheduled (not published)", async () => {
    await seedPost();
    await saveDraft(makeReq("/x?locale=en", { blocks: [], seo: {} }), createParams({ postId: "bp_1" }));
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await publish(makeReq("/x?locale=en", { scheduled_at: future }), createParams({ postId: "bp_1" }));
    const post = await BlogPost.findOne({ post_id: "bp_1" }).lean();
    expect(post.translations[0].status).toBe("scheduled");
    expect(post.translations[0].published_version).toBeUndefined();
  });

  it("GET content without locale returns 400", async () => {
    await seedPost();
    const res = await getContent(makeReq("/x"), createParams({ postId: "bp_1" }));
    expect(res.status).toBe(400);
  });
});
