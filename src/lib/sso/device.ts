/**
 * SSO Device Information Parser
 *
 * Parses user agent and extracts device information.
 */

import type { DeviceType } from "@/lib/db/models/sso-session";

// ============================================
// TYPES
// ============================================

export interface DeviceInfo {
  device_type: DeviceType;
  browser?: string;
  browser_version?: string;
  os?: string;
  os_version?: string;
  is_mobile: boolean;
  is_tablet: boolean;
  is_bot: boolean;
}

// ============================================
// PARSER
// ============================================

/**
 * Parse user agent string to extract device information.
 */
export function parseUserAgent(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return {
      device_type: "unknown",
      is_mobile: false,
      is_tablet: false,
      is_bot: false,
    };
  }

  const ua = userAgent.toLowerCase();

  // Check for bots
  const isBot = /bot|crawler|spider|scraper|headless/i.test(userAgent);
  if (isBot) {
    return {
      device_type: "unknown",
      browser: "Bot",
      is_mobile: false,
      is_tablet: false,
      is_bot: true,
    };
  }

  // Detect device type
  const isMobile = /mobile|android|iphone|ipod|blackberry|windows phone/i.test(userAgent) &&
    !/ipad|tablet/i.test(userAgent);
  const isTablet = /ipad|tablet|playbook|silk/i.test(userAgent) ||
    (/android/i.test(userAgent) && !/mobile/i.test(userAgent));

  let deviceType: DeviceType = "desktop";
  if (isMobile) deviceType = "mobile";
  else if (isTablet) deviceType = "tablet";

  // Detect browser
  let browser: string | undefined;
  let browserVersion: string | undefined;

  if (ua.includes("edg/")) {
    browser = "Edge";
    browserVersion = extractVersion(userAgent, /edg\/(\d+[\d.]*)/i);
  } else if (ua.includes("opr/") || ua.includes("opera")) {
    browser = "Opera";
    browserVersion = extractVersion(userAgent, /opr\/(\d+[\d.]*)/i);
  } else if (ua.includes("chrome") && !ua.includes("chromium")) {
    browser = "Chrome";
    browserVersion = extractVersion(userAgent, /chrome\/(\d+[\d.]*)/i);
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
    browserVersion = extractVersion(userAgent, /version\/(\d+[\d.]*)/i);
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
    browserVersion = extractVersion(userAgent, /firefox\/(\d+[\d.]*)/i);
  } else if (ua.includes("msie") || ua.includes("trident")) {
    browser = "Internet Explorer";
    browserVersion = extractVersion(userAgent, /(?:msie |rv:)(\d+[\d.]*)/i);
  }

  // Detect OS
  let os: string | undefined;
  let osVersion: string | undefined;

  if (ua.includes("windows")) {
    os = "Windows";
    if (ua.includes("windows nt 10")) osVersion = "10";
    else if (ua.includes("windows nt 11") || ua.includes("windows nt 10.0; win64; x64") && parseFloat(extractVersion(userAgent, /chrome\/(\d+)/i) || "0") > 100) {
      osVersion = "11";
    }
    else if (ua.includes("windows nt 6.3")) osVersion = "8.1";
    else if (ua.includes("windows nt 6.2")) osVersion = "8";
    else if (ua.includes("windows nt 6.1")) osVersion = "7";
  } else if (ua.includes("mac os x")) {
    os = "macOS";
    osVersion = extractVersion(userAgent, /mac os x (\d+[._\d]*)/i)?.replace(/_/g, ".");
  } else if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
    os = "iOS";
    osVersion = extractVersion(userAgent, /os (\d+[._\d]*)/i)?.replace(/_/g, ".");
  } else if (ua.includes("android")) {
    os = "Android";
    osVersion = extractVersion(userAgent, /android (\d+[\d.]*)/i);
  } else if (ua.includes("linux")) {
    os = "Linux";
  }

  return {
    device_type: deviceType,
    browser,
    browser_version: browserVersion,
    os,
    os_version: osVersion,
    is_mobile: isMobile,
    is_tablet: isTablet,
    is_bot: false,
  };
}

/**
 * Extract version number from user agent.
 */
function extractVersion(userAgent: string, pattern: RegExp): string | undefined {
  const match = userAgent.match(pattern);
  return match ? match[1] : undefined;
}

/**
 * Get client IP from request headers.
 */
export function getClientIP(request: Request): string {
  const headers = request.headers;

  // Check various headers (in order of trust)
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  const cfConnectingIP = headers.get("cf-connecting-ip");
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to unknown
  return "unknown";
}

/**
 * Generate a simple device fingerprint for session tracking.
 * Note: This is not meant to be cryptographically secure,
 * just to help detect session hijacking.
 */
export function generateDeviceFingerprint(
  userAgent: string,
  ip: string,
  acceptLanguage?: string
): string {
  const data = [
    userAgent || "unknown",
    ip || "unknown",
    acceptLanguage || "unknown",
  ].join("|");

  // Simple hash using built-in crypto
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}
