import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("unit: pipeline-settings resolver (dynamic record + env fallback)", () => {
  const OLD = { ...process.env };
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    process.env = { ...OLD };
    vi.restoreAllMocks();
  });

  it("mapPipelineSettings: a record field wins only when non-empty, else env fallback", async () => {
    const { mapPipelineSettings } = await import("@/lib/leads/pipeline-settings");
    const WH_FALLBACK = "env-wh-fixture"; // fixture value (not a real secret)
    const env = {
      twentyBaseUrl: "https://env.crm",
      twentyApiKey: "env-key",
      twentyWebhookSecret: WH_FALLBACK,
      rudderstackWriteKey: "env-wk",
      rudderstackDataPlaneUrl: "https://env.events",
    };
    const out = mapPipelineSettings(
      { twenty_base_url: "https://rec.crm", twenty_api_key: "rec-key", rudderstack_write_key: "   " },
      env
    );
    expect(out.twentyBaseUrl).toBe("https://rec.crm"); // record wins
    expect(out.twentyApiKey).toBe("rec-key"); // record wins
    expect(out.rudderstackWriteKey).toBe("env-wk"); // blank record -> env
    expect(out.twentyWebhookSecret).toBe(WH_FALLBACK); // absent in record -> env
  });

  it("pipelineSettingsFromEnv uses the Twenty default base when env is unset", async () => {
    delete process.env.VINC_TWENTY_BASE_URL;
    process.env.VINC_TWENTY_API_KEY = "k";
    const { pipelineSettingsFromEnv, TWENTY_BASE_DEFAULT } = await import("@/lib/leads/pipeline-settings");
    const env = pipelineSettingsFromEnv();
    expect(env.twentyBaseUrl).toBe(TWENTY_BASE_DEFAULT);
    expect(env.twentyApiKey).toBe("k");
  });

  it("resolvePipelineSettings returns env when VINC_PIPELINE_TENANT_ID is unset (no DB read)", async () => {
    delete process.env.VINC_PIPELINE_TENANT_ID;
    process.env.VINC_TWENTY_API_KEY = "env-key";
    const { resolvePipelineSettings } = await import("@/lib/leads/pipeline-settings");
    const s = await resolvePipelineSettings({ force: true });
    expect(s.twentyApiKey).toBe("env-key");
  });

  it("resolvePipelineSettings overlays the dynamic record on env when the tenant is set", async () => {
    process.env.VINC_PIPELINE_TENANT_ID = "vendereincloud-it";
    process.env.VINC_TWENTY_API_KEY = "env-key";
    process.env.RUDDERSTACK_WRITE_KEY = "env-wk";
    const findOne = vi.fn(() => ({
      lean: () => Promise.resolve({ data: { twenty_api_key: "rec-key" } }),
    }));
    vi.doMock("@/lib/db/model-registry", () => ({
      getDataModelRecordModel: vi.fn(async () => ({ findOne })),
    }));
    const { resolvePipelineSettings } = await import("@/lib/leads/pipeline-settings");
    const s = await resolvePipelineSettings({ force: true });
    expect(s.twentyApiKey).toBe("rec-key"); // record wins
    expect(s.rudderstackWriteKey).toBe("env-wk"); // absent in record -> env fallback
    expect(findOne).toHaveBeenCalledWith({ relation_id: "_channel", channel: "default" });
  });

  it("resolvePipelineSettings falls back to env if the DB read throws (never breaks the pipeline)", async () => {
    process.env.VINC_PIPELINE_TENANT_ID = "vendereincloud-it";
    process.env.VINC_TWENTY_API_KEY = "env-key";
    vi.doMock("@/lib/db/model-registry", () => ({
      getDataModelRecordModel: vi.fn(async () => {
        throw new Error("db down");
      }),
    }));
    const { resolvePipelineSettings } = await import("@/lib/leads/pipeline-settings");
    const s = await resolvePipelineSettings({ force: true });
    expect(s.twentyApiKey).toBe("env-key");
  });
});
