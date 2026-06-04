import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { setupTestDatabase, teardownTestDatabase, clearDatabase } from "../conftest";
import { B2BUserSchema } from "@/lib/db/models/b2b-user";
import { RoleSchema } from "@/lib/db/models/role";

const sendWelcomeEmail = vi.fn(async () => ({ success: true, messageId: "m1" }));
vi.mock("@/lib/email/b2b-emails", () => ({ sendWelcomeEmail: (...a: unknown[]) => sendWelcomeEmail(...a) }));

const auth = {
  success: true as const,
  tenantDb: "vinc-test",
  tenantId: "test",
  userId: "admin-1",
  permissions: new Set(["users.manage", "roles.manage"]),
  priceAccess: "edit",
  scope: { channels: "all", customers: "all", price_lists: "all" },
  can: (p: string) => new Set(["users.manage", "roles.manage"]).has(p),
};
vi.mock("@/lib/auth/tenant-auth", () => ({ requireTenantAuth: vi.fn(async () => auth) }));

let B2BUser: mongoose.Model<any>;
let Role: mongoose.Model<any>;
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({ B2BUser, Role })),
}));

import { POST } from "@/app/api/b2b/users/route";

function req(body: unknown) {
  return new Request("http://t/api/b2b/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/b2b/users", () => {
  beforeAll(async () => {
    await setupTestDatabase();
    B2BUser = mongoose.models.B2BUser || mongoose.model("B2BUser", B2BUserSchema);
    Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);
  });
  afterAll(async () => { await teardownTestDatabase(); });
  beforeEach(async () => { await clearDatabase(); sendWelcomeEmail.mockClear(); });

  it("creates a member, hashes the password, and emails credentials", async () => {
    const res = await POST(req({ username: "mrossi", email: "m@x.it", companyName: "ACME" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.emailSent).toBe(true);
    const doc = await B2BUser.findOne({ username: "mrossi" }).lean<any>();
    expect(doc).toBeTruthy();
    expect(doc.passwordHash).toBeTruthy();
    expect(doc.passwordHash).not.toContain("mrossi");
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    const [data, toEmail] = sendWelcomeEmail.mock.calls[0];
    expect(toEmail).toBe("m@x.it");
    expect(data.username).toBe("mrossi");
    expect(typeof data.password).toBe("string");
    expect(data.password.length).toBeGreaterThanOrEqual(10);
  });

  it("rejects missing username/email with 400", async () => {
    const res = await POST(req({ username: "x" }));
    expect(res.status).toBe(400);
  });

  it("rejects duplicate email with 409", async () => {
    await POST(req({ username: "abc1", email: "dup@x.it", companyName: "C" }));
    const res = await POST(req({ username: "abc2", email: "dup@x.it", companyName: "C" }));
    expect(res.status).toBe(409);
  });

  it("still returns 201 with emailSent=false when the mailer fails", async () => {
    sendWelcomeEmail.mockResolvedValueOnce({ success: false, error: "smtp down" });
    const res = await POST(req({ username: "noemail", email: "n@x.it", companyName: "C" }));
    expect(res.status).toBe(201);
    expect((await res.json()).data.emailSent).toBe(false);
    expect(await B2BUser.findOne({ username: "noemail" }).lean()).toBeTruthy();
  });
});
