/**
 * SubscriptionPlan Model
 *
 * One record per pricing tier (e.g. Basic/Pro/Scale), channel-scoped.
 * Holds base price + billing interval(s), an included metered allowance with
 * per-unit overage, trial/sandbox config, entitlements, and checkout behavior.
 *
 * Collection: subscriptionplans (lowercase, no underscores per CLAUDE.md)
 */

import mongoose, { Schema, Document } from "mongoose";
import { nanoid } from "nanoid";
import type { MultiLangString } from "@/lib/types/pim";
import type {
  PlanStatus,
  PlanKind,
  CheckoutMode,
  BillingInterval,
  MetricAggregation,
} from "@/lib/constants/subscription";
import {
  PLAN_STATUSES,
  PLAN_KINDS,
  CHECKOUT_MODES,
  BILLING_INTERVALS,
  METRIC_AGGREGATIONS,
} from "@/lib/constants/subscription";

export interface IPlanBillingOption {
  interval: BillingInterval;
  interval_count: number;
  base_price: number;
}

export interface IPlanMetric {
  metric_key: string;
  label?: MultiLangString;
  included_quantity: number;
  overage_unit_price: number;
  hard_cap?: number | null;
  aggregation: MetricAggregation;
}

export interface ISubscriptionPlan {
  /** Unique identifier: "plan_{nanoid(10)}" */
  plan_id: string;
  tenant_id?: string;
  /** Sales-channel code (kebab-case). Default "default". */
  channel: string;
  /** Stable per-channel key, e.g. "basic" | "pro" | "scale". */
  code: string;
  name: MultiLangString;
  description?: MultiLangString;
  feature_bullets?: MultiLangString[];
  is_featured: boolean;
  public: boolean;
  sort_order: number;
  currency: string;
  billing_options: IPlanBillingOption[];
  metrics: IPlanMetric[];
  trial_days?: number | null;
  sandbox_included: boolean;
  entitlements: Record<string, string | number | boolean>;
  kind: PlanKind;
  checkout_mode: CheckoutMode;
  status: PlanStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ISubscriptionPlanDocument extends ISubscriptionPlan, Document {}

const BillingOptionSchema = new Schema<IPlanBillingOption>(
  {
    interval: { type: String, enum: BILLING_INTERVALS, required: true },
    interval_count: { type: Number, default: 1, min: 1 },
    base_price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const MetricSchema = new Schema<IPlanMetric>(
  {
    metric_key: { type: String, required: true, trim: true },
    label: { type: Schema.Types.Mixed },
    included_quantity: { type: Number, default: 0, min: 0 },
    overage_unit_price: { type: Number, default: 0, min: 0 },
    hard_cap: { type: Number, default: null },
    aggregation: { type: String, enum: METRIC_AGGREGATIONS, default: "sum" },
  },
  { _id: false }
);

const SubscriptionPlanSchema = new Schema<ISubscriptionPlanDocument>(
  {
    plan_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `plan_${nanoid(10)}`,
    },
    tenant_id: { type: String, index: true },
    channel: { type: String, required: true, trim: true, lowercase: true, default: "default" },
    code: { type: String, required: true, trim: true, lowercase: true },
    name: { type: Schema.Types.Mixed, required: true },
    description: { type: Schema.Types.Mixed },
    feature_bullets: { type: [Schema.Types.Mixed], default: [] },
    is_featured: { type: Boolean, default: false },
    public: { type: Boolean, default: false },
    sort_order: { type: Number, default: 0 },
    currency: { type: String, default: "EUR", trim: true, uppercase: true },
    billing_options: { type: [BillingOptionSchema], default: [] },
    metrics: { type: [MetricSchema], default: [] },
    trial_days: { type: Number, default: null },
    sandbox_included: { type: Boolean, default: false },
    entitlements: { type: Schema.Types.Mixed, default: () => ({}) },
    kind: { type: String, enum: PLAN_KINDS, default: "standard" },
    checkout_mode: { type: String, enum: CHECKOUT_MODES, default: "self_serve" },
    status: { type: String, enum: PLAN_STATUSES, default: "active" },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

SubscriptionPlanSchema.index({ channel: 1, code: 1 }, { unique: true });
SubscriptionPlanSchema.index({ channel: 1, status: 1, sort_order: 1 });

export { SubscriptionPlanSchema };

export const SubscriptionPlanModel =
  mongoose.models.SubscriptionPlan ||
  mongoose.model<ISubscriptionPlanDocument>("SubscriptionPlan", SubscriptionPlanSchema);
