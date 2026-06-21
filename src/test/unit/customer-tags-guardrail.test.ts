import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
} from "../conftest";

vi.mock("@/app/api/b2b/customer-tags/_auth", () => ({
  getTagAuth: vi.fn(async () => ({ tenantId: "test-tenant", tenantDb: "vinc-test-tenant" })),
}));

vi.mock("@/lib/db/connection", async () => {
  const { CustomerTagModel } = await import("@/lib/db/models/customer-tag");
  return { connectWithModels: vi.fn(() => Promise.resolve({ CustomerTag: CustomerTagModel })) };
});

import { POST } from "@/app/api/b2b/customer-tags/route";
import { NextRequest } from "next/server";

function postReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/b2b/customer-tags", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("unit: customer-tags POST guardrail", () => {
  beforeAll(async () => { await setupTestDatabase(); });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); });

  it("rejects manual creation of an agent (agente:) tag", async () => {
    const res = await POST(postReq({ prefix: "agente", code: "m01", description: "Mario" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/agente/i);
  });

  it("still allows a normal tag", async () => {
    const res = await POST(postReq({
      prefix: "categoria-di-sconto", code: "sconto-45", description: "Sconto 45",
    }));
    expect(res.status).toBe(201);
  });
});
