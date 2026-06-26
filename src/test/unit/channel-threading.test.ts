/**
 * Unit Tests: channel threading through send pipeline
 *
 * Proves that options.channel flows from sendEmail → fetchTenantEmailConfig
 * → resolveNotificationConfig, and defaults to "default" when absent.
 *
 * Test seam: mock resolveNotificationConfig (the outermost I/O boundary before
 * fetchTenantEmailConfig). sendEmail reaches the resolve site before any DB
 * operations, then returns early ("not configured") — no in-memory MongoDB needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const mockResolveNotif = vi.fn();
vi.mock("@/lib/notifications/resolve-config", () => ({
  resolveNotificationConfig: (...a: unknown[]) => mockResolveNotif(...a),
}));

// ─── Imports that depend on mocks ─────────────────────────────────────────────

import { sendEmail, clearEmailConfigCache } from "@/lib/email";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal resolved config — no smtp.from so isConfigured=false → early return */
const minimalResolved = {
  channel: "default",
  email: {
    enabled: false,
    transport: "smtp" as const,
    from: "",
    fromName: "Test",
    smtp: { host: "", port: 587, secure: false, user: "", password: "" },
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("channel threading — sendEmail passes channel to fetchTenantEmailConfig", () => {
  beforeEach(() => {
    mockResolveNotif.mockReset();
    clearEmailConfigCache();
    mockResolveNotif.mockResolvedValue(minimalResolved);
  });

  it("passes options.channel into resolveNotificationConfig (via fetchTenantEmailConfig)", async () => {
    /**
     * The required assertion: options.channel reaches fetchTenantEmailConfig.
     * sendEmail returns early (not configured) but the resolve call already fired.
     */
    await sendEmail({
      to: "x@acme.it",
      subject: "s",
      html: "<p>h</p>",
      tenantDb: "vinc-acme",
      channel: "b2b",
    });
    expect(mockResolveNotif).toHaveBeenCalledWith("vinc-acme", "b2b");
  });

  it("defaults channel to 'default' when not provided", async () => {
    /**
     * When no channel is supplied, fetchTenantEmailConfig must use "default".
     */
    await sendEmail({
      to: "x@acme.it",
      subject: "s",
      html: "<p>h</p>",
      tenantDb: "vinc-acme",
    });
    expect(mockResolveNotif).toHaveBeenCalledWith("vinc-acme", "default");
  });
});
