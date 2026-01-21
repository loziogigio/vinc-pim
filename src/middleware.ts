import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// CORS headers for cross-origin API requests
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Tenant-ID, X-Requested-With, X-API-Key, X-API-Key-ID, X-API-Secret, X-Auth-Method",
  "Access-Control-Max-Age": "86400", // 24 hours
};

const securityHeaders: Record<string, string> = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
};

/**
 * Extract tenant ID from API key format: "ak_{tenant-id}_{random}"
 */
const extractTenantFromApiKey = (apiKey: string): string | null => {
  // Match pattern: ak_{tenant-id}_{random} where random is 12 hex chars
  const match = apiKey.match(/^ak_(.+)_[a-f0-9]{12}$/);
  return match ? match[1] : null;
};

/**
 * Extract tenant ID from request
 * Priority: API key > URL path > X-Tenant-ID header > query param
 * No fallback - tenant must be explicitly provided
 */
const getTenantId = (request: NextRequest): { tenantId: string | null; rewritePath: string | null; isExplicit: boolean } => {
  // 1. Check URL path: /{tenant}/api/... or /{tenant}/b2b/... or /{tenant}/b2b
  const pathname = request.nextUrl.pathname;
  // Match /{tenant}/api/... or /{tenant}/b2b/... (with trailing path)
  const pathMatch = pathname.match(/^\/([^\/]+)(\/(?:api|b2b)\/.*)$/);
  // Match /{tenant}/b2b exactly (no trailing path)
  const b2bExactMatch = pathname.match(/^\/([^\/]+)(\/b2b)$/);

  const match = pathMatch || b2bExactMatch;
  if (match) {
    const [, tenantId, remainingPath] = match;
    // Avoid matching reserved paths
    if (!['api', 'b2b', '_next', 'static', 'favicon.ico', 'super-admin', 'login'].includes(tenantId)) {
      return { tenantId, rewritePath: remainingPath, isExplicit: true };
    }
  }

  // 2. Check X-Tenant-ID header
  const headerTenantId = request.headers.get("x-tenant-id");
  if (headerTenantId) return { tenantId: headerTenantId, rewritePath: null, isExplicit: true };

  // 3. Check query parameter
  const url = new URL(request.url);
  const queryTenantId = url.searchParams.get("tenant");
  if (queryTenantId) return { tenantId: queryTenantId, rewritePath: null, isExplicit: true };

  // 4. No tenant found - return null (API key auth will be checked in route-specific logic)
  return { tenantId: null, rewritePath: null, isExplicit: false };
};

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Extract tenant and check for path rewrite
  const { tenantId, rewritePath, isExplicit } = getTenantId(request);

  // Determine actual path (after tenant prefix removal)
  const actualPath = rewritePath || pathname;
  const isApiRoute = actualPath.startsWith("/api");
  const isB2BApiRoute = actualPath.startsWith("/api/b2b");
  const isB2BPageRoute = actualPath === "/b2b" || actualPath.startsWith("/b2b/");
  const isAdminRoute = actualPath.startsWith("/api/admin");

  // Handle CORS preflight (OPTIONS) requests for all API routes
  if (isApiRoute && request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Admin routes - no tenant required (uses vinc-admin database)
  if (isAdminRoute) {
    const response = NextResponse.next();

    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // Handle B2B API routes (support both API key and session authentication)
  if (isB2BApiRoute) {
    // Check for API key authentication (used by external clients like vinc-b2b)
    // Support both header formats: x-api-key OR x-api-key-id (for sync scripts)
    const apiKey = request.headers.get("x-api-key") || request.headers.get("x-api-key-id");
    const apiSecret = request.headers.get("x-api-secret");
    const requestHeaders = new Headers(request.headers);

    // If API keys are provided, validate and inject tenant context
    if (apiKey && apiSecret) {
      // Extract tenant from API key
      const apiKeyTenantId = extractTenantFromApiKey(apiKey);
      if (!apiKeyTenantId) {
        return NextResponse.json(
          {
            error: "Invalid API key format",
            details: {
              code: "INVALID_API_KEY",
              message: "API key must be in format: ak_{tenant-id}_{suffix}"
            }
          },
          { status: 401, headers: corsHeaders }
        );
      }

      // Inject tenant headers from API key
      requestHeaders.set("x-resolved-tenant-id", apiKeyTenantId);
      requestHeaders.set("x-resolved-tenant-db", `vinc-${apiKeyTenantId}`);
      requestHeaders.set("x-auth-method", "api-key");
      requestHeaders.set("x-api-key-id", apiKey);
    } else {
      // No API keys - mark as session auth (route handler will validate session)
      requestHeaders.set("x-auth-method", "session");

      // Inject tenant headers from URL path if available
      if (tenantId) {
        requestHeaders.set("x-resolved-tenant-id", tenantId);
        requestHeaders.set("x-resolved-tenant-db", `vinc-${tenantId}`);
      }
    }

    // Rewrite URL if tenant was in path
    if (rewritePath) {
      const url = request.nextUrl.clone();
      url.pathname = rewritePath;
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders }
      });
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
    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // Handle B2B page routes
  if (isB2BPageRoute && tenantId && rewritePath) {
    // For exact /{tenant}/b2b path, let Next.js use the dynamic route
    if (rewritePath === "/b2b") {
      const response = NextResponse.next();
      Object.entries(securityHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    // For sub-paths like /{tenant}/b2b/pim, rewrite URL and inject tenant headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-resolved-tenant-id", tenantId);
    requestHeaders.set("x-resolved-tenant-db", `vinc-${tenantId}`);

    // Rewrite URL to remove tenant prefix
    const url = request.nextUrl.clone();
    url.pathname = rewritePath;
    const response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders }
    });

    Object.entries(securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // For public API routes, search routes, and ELIA routes, require API key authentication
  const isPublicApiRoute = actualPath.startsWith("/api/public");
  const isSearchRoute = actualPath.startsWith("/api/search");
  const isEliaRoute = actualPath.startsWith("/api/elia");
  if (isPublicApiRoute || isSearchRoute || isEliaRoute) {
    // Check for API key authentication
    // Support both header formats: x-api-key OR x-api-key-id (for sync scripts)
    const apiKey = request.headers.get("x-api-key") || request.headers.get("x-api-key-id");
    const apiSecret = request.headers.get("x-api-secret");

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error: "Authentication required",
          details: {
            code: "NO_API_KEY",
            message: "API key and secret are required for API routes (provide X-API-Key and X-API-Secret headers)"
          }
        },
        { status: 401, headers: corsHeaders }
      );
    }

    // Extract tenant from API key
    const apiKeyTenantId = extractTenantFromApiKey(apiKey);
    if (!apiKeyTenantId) {
      return NextResponse.json(
        {
          error: "Invalid API key format",
          details: {
            code: "INVALID_API_KEY",
            message: "API key must be in format: ak_{tenant-id}_{suffix}"
          }
        },
        { status: 401, headers: corsHeaders }
      );
    }

    // Inject tenant headers from API key
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-resolved-tenant-id", apiKeyTenantId);
    requestHeaders.set("x-resolved-tenant-db", `vinc-${apiKeyTenantId}`);
    requestHeaders.set("x-auth-method", "api-key");
    requestHeaders.set("x-api-key-id", apiKey);

    // Rewrite URL if tenant was in path
    if (rewritePath) {
      const url = request.nextUrl.clone();
      url.pathname = rewritePath;
      const response = NextResponse.rewrite(url, {
        request: { headers: requestHeaders }
      });
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

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/:tenant/api/:path*",
    "/:tenant/b2b",
    "/:tenant/b2b/:path*",
    "/b2b/:path*"
  ]
};
