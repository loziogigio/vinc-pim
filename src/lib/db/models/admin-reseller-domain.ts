import mongoose, { Schema, Document, Model } from "mongoose";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";

/**
 * Reseller Domain Model
 *
 * Maps custom domains to resellers for vinc-vetrina storefronts.
 * Stored in vinc-admin database for cross-tenant lookups.
 *
 * Collection: resellerdomains
 */

// ============================================
// TYPES
// ============================================

export type SubscriptionPlan = "free" | "starter" | "pro" | "enterprise";

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  "free",
  "starter",
  "pro",
  "enterprise",
];

export interface ISubscription {
  /** Current plan */
  plan: SubscriptionPlan;
  /** Plan start date */
  started_at: Date;
  /** Plan expiration (null = no expiration) */
  expires_at?: Date;
  /** Monthly/yearly billing */
  billing_cycle?: "monthly" | "yearly";
  /** External payment reference (Stripe, etc.) */
  external_subscription_id?: string;
}

export interface IResellerDomain extends Document {
  /** The custom domain hostname (unique globally) */
  hostname: string;
  /** Protocol for this domain */
  protocol: "http" | "https";

  /** Tenant IDs this domain can access (supports multi-tenant resellers) */
  tenant_ids: string[];
  /** The reseller customer ID (from tenant's customers collection) */
  customer_id: string;
  /** Primary tenant for this reseller (for billing, main catalog) */
  primary_tenant_id: string;

  /** Subscription/plan info */
  subscription: ISubscription;

  /** Domain verification status */
  is_verified: boolean;
  /** DNS verification token (for domain ownership proof) */
  verification_token?: string;
  /** When verification was completed */
  verified_at?: Date;

  /** Whether domain is active */
  is_active: boolean;

  /** Optional: Custom branding overrides */
  branding?: {
    logo_url?: string;
    favicon_url?: string;
    primary_color?: string;
    store_name?: string;
  };

  /** Timestamps */
  created_at: Date;
  updated_at: Date;
}

// ============================================
// STATIC METHODS INTERFACE
// ============================================

export interface IResellerDomainModel extends Model<IResellerDomain> {
  /**
   * Find domain by hostname
   */
  findByHostname(hostname: string): Promise<IResellerDomain | null>;

  /**
   * Find all domains for a reseller
   */
  findByReseller(
    customerId: string,
    tenantId?: string
  ): Promise<IResellerDomain[]>;

  /**
   * Check if hostname exists (for validation)
   */
  hostnameExists(hostname: string): Promise<boolean>;

  /**
   * Find domains by tenant
   */
  findByTenant(tenantId: string): Promise<IResellerDomain[]>;
}

// ============================================
// SCHEMA
// ============================================

const SubscriptionSchema = new Schema<ISubscription>(
  {
    plan: {
      type: String,
      required: true,
      enum: SUBSCRIPTION_PLANS,
      default: "free",
    },
    started_at: { type: Date, required: true, default: Date.now },
    expires_at: { type: Date },
    billing_cycle: { type: String, enum: ["monthly", "yearly"] },
    external_subscription_id: { type: String },
  },
  { _id: false }
);

const BrandingSchema = new Schema(
  {
    logo_url: { type: String },
    favicon_url: { type: String },
    primary_color: { type: String },
    store_name: { type: String },
  },
  { _id: false }
);

const ResellerDomainSchema = new Schema<IResellerDomain>(
  {
    // Domain info
    hostname: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    protocol: {
      type: String,
      enum: ["http", "https"],
      default: "https",
    },

    // Tenant & reseller association
    tenant_ids: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length > 0,
        message: "At least one tenant_id is required",
      },
    },
    customer_id: {
      type: String,
      required: true,
      index: true,
    },
    primary_tenant_id: {
      type: String,
      required: true,
      index: true,
    },

    // Subscription
    subscription: {
      type: SubscriptionSchema,
      required: true,
      default: () => ({
        plan: "free",
        started_at: new Date(),
      }),
    },

    // Verification
    is_verified: { type: Boolean, default: false },
    verification_token: { type: String },
    verified_at: { type: Date },

    // Status
    is_active: { type: Boolean, default: true, index: true },

    // Branding
    branding: { type: BrandingSchema },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// ============================================
// INDEXES
// ============================================

// Lookup by tenant
ResellerDomainSchema.index({ tenant_ids: 1 });

// Lookup by reseller within tenant
ResellerDomainSchema.index({ primary_tenant_id: 1, customer_id: 1 });

// Active domains lookup
ResellerDomainSchema.index({ is_active: 1, is_verified: 1 });

// ============================================
// STATIC METHODS
// ============================================

ResellerDomainSchema.statics.findByHostname = async function (
  hostname: string
): Promise<IResellerDomain | null> {
  return this.findOne({
    hostname: hostname.toLowerCase(),
    is_active: true,
  });
};

ResellerDomainSchema.statics.findByReseller = async function (
  customerId: string,
  tenantId?: string
): Promise<IResellerDomain[]> {
  const query: Record<string, unknown> = { customer_id: customerId };
  if (tenantId) {
    query.primary_tenant_id = tenantId;
  }
  return this.find(query).sort({ created_at: -1 });
};

ResellerDomainSchema.statics.hostnameExists = async function (
  hostname: string
): Promise<boolean> {
  const count = await this.countDocuments({
    hostname: hostname.toLowerCase(),
  });
  return count > 0;
};

ResellerDomainSchema.statics.findByTenant = async function (
  tenantId: string
): Promise<IResellerDomain[]> {
  return this.find({
    tenant_ids: tenantId,
    is_active: true,
  }).sort({ hostname: 1 });
};

// ============================================
// MODEL GETTER
// ============================================

let cachedModel: IResellerDomainModel | null = null;

/**
 * Get the ResellerDomain model (connects to vinc-admin if needed)
 */
export async function getResellerDomainModel(): Promise<IResellerDomainModel> {
  if (cachedModel) {
    return cachedModel;
  }

  const adminConnection = await connectToAdminDatabase();

  cachedModel =
    (adminConnection.models.ResellerDomain as IResellerDomainModel) ||
    adminConnection.model<IResellerDomain, IResellerDomainModel>(
      "ResellerDomain",
      ResellerDomainSchema,
      "resellerdomains"
    );

  return cachedModel;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a DNS verification token
 */
export function generateVerificationToken(): string {
  return `vinc-verify-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Check if subscription is valid (not expired)
 */
export function isSubscriptionValid(subscription: ISubscription): boolean {
  if (!subscription.expires_at) {
    return true; // No expiration = always valid
  }
  return new Date() < subscription.expires_at;
}

/**
 * Validate hostname format
 */
export function isValidHostname(hostname: string): boolean {
  // Basic hostname validation (no protocol, no path)
  const hostnameRegex =
    /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63})*\.[a-zA-Z]{2,}$/;
  return hostnameRegex.test(hostname);
}
