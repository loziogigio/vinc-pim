/**
 * Tests for public B2B portal forms endpoints:
 *   POST /api/b2b/b2b/public/forms/submit
 *   POST /api/b2b/b2b/public/forms/standalone
 *
 * These routes use API-key auth (verifyAPIKey) + Origin→portal-domain lookup.
 * Email sending is mocked so no real emails are dispatched.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";

// ============================================
// IN-MEMORY DB SETUP
// ============================================

const TEST_TENANT = "pub-forms-test";
const TEST_DB = `vinc-${TEST_TENANT}`;
const PORTAL_SLUG = "default";
const PORTAL_DOMAIN = "forms.example.com";

let mongod: MongoMemoryServer;
let conn: mongoose.Connection;

// Mock the connection pool so connectWithModels uses our in-memory connection
vi.mock("@/lib/db/connection-pool", () => ({
  getPooledConnection: vi.fn(async () => conn),
}));

// Mock build-guard
vi.mock("@/lib/db/build-guard", () => ({
  assertNotBuildPhase: vi.fn(),
}));

// Mock API-key auth
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKey: vi.fn(() =>
    Promise.resolve({
      valid: true,
      tenantId: TEST_TENANT,
    })
  ),
}));

// Mock email sending — spy so we can assert calls without real dispatch
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

// Mock email template rendering
vi.mock("@/lib/email/templates/b2c-form-submission", () => ({
  renderFormSubmissionEmail: vi.fn(() => "<html>mock email</html>"),
}));

// Import modules AFTER mocks are set up
const { connectWithModels } = await import("@/lib/db/connection");
const { POST: formSubmitPOST } = await import("@/app/api/b2b/b2b/public/forms/submit/route");
const { POST: standalonePOST } = await import("@/app/api/b2b/b2b/public/forms/standalone/route");

// ============================================
// HELPERS
// ============================================

function buildRequest(
  method: string,
  url: string,
  opts: {
    origin?: string;
    apiKeyValid?: boolean;
    body?: unknown;
  } = {}
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost${url}`;
  const headers: Record<string, string> = {};

  if (opts.apiKeyValid !== false) {
    headers["x-api-key-id"] = `ak_${TEST_TENANT}_test`;
    headers["x-api-secret"] = "sk_test_secret";
  }
  if (opts.origin) {
    headers["origin"] = opts.origin;
  }
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return new NextRequest(fullUrl, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const FORM_FIELDS = [
  { id: "name", label: "Name", type: "text", required: true },
  { id: "email", label: "Email", type: "email", required: true },
  { id: "message", label: "Message", type: "textarea", required: false },
];

// ============================================
// LIFECYCLE
// ============================================

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  conn = await mongoose.createConnection(mongod.getUri()).asPromise();
}, 30000);

afterAll(async () => {
  await conn.dropDatabase();
  await conn.close();
  await mongod.stop();
});

beforeEach(async () => {
  const { B2BPortal, B2BFormSubmission, B2BFormDefinition, HomeTemplate } =
    await connectWithModels(TEST_DB);
  await B2BPortal.deleteMany({});
  await B2BFormSubmission.deleteMany({});
  await B2BFormDefinition.deleteMany({});
  await HomeTemplate.deleteMany({});

  vi.clearAllMocks();

  // Re-apply mocks after clearAllMocks
  const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
  vi.mocked(verifyAPIKey).mockResolvedValue({ valid: true, tenantId: TEST_TENANT });

  const emailModule = await import("@/lib/email");
  vi.mocked(emailModule.sendEmail).mockResolvedValue(undefined as any);

  const tplModule = await import("@/lib/email/templates/b2c-form-submission");
  vi.mocked(tplModule.renderFormSubmissionEmail).mockReturnValue("<html>mock email</html>");

  // Seed a portal with the test domain
  await B2BPortal.create({
    slug: PORTAL_SLUG,
    name: "Forms Portal",
    channel: "default",
    status: "active",
    domains: [{ domain: PORTAL_DOMAIN, is_primary: true }],
    branding: { title: "Forms Portal", primary_color: "#ff0000" },
  });
}, 10000);

// ============================================
// POST /api/b2b/b2b/public/forms/submit
// ============================================

describe("POST /api/b2b/b2b/public/forms/submit", () => {
  const now = new Date().toISOString();

  async function seedPublishedPage(formBlockId = "form-1", notificationEmail?: string) {
    const { HomeTemplate } = await connectWithModels(TEST_DB);
    await HomeTemplate.create({
      templateId: `b2b-${PORTAL_SLUG}-page-contact`,
      name: "Contact",
      version: 1,
      blocks: [
        {
          id: formBlockId,
          type: "form-contact",
          order: 0,
          config: {
            fields: FORM_FIELDS,
            success_message: "Thank you!",
            ...(notificationEmail ? { notification_email: notificationEmail } : {}),
          },
        },
      ],
      seo: {},
      status: "published",
      publishedAt: now,
      isCurrent: true,
      isCurrentPublished: true,
      createdAt: now,
      lastSavedAt: now,
    });
  }

  it("returns 401 when API key headers are missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      apiKeyValid: false,
      body: { page_slug: "contact", form_block_id: "form-1", data: {} },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is invalid", async () => {
    const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
    vi.mocked(verifyAPIKey).mockResolvedValue({ valid: false, error: "Invalid" });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { page_slug: "contact", form_block_id: "form-1", data: {} },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when Origin header is missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      body: { page_slug: "contact", form_block_id: "form-1", data: {} },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when Origin domain does not match any portal", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: "https://unknown.example.com",
      body: { page_slug: "contact", form_block_id: "form-1", data: {} },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when required body fields are missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { page_slug: "contact" },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 404 when page has no published template", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { page_slug: "nonexistent", form_block_id: "form-1", data: { name: "Alice", email: "alice@example.com" } },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found|not published/i);
  });

  it("returns 404 when form block ID does not exist on the page", async () => {
    await seedPublishedPage("form-1");

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { page_slug: "contact", form_block_id: "nonexistent-block", data: { name: "Alice", email: "alice@example.com" } },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/form block not found/i);
  });

  it("returns 400 when a required field is missing from data", async () => {
    await seedPublishedPage("form-1");

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { page_slug: "contact", form_block_id: "form-1", data: { name: "Alice" } }, // missing email
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
    expect(body.error).toMatch(/required/i);
  });

  it("persists a B2BFormSubmission with form_type='page_form' on valid submission", async () => {
    await seedPublishedPage("form-1");

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        page_slug: "contact",
        form_block_id: "form-1",
        data: { name: "Alice", email: "alice@example.com", message: "Hello" },
      },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.success).toBe(true);
    expect(resBody.message).toBe("Thank you!");

    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const saved = await B2BFormSubmission.findOne({ portal_slug: PORTAL_SLUG }).lean() as any;
    expect(saved).not.toBeNull();
    expect(saved.form_type).toBe("page_form");
    expect(saved.page_slug).toBe("contact");
    expect(saved.form_block_id).toBe("form-1");
    expect(saved.submitter_email).toBe("alice@example.com");
    expect(saved.data.name).toBe("Alice");
  });

  it("calls sendEmail when notification_email is configured", async () => {
    await seedPublishedPage("form-1", "admin@example.com");

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        page_slug: "contact",
        form_block_id: "form-1",
        data: { name: "Bob", email: "bob@example.com" },
      },
    });
    const res = await formSubmitPOST(req);
    expect(res.status).toBe(200);

    // Wait a tick for the fire-and-forget to execute
    await new Promise((r) => setTimeout(r, 10));

    const emailModule = await import("@/lib/email");
    expect(vi.mocked(emailModule.sendEmail)).toHaveBeenCalledOnce();
    const call = vi.mocked(emailModule.sendEmail).mock.calls[0][0];
    expect(call.to).toBe("admin@example.com");
    expect(call.replyTo).toBe("bob@example.com");
  });

  it("does NOT call sendEmail when no notification_email is configured", async () => {
    await seedPublishedPage("form-1"); // no notification_email

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/submit", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        page_slug: "contact",
        form_block_id: "form-1",
        data: { name: "Carol", email: "carol@example.com" },
      },
    });
    await formSubmitPOST(req);

    await new Promise((r) => setTimeout(r, 10));
    const emailModule = await import("@/lib/email");
    expect(vi.mocked(emailModule.sendEmail)).not.toHaveBeenCalled();
  });
});

// ============================================
// POST /api/b2b/b2b/public/forms/standalone
// ============================================

describe("POST /api/b2b/b2b/public/forms/standalone", () => {
  async function seedFormDefinition(opts: {
    slug?: string;
    enabled?: boolean;
    notificationEmails?: string[];
    sendSubmitterCopy?: boolean;
  } = {}) {
    const { B2BFormDefinition } = await connectWithModels(TEST_DB);
    await B2BFormDefinition.create({
      portal_slug: PORTAL_SLUG,
      slug: opts.slug || "contact-form",
      name: "Contact Form",
      config: {
        fields: FORM_FIELDS,
        success_message: "Submitted!",
      },
      notification_emails: opts.notificationEmails || [],
      send_submitter_copy: opts.sendSubmitterCopy ?? false,
      is_system: false,
      enabled: opts.enabled ?? true,
    });
  }

  it("returns 401 when API key headers are missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      apiKeyValid: false,
      body: { form_definition_slug: "contact-form", data: {} },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is invalid", async () => {
    const { verifyAPIKey } = await import("@/lib/auth/api-key-auth");
    vi.mocked(verifyAPIKey).mockResolvedValue({ valid: false, error: "Invalid" });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { form_definition_slug: "contact-form", data: {} },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when Origin header is missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      body: { form_definition_slug: "contact-form", data: {} },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when Origin domain does not match any portal", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: "https://unknown.example.com",
      body: { form_definition_slug: "contact-form", data: {} },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when required body fields are missing", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { data: { name: "Test" } }, // missing form_definition_slug
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns 404 when form definition does not exist", async () => {
    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { form_definition_slug: "nonexistent", data: { name: "Alice", email: "alice@example.com" } },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found|disabled/i);
  });

  it("returns 404 when form definition is disabled", async () => {
    await seedFormDefinition({ enabled: false });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { form_definition_slug: "contact-form", data: { name: "Alice", email: "alice@example.com" } },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when a required field is missing from data", async () => {
    await seedFormDefinition();

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: { form_definition_slug: "contact-form", data: { name: "Alice" } }, // missing email
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/email/i);
    expect(body.error).toMatch(/required/i);
  });

  it("persists B2BFormSubmission with form_type='standalone' and form_definition_slug set", async () => {
    await seedFormDefinition();

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        form_definition_slug: "contact-form",
        data: { name: "Dave", email: "dave@example.com", message: "Hi!" },
      },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.success).toBe(true);
    expect(resBody.message).toBe("Submitted!");

    const { B2BFormSubmission } = await connectWithModels(TEST_DB);
    const saved = await B2BFormSubmission.findOne({ portal_slug: PORTAL_SLUG }).lean() as any;
    expect(saved).not.toBeNull();
    expect(saved.form_type).toBe("standalone");
    expect(saved.form_definition_slug).toBe("contact-form");
    expect(saved.submitter_email).toBe("dave@example.com");
    expect(saved.data.name).toBe("Dave");
    // page_slug should not be set for standalone submissions
    expect(saved.page_slug).toBeUndefined();
  });

  it("calls sendEmail for each notification recipient", async () => {
    await seedFormDefinition({
      notificationEmails: ["admin@example.com", "manager@example.com"],
    });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        form_definition_slug: "contact-form",
        data: { name: "Eve", email: "eve@example.com" },
      },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 10));

    const emailModule = await import("@/lib/email");
    // One call for the notification recipients list
    expect(vi.mocked(emailModule.sendEmail)).toHaveBeenCalledOnce();
    const call = vi.mocked(emailModule.sendEmail).mock.calls[0][0];
    expect(call.to).toEqual(["admin@example.com", "manager@example.com"]);
  });

  it("sends submitter copy when send_submitter_copy is true", async () => {
    await seedFormDefinition({
      notificationEmails: ["admin@example.com"],
      sendSubmitterCopy: true,
    });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        form_definition_slug: "contact-form",
        data: { name: "Frank", email: "frank@example.com" },
      },
    });
    const res = await standalonePOST(req);
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, 10));

    const emailModule = await import("@/lib/email");
    // Two calls: one for admin, one for submitter copy
    expect(vi.mocked(emailModule.sendEmail)).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(emailModule.sendEmail).mock.calls;
    const submitterCall = calls.find((c) => c[0].to === "frank@example.com");
    expect(submitterCall).toBeDefined();
  });

  it("does NOT call sendEmail when no notification_emails and no submitter copy", async () => {
    await seedFormDefinition({ notificationEmails: [] });

    const req = buildRequest("POST", "/api/b2b/b2b/public/forms/standalone", {
      origin: `https://${PORTAL_DOMAIN}`,
      body: {
        form_definition_slug: "contact-form",
        data: { name: "Grace", email: "grace@example.com" },
      },
    });
    await standalonePOST(req);

    await new Promise((r) => setTimeout(r, 10));
    const emailModule = await import("@/lib/email");
    expect(vi.mocked(emailModule.sendEmail)).not.toHaveBeenCalled();
  });
});
