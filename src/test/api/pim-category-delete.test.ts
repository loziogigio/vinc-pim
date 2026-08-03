import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

const { sessionRef, invalidateMock } = vi.hoisted(() => {
  const sessionRef: { value: Record<string, unknown> | null } = { value: null };
  const invalidateMock = vi.fn(async () => {});
  return { sessionRef, invalidateMock };
});

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(async () =>
    sessionRef.value ?? {
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }),
    }
  ),
}));
vi.mock("@/lib/services/category.service", () => ({
  invalidateCategoryCache: invalidateMock,
}));

import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "@/test/conftest";
import { connectWithModels } from "@/lib/db/connection";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/b2b/pim/categories/[id]/route";

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new NextRequest("http://localhost", { method: "DELETE" });

async function seedCategory(overrides: Record<string, unknown>) {
  const { Category } = await connectWithModels("vinc-test");
  await Category.create({
    category_id: overrides.category_id,
    name: overrides.name ?? String(overrides.category_id),
    slug: overrides.slug ?? String(overrides.category_id),
    level: overrides.parent_id ? 1 : 0,
    path: overrides.parent_id ? [overrides.parent_id] : [],
    ...overrides,
  });
}

async function findCategory(category_id: string) {
  const { Category } = await connectWithModels("vinc-test");
  return Category.findOne({ category_id }).lean();
}

describe("DELETE /api/b2b/pim/categories/[id]", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  }, 30000);
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await clearDatabase();
    sessionRef.value = { success: true, tenantId: "test", tenantDb: "vinc-test", userId: "u1" };
    invalidateMock.mockClear();
  });

  it("hard-deletes a leaf category with no products", async () => {
    await seedCategory({ category_id: "cat-1" });

    const res = await DELETE(req(), ctx("cat-1"));

    expect(res.status).toBe(200);
    expect(await findCategory("cat-1")).toBeNull();
    expect(invalidateMock).toHaveBeenCalledWith("vinc-test");
  });

  it("hard-deletes an inactive (soft-deleted) leaf, unblocking its parent", async () => {
    await seedCategory({ category_id: "parent-1" });
    await seedCategory({ category_id: "child-1", parent_id: "parent-1", is_active: false });

    // Parent is blocked while the inactive child still exists
    const blocked = await DELETE(req(), ctx("parent-1"));
    expect(blocked.status).toBe(400);
    expect(await findCategory("parent-1")).not.toBeNull();

    // The inactive child can be really deleted
    const childRes = await DELETE(req(), ctx("child-1"));
    expect(childRes.status).toBe(200);
    expect(await findCategory("child-1")).toBeNull();

    // Now the parent deletes too
    const parentRes = await DELETE(req(), ctx("parent-1"));
    expect(parentRes.status).toBe(200);
    expect(await findCategory("parent-1")).toBeNull();
  });

  it("returns 400 and keeps the category when current products reference it", async () => {
    await seedCategory({ category_id: "cat-1" });
    const { PIMProduct } = await connectWithModels("vinc-test");
    await PIMProduct.create({
      entity_code: "p1",
      sku: "p1",
      version: 1,
      isCurrent: true,
      category: { category_id: "cat-1" },
    });

    const res = await DELETE(req(), ctx("cat-1"));

    expect(res.status).toBe(400);
    expect(await findCategory("cat-1")).not.toBeNull();
  });

  it("returns 400 when only a per-channel assignment references it", async () => {
    await seedCategory({ category_id: "cat-1" });
    const { PIMProduct } = await connectWithModels("vinc-test");
    await PIMProduct.create({
      entity_code: "p1",
      sku: "p1",
      version: 1,
      isCurrent: true,
      channel_categories: [{ channel_code: "b2b", category: { category_id: "cat-1" } }],
    });

    const res = await DELETE(req(), ctx("cat-1"));

    expect(res.status).toBe(400);
    expect(await findCategory("cat-1")).not.toBeNull();
  });

  it("ignores references from non-current product versions", async () => {
    await seedCategory({ category_id: "cat-1" });
    const { PIMProduct } = await connectWithModels("vinc-test");
    await PIMProduct.create({
      entity_code: "p1",
      sku: "p1",
      version: 1,
      isCurrent: false,
      category: { category_id: "cat-1" },
    });

    const res = await DELETE(req(), ctx("cat-1"));

    expect(res.status).toBe(200);
    expect(await findCategory("cat-1")).toBeNull();
  });

  it("returns 400 and keeps the category when it has children", async () => {
    await seedCategory({ category_id: "parent-1" });
    await seedCategory({ category_id: "child-1", parent_id: "parent-1" });

    const res = await DELETE(req(), ctx("parent-1"));

    expect(res.status).toBe(400);
    expect(await findCategory("parent-1")).not.toBeNull();
  });

  it("returns 404 for a missing category", async () => {
    const res = await DELETE(req(), ctx("nope"));
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    sessionRef.value = null;
    const res = await DELETE(req(), ctx("cat-1"));
    expect(res.status).toBe(401);
  });
});
