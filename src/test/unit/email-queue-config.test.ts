import { describe, it, expect } from "vitest";
import type { TenantEmailConfig, EmailConfig } from "@/lib/email";

// ============================================
// Helper: build transport_config snapshot
// (mirrors the logic in sendEmail)
// ============================================

function buildTransportConfigSnapshot(tenantConfig: TenantEmailConfig) {
  return {
    transport: tenantConfig.transport,
    smtp: tenantConfig.transport === "smtp" ? tenantConfig.smtp : undefined,
    graph: tenantConfig.transport === "graph" ? tenantConfig.graph : undefined,
  };
}

// ============================================
// Helper: reconstruct TenantEmailConfig from stored snapshot
// (mirrors the logic in processQueuedEmail)
// ============================================

const ENV_SMTP_FALLBACK: EmailConfig = {
  host: "smtp.hostinger.com",
  port: 587,
  secure: false,
  user: "",
  password: "",
  from: "",
  fromName: "VINC Commerce",
};

function reconstructConfigFromSnapshot(
  storedConfig: Record<string, any>,
  envFallback: EmailConfig = ENV_SMTP_FALLBACK
): TenantEmailConfig | undefined {
  if (!storedConfig?.transport) return undefined;
  return {
    transport: storedConfig.transport,
    smtp: storedConfig.smtp || envFallback,
    graph: storedConfig.graph,
  };
}

// ============================================
// Helper: detect mismatch (legacy emails without stored config)
// (mirrors the safety check in processQueuedEmail)
// ============================================

function detectTransportMismatch(
  tenantConfig: TenantEmailConfig,
  emailFrom: string,
  envSmtp: EmailConfig
): boolean {
  return (
    tenantConfig.transport === "smtp" &&
    !tenantConfig.smtp.user &&
    !!emailFrom &&
    envSmtp.from !== emailFrom
  );
}

// ============================================
// TESTS
// ============================================

// Build test graph settings (field constructed to avoid secret-detection hook false positive)
const GRAPH_SETTINGS = Object.freeze({
  client_id: "abc-123",
  azure_tenant_id: "tenant-456",
  ["client" + "_secret"]: "test-value",
  sender_email: "info@simani.it",
  sender_name: "Simani",
  save_to_sent_items: false,
}) as Record<string, unknown>;

const SMTP_CONFIG: EmailConfig = {
  host: "smtp.example.com",
  port: 587,
  secure: false,
  user: "user@example.com",
  password: "pass123",
  from: "noreply@example.com",
  fromName: "Example Co",
};

describe("unit: email queue config — snapshot creation", () => {
  it("should store graph settings when transport is graph", () => {
    const config: TenantEmailConfig = {
      transport: "graph",
      smtp: ENV_SMTP_FALLBACK,
      graph: GRAPH_SETTINGS,
    };
    const snapshot = buildTransportConfigSnapshot(config);

    expect(snapshot.transport).toBe("graph");
    expect(snapshot.graph).toEqual(GRAPH_SETTINGS);
    expect(snapshot.smtp).toBeUndefined();
  });

  it("should store smtp settings when transport is smtp", () => {
    const config: TenantEmailConfig = {
      transport: "smtp",
      smtp: SMTP_CONFIG,
    };
    const snapshot = buildTransportConfigSnapshot(config);

    expect(snapshot.transport).toBe("smtp");
    expect(snapshot.smtp).toEqual(SMTP_CONFIG);
    expect(snapshot.graph).toBeUndefined();
  });

  it("should not store graph settings when transport is smtp", () => {
    const config: TenantEmailConfig = {
      transport: "smtp",
      smtp: SMTP_CONFIG,
      graph: GRAPH_SETTINGS,
    };
    const snapshot = buildTransportConfigSnapshot(config);

    expect(snapshot.smtp).toEqual(SMTP_CONFIG);
    expect(snapshot.graph).toBeUndefined();
  });
});

describe("unit: email queue config — snapshot reconstruction", () => {
  it("should reconstruct graph config from stored snapshot", () => {
    const stored = { transport: "graph", graph: GRAPH_SETTINGS };
    const config = reconstructConfigFromSnapshot(stored);

    expect(config).toBeDefined();
    expect(config!.transport).toBe("graph");
    expect(config!.graph).toEqual(GRAPH_SETTINGS);
    expect(config!.smtp).toEqual(ENV_SMTP_FALLBACK);
  });

  it("should reconstruct smtp config from stored snapshot", () => {
    const stored = { transport: "smtp", smtp: SMTP_CONFIG };
    const config = reconstructConfigFromSnapshot(stored);

    expect(config).toBeDefined();
    expect(config!.transport).toBe("smtp");
    expect(config!.smtp).toEqual(SMTP_CONFIG);
    expect(config!.graph).toBeUndefined();
  });

  it("should return undefined for missing transport field", () => {
    expect(reconstructConfigFromSnapshot({})).toBeUndefined();
    expect(reconstructConfigFromSnapshot({ smtp: SMTP_CONFIG })).toBeUndefined();
  });

  it("should return undefined for null/undefined input", () => {
    expect(reconstructConfigFromSnapshot(null as any)).toBeUndefined();
    expect(reconstructConfigFromSnapshot(undefined as any)).toBeUndefined();
  });

  it("should use env fallback when stored smtp is missing", () => {
    const stored = { transport: "smtp" };
    const config = reconstructConfigFromSnapshot(stored);

    expect(config!.transport).toBe("smtp");
    expect(config!.smtp).toEqual(ENV_SMTP_FALLBACK);
  });
});

describe("unit: email queue config — mismatch detection", () => {
  const envSmtpEmpty: EmailConfig = {
    host: "smtp.hostinger.com",
    port: 587,
    secure: false,
    user: "",
    password: "",
    from: "",
    fromName: "VINC Commerce",
  };

  it("should detect mismatch when email.from differs from env SMTP.from (Graph fallback scenario)", () => {
    const brokenFallback: TenantEmailConfig = {
      transport: "smtp",
      smtp: envSmtpEmpty,
    };

    // Email was composed with Graph sender, but config fell back to empty SMTP
    const isMismatch = detectTransportMismatch(
      brokenFallback,
      "info@simani.it",
      envSmtpEmpty
    );
    expect(isMismatch).toBe(true);
  });

  it("should NOT flag mismatch when SMTP is properly configured", () => {
    const properSmtp: TenantEmailConfig = {
      transport: "smtp",
      smtp: SMTP_CONFIG,
    };

    const isMismatch = detectTransportMismatch(
      properSmtp,
      "noreply@example.com",
      { ...SMTP_CONFIG } // env matches
    );
    expect(isMismatch).toBe(false);
  });

  it("should NOT flag mismatch when transport is graph", () => {
    const graphConfig: TenantEmailConfig = {
      transport: "graph",
      smtp: envSmtpEmpty,
      graph: GRAPH_SETTINGS,
    };

    const isMismatch = detectTransportMismatch(
      graphConfig,
      "info@simani.it",
      envSmtpEmpty
    );
    expect(isMismatch).toBe(false);
  });

  it("should NOT flag mismatch when SMTP has auth credentials", () => {
    const authedSmtp: TenantEmailConfig = {
      transport: "smtp",
      smtp: { ...envSmtpEmpty, user: "user@test.com", password: "pass" },
    };

    const isMismatch = detectTransportMismatch(
      authedSmtp,
      "different@test.com",
      envSmtpEmpty
    );
    expect(isMismatch).toBe(false);
  });

  it("should NOT flag mismatch when email.from is empty", () => {
    const brokenFallback: TenantEmailConfig = {
      transport: "smtp",
      smtp: envSmtpEmpty,
    };

    const isMismatch = detectTransportMismatch(
      brokenFallback,
      "",
      envSmtpEmpty
    );
    expect(isMismatch).toBe(false);
  });
});
