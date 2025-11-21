import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT = 60;
const INTERVAL = 60 * 1000;

const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp"
};

const getClientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

/**
 * Extract tenant ID from request
 * Priority: X-Tenant-ID header > query param > subdomain > env var
 */
const getTenantId = (request: NextRequest): string | null => {
  // 1. Check X-Tenant-ID header
  const headerTenantId = request.headers.get("x-tenant-id");
  if (headerTenantId) return headerTenantId;

  // 2. Check query parameter
  const url = new URL(request.url);
  const queryTenantId = url.searchParams.get("tenant");
  if (queryTenantId) return queryTenantId;

  // 3. Extract from subdomain
  const hostname = request.headers.get("host") || "";
  const hostnameWithoutPort = hostname.split(":")[0];
  const parts = hostnameWithoutPort.split(".");

  // If subdomain exists and is not 'www', use it as tenant ID
  if (parts.length >= 2 && parts[0] !== "www") {
    return parts[0];
  }

  // 4. Fall back to environment variable
  return process.env.VINC_TENANT_ID || null;
};

const consumeToken = (ip: string) => {
  const now = Date.now();
  const record = rateLimitMap.get(ip) ?? { tokens: RATE_LIMIT, lastRefill: now };
  const elapsed = now - record.lastRefill;

  if (elapsed >= INTERVAL) {
    record.tokens = RATE_LIMIT;
    record.lastRefill = now;
  }

  if (record.tokens <= 0) {
    rateLimitMap.set(ip, record);
    return false;
  }

  record.tokens -= 1;
  rateLimitMap.set(ip, record);
  return true;
};

export async function middleware(request: NextRequest) {
  // Extract tenant ID for B2B routes
  const isB2BRoute = request.nextUrl.pathname.startsWith("/api/b2b");

  if (isB2BRoute) {
    const tenantId = getTenantId(request);

    // For B2B routes, tenant ID is required
    if (!tenantId) {
      return NextResponse.json(
        {
          error: "Tenant ID required for B2B access",
          hint: "Use subdomain (e.g., tenant-id.domain.com), query param (?tenant=tenant-id), or X-Tenant-ID header"
        },
        { status: 400 }
      );
    }

    // Inject tenant information into request headers for route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-resolved-tenant-id", tenantId);
    requestHeaders.set("x-resolved-tenant-db", `vinc-${tenantId}`);

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Add security headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Rate limiting
    const ip = getClientIp(request);
    if (!consumeToken(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    return response;
  }

  // For non-B2B routes, continue as before
  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  const ip = getClientIp(request);
  if (!consumeToken(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*"]
};
