/**
 * Stripe Connect Service
 *
 * Manages Express account creation, onboarding links, status checks,
 * and dashboard access for tenant onboarding via Stripe Connect.
 *
 * Uses the platform's STRIPE_SECRET_KEY (same key used by the Stripe provider).
 */

import type Stripe from "stripe";

// Lazy-loaded Stripe SDK (platform key)
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const StripeSDK = require("stripe");
    stripe = new StripeSDK(process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2024-12-18.acacia",
    }) as Stripe;
  }
  return stripe;
}

// ============================================
// EXPRESS ACCOUNT CREATION
// ============================================

interface CreateExpressAccountOpts {
  email?: string;
  country?: string;
  business_name?: string;
}

/**
 * Creates a Stripe Express account for a tenant.
 * The tenant_id is stored in metadata for reference.
 */
export async function createExpressAccount(
  tenantId: string,
  opts?: CreateExpressAccountOpts
): Promise<Stripe.Account> {
  const client = getStripe();

  const params: Stripe.AccountCreateParams = {
    type: "express",
    metadata: { tenant_id: tenantId },
  };

  if (opts?.email) params.email = opts.email;
  if (opts?.country) params.country = opts.country;
  if (opts?.business_name) {
    params.business_profile = { name: opts.business_name };
  }

  return client.accounts.create(params);
}

// ============================================
// ACCOUNT LINK (ONBOARDING)
// ============================================

/**
 * Generates a Stripe-hosted onboarding link for an Express account.
 * Links expire after a few minutes — call refresh if expired.
 */
export async function createAccountLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string
): Promise<string> {
  const client = getStripe();

  const link = await client.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });

  return link.url;
}

// ============================================
// ACCOUNT STATUS
// ============================================

export interface ConnectAccountStatus {
  account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements_pending: number;
  current_deadline?: Date;
}

/**
 * Retrieves and normalizes the current status of a Connect Express account.
 */
export async function getAccountStatus(
  accountId: string
): Promise<ConnectAccountStatus> {
  const client = getStripe();
  const account = await client.accounts.retrieve(accountId);

  return {
    account_id: account.id,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    requirements_pending:
      account.requirements?.currently_due?.length ?? 0,
    current_deadline: account.requirements?.current_deadline
      ? new Date(account.requirements.current_deadline * 1000)
      : undefined,
  };
}

// ============================================
// LOGIN LINK (EXPRESS DASHBOARD)
// ============================================

/**
 * Generates a one-time login link to the Stripe Express dashboard.
 * Only works for accounts with charges_enabled or details_submitted.
 */
export async function createLoginLink(accountId: string): Promise<string> {
  const client = getStripe();
  const link = await client.accounts.createLoginLink(accountId);
  return link.url;
}

// ============================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================

/**
 * Verifies a Stripe Connect webhook signature using the platform webhook secret.
 * Returns the parsed event if valid, throws if invalid.
 */
export function verifyConnectWebhook(
  payload: string,
  signature: string,
  secret: string
): Stripe.Event {
  const client = getStripe();
  return client.webhooks.constructEvent(payload, signature, secret);
}
