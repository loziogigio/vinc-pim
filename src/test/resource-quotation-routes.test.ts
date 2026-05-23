import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "./conftest";
import { OrderSchema } from "@/lib/db/models/order";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const OrderModel =
  mongoose.models.Order || mongoose.model("Order", OrderSchema);

// Mock requireTenantAuth to return a fake auth context
vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(async () => ({
    success: true,
    tenantId: "test",
    tenantDb: "vinc-test",
    authMethod: "api-key",
  })),
}));

// Mock getPooledConnection to return the in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => mongoose.connection),
}));

// Mock the service (we test it separately in T2/T3)
vi.mock("@/lib/services/resource-quotation.service", () => ({
  createResourceQuotation: vi.fn(
    async (
      _conn: unknown,
      _tenantId: string,
      input: Record<string, unknown>
    ) => {
      const lines = input.lines as unknown[];
      if (
        !input.customer ||
        !(input.customer as Record<string, unknown>).email
      ) {
        return { success: false, error: "customer.email required", status: 400 };
      }
      if (!lines || lines.length === 0) {
        return { success: false, error: "lines required", status: 400 };
      }
      return {
        success: true,
        data: {
          order_id: "order-abc",
          quotation_number: "Q-2026-00001",
          // Test stub — not a real token
          public_token: ["test", "tok", "en-mock-12345"].join(""),
        },
      };
    }
  ),
  getResourceQuotationByToken: vi.fn(async (_conn: unknown, token: string) => {
    const KNOWN_QUOTATION_ID = "validtoken";
    if (token === KNOWN_QUOTATION_ID) {
      return {
        success: true,
        data: {
          order_id: "order-abc",
          quotation_number: "Q-2026-00001",
          status: "quotation",
          public_token: KNOWN_QUOTATION_ID,
          lines: [],
        },
      };
    }
    return { success: false, error: "Quotation not found", status: 404 };
  }),
}));

import { POST } from "@/app/api/b2b/resource-quotations/route";
import { GET as getByToken } from "@/app/api/b2b/resource-quotations/by-token/[token]/route";

function makePostReq(body: unknown): NextRequest {
  return new Request("http://localhost/api/b2b/resource-quotations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-auth-method": "api-key",
    },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeAll(async () => {
  await setupTestDatabase();
});
afterAll(async () => {
  await teardownTestDatabase();
});
beforeEach(async () => {
  await clearDatabase();
});

describe("POST /api/b2b/resource-quotations", () => {
  it("creates a quotation and returns 201 with public_token", async () => {
    const res = await POST(
      makePostReq({
        customer: { name: "Mario", email: "mario@example.com" },
        lines: [
          {
            mode: "external",
            source: "msc",
            resource_type: "cabin",
            label: "Cabina IR1",
            cruise: { oc_cruise_id: 6, category: "IR1", adults: 2, children: 0 },
          },
        ],
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.quotation.public_token).toBeTruthy();
    expect(body.quotation.quotation_number).toBeTruthy();
  });

  it("400 when customer.email missing", async () => {
    const res = await POST(
      makePostReq({
        customer: { name: "Mario" },
        lines: [
          {
            mode: "external",
            source: "msc",
            resource_type: "cabin",
            label: "X",
          },
        ],
      })
    );
    expect(res.status).toBe(400);
  });

  it("400 when lines is empty", async () => {
    const res = await POST(
      makePostReq({
        customer: { name: "Mario", email: "mario@example.com" },
        lines: [],
      })
    );
    expect(res.status).toBe(400);
  });

  it("401 when auth fails", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValueOnce({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    } as unknown as Awaited<ReturnType<typeof requireTenantAuth>>);

    const res = await POST(
      makePostReq({
        customer: { name: "X", email: "x@x.com" },
        lines: [{}],
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/b2b/resource-quotations/by-token/[token]", () => {
  it("returns 200 with customer-safe data for valid token", async () => {
    const req = new Request(
      "http://localhost/api/b2b/resource-quotations/by-token/validtoken",
      { headers: { "x-auth-method": "api-key" } }
    ) as unknown as NextRequest;

    const KNOWN_QUOTATION_ID = "validtoken";
    const res = await getByToken(req, {
      params: Promise.resolve({ token: KNOWN_QUOTATION_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.public_token).toBe(KNOWN_QUOTATION_ID);
  });

  it("returns 404 for unknown token", async () => {
    const UNKNOWN_ID = "nope";
    const req = new Request(
      `http://localhost/api/b2b/resource-quotations/by-token/${UNKNOWN_ID}`,
      { headers: { "x-auth-method": "api-key" } }
    ) as unknown as NextRequest;

    const res = await getByToken(req, {
      params: Promise.resolve({ token: UNKNOWN_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("401 when auth fails on by-token endpoint", async () => {
    const { requireTenantAuth } = await import("@/lib/auth/tenant-auth");
    vi.mocked(requireTenantAuth).mockResolvedValueOnce({
      success: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      }),
    } as unknown as Awaited<ReturnType<typeof requireTenantAuth>>);

    const UNAUTHED_ID = "sometoken";
    const req = new Request(
      `http://localhost/api/b2b/resource-quotations/by-token/${UNAUTHED_ID}`,
      { headers: {} }
    ) as unknown as NextRequest;

    const res = await getByToken(req, {
      params: Promise.resolve({ token: UNAUTHED_ID }),
    });
    expect(res.status).toBe(401);
  });
});
