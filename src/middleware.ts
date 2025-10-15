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
