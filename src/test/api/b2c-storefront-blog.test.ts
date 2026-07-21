/**
 * Storefront-scoped blog wrapper API — integration tests.
 *
 * Verifies the security backbone of the office per-store blog proxy:
 *  - cross-store isolation (a post/category tagged store-a is invisible &
 *    untouchable through store-b's wrappers),
 *  - the storefront slug is force-stamped as the channel on create,
 *  - client-supplied channel/channels params are ignored,
 *  - PATCH cannot re-tag a post out of its store,
 *  - the public blog read accepts API-key auth (not only the legacy header).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import { setupTestDatabase, teardownTestDatabase, clearDatabase, createParams } from "../conftest";
import { BlogPostSchema } from "@/lib/db/models/blog-post";
import { BlogPostVersionSchema } from "@/lib/db/models/blog-post-version";
import { BlogCategorySchema } from "@/lib/db/models/blog-category";
import { BlogTagSchema } from "@/lib/db/models/blog-tag";
import { SalesChannelSchema } from "@/lib/db/models/sales-channel";
import { B2CStorefrontSchema } from "@/lib/db/models/b2c-storefront";

const BlogPost = mongoose.models.BlogPost || mongoose.model("BlogPost", BlogPostSchema);
const BlogPostVersion = mongoose.models.BlogPostVersion || mongoose.model("BlogPostVersion", BlogPostVersionSchema);
const BlogCategory = mongoose.models.BlogCategory || mongoose.model("BlogCategory", BlogCategorySchema);
const BlogTag = mongoose.models.BlogTag || mongoose.model("BlogTag", BlogTagSchema);
const SalesChannel = mongoose.models.SalesChannel || mongoose.model("SalesChannel", SalesChannelSchema);
const B2CStorefront = mongoose.models.B2CStorefront || mongoose.model("B2CStorefront", B2CStorefrontSchema);

// ── Mocks (before route imports) ─────────────────────────────────────────────
vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({ success: true, tenantId: "test-tenant", tenantDb: "vinc-test-tenant", userId: "u1" }),
  ),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({ BlogPost, BlogPostVersion, BlogCategory, BlogTag, SalesChannel, B2CStorefront }),
  ),
}));
vi.mock("@/lib/services/tenant-languages", () => ({
  getTenantLanguageCodes: vi.fn(async () => ["it", "en"]),
  getTenantDefaultLanguageCode: vi.fn(async () => "en"),
}));
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: vi.fn(async () => ({ valid: true, tenantId: "test-tenant" })),
}));

// ── Routes under test ────────────────────────────────────────────────────────
import { GET as listPosts, POST as createPost } from "@/app/api/b2b/b2c/storefronts/[slug]/blog/posts/route";
import {
  GET as getPost,
  PATCH as patchPost,
  DELETE as deletePost,
} from "@/app/api/b2b/b2c/storefronts/[slug]/blog/posts/[postId]/route";
import { GET as getContent } from "@/app/api/b2b/b2c/storefronts/[slug]/blog/posts/[postId]/content/route";
import { POST as saveDraft } from "@/app/api/b2b/b2c/storefronts/[slug]/blog/posts/[postId]/content/save-draft/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/b2b/b2c/storefronts/[slug]/blog/categories/route";
import { PUT as putCategory } from "@/app/api/b2b/b2c/storefronts/[slug]/blog/categories/[id]/route";
import { GET as listPublic } from "@/app/api/public/blog/posts/route";

function makeReq(url: string, opts?: { method?: string; body?: unknown; headers?: Record<string, string> }) {
  const { method = "GET", body, headers = {} } = opts || {};
  return new NextRequest(`http://localhost${url}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
  });
}

async function seedStores() {
  await B2CStorefront.create({ name: "Store A", slug: "store-a", status: "active" });
  await B2CStorefront.create({ name: "Store B", slug: "store-b", status: "active" });
}

/** Create a post through the store-a wrapper and return its id. */
async function createStoreAPost(body: Record<string, unknown>) {
  const res = await createPost(makeReq("/x", { method: "POST", body }), createParams({ slug: "store-a" }));
  return res;
}

describe("integration: Storefront-scoped Blog API", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); vi.clearAllMocks(); await seedStores(); });

  // 1. Cross-store guard — store-b cannot see/touch a store-a post
  it("blocks every store-b route from a store-a post (404)", async () => {
    const created = await (await createStoreAPost({ title: "A Post" })).json();
    const id = created.data.post_id;

    const pB = createParams({ slug: "store-b", postId: id });
    expect((await getPost(makeReq("/x"), pB)).status).toBe(404);
    expect((await patchPost(makeReq("/x", { method: "PATCH", body: { slug: "x" } }), pB)).status).toBe(404);
    expect((await deletePost(makeReq("/x", { method: "DELETE" }), pB)).status).toBe(404);
    expect((await getContent(makeReq("/x?locale=en"), pB)).status).toBe(404);
    expect((await saveDraft(makeReq("/x?locale=en", { method: "POST", body: { blocks: [] } }), pB)).status).toBe(404);

    // sanity: the SAME routes succeed through store-a
    const pA = createParams({ slug: "store-a", postId: id });
    expect((await getPost(makeReq("/x"), pA)).status).toBe(200);
  });

  // 2. Create force-stamps the storefront slug as the only channel
  it("forces channels:[slug] on create, ignoring the client body", async () => {
    const res = await createStoreAPost({ title: "Tagged", channels: ["evil", "default"] });
    expect(res.status).toBe(201);
    const post = (await res.json()).data;
    expect(post.channels).toEqual(["store-a"]);
  });

  // 3. List ignores a client channel param
  it("lists only this store's posts even when ?channel=other is passed", async () => {
    await createStoreAPost({ title: "In A" });
    // a store-b post created via its own wrapper
    await createPost(makeReq("/x", { method: "POST", body: { title: "In B" } }), createParams({ slug: "store-b" }));

    const res = await listPosts(makeReq("/x?channel=store-b"), createParams({ slug: "store-a" }));
    const list = (await res.json()).data;
    expect(list.pagination.total).toBe(1);
    expect(list.items[0].title).toBe("In A");
    expect(list.items[0].channels).toEqual(["store-a"]);
  });

  // 4. PATCH strips channels — cannot re-tag a post out of its store
  it("PATCH updates the slug but keeps channels:[slug]", async () => {
    const created = await (await createStoreAPost({ title: "Editable" })).json();
    const id = created.data.post_id;

    const res = await patchPost(
      makeReq("/x", { method: "PATCH", body: { channels: ["default"], slug: "new-slug" } }),
      createParams({ slug: "store-a", postId: id }),
    );
    const post = (await res.json()).data;
    expect(post.slug).toBe("new-slug");
    expect(post.channels).toEqual(["store-a"]);
  });

  // 5. Category scoping
  it("scopes categories to the store (store-b cannot see or update store-a's)", async () => {
    const created = await (
      await createCategory(
        makeReq("/x", { method: "POST", body: { name: { en: "News" } } }),
        createParams({ slug: "store-a" }),
      )
    ).json();
    const catId = created.data.category_id;
    expect(created.data.channels).toEqual(["store-a"]);

    // store-b list does not include it
    const bList = (await (await listCategories(makeReq("/x"), createParams({ slug: "store-b" }))).json()).data;
    expect(bList.items).toHaveLength(0);

    // store-a list does
    const aList = (await (await listCategories(makeReq("/x"), createParams({ slug: "store-a" }))).json()).data;
    expect(aList.items).toHaveLength(1);

    // store-b PUT on it → 404
    const putRes = await putCategory(
      makeReq("/x", { method: "PUT", body: { name: { en: "Hacked" } } }),
      createParams({ slug: "store-b", id: catId }),
    );
    expect(putRes.status).toBe(404);
  });

  // 6. Public route auth
  it("public list accepts API-key auth without the legacy header, else 401", async () => {
    await BlogPost.create({
      post_id: "bp_pub", slug: "live", channels: ["default"], default_locale: "en",
      translations: [{ locale: "en", title: "Live", status: "published", published_version: 1, current_version: 1, published_at: new Date() }],
    });

    // WITH api-key headers, WITHOUT x-resolved-tenant-db → 200
    const ok = await listPublic(
      makeReq("/api/public/blog/posts?channel=default&locale=en", {
        headers: { "x-api-key-id": "ak_test_1", "x-api-secret": "sk_test_1" },
      }),
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.items).toHaveLength(1);

    // WITH NEITHER → 401
    const unauth = await listPublic(makeReq("/api/public/blog/posts?channel=default&locale=en"));
    expect(unauth.status).toBe(401);
  });
});
