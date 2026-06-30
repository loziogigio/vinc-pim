import { describe, it, expect, vi, beforeEach } from "vitest";

const recFindOne = vi.fn();
const custFindOne = vi.fn();

// model-registry: channel record model
vi.mock("@/lib/db/model-registry", () => ({
  getDataModelRecordModel: vi.fn(async () => ({
    findOne: (...a: any[]) => ({ lean: () => recFindOne(...a) }),
  })),
}));

// connection: Customer model
vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(async () => ({
    Customer: {
      findOne: (...a: any[]) => ({ lean: () => custFindOne(...a) }),
    },
  })),
}));

const { loadUserExclusionsForSearch } = await import(
  "@/app/api/search/search/exclusions-loader"
);

const RULES = [
  {
    enabled: true,
    user_field: "address_country",
    solr_field: "attribute_erp_user_country_exclude_ss",
    label: "x",
  },
];

beforeEach(() => {
  recFindOne.mockReset();
  custFindOne.mockReset();
});

describe("loadUserExclusionsForSearch", () => {
  it("returns [] for a guest (no customer_code)", async () => {
    const out = await loadUserExclusionsForSearch("vinc-acme-it", "b2b", undefined, "A1");
    expect(out).toEqual([]);
    expect(recFindOne).not.toHaveBeenCalled();
  });

  it("returns [] when no channel is provided", async () => {
    const out = await loadUserExclusionsForSearch("vinc-acme-it", undefined, "C1", "A1");
    expect(out).toEqual([]);
  });

  it("returns [] when the channel record has no rules", async () => {
    recFindOne.mockResolvedValue({ data: { user_exclusion_rules: [] } });
    const out = await loadUserExclusionsForSearch("vinc-acme-it", "b2b", "C1", "A1");
    expect(out).toEqual([]);
    expect(custFindOne).not.toHaveBeenCalled();
  });

  it("resolves exclusions from rules + customer address", async () => {
    recFindOne.mockResolvedValue({ data: { user_exclusion_rules: RULES } });
    custFindOne.mockResolvedValue({
      addresses: [{ external_code: "A1", country: "IT", is_default: true }],
    });
    const out = await loadUserExclusionsForSearch("vinc-acme-it", "b2b", "C1", "A1");
    expect(out).toEqual([
      { solr_field: "attribute_erp_user_country_exclude_ss", value: "IT" },
    ]);
  });

  it("returns [] when the customer is not found", async () => {
    recFindOne.mockResolvedValue({ data: { user_exclusion_rules: RULES } });
    custFindOne.mockResolvedValue(null);
    const out = await loadUserExclusionsForSearch("vinc-acme-it", "b2b", "C1", "A1");
    expect(out).toEqual([]);
  });
});
