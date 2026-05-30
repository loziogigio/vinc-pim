import { describe, it, expect } from "vitest";
import { buildAbility } from "@/lib/auth/permissions/ability";

describe("buildAbility", () => {
  it("grants the actions/subjects of the given permission keys", () => {
    const ability = buildAbility(["pim.product.view", "orders.cancel"], {});
    expect(ability.can("read", "Product")).toBe(true);
    expect(ability.can("cancel", "Order")).toBe(true);
    expect(ability.can("delete", "Product")).toBe(false);
    expect(ability.can("read", "Customer")).toBe(false);
  });

  it("applies subject scope conditions", () => {
    const ability = buildAbility(["orders.view"], {
      Order: { channel: { $in: ["retail"] } },
    });
    // CASL evaluates conditions against the candidate object
    expect(ability.can("read", { __caslSubjectType__: "Order", channel: "retail" } as never)).toBe(true);
    expect(ability.can("read", { __caslSubjectType__: "Order", channel: "wholesale" } as never)).toBe(false);
  });
});
