import { Schema } from "mongoose";
import { DEAL_STAGES } from "@/lib/constants/deal";

export interface TouchSnapshot {
  channel?: string; source?: string; medium?: string; campaign?: string;
  term?: string; content?: string; landing_page?: string;
  gclid?: string; fbclid?: string; li_fat_id?: string; referrer?: string; ts?: string;
}

export interface IDeal {
  _id?: string;
  form_submission_id: string;
  contact_name?: string; contact_email?: string; contact_company?: string; contact_phone?: string;
  buyer_segment: "b2b" | "b2c" | "ufficio" | "unsure";
  source_form: "demo" | "audit";
  page_slug: string;
  anonymous_id?: string;
  first_touch?: TouchSnapshot;
  last_touch?: TouchSnapshot;
  marketing_last?: { channel?: string; source?: string; medium?: string; campaign?: string };
  consent?: { analytics: boolean; marketing: boolean };
  stage: (typeof DEAL_STAGES)[number];
  amount?: number;
  currency: string;
  cash_collected_at?: Date;
  lost_reason?: string;
  crm_company_id?: string;
  crm_person_id?: string;
  crm_opportunity_id?: string;
  crm_stage?: string;
  created_at: Date;
  updated_at: Date;
}

const TouchSnapshotSchema = new Schema<TouchSnapshot>({
  channel: String, source: String, medium: String, campaign: String,
  term: String, content: String, landing_page: String,
  gclid: String, fbclid: String, li_fat_id: String, referrer: String, ts: String,
}, { _id: false });

export const DealSchema = new Schema(
  {
    form_submission_id: { type: String, required: true, unique: true },
    contact_name: { type: String, trim: true },
    contact_email: { type: String, trim: true, lowercase: true },
    contact_company: { type: String, trim: true },
    contact_phone: { type: String, trim: true },
    buyer_segment: { type: String, enum: ["b2b", "b2c", "ufficio", "unsure"], required: true },
    source_form: { type: String, enum: ["demo", "audit"], required: true },
    page_slug: { type: String, required: true, trim: true, lowercase: true },
    anonymous_id: { type: String },
    first_touch: { type: TouchSnapshotSchema },
    last_touch: { type: TouchSnapshotSchema },
    marketing_last: { type: new Schema({ channel: String, source: String, medium: String, campaign: String }, { _id: false }) },
    consent: { type: new Schema({ analytics: Boolean, marketing: Boolean }, { _id: false }) },
    stage: { type: String, enum: DEAL_STAGES as unknown as string[], default: "new_lead" },
    amount: { type: Number },
    currency: { type: String, default: "EUR" },
    cash_collected_at: { type: Date },
    lost_reason: { type: String },
    crm_company_id: { type: String },
    crm_person_id: { type: String },
    crm_opportunity_id: { type: String },
    crm_stage: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, collection: "deals" }
);

DealSchema.index({ crm_opportunity_id: 1 });
DealSchema.index({ stage: 1, created_at: -1 });
