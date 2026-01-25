/**
 * SSO Rate Limiting Service
 *
 * Handles rate limiting and progressive delays for login attempts.
 */

import { getLoginAttemptModel } from "@/lib/db/models/sso-login-attempt";
import { getBlockedIPModel } from "@/lib/db/models/sso-blocked-ip";
import { getTenantSecurityConfigModel, DEFAULT_SECURITY_CONFIG } from "@/lib/db/models/sso-tenant-security";

// ============================================
// TYPES
// ============================================

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  delay_ms?: number;
  attempts_remaining?: number;
  lockout_until?: Date;
}

// ============================================
// RATE LIMIT CHECKS
// ============================================

/**
 * Check if a login attempt is allowed based on rate limits.
 */
export async function checkRateLimit(
  email: string,
  ip: string,
  tenantId?: string
): Promise<RateLimitResult> {
  const BlockedIP = await getBlockedIPModel();
  const LoginAttempt = await getLoginAttemptModel();

  // 1. Check IP block (global and tenant-specific)
  const isBlocked = await BlockedIP.isIPBlocked(ip, tenantId);
  if (isBlocked) {
    return {
      allowed: false,
      reason: "IP address is blocked",
    };
  }

  // 2. Get tenant security config (or defaults)
  let config = DEFAULT_SECURITY_CONFIG;
  if (tenantId) {
    const TenantSecurityConfig = await getTenantSecurityConfigModel();
    const tenantConfig = await TenantSecurityConfig.findByTenantId(tenantId);
    if (tenantConfig) {
      config = {
        max_sessions_per_user: tenantConfig.max_sessions_per_user,
        session_timeout_hours: tenantConfig.session_timeout_hours,
        max_login_attempts: tenantConfig.max_login_attempts,
        lockout_minutes: tenantConfig.lockout_minutes,
        enable_progressive_delay: tenantConfig.enable_progressive_delay,
        require_strong_password: tenantConfig.require_strong_password,
        notify_on_new_device: tenantConfig.notify_on_new_device,
        notify_on_suspicious_login: tenantConfig.notify_on_suspicious_login,
        notify_on_password_change: tenantConfig.notify_on_password_change,
      };
    }
  }

  // 3. Count recent failed attempts
  const { failed } = await LoginAttempt.countRecentAttempts(
    email,
    ip,
    tenantId,
    config.lockout_minutes
  );

  // 4. Check if locked out
  if (failed >= config.max_login_attempts) {
    const lockoutUntil = new Date(Date.now() + config.lockout_minutes * 60 * 1000);
    return {
      allowed: false,
      reason: `Too many failed attempts. Try again in ${config.lockout_minutes} minutes.`,
      lockout_until: lockoutUntil,
      attempts_remaining: 0,
    };
  }

  // 5. Calculate progressive delay
  let delayMs = 0;
  if (config.enable_progressive_delay && failed > 0) {
    // Exponential backoff: 0, 1s, 2s, 4s, 8s, 16s...
    delayMs = Math.min(Math.pow(2, failed - 1) * 1000, 30000);
  }

  return {
    allowed: true,
    delay_ms: delayMs,
    attempts_remaining: config.max_login_attempts - failed,
  };
}

/**
 * Check global IP rate limit (for DDoS protection).
 */
export async function checkGlobalIPRateLimit(ip: string): Promise<RateLimitResult> {
  const LoginAttempt = await getLoginAttemptModel();

  // Max 100 failed attempts per IP per hour globally
  const MAX_GLOBAL_ATTEMPTS = 100;
  const WINDOW_MINUTES = 60;

  const count = await LoginAttempt.countRecentIPAttempts(ip, WINDOW_MINUTES);

  if (count >= MAX_GLOBAL_ATTEMPTS) {
    // Auto-block this IP
    const BlockedIP = await getBlockedIPModel();
    await BlockedIP.blockIP({
      ip_address: ip,
      is_global: true,
      reason: "rate_limit_exceeded",
      description: `Exceeded ${MAX_GLOBAL_ATTEMPTS} failed attempts in ${WINDOW_MINUTES} minutes`,
      attempt_count: count,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour block
    });

    return {
      allowed: false,
      reason: "Too many requests from this IP address",
    };
  }

  return { allowed: true };
}

// ============================================
// LOGGING
// ============================================

/**
 * Log a login attempt.
 */
export async function logLoginAttempt(
  email: string,
  ip: string,
  tenantId: string | undefined,
  success: boolean,
  failureReason?: string,
  deviceInfo?: {
    device_type?: string;
    browser?: string;
    browser_version?: string;
    os?: string;
    user_agent?: string;
    country?: string;
    city?: string;
  },
  clientId?: string
): Promise<void> {
  const LoginAttempt = await getLoginAttemptModel();

  await LoginAttempt.create({
    tenant_id: tenantId,
    email: email.toLowerCase(),
    ip_address: ip,
    success,
    failure_reason: success ? undefined : (failureReason as import("@/lib/db/models/sso-login-attempt").FailureReason),
    ...deviceInfo,
    client_id: clientId,
    timestamp: new Date(),
  });
}

/**
 * Apply progressive delay if needed.
 */
export async function applyProgressiveDelay(delayMs: number): Promise<void> {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
