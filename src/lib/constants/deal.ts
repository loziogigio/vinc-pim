import { EVENTS } from "vinc-analytics";

export const DEAL_STAGES = [
  "new_lead", "qualified", "demo_activated", "audit_booked",
  "audit_sold", "go_live_sold", "won", "lost",
] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const LEAD_PAGE_SLUGS = ["richiedi-demo", "prenota-audit"] as const;

/** Normalise a Twenty stage label/enum value (e.g. "AUDIT_SOLD", "Go-Live Sold") to a DealStage. */
export function twentyStageToDealStage(value: string): DealStage | null {
  const norm = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (DEAL_STAGES as readonly string[]).includes(norm) ? (norm as DealStage) : null;
}

/** Event fired when a deal ENTERS the given stage. Stages without a commercial fact are omitted. */
export const STAGE_EVENT: Partial<Record<DealStage, string>> = {
  audit_sold: EVENTS.AUDIT_SOLD,
  go_live_sold: EVENTS.GO_LIVE_SOLD,
  won: EVENTS.DEAL_WON,
  lost: EVENTS.DEAL_LOST,
};
