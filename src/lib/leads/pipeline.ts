import { createDealFromLead, attachCrmIds, type LeadAttribution } from "@/lib/services/deal.service";
import { TwentyClient, type TwentyConfig } from "@/lib/services/crm-client";
import { buildLeadContext, type LeadContext } from "@/lib/leads/lead-context";

export async function processLead(args: {
  models: { Deal: import("mongoose").Model<any> };
  twentyCfg?: TwentyConfig;
  form_submission_id: string;
  contact: { name?: string; email?: string; company?: string; phone?: string };
  buyer_segment: "b2b" | "b2c" | "ufficio" | "unsure";
  source_form: "demo" | "audit";
  page_slug: string;
  attribution?: LeadAttribution;
}): Promise<{ crm_opportunity_id?: string; leadContext: LeadContext }> {
  const deal = await createDealFromLead(args.models, {
    form_submission_id: args.form_submission_id,
    contact: args.contact,
    buyer_segment: args.buyer_segment,
    source_form: args.source_form,
    page_slug: args.page_slug,
    attribution: args.attribution,
  });

  let crm_opportunity_id = deal.crm_opportunity_id;
  if (args.twentyCfg?.apiKey && !crm_opportunity_id) {
    try {
      const t = new TwentyClient(args.twentyCfg);
      const company = await t.findOrCreateCompany({ name: args.contact.company });
      const person = await t.findOrCreatePerson({
        email: args.contact.email,
        name: args.contact.name,
        phone: args.contact.phone,
        companyId: company.id,
      });
      const opp = await t.createOpportunity({
        name: `${args.contact.company || args.contact.name || args.contact.email || "Lead"} — ${args.buyer_segment}`,
        stage: "NEW_LEAD",
        companyId: company.id,
        pointOfContactId: person.id,
      });
      crm_opportunity_id = opp.id;
      await attachCrmIds(args.models, String(deal._id), {
        company_id: company.id,
        person_id: person.id,
        opportunity_id: opp.id,
        stage: "New Lead",
      });
    } catch (err) {
      console.warn("[pipeline] Twenty upsert failed (non-fatal):", err);
    }
  }

  const leadContext = buildLeadContext({
    buyer_segment: args.buyer_segment,
    crm_opportunity_id,
    attribution: args.attribution,
  });
  return { crm_opportunity_id, leadContext };
}
