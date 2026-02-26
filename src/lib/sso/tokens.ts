/**
 * SSO Token Management Service
 *
 * Handles JWT token creation, validation, and refresh.
 * Uses 'jose' library for JWT operations (edge-runtime compatible).
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { getSSOSessionModel } from "@/lib/db/models/sso-session";
import { getRefreshTokenModel } from "@/lib/db/models/sso-refresh-token";

// ============================================
// TYPES
// ============================================

export interface TokenPayload {
  sub: string; // user_id
  tenant_id: string;
  email: string;
  role: string;
  session_id: string;
  client_id: string;
  jti: string; // unique token id
  iat: number;
  exp: number;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  refresh_token_hash: string;
  token_type: "Bearer";
  expires_in: number;
}

export interface RefreshResult {
  success: boolean;
  tokens?: TokenPair;
  error?: string;
}

// ============================================
// CONFIG
// ============================================

const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || "7", 10);

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET or SESSION_SECRET env var must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Parse expiry string to seconds.
 */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "s": return value;
    case "m": return value * 60;
    case "h": return value * 60 * 60;
    case "d": return value * 60 * 60 * 24;
    default: return 900;
  }
}

const ACCESS_TOKEN_SECONDS = parseExpiry(ACCESS_TOKEN_EXPIRY);

// ============================================
// TOKEN GENERATION
// ============================================

/**
 * Generate a new access token.
 */
export async function generateAccessToken(payload: Omit<TokenPayload, "jti" | "iat" | "exp">): Promise<string> {
  const jti = crypto.randomUUID();

  const token = await new SignJWT({
    ...payload,
    jti,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_SECONDS}s`)
    .sign(getJwtSecret());

  return token;
}

/**
 * Generate a new refresh token.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString("base64url");
}

/**
 * Hash a refresh token for storage.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new token pair and store in database.
 * Note: Does NOT update the session - caller is responsible for setting refresh_token_hash.
 */
export async function createTokenPair(
  userId: string,
  tenantId: string,
  email: string,
  role: string,
  sessionId: string,
  clientId: string,
  familyId?: string
): Promise<TokenPair> {
  const RefreshToken = await getRefreshTokenModel();

  // Generate tokens
  const accessToken = await generateAccessToken({
    sub: userId,
    tenant_id: tenantId,
    email,
    role,
    session_id: sessionId,
    client_id: clientId,
  });

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  // Create token family for rotation tracking
  const tokenFamilyId = familyId || crypto.randomUUID();

  // Store refresh token
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    token_hash: refreshTokenHash,
    session_id: sessionId,
    tenant_id: tenantId,
    user_id: userId,
    client_id: clientId,
    family_id: tokenFamilyId,
    generation: 1,
    expires_at: expiresAt,
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    refresh_token_hash: refreshTokenHash,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_SECONDS,
  };
}

// ============================================
// TOKEN VALIDATION
// ============================================

/**
 * Validate an access token.
 */
export async function validateAccessToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Refresh tokens using a refresh token.
 * Implements token rotation for security.
 */
export async function refreshTokens(
  refreshToken: string,
  clientId: string
): Promise<RefreshResult> {
  const RefreshToken = await getRefreshTokenModel();
  const SSOSession = await getSSOSessionModel();

  const tokenHash = hashRefreshToken(refreshToken);

  // Find and consume the refresh token
  const storedToken = await RefreshToken.consumeToken(tokenHash);

  if (!storedToken) {
    // Token not found or already used - potential token theft
    // Try to find if this token was already used (replay attack)
    const usedToken = await RefreshToken.findOne({ token_hash: tokenHash });

    if (usedToken && usedToken.used_at) {
      // Token was already used - revoke entire family (potential theft)
      await RefreshToken.revokeTokenFamily(usedToken.family_id, "token_reuse_detected");
      await SSOSession.revokeSession(usedToken.session_id, "token_reuse_detected");

      return {
        success: false,
        error: "Token has been revoked due to suspicious activity",
      };
    }

    return {
      success: false,
      error: "Invalid or expired refresh token",
    };
  }

  // Verify client ID matches
  if (storedToken.client_id !== clientId) {
    await RefreshToken.revokeTokenFamily(storedToken.family_id, "client_mismatch");
    return {
      success: false,
      error: "Client mismatch",
    };
  }

  // Get session
  const session = await SSOSession.findBySessionId(storedToken.session_id);
  if (!session) {
    return {
      success: false,
      error: "Session not found or expired",
    };
  }

  // Generate new token pair (rotation)
  const newAccessToken = await generateAccessToken({
    sub: session.user_id,
    tenant_id: session.tenant_id,
    email: session.user_email,
    role: session.user_role,
    session_id: session.session_id,
    client_id: clientId,
  });

  const newRefreshToken = generateRefreshToken();
  const newRefreshTokenHash = hashRefreshToken(newRefreshToken);

  // Store new refresh token
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    token_hash: newRefreshTokenHash,
    session_id: session.session_id,
    tenant_id: session.tenant_id,
    user_id: session.user_id,
    client_id: clientId,
    family_id: storedToken.family_id,
    generation: storedToken.generation + 1,
    expires_at: expiresAt,
  });

  // Update session
  await SSOSession.updateOne(
    { session_id: session.session_id },
    {
      $set: {
        refresh_token_hash: newRefreshTokenHash,
        last_activity: new Date(),
      },
    }
  );

  return {
    success: true,
    tokens: {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      refresh_token_hash: newRefreshTokenHash,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_SECONDS,
    },
  };
}

// ============================================
// TOKEN REVOCATION
// ============================================

/**
 * Revoke all tokens for a session.
 */
export async function revokeSessionTokens(sessionId: string): Promise<void> {
  const RefreshToken = await getRefreshTokenModel();

  // Find the session's refresh token to get family ID
  const token = await RefreshToken.findOne({ session_id: sessionId, is_active: true });

  if (token) {
    await RefreshToken.revokeTokenFamily(token.family_id, "session_logout");
  }
}

/**
 * Revoke all tokens for a user across all sessions.
 */
export async function revokeAllUserTokens(tenantId: string, userId: string): Promise<void> {
  const RefreshToken = await getRefreshTokenModel();
  await RefreshToken.revokeUserTokens(tenantId, userId, "full_logout");
}
