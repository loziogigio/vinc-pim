// vinc-commerce-suite/src/lib/leads/crm-webhook.ts
import crypto from "node:crypto";
import { findByOpportunity, updateDealStage } from "@/lib/services/deal.service";
import { twentyStageToDealStage, STAGE_EVENT, type DealStage } from "@/lib/constants/deal";
import { microsToNumber } from "@/lib/services/crm-client";
import { emitEvent } from "@/lib/analytics/emit";

/**
 * Verify a Twenty CRM webhook signature (HMAC-SHA256, timing-safe).
 * Returns false if signature or secret is missing/empty.
 */
export function verifyWebhook(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual requires equal-length buffers; mismatched length = invalid sig
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type Models = { Deal: import("mongoose").Model<any> };

/**
 * Handle a Twenty CRM opportunity webhook event.
 * Maps the raw stage to a DealStage, no-ops if stage unchanged or deal not found,
 * updates the deal, and emits the commercial-fact analytics event.
 */
export async function handleOpportunityEvent(
  models: Models,
  payload: any
): Promise<{ applied: boolean; event?: string }> {
  const record = payload?.record ?? {};
  const oppId: string | undefined = record.id;
  const stageRaw: string | undefined = record.stage;
  if (!oppId || !stageRaw) return { applied: false };

  const deal = await findByOpportunity(models, oppId);
  if (!deal) return { applied: false };

  const cashCollected = Boolean(record.cashCollected);

  // Cash-collected flag path (independent of stage move).
  if (cashCollected && !deal.cash_collected_at) {
    await updateDealStage(models, oppId, deal.stage as DealStage, {
      cash_collected_at: new Date(),
      crm_stage: stageRaw,
    });
    await emitEvent({
      event: "Cash Collected",
      userId: deal.contact_email,
      anonymousId: deal.anonymous_id,
      properties: buildEventProps(deal),
    });
    return { applied: true, event: "Cash Collected" };
  }

  const nextStage: DealStage | null = twentyStageToDealStage(stageRaw);
  if (!nextStage || nextStage === deal.stage) return { applied: false };

  const amount = microsToNumber(record.amount?.amountMicros);
  await updateDealStage(models, oppId, nextStage, {
    crm_stage: stageRaw,
    ...(amount != null ? { amount } : {}),
    ...(nextStage === "lost" && record.lostReason ? { lost_reason: String(record.lostReason) } : {}),
  });

  const event = STAGE_EVENT[nextStage];
  if (event) {
    await emitEvent({
      event,
      userId: deal.contact_email,
      anonymousId: deal.anonymous_id,
      properties: { ...buildEventProps({ ...deal, amount }), stage: nextStage },
    });
    return { applied: true, event };
  }
  return { applied: true };
}

function buildEventProps(deal: any): Record<string, unknown> {
  const t = deal.first_touch ?? {};
  return {
    deal_id: String(deal._id ?? ""),
    buyer_segment: deal.buyer_segment,
    amount: deal.amount,
    first_touch_channel: t.channel,
    first_touch_source: t.source,
    first_touch_campaign: t.campaign,
  };
}
