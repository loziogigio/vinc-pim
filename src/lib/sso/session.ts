/**
 * SSO Session Service
 *
 * Manages user sessions across client applications.
 */

import crypto from "crypto";
import { getSSOSessionModel, type ISSOSessionDocument, type ClientApp, type ISSOSessionVincProfile } from "@/lib/db/models/sso-session";
import { getTenantSecurityConfigModel, DEFAULT_SECURITY_CONFIG } from "@/lib/db/models/sso-tenant-security";
import { parseUserAgent, generateDeviceFingerprint } from "./device";
import { createTokenPair, revokeSessionTokens, type TokenPair } from "./tokens";

// ============================================
// TYPES
// ============================================

export interface CreateSessionInput {
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  company_name?: string;
  // Full VINC profile to store in session
  vinc_profile?: ISSOSessionVincProfile;
  client_app: ClientApp;
  storefront_id?: string;
  ip_address: string;
  user_agent?: string;
  accept_language?: string;
}

export interface SessionWithTokens {
  session: ISSOSessionDocument;
  tokens: TokenPair;
}

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new SSO session.
 */
export async function createSession(input: CreateSessionInput): Promise<SessionWithTokens> {
  const SSOSession = await getSSOSessionModel();
  const TenantSecurityConfig = await getTenantSecurityConfigModel();

  // Get security config
  const config = await TenantSecurityConfig.findByTenantId(input.tenant_id);
  const maxSessions = config?.max_sessions_per_user || DEFAULT_SECURITY_CONFIG.max_sessions_per_user;
  const sessionTimeoutHours = config?.session_timeout_hours || DEFAULT_SECURITY_CONFIG.session_timeout_hours;

  // Check existing sessions and enforce limit
  const existingSessions = await SSOSession.findActiveSessions(input.tenant_id, input.user_id);

  if (existingSessions.length >= maxSessions) {
    // Revoke oldest sessions to make room
    const sessionsToRevoke = existingSessions.slice(maxSessions - 1);
    for (const session of sessionsToRevoke) {
      await SSOSession.revokeSession(session.session_id, "session_limit_exceeded");
      await revokeSessionTokens(session.session_id);
    }
  }

  // Parse device info
  const deviceInfo = parseUserAgent(input.user_agent || null);
  const deviceFingerprint = generateDeviceFingerprint(
    input.user_agent || "",
    input.ip_address,
    input.accept_language
  );

  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionTimeoutHours * 60 * 60 * 1000);

  // Create tokens first
  const tokens = await createTokenPair(
    input.user_id,
    input.tenant_id,
    input.user_email,
    input.user_role,
    sessionId,
    input.client_app
  );

  // Create session record
  const session = await SSOSession.create({
    session_id: sessionId,
    tenant_id: input.tenant_id,
    user_id: input.user_id,
    user_email: input.user_email,
    user_role: input.user_role,
    company_name: input.company_name,
    vinc_profile: input.vinc_profile,
    client_app: input.client_app,
    storefront_id: input.storefront_id,
    ip_address: input.ip_address,
    device_type: deviceInfo.device_type,
    browser: deviceInfo.browser,
    browser_version: deviceInfo.browser_version,
    os: deviceInfo.os,
    os_version: deviceInfo.os_version,
    user_agent: input.user_agent,
    device_fingerprint: deviceFingerprint,
    refresh_token_hash: tokens.refresh_token_hash,
    last_activity: new Date(),
    expires_at: expiresAt,
    is_active: true,
  });

  return { session, tokens };
}

/**
 * Get session by ID.
 */
export async function getSession(sessionId: string): Promise<ISSOSessionDocument | null> {
  const SSOSession = await getSSOSessionModel();
  return SSOSession.findBySessionId(sessionId);
}

/**
 * Get all active sessions for a user.
 */
export async function getUserSessions(
  tenantId: string,
  userId: string
): Promise<ISSOSessionDocument[]> {
  const SSOSession = await getSSOSessionModel();
  return SSOSession.findActiveSessions(tenantId, userId);
}

/**
 * Get all active sessions for a tenant.
 */
export async function getTenantSessions(tenantId: string): Promise<ISSOSessionDocument[]> {
  const SSOSession = await getSSOSessionModel();
  return SSOSession.findAllActiveSessions(tenantId);
}

/**
 * Update session last activity.
 */
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const SSOSession = await getSSOSessionModel();
  await SSOSession.updateLastActivity(sessionId);
}

/**
 * End a specific session.
 */
export async function endSession(sessionId: string, reason?: string): Promise<boolean> {
  const SSOSession = await getSSOSessionModel();

  const session = await SSOSession.revokeSession(sessionId, reason || "user_logout");

  if (session) {
    await revokeSessionTokens(sessionId);
    return true;
  }

  return false;
}

/**
 * End all sessions for a user.
 */
export async function endAllUserSessions(
  tenantId: string,
  userId: string,
  reason?: string
): Promise<number> {
  const SSOSession = await getSSOSessionModel();

  const count = await SSOSession.revokeAllUserSessions(tenantId, userId, reason || "full_logout");

  return count;
}

/**
 * Check if a session is valid and update last activity.
 */
export async function validateSession(sessionId: string): Promise<ISSOSessionDocument | null> {
  const session = await getSession(sessionId);

  if (session) {
    await updateSessionActivity(sessionId);
  }

  return session;
}

/**
 * Check if user has an active session (for silent SSO).
 */
export async function hasActiveSession(
  tenantId: string,
  userId: string
): Promise<ISSOSessionDocument | null> {
  const sessions = await getUserSessions(tenantId, userId);
  return sessions.length > 0 ? sessions[0] : null;
}
