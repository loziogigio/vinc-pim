import type { IDeal, TouchSnapshot } from "@/lib/db/models/deal";
import type { DealStage } from "@/lib/constants/deal";

export interface LeadAttribution {
  anonymous_id?: string;
  buyer_segment: IDeal["buyer_segment"];
  marketing?: { channel?: string; campaign?: string; source?: string; medium?: string };
  first?: TouchSnapshot;
  last?: TouchSnapshot;
  consent?: { analytics: boolean; marketing: boolean };
}

export interface CreateDealInput {
  form_submission_id: string;
  contact: { name?: string; email?: string; company?: string; phone?: string };
  buyer_segment: IDeal["buyer_segment"];
  source_form: IDeal["source_form"];
  page_slug: string;
  attribution?: LeadAttribution;
}

type Models = { Deal: import("mongoose").Model<IDeal> };

export async function createDealFromLead(models: Models, input: CreateDealInput): Promise<IDeal> {
  const existing = await models.Deal.findOne({ form_submission_id: input.form_submission_id });
  if (existing) return existing.toObject() as IDeal;
  const a = input.attribution;
  const created = await models.Deal.create({
    form_submission_id: input.form_submission_id,
    contact_name: input.contact.name,
    contact_email: input.contact.email,
    contact_company: input.contact.company,
    contact_phone: input.contact.phone,
    buyer_segment: input.buyer_segment,
    source_form: input.source_form,
    page_slug: input.page_slug,
    anonymous_id: a?.anonymous_id,
    first_touch: a?.first,
    last_touch: a?.last,
    marketing_last: a?.marketing,
    consent: a?.consent,
  });
  return created.toObject() as IDeal;
}

export async function findByOpportunity(models: Models, crm_opportunity_id: string): Promise<IDeal | null> {
  const d = await models.Deal.findOne({ crm_opportunity_id });
  return d ? (d.toObject() as IDeal) : null;
}

export async function attachCrmIds(
  models: Models,
  dealId: string,
  ids: { company_id?: string; person_id?: string; opportunity_id?: string; stage?: string }
): Promise<void> {
  await models.Deal.updateOne({ _id: dealId }, {
    $set: {
      crm_company_id: ids.company_id,
      crm_person_id: ids.person_id,
      crm_opportunity_id: ids.opportunity_id,
      crm_stage: ids.stage,
    },
  });
}

export async function updateDealStage(
  models: Models,
  crm_opportunity_id: string,
  stage: DealStage,
  patch?: { amount?: number; currency?: string; lost_reason?: string; crm_stage?: string; cash_collected_at?: Date }
): Promise<IDeal | null> {
  const d = await models.Deal.findOneAndUpdate(
    { crm_opportunity_id },
    { $set: { stage, ...(patch ?? {}) } },
    { new: true }
  );
  return d ? (d.toObject() as IDeal) : null;
}
