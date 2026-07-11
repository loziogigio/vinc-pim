/**
 * VINC Demo — seed configuration (Phase A).
 *
 * The tenant identity, public domains, env-credential readers and the access
 * matrix are the single source of truth in `src/lib/demo/demo-access.ts` (so
 * the CS API and these scripts agree). This file adds the SEED-ONLY definitions
 * (sales channels, demo customers, portal users, B2C storefront) used by
 * provision-demo-tenant.ts and reset-demo-tenant.ts, and re-exports the shared
 * contract for convenience.
 */

export {
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_PROJECT_CODE,
  DEMO_DB_NAME,
  DEMO_DOMAINS,
  DEMO_ADMIN_EMAIL,
  DEMO_REQUEST_PAGE_SLUG,
  requireDemoPasswords,
  getDemoPasswordsSafe,
  getDemoAccess,
  type DemoPasswords,
  type DemoAccessEntry,
} from "../../src/lib/demo/demo-access.js";

/** Sales channels (createTenant does NOT create these). */
export const DEMO_SALES_CHANNELS = [
  { code: "b2b", name: "B2B Wholesale", is_default: true, color: "#2563eb" },
  { code: "b2c", name: "B2C Shop", is_default: false, color: "#16a34a" },
] as const;

export interface DemoCustomer {
  customer_id: string;
  external_code: string;
  company_name: string;
  customer_type: "business" | "private";
  channel: "b2b" | "b2c";
  email: string;
  vat?: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  discount_tag?: "premium" | "standard";
}

/** Demo customers — drive B2B login context, addresses and (future) price lists. */
export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    customer_id: "CUST-DEMO-01",
    external_code: "DEMO-C01",
    company_name: "Rossi Forniture S.r.l.",
    customer_type: "business",
    channel: "b2b",
    email: "buyer1@demo.vendereincloud.it",
    vat: "IT01234567890",
    street: "Via Roma 10",
    city: "Milano",
    province: "MI",
    postal_code: "20100",
    discount_tag: "premium",
  },
  {
    customer_id: "CUST-DEMO-02",
    external_code: "DEMO-C02",
    company_name: "Bianchi Distribuzione S.p.A.",
    customer_type: "business",
    channel: "b2b",
    email: "buyer2@demo.vendereincloud.it",
    vat: "IT09876543210",
    street: "Corso Italia 5",
    city: "Torino",
    province: "TO",
    postal_code: "10100",
    discount_tag: "standard",
  },
  {
    customer_id: "CUST-DEMO-03",
    external_code: "DEMO-C03",
    company_name: "Mario Verdi",
    customer_type: "private",
    channel: "b2c",
    email: "shopper@demo.vendereincloud.it",
    street: "Via Verdi 22",
    city: "Bologna",
    province: "BO",
    postal_code: "40100",
  },
];

export interface DemoPortalUser {
  username: string;
  email: string;
  channel: "b2b" | "b2c";
  customer_id: string;
  passwordKey: "admin" | "b2b" | "b2c";
  label: string;
}

/** Portal users — log in to the B2B portal / B2C shop (validated by CS SSO). */
export const DEMO_PORTAL_USERS: DemoPortalUser[] = [
  // username MUST equal the login email: CS SSO (api/auth/login) matches the
  // typed identifier against the `username` field only (no email fallback).
  {
    username: "buyer1@demo.vendereincloud.it",
    email: "buyer1@demo.vendereincloud.it",
    channel: "b2b",
    customer_id: "CUST-DEMO-01",
    passwordKey: "b2b",
    label: "B2B buyer — Rossi Forniture",
  },
  {
    username: "buyer2@demo.vendereincloud.it",
    email: "buyer2@demo.vendereincloud.it",
    channel: "b2b",
    customer_id: "CUST-DEMO-02",
    passwordKey: "b2b",
    label: "B2B buyer — Bianchi Distribuzione",
  },
  {
    username: "shopper@demo.vendereincloud.it",
    email: "shopper@demo.vendereincloud.it",
    channel: "b2c",
    customer_id: "CUST-DEMO-03",
    passwordKey: "b2c",
    label: "B2C shopper",
  },
];

/** B2C storefront record (one per channel). */
export const DEMO_STOREFRONT = {
  name: "VINC Demo Shop",
  slug: "demo-shop",
  channel: "b2c",
  domains: [{ domain: "demo-b2c.vendereincloud.it", is_primary: true }],
  branding: {
    title: "VINC Demo Shop",
    primary_color: "#16a34a",
    secondary_color: "#0ea5e9",
  },
} as const;
