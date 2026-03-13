/**
 * Tenant Pricing Config Model
 *
 * Per-tenant pricing provider credentials and preferences.
 * Collection: "tenantpricingconfigs"
 */

import mongoose, { Schema, Document } from "mongoose";
import {
  PRICING_PROVIDERS,
  PRICING_DEFAULTS,
} from "@/lib/constants/pricing-provider";

// ============================================
// INTERFACES
// ============================================

export interface ILegacyErpConfig {
  api_base_url: string;
  auth_method: "bearer" | "api_key" | "none";
  api_key?: string;
  bearer_token?: string;
  timeout_ms: number;
  enabled: boolean;
}

export interface IGenericHttpResponseMapping {
  entity_code_field: string;
  net_price_field: string;
  gross_price_field: string;
  price_field: string;
  vat_percent_field?: string;
  availability_field?: string;
  discount_field?: string;
}

export interface IGenericHttpConfig {
  api_base_url: string;
  auth_method: "bearer" | "api_key" | "basic" | "none";
  api_key?: string;
  api_secret?: string;
  bearer_token?: string;
  custom_headers?: Map<string, string>;
  endpoint: string;
  timeout_ms: number;
  response_mapping: IGenericHttpResponseMapping;
  enabled: boolean;
}

export interface ITenantPricingConfigDoc extends Document {
  tenant_id: string;
  active_provider: string;

  providers: {
    legacy_erp?: ILegacyErpConfig;
    generic_http?: IGenericHttpConfig;
  };

  cache: {
    enabled: boolean;
    ttl_seconds: number;
  };

  fallback: {
    log_errors: boolean;
    max_retries: number;
  };

  circuit_breaker: {
    failure_threshold: number;
    recovery_timeout_ms: number;
    success_threshold: number;
  };

  created_at: Date;
  updated_at: Date;
}

// ============================================
// SUB-SCHEMAS
// ============================================

const LegacyErpConfigSchema = new Schema<ILegacyErpConfig>(
  {
    api_base_url: { type: String, required: true, trim: true },
    auth_method: {
      type: String,
      enum: ["bearer", "api_key", "none"],
      default: "none",
    },
    api_key: { type: String, trim: true },
    bearer_token: { type: String, trim: true },
    timeout_ms: {
      type: Number,
      default: PRICING_DEFAULTS.TIMEOUT_MS,
    },
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

const GenericHttpResponseMappingSchema = new Schema<IGenericHttpResponseMapping>(
  {
    entity_code_field: { type: String, required: true },
    net_price_field: { type: String, required: true },
    gross_price_field: { type: String, required: true },
    price_field: { type: String, required: true },
    vat_percent_field: String,
    availability_field: String,
    discount_field: String,
  },
  { _id: false }
);

const GenericHttpConfigSchema = new Schema<IGenericHttpConfig>(
  {
    api_base_url: { type: String, required: true, trim: true },
    auth_method: {
      type: String,
      enum: ["bearer", "api_key", "basic", "none"],
      default: "none",
    },
    api_key: { type: String, trim: true },
    api_secret: { type: String, trim: true },
    bearer_token: { type: String, trim: true },
    custom_headers: {
      type: Map,
      of: String,
    },
    endpoint: { type: String, required: true, trim: true },
    timeout_ms: {
      type: Number,
      default: PRICING_DEFAULTS.TIMEOUT_MS,
    },
    response_mapping: GenericHttpResponseMappingSchema,
    enabled: { type: Boolean, default: false },
  },
  { _id: false }
);

// ============================================
// MAIN SCHEMA
// ============================================

export const TenantPricingConfigSchema = new Schema<ITenantPricingConfigDoc>(
  {
    tenant_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    active_provider: {
      type: String,
      enum: [...PRICING_PROVIDERS],
      default: "legacy_erp",
    },

    providers: {
      legacy_erp: LegacyErpConfigSchema,
      generic_http: GenericHttpConfigSchema,
    },

    cache: {
      enabled: { type: Boolean, default: false },
      ttl_seconds: {
        type: Number,
        default: PRICING_DEFAULTS.CACHE_TTL_SECONDS,
      },
    },

    fallback: {
      log_errors: { type: Boolean, default: true },
      max_retries: {
        type: Number,
        default: PRICING_DEFAULTS.MAX_RETRIES,
      },
    },

    circuit_breaker: {
      failure_threshold: {
        type: Number,
        default: PRICING_DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
      },
      recovery_timeout_ms: {
        type: Number,
        default: PRICING_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
      },
      success_threshold: {
        type: Number,
        default: PRICING_DEFAULTS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
      },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
    collection: "tenantpricingconfigs",
  }
);

// Default model (for standalone use)
export const TenantPricingConfigModel =
  mongoose.models.TenantPricingConfig ||
  mongoose.model<ITenantPricingConfigDoc>(
    "TenantPricingConfig",
    TenantPricingConfigSchema
  );
