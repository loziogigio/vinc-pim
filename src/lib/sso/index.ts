/**
 * SSO Module - Main Exports
 *
 * Centralized exports for SSO functionality.
 */

// Rate limiting
export {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
  applyProgressiveDelay,
  type RateLimitResult,
} from "./rate-limit";

// Token management
export {
  generateAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  createTokenPair,
  validateAccessToken,
  refreshTokens,
  revokeSessionTokens,
  revokeAllUserTokens,
  type TokenPayload,
  type TokenPair,
  type RefreshResult,
} from "./tokens";

// Device info
export {
  parseUserAgent,
  getClientIP,
  generateDeviceFingerprint,
  type DeviceInfo,
} from "./device";

// Session management
export {
  createSession,
  getSession,
  getUserSessions,
  getTenantSessions,
  updateSessionActivity,
  endSession,
  endAllUserSessions,
  validateSession,
  hasActiveSession,
  type CreateSessionInput,
  type SessionWithTokens,
} from "./session";

// OAuth flow
export {
  validateClient,
  validateClientCredentials,
  createAuthClient,
  createAuthCode,
  exchangeAuthCode,
  generateState,
  generatePKCE,
  type AuthCodePayload,
  type TokenExchangeResult,
} from "./oauth";

// Client seeding
export {
  seedOAuthClients,
  listOAuthClients,
  createCustomClient,
  deactivateClient,
  type SeedResult,
} from "./seed-clients";
