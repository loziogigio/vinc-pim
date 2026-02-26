/**
 * Tenant Payment Config Model
 *
 * Per-tenant gateway credentials, preferences, and commission rate.
 * Collection: "tenantpaymentconfigs"
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_METHODS,
  PAYMENT_DEFAULTS,
} from "@/lib/constants/payment";

// ============================================
// INTERFACES
// ============================================

export interface IStripeConfig {
  account_id: string;
  account_status: "pending" | "active" | "restricted";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  onboarded_at?: Date;
}

export interface IMangopayConfig {
  user_id: string;
  wallet_id: string;
  bank_account_id?: string;
  kyc_level: "LIGHT" | "REGULAR";
  status: "pending" | "active" | "blocked";
  onboarded_at?: Date;
}

export interface IPayPalConfig {
  merchant_id: string;
  enabled: boolean;
}

export interface INexiConfig {
  api_key: string;
  terminal_id?: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  moto_enabled: boolean;
  recurring_enabled: boolean;
}

export interface IAxerveConfig {
  shop_login: string;
  api_key: string;
  environment: "sandbox" | "production";
  enabled: boolean;
  moto_profile: boolean;
  recurring_enabled: boolean;
}

export interface ISatispayConfig {
  key_id: string;
  enabled: boolean;
}

export interface IScalapayConfig {
  api_key: string;
  environment: "sandbox" | "production";
  enabled: boolean;
}

export interface ITenantPaymentConfig extends Document {
  tenant_id: string;
  commission_rate: number;

  providers: {
    stripe?: IStripeConfig;
    mangopay?: IMangopayConfig;
    paypal?: IPayPalConfig;
    nexi?: INexiConfig;
    axerve?: IAxerveConfig;
    satispay?: ISatispayConfig;
    scalapay?: IScalapayConfig;
  };

  default_provider?: string;
  enabled_methods: string[];

  created_at: Date;
  updated_at: Date;
}

// ============================================
// SUB-SCHEMAS
// ============================================

const StripeConfigSchema = new Schema<IStripeConfig>(
  {
    account_id: { type: String, required: true },
    account_status: {
      type: String,
      enum: ["pending", "active", "restricted"],
      default: "pending",
    },
    charges_enabled: { type: Boolean, default: false },
    payouts_enabled: { type: Boolean, default: false },
    onboarded_at: Date,
  },
  { _id: false }
);

const MangopayConfigSchema = new Schema<IMangopayConfig>(
  {
    user_id: { type: String, required: true },
    wallet_id: { type: String, required: true },
    bank_account_id: String,
    kyc_level: {
      type: String,
      enum: ["LIGHT", "REGULAR"],
      default: "LIGHT",
    },
    status: {
      type: String,
      enum: ["pending", "active", "blocked"],
      default: "pending",
    },
    onboarded_at: Date,
  },
  { _id: false }
);

const PayPalConfigSchema = new Schema<IPayPalConfig>(
  {
    merchant_id: { type: String, required: true },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const NexiConfigSchema = new Schema<INexiConfig>(
  {
    api_key: { type: String, required: true },
    terminal_id: String,
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
    },
    enabled: { type: Boolean, default: false },
    moto_enabled: { type: Boolean, default: false },
    recurring_enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const AxerveConfigSchema = new Schema<IAxerveConfig>(
  {
    shop_login: { type: String, required: true },
    api_key: { type: String, required: true },
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
    },
    enabled: { type: Boolean, default: false },
    moto_profile: { type: Boolean, default: false },
    recurring_enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const SatispayConfigSchema = new Schema<ISatispayConfig>(
  {
    key_id: { type: String, required: true },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const ScalapayConfigSchema = new Schema<IScalapayConfig>(
  {
    api_key: { type: String, required: true },
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      default: "sandbox",
    },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================

export const TenantPaymentConfigSchema = new Schema<ITenantPaymentConfig>(
  {
    tenant_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    commission_rate: {
      type: Number,
      required: true,
      default: PAYMENT_DEFAULTS.COMMISSION_RATE,
    },

    providers: {
      stripe: StripeConfigSchema,
      mangopay: MangopayConfigSchema,
      paypal: PayPalConfigSchema,
      nexi: NexiConfigSchema,
      axerve: AxerveConfigSchema,
      satispay: SatispayConfigSchema,
      scalapay: ScalapayConfigSchema,
    },

    default_provider: {
      type: String,
      enum: [...PAYMENT_PROVIDERS],
    },
    enabled_methods: {
      type: [{ type: String, enum: [...PAYMENT_METHODS] }],
      default: [],
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "tenantpaymentconfigs",
  }
);

// Default model (for standalone use)
export const TenantPaymentConfigModel =
  mongoose.models.TenantPaymentConfig ||
  mongoose.model<ITenantPaymentConfig>(
    "TenantPaymentConfig",
    TenantPaymentConfigSchema
  );
