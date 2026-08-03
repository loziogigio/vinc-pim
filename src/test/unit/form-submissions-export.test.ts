import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let tenantConn: mongoose.Connection;

const TEST_TENANT = "forms-export-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const STOREFRONT_SLUG = "demo";
const PORTAL_SLUG = "default";

vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => tenantConn),
}));

vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

vi.mock("@/lib/auth/tenant-auth", () => ({
  requireTenantAuth: vi.fn(() =>
    Promise.resolve({
      success: true,
      tenantId: TEST_TENANT,
      tenantDb: TEST_DB,
      userId: "test-user",
      authMethod: "session",
    })
  ),
}));

const { connectWithModels } = await import("@/lib/db/connection");
const { POST: b2cExport } = await import(
  "@/app/api/b2b/b2c/storefronts/[slug]/forms/export/route"
);
const { POST: b2bExport } = await import(
  "@/app/api/b2b/b2b/portals/[slug]/forms/export/route"
);

const b2cCtx = { params: Promise.resolve({ slug: STOREFRONT_SLUG }) };
const b2bCtx = { params: Promise.resolve({ slug: PORTAL_SLUG }) };

function post(body: unknown): Request {
  return new Request("http://localhost/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  tenantConn = await mongoose
    .createConnection(mongod.getUri(), { dbName: TEST_DB })
    .asPromise();
});

afterAll(async () => {
  await tenantConn?.close();
  await mongod?.stop();
});

beforeEach(async () => {
  const { FormSubmission, B2BFormSubmission, FormDefinition, B2BFormDefinition } =
    await connectWithModels(TEST_DB);
  await Promise.all([
    FormSubmission.deleteMany({}),
    B2BFormSubmission.deleteMany({}),
    FormDefinition.deleteMany({}),
    B2BFormDefinition.deleteMany({}),
  ]);
});

async function seedB2c() {
  const { FormSubmission, FormDefinition } = await connectWithModels(TEST_DB);
  await FormDefinition.create({
    storefront_slug: STOREFRONT_SLUG,
    slug: "contact",
    name: "Contact",
    config: {
      variant: "form",
      fields: [
        { id: "full_name", type: "text", label: "Full name" },
        { id: "message", type: "textarea", label: "Message" },
      ],
    },
  });
  const seeded = await FormSubmission.create([
    {
      storefront_slug: STOREFRONT_SLUG,
      page_slug: "contatti",
      form_type: "page_form",
      form_definition_slug: "contact",
      submitter_email: "ada@example.com",
      ip_address: "10.0.0.1",
      seen: false,
      data: { full_name: "Ada", message: "Hello; world" },
      created_at: new Date("2026-02-01T10:00:00.000Z"),
    },
    {
      storefront_slug: STOREFRONT_SLUG,
      page_slug: "home",
      form_type: "standalone",
      form_definition_slug: "contact",
      submitter_email: "bob@example.com",
      ip_address: "10.0.0.2",
      seen: true,
      data: { full_name: "Bob" },
      created_at: new Date("2026-03-01T10:00:00.000Z"),
    },
  ]);
  return seeded.map((doc) => String(doc._id));
}

describe("POST forms/export — b2c", () => {
  it("exports only the selected ids, newest first, as a semicolon CSV with a BOM", async () => {
    const ids = await seedB2c();
    const res = await b2cExport(post({ submission_ids: ids }) as never, b2cCtx as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain(
      `attachment; filename="form-submissions-${STOREFRONT_SLUG}-`
    );
    // Response.text() decodes with TextDecoder's default ignoreBOM: false, which
    // strips a leading BOM per the WHATWG spec — even though the raw bytes on the
    // wire (and what a browser download / Excel actually sees) do contain it. Decode
    // the raw bytes with ignoreBOM: true so this assertion reflects what buildCsv
    // really emitted, not an artifact of how the test reads the response.
    const buf = await res.arrayBuffer();
    const csv = new TextDecoder("utf-8", { ignoreBOM: true }).decode(buf);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.replace("﻿", "").split("\r\n");
    // header + 2 rows; newest (Bob, March) first
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Bob");
    expect(lines[2]).toContain("Ada");
    // a value containing the delimiter is quoted
    expect(lines[2]).toContain('"Hello; world"');
    // definition-driven columns are present
    expect(lines[0]).toContain("Full name");
    expect(lines[0]).toContain("Message");
  });

  it("exports one row when only one id is selected", async () => {
    const ids = await seedB2c();
    const res = await b2cExport(post({ submission_ids: [ids[0]] }) as never, b2cCtx as never);
    const lines = (await res.text()).replace("﻿", "").split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Ada");
  });

  it("honours filters in all_matching mode", async () => {
    await seedB2c();
    const res = await b2cExport(
      post({ all_matching: true, filters: { seen: "unseen" } }) as never,
      b2cCtx as never
    );
    const lines = (await res.text()).replace("﻿", "").split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Ada");
  });

  it("honours a date range in all_matching mode", async () => {
    await seedB2c();
    const res = await b2cExport(
      post({
        all_matching: true,
        filters: { date_from: "2026-02-25", date_to: "2026-03-05" },
      }) as never,
      b2cCtx as never
    );
    const lines = (await res.text()).replace("﻿", "").split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Bob");
  });

  it("emits commas when the comma delimiter is requested", async () => {
    const ids = await seedB2c();
    const res = await b2cExport(
      post({ submission_ids: ids, delimiter: "comma" }) as never,
      b2cCtx as never
    );
    const header = (await res.text()).replace("﻿", "").split("\r\n")[0];
    expect(header).toContain(",");
    expect(header).not.toContain(";");
  });

  it("rejects an empty submission_ids array with 400", async () => {
    await seedB2c();
    const res = await b2cExport(post({ submission_ids: [] }) as never, b2cCtx as never);
    expect(res.status).toBe(400);
  });

  it("rejects a body with neither mode with 400", async () => {
    await seedB2c();
    const res = await b2cExport(post({}) as never, b2cCtx as never);
    expect(res.status).toBe(400);
  });

  it("answers 404 NO_ROWS when nothing matches", async () => {
    await seedB2c();
    const res = await b2cExport(
      post({ all_matching: true, filters: { email: "nobody@example.com" } }) as never,
      b2cCtx as never
    );
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("NO_ROWS");
  });

  it("answers 413 EXPORT_TOO_LARGE with the real total past the cap", async () => {
    const { FormSubmission } = await connectWithModels(TEST_DB);
    const constants = await import("@/lib/constants/form-export");
    vi.spyOn(constants, "FORM_EXPORT_MAX_ROWS", "get").mockReturnValue(1);
    await FormSubmission.create([
      { storefront_slug: STOREFRONT_SLUG, data: {}, seen: false },
      { storefront_slug: STOREFRONT_SLUG, data: {}, seen: false },
    ]);
    const res = await b2cExport(post({ all_matching: true }) as never, b2cCtx as never);
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.code).toBe("EXPORT_TOO_LARGE");
    expect(body.total).toBe(2);
    vi.restoreAllMocks();
  });
});

describe("scope isolation", () => {
  it("never returns another storefront's rows for a selected id", async () => {
    const { FormSubmission } = await connectWithModels(TEST_DB);
    const foreign = await FormSubmission.create({
      storefront_slug: "other-shop",
      data: { secret: "nope" },
      seen: false,
    });
    const mine = await FormSubmission.create({
      storefront_slug: STOREFRONT_SLUG,
      data: { ok: "yes" },
      seen: false,
    });
    const res = await b2cExport(
      post({ submission_ids: [String(foreign._id), String(mine._id)] }) as never,
      b2cCtx as never
    );
    const csv = await res.text();
    expect(csv).not.toContain("nope");
    expect(csv).toContain("yes");
  });

  it("never returns b2b rows from the b2c route", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      data: { portal_only: "b2b-value" },
      seen: false,
    });
    await seedB2c();
    const res = await b2cExport(post({ all_matching: true }) as never, b2cCtx as never);
    expect(await res.text()).not.toContain("b2b-value");
  });

  it("never returns b2c rows from the b2b route", async () => {
    await seedB2c();
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      data: { portal_only: "b2b-value" },
      seen: false,
    });
    const res = await b2bExport(post({ all_matching: true }) as never, b2bCtx as never);
    const csv = await res.text();
    expect(csv).toContain("b2b-value");
    expect(csv).not.toContain("ada@example.com");
  });
});

describe("POST forms/export — b2b", () => {
  it("names the file after the portal slug", async () => {
    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    await B2BFormSubmission.create({
      portal_slug: PORTAL_SLUG,
      data: { note: "x" },
      seen: false,
    });
    const res = await b2bExport(post({ all_matching: true }) as never, b2bCtx as never);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain(
      `form-submissions-${PORTAL_SLUG}-`
    );
  });
});
