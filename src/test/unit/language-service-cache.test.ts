import { describe, it, expect, vi, beforeEach } from "vitest";

// The default-connection LanguageModel is never connected in the running app
// (the app uses per-tenant createConnection pools, not mongoose.connect()).
// So refreshLanguageCache REQUIRES a caller-supplied model — otherwise it
// buffers and times out after 10s. There is no hardcoded default. See
// enable/route.ts, which passes its tenant-bound model.
const defaultFind = vi.fn(() => ({ sort: () => ({ lean: async () => [] }) }));
vi.mock("../../lib/db/models/language", () => ({
  LanguageModel: { find: (...a: any[]) => defaultFind(...a) },
}));

import { refreshLanguageCache } from "@/services/language.service";

function chain(docs: any[]) {
  return { sort: () => ({ lean: async () => docs }) };
}

beforeEach(() => {
  defaultFind.mockReset();
  defaultFind.mockReturnValue(chain([]));
});

describe("refreshLanguageCache", () => {
  it("queries the injected tenant model, not the default-connection model", async () => {
    const tenantFind = vi.fn(() => chain([{ code: "de", isEnabled: true }]));
    const tenantModel = { find: tenantFind } as any;

    await refreshLanguageCache(tenantModel);

    expect(tenantFind).toHaveBeenCalledWith({ isEnabled: true });
    expect(defaultFind).not.toHaveBeenCalled();
  });

  it("queries whichever model is passed (scripts/tests pass the default import)", async () => {
    const defaultModel = { find: defaultFind } as any;
    await refreshLanguageCache(defaultModel);
    expect(defaultFind).toHaveBeenCalledWith({ isEnabled: true });
  });
});
