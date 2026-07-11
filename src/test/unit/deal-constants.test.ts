import { describe, it, expect } from "vitest";
import { DEAL_STAGES, twentyStageToDealStage, STAGE_EVENT, LEAD_PAGE_SLUGS } from "@/lib/constants/deal";

describe("unit: deal constants", () => {
  it("has the canonical ordered stages", () => {
    expect(DEAL_STAGES).toEqual([
      "new_lead","qualified","demo_activated","audit_booked","audit_sold","go_live_sold","won","lost",
    ]);
  });
  it("maps Twenty stage enum values to deal stages (case-insensitive)", () => {
    expect(twentyStageToDealStage("AUDIT_SOLD")).toBe("audit_sold");
    expect(twentyStageToDealStage("Go-Live Sold")).toBe("go_live_sold");
    expect(twentyStageToDealStage("WON")).toBe("won");
    expect(twentyStageToDealStage("nonsense")).toBeNull();
  });
  it("maps stages to entry events for the commercial facts", () => {
    expect(STAGE_EVENT.audit_sold).toBe("Audit Sold");
    expect(STAGE_EVENT.go_live_sold).toBe("Go-Live Sold");
    expect(STAGE_EVENT.won).toBe("Deal Won");
    expect(STAGE_EVENT.lost).toBe("Deal Lost");
    expect(STAGE_EVENT.new_lead).toBeUndefined();
  });
  it("lists the lead page slugs", () => {
    expect(LEAD_PAGE_SLUGS).toEqual(["richiedi-demo","prenota-audit"]);
  });
});
