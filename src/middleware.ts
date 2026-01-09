import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT = 60;
const INTERVAL = 60 * 1000;

// CORS headers for cross-origin API requests
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID, X-Requested-With",
  "Access-Control-Max-Age": "86400", // 24 hours
};

const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

const getClientIp = (request: NextRequest) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

const isLocalhost = (request: NextRequest) => {
  const host = request.headers.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
};

/**
 * Extract tenant ID from request
 * Priority: URL path > X-Tenant-ID header > query param > env var
 */
const getTenantId = (request: NextRequest): { tenantId: string | null; rewritePath: string | null } => {
  // 1. Check URL path: /{tenant}/api/...
  const pathname = request.nextUrl.pathname;
  const pathMatch = pathname.match(/^\/([^\/]+)(\/api\/.*)$/);
  if (pathMatch) {
    const [, tenantId, remainingPath] = pathMatch;
    // Avoid matching reserved paths
    if (!['api', '_next', 'static', 'favicon.ico'].includes(tenantId)) {
      return { tenantId, rewritePath: remainingPath };
    }
  }

  // 2. Check X-Tenant-ID header
  const headerTenantId = request.headers.get("x-tenant-id");
  if (headerTenantId) return { tenantId: headerTenantId, rewritePath: null };

  // 3. Check query parameter
  const url = new URL(request.url);
  const queryTenantId = url.searchParams.get("tenant");
  if (queryTenantId) return { tenantId: queryTenantId, rewritePath: null };

  // 4. Fall back to environment variable
  return { tenantId: process.env.VINC_TENANT_ID || null, rewritePath: null };
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
  const pathname = request.nextUrl.pathname;

  // Extract tenant and check for path rewrite
  const { tenantId, rewritePath } = getTenantId(request);

  // Determine actual path (after tenant prefix removal)
  const actualPath = rewritePath || pathname;
  const isApiRoute = actualPath.startsWith("/api");
  const isB2BRoute = actualPath.startsWith("/api/b2b");
  const isImportRoute = actualPath.startsWith("/api/b2b/pim/import");

  // Handle CORS preflight (OPTIONS) requests for all API routes
  if (isApiRoute && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (isB2BRoute) {
    // For B2B routes, tenant ID is required
    if (!tenantId) {
      return NextResponse.json(
        {
          error: "Tenant ID required for B2B access",
          hint: "Use path (/{tenant}/api/...), header (X-Tenant-ID), or query (?tenant=...)"
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Inject tenant information into request headers for route handlers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-resolved-tenant-id", tenantId);
    requestHeaders.set("x-resolved-tenant-db", `vinc-${tenantId}`);

    // Rate limiting (skip for localhost and import paths)
    if (!isLocalhost(request) && !isImportRoute) {
      const ip = getClientIp(request);
      if (!consumeToken(ip)) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: corsHeaders }
        );
      }
    }

    // Rewrite URL if tenant was in path
    if (rewritePath) {
      const url = request.nextUrl.clone();
      url.pathname = rewritePath;
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders }
      });

      // Add security and CORS headers
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });

      return response;
    }

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Add security and CORS headers
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // For non-B2B routes, continue as before
  const response = NextResponse.next();

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add CORS headers for API routes
  if (isApiRoute) {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // Rate limiting (skip for localhost and import paths)
  if (!isLocalhost(request) && !isImportRoute) {
    const ip = getClientIp(request);
    if (!consumeToken(ip)) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: isApiRoute ? corsHeaders : undefined }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/:tenant/api/:path*"
  ]
};
