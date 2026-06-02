import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { DataModelDefinitionSchema } from "@/lib/db/models/data-model-definition";

const DataModelDefinition =
  mongoose.models.DataModelDefinition ||
  mongoose.model("DataModelDefinition", DataModelDefinitionSchema);

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({ success: true, tenantId: "t", tenantDb: "vinc-test-tenant", userId: "u1" })
  ),
}));
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() => Promise.resolve({ DataModelDefinition })),
  getPooledConnection: vi.fn(() => Promise.resolve(mongoose.connection)),
}));

import { POST as install } from "@/app/api/b2b/data-models/install/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/b2b/data-models/install", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

describe("integration: POST /api/b2b/data-models/install", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });
  afterAll(async () => {
    await teardownTestDatabase();
  });
  beforeEach(async () => {
    await clearDatabase();
    vi.clearAllMocks();
  });

  it("installs the erp_settings definition and seeds the _global record", async () => {
    const res = await install(makeReq({ blueprint: "erp_settings", channel: "default" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.definition.slug).toBe("erp_settings");
    expect(json.data.recordSeeded).toBe(true);

    const def = await DataModelDefinition.findOne({ slug: "erp_settings" }).lean();
    expect(def?.cardinality).toBe("single");
    expect(def?.channel).toBe("default");
    expect(def?.readable_by_end_user).toBe(false);

    const RecordModel = mongoose.connection.models.DynRecord_erp_settings;
    const rec = await RecordModel.findOne({ relation_id: "_global", channel: "default" }).lean();
    expect((rec?.data as { provider: string }).provider).toBe("mymb_time");
  });

  it("returns 409 alreadyInstalled when the slug already exists", async () => {
    await install(makeReq({ blueprint: "erp_settings", channel: "default" }));
    const res = await install(makeReq({ blueprint: "erp_settings", channel: "default" }));
    const json = await res.json();
    expect(res.status).toBe(409);
    expect(json.alreadyInstalled).toBe(true);
  });

  it("returns 400 for an unknown blueprint id", async () => {
    const res = await install(makeReq({ blueprint: "does_not_exist", channel: "default" }));
    expect(res.status).toBe(400);
  });

  it("defaults channel to 'default' when omitted", async () => {
    const res = await install(makeReq({ blueprint: "erp_settings" }));
    const json = await res.json();
    expect(res.status).toBe(201);
    expect(json.data.definition.channel).toBe("default");
  });
});
