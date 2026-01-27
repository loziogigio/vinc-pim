/**
 * SSO Login API Tests
 *
 * Tests for the /api/auth/login endpoint.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/auth/login/route";

// Mock modules
vi.mock("@/lib/vinc-api", () => ({
  getVincApiForTenant: vi.fn(),
  VincApiError: class VincApiError extends Error {
    constructor(public status: number, public detail: string) {
      super(detail);
      this.name = "VincApiError";
    }
  },
}));

vi.mock("@/lib/sso/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkGlobalIPRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  logLoginAttempt: vi.fn().mockResolvedValue(undefined),
  applyProgressiveDelay: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/sso/device", () => ({
  getClientIP: vi.fn().mockReturnValue("127.0.0.1"),
  parseUserAgent: vi.fn().mockReturnValue({
    device_type: "desktop",
    browser: "Chrome",
    os: "Windows",
  }),
}));

vi.mock("@/lib/sso/session", () => ({
  createSession: vi.fn().mockResolvedValue({
    session: { session_id: "test-session-id" },
    tokens: {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      token_type: "Bearer",
      expires_in: 900,
    },
  }),
}));

vi.mock("@/lib/sso/oauth", () => ({
  createAuthCode: vi.fn().mockResolvedValue("test-auth-code"),
  validateClient: vi.fn().mockResolvedValue({ client_id: "test-client" }),
  validateClientForTenant: vi.fn().mockResolvedValue({ client_id: "test-client" }),
}));

import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
} from "@/lib/sso/rate-limit";
import { createSession } from "@/lib/sso/session";
import { validateClient, validateClientForTenant, createAuthCode } from "@/lib/sso/oauth";
import { getClientIP, parseUserAgent } from "@/lib/sso/device";

describe("api: SSO Login", () => {
  const mockVincApi = {
    auth: {
      login: vi.fn(),
      getProfile: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Re-set default mock implementations after clearing
    (getVincApiForTenant as ReturnType<typeof vi.fn>).mockReturnValue(mockVincApi);
    (checkGlobalIPRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValue({ allowed: true });
    (logLoginAttempt as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (getClientIP as ReturnType<typeof vi.fn>).mockReturnValue("127.0.0.1");
    (parseUserAgent as ReturnType<typeof vi.fn>).mockReturnValue({
      device_type: "desktop",
      browser: "Chrome",
      os: "Windows",
    });
    (createSession as ReturnType<typeof vi.fn>).mockResolvedValue({
      session: { session_id: "test-session-id" },
      tokens: {
        access_token: "test-access-token",
        refresh_token: "test-refresh-token",
        token_type: "Bearer",
        expires_in: 900,
      },
    });
    (validateClient as ReturnType<typeof vi.fn>).mockResolvedValue({ client_id: "test-client" });
    (validateClientForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ client_id: "test-client" });
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue("test-auth-code");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createRequest(body: Record<string, unknown>): NextRequest {
    return new NextRequest("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Test Browser",
      },
      body: JSON.stringify(body),
    });
  }

  describe("validation", () => {
    it("should return 400 when password is missing", async () => {
      const req = createRequest({
        email: "test@example.com",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Password is required");
    });

    it("should return 400 when email and username are missing", async () => {
      const req = createRequest({
        password: "password123",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Email or username is required");
    });

    it("should return 400 when tenant_id is missing", async () => {
      const req = createRequest({
        email: "test@example.com",
        password: "password123",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Tenant ID is required");
    });

    it("should return 400 when OAuth flow missing client_id", async () => {
      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
        response_type: "code",
        redirect_uri: "http://callback.example.com",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe(
        "client_id and redirect_uri are required for OAuth flow"
      );
    });

    it("should return 400 for invalid JSON body", async () => {
      const req = new NextRequest("http://localhost:3001/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid request body");
    });
  });

  describe("rate limiting", () => {
    it("should return 429 when global IP rate limit exceeded", async () => {
      (checkGlobalIPRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        reason: "Too many requests from this IP",
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Too many requests from this IP");
    });

    it("should return 429 when user rate limit exceeded", async () => {
      (checkRateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        allowed: false,
        reason: "Account temporarily locked",
        lockout_until: "2026-01-25T12:00:00Z",
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toBe("Account temporarily locked");
      expect(data.lockout_until).toBe("2026-01-25T12:00:00Z");
      expect(logLoginAttempt).toHaveBeenCalledWith(
        "test@example.com",
        "127.0.0.1",
        "test-tenant",
        false,
        "rate_limited",
        expect.any(Object),
        undefined
      );
    });
  });

  describe("VINC API authentication", () => {
    it("should authenticate successfully via VINC API", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "vinc-access-token",
        refresh_token: "vinc-refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "reseller",
        status: "active",
        supplier_id: "supplier-456",
        supplier_name: "Test Supplier",
        customers: [],
        has_password: true,
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.access_token).toBe("test-access-token");
      expect(data.user.id).toBe("user-123");
      expect(data.user.email).toBe("test@example.com");
      expect(data.user.role).toBe("reseller");
      expect(data.user.supplier_name).toBe("Test Supplier");
      expect(data.tenant_id).toBe("test-tenant");
      expect(data.session_id).toBe("test-session-id");
      expect(data.vinc_tokens).toBeDefined();
      expect(data.vinc_tokens.access_token).toBe("vinc-access-token");

      expect(getVincApiForTenant).toHaveBeenCalledWith("test-tenant");
      expect(mockVincApi.auth.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(mockVincApi.auth.getProfile).toHaveBeenCalledWith("vinc-access-token");
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "test-tenant",
          user_id: "user-123",
          user_email: "test@example.com",
          user_role: "reseller",
        })
      );
    });

    it("should return 401 for invalid credentials", async () => {
      const { VincApiError: MockVincApiError } = await import("@/lib/vinc-api");
      mockVincApi.auth.login.mockRejectedValueOnce(
        new MockVincApiError(401, "Invalid credentials")
      );

      const req = createRequest({
        email: "test@example.com",
        password: "wrongpassword",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid credentials");
      expect(logLoginAttempt).toHaveBeenCalledWith(
        "test@example.com",
        "127.0.0.1",
        "test-tenant",
        false,
        "invalid_credentials",
        expect.any(Object),
        undefined
      );
    });

    it("should return 503 for VINC API server error", async () => {
      const { VincApiError: MockVincApiError } = await import("@/lib/vinc-api");
      mockVincApi.auth.login.mockRejectedValueOnce(
        new MockVincApiError(500, "Internal server error")
      );

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Authentication service error");
    });

    it("should normalize email to lowercase", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        role: "reseller",
        status: "active",
        customers: [],
        has_password: true,
      });

      const req = createRequest({
        email: "TEST@EXAMPLE.COM",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      expect(mockVincApi.auth.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  describe("OAuth flow", () => {
    it("should return authorization code for OAuth flow", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "vinc-access-token",
        refresh_token: "vinc-refresh-token",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "reseller",
        status: "active",
        customers: [],
        has_password: true,
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
        response_type: "code",
        client_id: "test-client",
        redirect_uri: "http://callback.example.com/auth",
        state: "random-state",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.code).toBe("test-auth-code");
      expect(data.redirect_uri).toBe("http://callback.example.com/auth");
      expect(data.state).toBe("random-state");
      expect(data.access_token).toBeUndefined();
    });
  });

  describe("company name extraction", () => {
    it("should use supplier_name when available", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        role: "reseller",
        status: "active",
        supplier_name: "Test Supplier Co",
        customers: [{ business_name: "Customer Business" }],
        has_password: true,
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "Test Supplier Co",
        })
      );
    });

    it("should fall back to customer business_name", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        role: "reseller",
        status: "active",
        customers: [{ business_name: "Customer Business" }],
        has_password: true,
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "Customer Business",
        })
      );
    });

    it("should fall back to user name", async () => {
      mockVincApi.auth.login.mockResolvedValueOnce({
        access_token: "token",
        refresh_token: "refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });

      mockVincApi.auth.getProfile.mockResolvedValueOnce({
        id: "user-123",
        email: "test@example.com",
        name: "John Doe",
        role: "reseller",
        status: "active",
        customers: [],
        has_password: true,
      });

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "John Doe",
        })
      );
    });
  });
});
