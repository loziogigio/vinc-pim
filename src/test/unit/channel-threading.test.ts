/**
 * Unit Tests: channel threading through send pipeline
 *
 * Proves that options.channel flows from sendEmail → fetchTenantEmailConfig
 * → resolveNotificationConfig, and defaults to "default" when absent.
 *
 * Also proves that the sendEmailNow config-resolve FALLBACK (when no
 * prefetchedConfig is supplied) passes emailLog.channel — not the implicit
 * "default" — to fetchTenantEmailConfig/resolveNotificationConfig.
 *
 * Test seam: mock resolveNotificationConfig (the outermost I/O boundary before
 * fetchTenantEmailConfig). sendEmail reaches the resolve site before any DB
 * operations, then returns early ("not configured") — no in-memory MongoDB needed.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IEmailLog } from "@/lib/db/models/email-log";

// ─── Mocks (hoisted before imports) ───────────────────────────────────────────

const mockResolveNotif = vi.fn();
vi.mock("@/lib/notifications/resolve-config", () => ({
  resolveNotificationConfig: (...a: unknown[]) => mockResolveNotif(...a),
}));

// Mock transport layer so _sendEmailNow doesn't actually send
const mockSendViaSmtp = vi.fn();
const mockSendViaGraph = vi.fn();
vi.mock("vinc-notifications/server", () => ({
  sendEmailViaSmtp: (...a: unknown[]) => mockSendViaSmtp(...a),
  sendEmailViaGraph: (...a: unknown[]) => mockSendViaGraph(...a),
}));

// Mock notification log service so markLogAsSent doesn't hit DB
vi.mock("@/lib/notifications/notification-log.service", () => ({
  createNotificationLog: vi.fn().mockResolvedValue({ log_id: "log-1" }),
  markLogAsSent: vi.fn().mockResolvedValue(undefined),
  markLogAsFailed: vi.fn().mockResolvedValue(undefined),
}));

// ─── Imports that depend on mocks ─────────────────────────────────────────────

import { sendEmail, clearEmailConfigCache, _sendEmailNow } from "@/lib/email";

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

/** Resolved config that IS configured (smtp.from set) so sendEmailNow proceeds to send */
const configuredResolved = {
  channel: "b2b",
  email: {
    enabled: true,
    transport: "smtp" as const,
    from: "noreply@acme.it",
    fromName: "Acme",
    smtp: { host: "smtp.acme.it", port: 587, secure: false, user: "u", password: "p" },
  },
};

/** Minimal fake IEmailLog with channel stamped — simulates a retry / direct call */
function makeEmailLog(channel: string): IEmailLog {
  return {
    email_id: "test-id",
    to: "dest@acme.it",
    subject: "Test",
    html: "<p>hi</p>",
    tenant_db: "vinc-acme",
    channel,
    status: "queued",
    attempts: 0,
    save: vi.fn().mockResolvedValue(undefined),
  } as unknown as IEmailLog;
}

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

describe("channel threading — sendEmailNow fallback passes emailLog.channel", () => {
  /**
   * sendEmailNow is not part of the public API but is exported as _sendEmailNow
   * for this test only. The fallback path (prefetchedConfig = undefined) is the
   * one used on direct calls and retries that arrive without a cached config.
   * This suite proves the fix: emailLog.channel is now threaded through instead
   * of implicitly falling back to "default".
   */

  beforeEach(() => {
    mockResolveNotif.mockReset();
    mockSendViaSmtp.mockReset();
    clearEmailConfigCache();
    mockResolveNotif.mockResolvedValue(configuredResolved);
    mockSendViaSmtp.mockResolvedValue({ ok: true, providerMessageId: "mid-1" });
  });

  it("passes emailLog.channel to resolveNotificationConfig when no prefetchedConfig supplied", async () => {
    const log = makeEmailLog("b2b");
    // Call without prefetchedConfig — exercises the fallback branch
    await _sendEmailNow(log);
    // resolveNotificationConfig must be called with the channel stamped on the log
    expect(mockResolveNotif).toHaveBeenCalledWith("vinc-acme", "b2b");
  });

  it("passes 'default' when emailLog.channel is undefined and no prefetchedConfig supplied", async () => {
    mockResolveNotif.mockResolvedValue(minimalResolved);
    const log = makeEmailLog(undefined as unknown as string);
    await _sendEmailNow(log);
    expect(mockResolveNotif).toHaveBeenCalledWith("vinc-acme", "default");
  });

  it("does NOT call resolveNotificationConfig when prefetchedConfig is provided", async () => {
    const log = makeEmailLog("b2b");
    const prefetched = {
      transport: "smtp" as const,
      smtp: { host: "smtp.acme.it", port: 587, secure: false, user: "u", password: "p", from: "noreply@acme.it", fromName: "Acme" },
    };
    mockSendViaSmtp.mockResolvedValue({ ok: true, providerMessageId: "mid-2" });
    await _sendEmailNow(log, undefined, prefetched);
    // No resolve needed — prefetched config is used directly
    expect(mockResolveNotif).not.toHaveBeenCalled();
  });
});
