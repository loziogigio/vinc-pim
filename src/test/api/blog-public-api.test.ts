import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase, createParams } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion = mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogPost, BlogPostVersion })),
}));

import { GET as listPublic } from "@/app/api/public/blog/posts/route";
import { GET as getPublic } from "@/app/api/public/blog/posts/[slug]/route";
import { NextRequest } from "next/server";

function makeReq(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://localhost${url}`, { headers });
}

async function seedPublished() {
  await BlogPost.create({
    post_id: "bp_1", slug: "live-post", channels: ["b2c"], default_locale: "en",
    translations: [{ locale: "en", title: "Live", excerpt: "Hi", status: "published", published_version: 1, current_version: 1, published_at: new Date() }],
  });
  await BlogPostVersion.create({
    post_id: "bp_1", locale: "en", version: 1, blocks: [{ type: "content-rich-text", config: { content: "<p>Body</p>" } }],
    seo: { title: "Live" }, status: "published", is_current: true, is_current_published: true, created_at: new Date().toISOString(), published_at: new Date().toISOString(),
  });
}

const TENANT_HEADER = { "x-resolved-tenant-db": "vinc-test-tenant" };

describe("integration: Blog Public API", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("lists published posts for a channel+locale", async () => {
    await seedPublished();
    const res = await listPublic(makeReq("/api/public/blog/posts?channel=b2c&locale=en", TENANT_HEADER));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].slug).toBe("live-post");
  });

  it("returns published blocks for a single post by slug", async () => {
    await seedPublished();
    const res = await getPublic(makeReq("/api/public/blog/posts/live-post?channel=b2c&locale=en", TENANT_HEADER), createParams({ slug: "live-post" }));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.data.blocks[0].type).toBe("content-rich-text");
  });

  it("returns 400 without the tenant header and 404 for an unknown slug", async () => {
    await seedPublished();
    expect((await listPublic(makeReq("/api/public/blog/posts?channel=b2c"))).status).toBe(400);
    const res404 = await getPublic(makeReq("/api/public/blog/posts/nope?channel=b2c&locale=en", TENANT_HEADER), createParams({ slug: "nope" }));
    expect(res404.status).toBe(404);
  });
});
