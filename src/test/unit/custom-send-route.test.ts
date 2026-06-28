import { describe, it, expect, vi, beforeEach } from "vitest";

const auth = vi.fn(async () => ({ success: true, tenantDb: "vinc-acme", tenantId: "acme", userId: "u" }));
vi.mock("@/lib/auth/tenant-auth", () => ({ requireTenantAuth: (...a: unknown[]) => auth(...a) }));
const cap = vi.fn();
vi.mock("@/lib/notifications/custom-send-cap", () => ({ enforceCustomSendCap: (...a: unknown[]) => cap(...a) }));
const send = vi.fn();
vi.mock("@/lib/notifications/custom-send.service", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...actual, sendCustomNotification: (...a: unknown[]) => send(...a) };
});

import { POST } from "@/app/api/b2b/notifications/custom/route";

function req(body: unknown) {
  return new Request("http://x/api/b2b/notifications/custom", { method: "POST", body: JSON.stringify(body) }) as never;
}

describe("POST /api/b2b/notifications/custom", () => {
  beforeEach(() => {
    auth.mockReset();
    auth.mockResolvedValue({ success: true, tenantDb: "vinc-acme", tenantId: "acme", userId: "u" });
    cap.mockReset();
    send.mockReset();
    cap.mockResolvedValue({ allowed: true, retryAfter: 0 });
  });

  it("400 on invalid body (no channels)", async () => {
    const res = await POST(req({ message: {} }));
    expect((res as Response).status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it("429 when the rate cap blocks", async () => {
    cap.mockResolvedValue({ allowed: false, retryAfter: 42 });
    const res = await POST(req({ channels: ["sms"], sms_to: "+39333", message: { text: "B" } }));
    expect((res as Response).status).toBe(429);
    const json = await (res as Response).json();
    expect(json.retry_after).toBe(42);
    expect(send).not.toHaveBeenCalled();
  });

  it("returns the auth response and does not send when unauthenticated", async () => {
    const unauth = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    auth.mockResolvedValue({ success: false, response: unauth });
    const res = await POST(req({ channels: ["sms"], sms_to: "+39333", message: { text: "B" } }));
    expect((res as Response).status).toBe(401);
    expect(cap).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("200 and returns results on success, forwarding tenantDb", async () => {
    send.mockResolvedValue({ ok: true, results: { sms: { ok: true, logId: "s1" } } });
    const res = await POST(req({ channels: ["sms"], sms_to: "+39333", message: { text: "B" } }));
    expect((res as Response).status).toBe(200);
    const json = await (res as Response).json();
    expect(json.ok).toBe(true);
    expect(json.results.sms.logId).toBe("s1");
    expect(send.mock.calls[0][0]).toMatchObject({ tenantDb: "vinc-acme", sms_to: "+39333" });
  });
});
