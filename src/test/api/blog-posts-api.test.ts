import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase, createParams } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";
import { SalesChannelSchema } from "@/lib/db/models/sales-channel";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion = mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);
const SalesChannel = mongoose.models.SalesChannel || mongoose.model("SalesChannel", SalesChannelSchema);

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() => Promise.resolve({
    success: true, tenantId: "test-tenant", tenantDb: "vinc-test-tenant", userId: "u1",
  })),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ BlogPost, BlogPostVersion, SalesChannel })),
}));

import { GET as listPosts, POST as createPost } from "@/app/api/b2b/blog/posts/route";
import { GET as getPost, PATCH as patchPost, DELETE as deletePost } from "@/app/api/b2b/blog/posts/[postId]/route";
import { NextRequest } from "next/server";

function makeReq(url: string, opts?: { method?: string; body?: unknown }) {
  const { method = "GET", body } = opts || {};
  return new NextRequest(`http://localhost${url}`, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

describe("integration: Blog Posts API", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); });

  it("POST creates a post (201) and GET lists it", async () => {
    const res = await createPost(makeReq("/api/b2b/blog/posts", { method: "POST", body: { title: "Hello World" } }));
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.data.slug).toBe("hello-world");

    const listRes = await listPosts(makeReq("/api/b2b/blog/posts?locale=en"));
    const list = await listRes.json();
    expect(list.data.pagination.total).toBe(1);
    expect(list.data.items[0].title).toBe("Hello World");
  });

  it("POST without title returns 400", async () => {
    const res = await createPost(makeReq("/api/b2b/blog/posts", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("GET/PATCH/DELETE by postId", async () => {
    const created = await (await createPost(makeReq("/api/b2b/blog/posts", { method: "POST", body: { title: "Edit Me" } }))).json();
    const id = created.data.post_id;

    const getRes = await getPost(makeReq(`/api/b2b/blog/posts/${id}`), createParams({ postId: id }));
    expect(getRes.status).toBe(200);

    const patchRes = await patchPost(
      makeReq(`/api/b2b/blog/posts/${id}`, { method: "PATCH", body: { slug: "edited" } }),
      createParams({ postId: id }),
    );
    expect((await patchRes.json()).data.slug).toBe("edited");

    const delRes = await deletePost(makeReq(`/api/b2b/blog/posts/${id}`, { method: "DELETE" }), createParams({ postId: id }));
    expect((await delRes.json()).success).toBe(true);

    const getGone = await getPost(makeReq(`/api/b2b/blog/posts/${id}`), createParams({ postId: id }));
    expect(getGone.status).toBe(404);
  });
});
