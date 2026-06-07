import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { B2BPageSchema } from "@/lib/db/models/b2b-page";
import { HomeTemplateSchema } from "@/lib/db/models/home-template";
import { B2BFormSubmissionSchema } from "@/lib/db/models/b2b-form-submission";

// Provision an in-memory connection and expose it before the module loads
let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Also mock build-guard (connection-pool imports it)
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock b2b-page-templates so initB2BPageTemplate is a no-op
vi.mock("@/lib/db/b2b-page-templates", () => ({
  initB2BPageTemplate: vi.fn(async () => {}),
  deleteB2BPageTemplates: vi.fn(async () => {}),
  deleteAllB2BPageTemplates: vi.fn(async () => {}),
}));

// Import service AFTER mocks are set up
const { createPage, updatePage, listPages } = await import(
  "@/lib/services/b2b-page.service"
);

const T = "vinc-test";
const P = "default";

async function clean() {
  await conn.collection("b2bpages").deleteMany({});
  await conn.collection("b2bhometemplates").deleteMany({});
  await conn.collection("b2bformsubmissions").deleteMany({});
}

describe("b2b-page.service lang", () => {
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    conn = await mongoose.createConnection(mongod.getUri()).asPromise();
    // Register models on the connection
    conn.model("B2BPage", B2BPageSchema);
    conn.model("HomeTemplate", HomeTemplateSchema);
    conn.model("B2BFormSubmission", B2BFormSubmissionSchema);
  }, 30000);

  afterAll(async () => {
    await conn.dropDatabase();
    await conn.close();
    await mongod.stop();
  });

  beforeEach(clean);

  it("stores lang on create and defaults when omitted", async () => {
    const de = await createPage(T, P, { slug: "kontakt", title: "Kontakt", lang: "de" });
    expect(de.lang).toBe("de");
    const def = await createPage(T, P, { slug: "contatti", title: "Contatti" });
    expect(def.lang).toBe("it");
  });

  it("filters list by lang", async () => {
    await createPage(T, P, { slug: "kontakt", title: "Kontakt", lang: "de" });
    await createPage(T, P, { slug: "contatti", title: "Contatti", lang: "it" });
    const de = await listPages(T, P, { lang: "de" });
    expect(de.items.map((i) => i.slug)).toEqual(["kontakt"]);
  });

  it("updates lang", async () => {
    await createPage(T, P, { slug: "info", title: "Info", lang: "it" });
    const updated = await updatePage(T, P, "info", { lang: "en" });
    expect(updated.lang).toBe("en");
  });
});
