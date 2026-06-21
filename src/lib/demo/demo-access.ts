/**
 * VINC Demo — shared access contract (single source of truth, app source).
 *
 * The demo tenant identity, public domains and the "what the lead receives"
 * access matrix. Shared by the CS API (the demo-access email sent on form
 * submit) and the provisioning / reset scripts under scripts/demo/.
 *
 * Credentials are read from the environment, NEVER hardcoded (per CLAUDE.md).
 * The demo is lead-gated, so a single shared set of credentials per surface is
 * intentional and stable (so the email + guideline page always match what was
 * provisioned).
 */

// Real tenant created in the CS admin UI (2026-06-14): id "demo-it", db/project "vinc-demo-it".
export const DEMO_TENANT_ID = "demo-it";
export const DEMO_TENANT_NAME = "VINC Demo";
export const DEMO_PROJECT_CODE = "vinc-demo-it";
export const DEMO_DB_NAME = `vinc-${DEMO_TENANT_ID}`; // vinc-demo-it

/** Marketing-site page slug whose submission triggers the demo-access email. */
export const DEMO_REQUEST_PAGE_SLUG = "richiedi-demo";

/**
 * Public-facing surfaces, all served by the EXISTING multi-tenant apps (resolved
 * by hostname). The lead-gated demo adds DNS + a Traefik route per host, not new
 * deployments. DNS for demo-b2b / demo-b2c / demo-ufficio is live (2026-06-14).
 */
export const DEMO_DOMAINS = {
  hub: "demo.vendereincloud.it", // guideline / access hub page
  b2b: "demo-b2b.vendereincloud.it", // B2B portal (existing multi-tenant vinc-b2b)
  b2c: "demo-b2c.vendereincloud.it", // B2C shop (existing multi-tenant storefront)
  ufficio: "demo-ufficio.vendereincloud.it", // Commerce Suite back-office (admin) for the demo tenant
} as const;

/** CS back-office admin — the account created in the CS admin UI for this tenant. */
export const DEMO_ADMIN_EMAIL = "demo@demo.it";

/** VINC Ufficio Digitale (the vinc-office network-commerce app) for the demo tenant, by hostname. */
export const DEMO_UFFICIO_URL = `https://${DEMO_DOMAINS.ufficio}`;

export interface DemoPasswords {
  admin: string;
  b2b: string;
  b2c: string;
}

/**
 * Read the shared demo credentials from the environment, or return null if any
 * are missing. Use this on the request path so a misconfigured environment
 * never throws mid-submission.
 */
export function getDemoPasswordsSafe(): DemoPasswords | null {
  const admin = process.env.DEMO_ADMIN_PASSWORD;
  const b2b = process.env.DEMO_B2B_PASSWORD;
  const b2c = process.env.DEMO_B2C_PASSWORD;
  if (!admin || !b2b || !b2c) return null;
  return { admin, b2b, b2c };
}

/**
 * Strict variant for provisioning scripts — throws with a clear message so we
 * never seed accounts with unknown passwords.
 */
export function requireDemoPasswords(): DemoPasswords {
  const pwds = getDemoPasswordsSafe();
  if (!pwds) {
    const missing = [
      !process.env.DEMO_ADMIN_PASSWORD && "DEMO_ADMIN_PASSWORD",
      !process.env.DEMO_B2B_PASSWORD && "DEMO_B2B_PASSWORD",
      !process.env.DEMO_B2C_PASSWORD && "DEMO_B2C_PASSWORD",
    ].filter(Boolean);
    throw new Error(
      `Missing demo credential env vars: ${missing.join(", ")}. ` +
        `Set them in .env — they back the shared demo accounts AND the welcome email / guideline page.`
    );
  }
  return pwds;
}

export interface DemoAccessEntry {
  surface: string;
  url: string;
  login: string;
  password: string;
  note?: string;
}

/**
 * Canonical "what the lead gets" access matrix. Single source of truth reused
 * by the provisioning summary, the demo-access email and the guideline page,
 * so the credentials a lead receives always match what was provisioned.
 */
export function getDemoAccess(pwds: DemoPasswords): DemoAccessEntry[] {
  return [
    {
      surface: "B2B Portal",
      url: `https://${DEMO_DOMAINS.b2b}`,
      login: "buyer1@demo.vendereincloud.it",
      password: pwds.b2b,
      note: "Also try buyer2@demo.vendereincloud.it — a different customer / price list.",
    },
    {
      surface: "B2C Shop",
      url: `https://${DEMO_DOMAINS.b2c}`,
      login: "shopper@demo.vendereincloud.it",
      password: pwds.b2c,
      note: "Browsing is open; log in to checkout.",
    },
    {
      surface: "VINC Ufficio Digitale",
      url: DEMO_UFFICIO_URL,
      login: DEMO_ADMIN_EMAIL,
      password: pwds.admin,
      note: "Network-commerce: sales network, agents & sales desk. (Login model TBD — confirm Ufficio auth.)",
    },
  ];
}
