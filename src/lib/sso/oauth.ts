/**
 * SSO OAuth Service
 *
 * Handles OAuth authorization code flow for SSO.
 */

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { getAuthClientModel, type IAuthClientDocument } from "@/lib/db/models/sso-auth-client";
import { getAuthCodeModel, type IAuthCodeDocument, type IAuthCodeVincProfile } from "@/lib/db/models/sso-auth-code";
import { getTenantModel } from "@/lib/db/models/admin-tenant";
import { getHomeSettings } from "@/lib/db/home-settings";

// ============================================
// TYPES
// ============================================

export interface AuthCodePayload {
  client_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  redirect_uri: string;
  state?: string;
  scope?: string;
  code_challenge?: string;
  code_challenge_method?: "plain" | "S256";
  // Full VINC profile to pass through OAuth flow
  vinc_profile?: IAuthCodeVincProfile;
}

export interface TokenExchangeResult {
  success: boolean;
  data?: {
    user_id: string;
    user_email: string;
    user_role: string;
    tenant_id: string;
    client_id: string;
    vinc_profile?: IAuthCodeVincProfile;
  };
  error?: string;
}

// ============================================
// CLIENT MANAGEMENT
// ============================================

/**
 * Validate a client ID and redirect URI.
 * @deprecated Use validateClientForTenant for tenant-aware validation
 */
export async function validateClient(
  clientId: string,
  redirectUri: string
): Promise<IAuthClientDocument | null> {
  const AuthClient = await getAuthClientModel();

  const client = await AuthClient.findByClientId(clientId);
  if (!client) return null;

  // Validate redirect URI is registered
  if (!client.redirect_uris.includes(redirectUri)) {
    return null;
  }

  return client;
}

/**
 * Validate redirect URI against tenant configuration.
 *
 * Checks if the redirect URI's origin matches:
 * 1. Localhost (always allowed for development)
 * 2. Tenant's configured domains (from superadmin)
 * 3. Tenant's branding URLs (shopUrl, websiteUrl from home-settings)
 */
export async function validateRedirectUriForTenant(
  redirectUri: string,
  tenantId: string
): Promise<boolean> {
  try {
    const redirectUrl = new URL(redirectUri);
    const redirectOrigin = redirectUrl.origin;

    // 1. Allow localhost for development
    if (redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1") {
      return true;
    }

    // 2. Check tenant domains from AdminTenant
    const TenantModel = await getTenantModel();
    const tenant = await TenantModel.findByTenantId(tenantId);

    if (tenant?.domains?.length) {
      for (const domain of tenant.domains) {
        if (domain.is_active === false) continue;
        const domainOrigin = `${domain.protocol || "https"}://${domain.hostname}`;
        if (redirectOrigin === domainOrigin) {
          return true;
        }
      }
    }

    // 3. Check branding URLs from home-settings
    const tenantDb = `vinc-${tenantId}`;
    const homeSettings = await getHomeSettings(tenantDb);

    const brandingUrls: string[] = [];
    if (homeSettings?.branding?.shopUrl) {
      brandingUrls.push(homeSettings.branding.shopUrl);
    }
    if (homeSettings?.branding?.websiteUrl) {
      brandingUrls.push(homeSettings.branding.websiteUrl);
    }

    for (const url of brandingUrls) {
      try {
        const brandingOrigin = new URL(url).origin;
        if (redirectOrigin === brandingOrigin) {
          return true;
        }
      } catch {
        // Invalid URL, skip
        continue;
      }
    }

    return false;
  } catch (error) {
    console.error("Error validating redirect URI:", error);
    return false;
  }
}

// Track if we've attempted auto-seeding this session
let autoSeedAttempted = false;

/**
 * Validate client ID and redirect URI with tenant-specific validation.
 *
 * The redirect URI is validated against:
 * - Localhost (development)
 * - Tenant's configured domains
 * - Tenant's branding URLs (shopUrl, websiteUrl)
 *
 * Auto-seeds OAuth clients if none exist.
 */
export async function validateClientForTenant(
  clientId: string,
  redirectUri: string,
  tenantId: string
): Promise<IAuthClientDocument | null> {
  const AuthClient = await getAuthClientModel();

  // Check if client exists
  let client = await AuthClient.findByClientId(clientId);

  // Auto-seed if client not found and we haven't tried yet
  if (!client && !autoSeedAttempted) {
    autoSeedAttempted = true;
    const clientCount = await AuthClient.countDocuments();
    if (clientCount === 0) {
      console.log("[OAuth] No clients found, auto-seeding default clients...");
      const { seedOAuthClients } = await import("./seed-clients");
      await seedOAuthClients();
      // Try finding client again after seeding
      client = await AuthClient.findByClientId(clientId);
    }
  }

  if (!client) return null;

  // Validate redirect URI against tenant configuration
  const isValidUri = await validateRedirectUriForTenant(redirectUri, tenantId);
  if (!isValidUri) return null;

  return client;
}

/**
 * Validate client credentials (for token endpoint).
 */
export async function validateClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<IAuthClientDocument | null> {
  const AuthClient = await getAuthClientModel();

  const client = await AuthClient.findByClientId(clientId);
  if (!client) return null;

  // Verify secret
  const isValid = await bcrypt.compare(clientSecret, client.client_secret_hash);
  if (!isValid) return null;

  return client;
}

/**
 * Create a new auth client (admin function).
 */
export async function createAuthClient(
  clientId: string,
  name: string,
  redirectUris: string[],
  options?: {
    type?: "web" | "mobile" | "api";
    allowedOrigins?: string[];
    logoUrl?: string;
    description?: string;
    isFirstParty?: boolean;
  }
): Promise<{ client: IAuthClientDocument; clientSecret: string }> {
  const AuthClient = await getAuthClientModel();

  // Generate client secret
  const clientSecret = crypto.randomBytes(32).toString("base64url");
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  const client = await AuthClient.create({
    client_id: clientId,
    client_secret_hash: clientSecretHash,
    name,
    type: options?.type || "web",
    redirect_uris: redirectUris,
    allowed_origins: options?.allowedOrigins,
    logo_url: options?.logoUrl,
    description: options?.description,
    is_first_party: options?.isFirstParty || false,
    is_active: true,
  });

  return { client, clientSecret };
}

// ============================================
// AUTHORIZATION CODE
// ============================================

/**
 * Generate an authorization code.
 */
export async function createAuthCode(payload: AuthCodePayload): Promise<string> {
  const AuthCode = await getAuthCodeModel();

  const code = crypto.randomBytes(32).toString("base64url");

  await AuthCode.create({
    code,
    client_id: payload.client_id,
    tenant_id: payload.tenant_id,
    user_id: payload.user_id,
    user_email: payload.user_email,
    user_role: payload.user_role,
    redirect_uri: payload.redirect_uri,
    state: payload.state,
    scope: payload.scope,
    code_challenge: payload.code_challenge,
    code_challenge_method: payload.code_challenge_method,
    vinc_profile: payload.vinc_profile,
    expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });

  return code;
}

/**
 * Exchange authorization code for tokens.
 */
export async function exchangeAuthCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TokenExchangeResult> {
  const AuthCode = await getAuthCodeModel();

  // Find and consume the code
  const authCode = await AuthCode.consumeCode(code);

  if (!authCode) {
    return {
      success: false,
      error: "Invalid or expired authorization code",
    };
  }

  // Verify client ID
  if (authCode.client_id !== clientId) {
    return {
      success: false,
      error: "Client ID mismatch",
    };
  }

  // Verify redirect URI
  if (authCode.redirect_uri !== redirectUri) {
    return {
      success: false,
      error: "Redirect URI mismatch",
    };
  }

  // Verify PKCE if used
  if (authCode.code_challenge) {
    if (!codeVerifier) {
      return {
        success: false,
        error: "Code verifier required",
      };
    }

    const isValid = verifyCodeChallenge(
      codeVerifier,
      authCode.code_challenge,
      authCode.code_challenge_method || "plain"
    );

    if (!isValid) {
      return {
        success: false,
        error: "Invalid code verifier",
      };
    }
  }

  return {
    success: true,
    data: {
      user_id: authCode.user_id,
      user_email: authCode.user_email,
      user_role: authCode.user_role,
      tenant_id: authCode.tenant_id,
      client_id: authCode.client_id,
      vinc_profile: authCode.vinc_profile,
    },
  };
}

/**
 * Verify PKCE code challenge.
 */
function verifyCodeChallenge(
  verifier: string,
  challenge: string,
  method: "plain" | "S256"
): boolean {
  if (method === "plain") {
    return verifier === challenge;
  }

  // S256: base64url(sha256(verifier))
  const hash = crypto.createHash("sha256").update(verifier).digest();
  const computed = hash.toString("base64url");

  return computed === challenge;
}

/**
 * Generate state parameter for OAuth flow.
 */
export function generateState(): string {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Generate PKCE code verifier and challenge.
 */
export function generatePKCE(): { verifier: string; challenge: string; method: "S256" } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(verifier).digest();
  const challenge = hash.toString("base64url");

  return { verifier, challenge, method: "S256" };
}
