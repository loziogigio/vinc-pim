/**
 * SSO Login API Tests
 *
 * Tests for the /api/auth/login endpoint.
 * Route authenticates portal users via bcrypt against MongoDB.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// MOCKS — must be before route imports
// ============================================

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn().mockReturnValue({ catch: vi.fn() });
const mockFind = vi.fn();

vi.mock("@/lib/db/connection", () => ({
  connectWithModels: vi.fn(() =>
    Promise.resolve({
      PortalUser: {
        findOne: mockFindOne,
        updateOne: mockUpdateOne,
      },
      Customer: {
        find: (...args: unknown[]) => ({
          lean: () => mockFind(...args),
        }),
      },
    })
  ),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: vi.fn().mockResolvedValue(true),
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

// ============================================
// IMPORTS — after mocks
// ============================================

import { POST } from "@/app/api/auth/login/route";
import {
  checkRateLimit,
  checkGlobalIPRateLimit,
  logLoginAttempt,
} from "@/lib/sso/rate-limit";
import { createSession } from "@/lib/sso/session";
import { createAuthCode, validateClientForTenant } from "@/lib/sso/oauth";
import { getClientIP, parseUserAgent } from "@/lib/sso/device";
import bcrypt from "bcryptjs";

// ============================================
// HELPERS
// ============================================

/** Default mock portal user */
function createMockUser(overrides?: Record<string, unknown>) {
  return {
    _id: "mongo-id-123",
    portal_user_id: "user-123",
    tenant_id: "test-tenant",
    username: "test@example.com",
    email: "test@example.com",
    password_hash: "$2a$10$hashedpassword",
    is_active: true,
    customer_access: [{ customer_id: "cust-001", address_access: "all" }],
    ...overrides,
  };
}

/** Default mock customer */
function createMockCustomer(overrides?: Record<string, unknown>) {
  return {
    customer_id: "cust-001",
    external_code: "EXT-001",
    company_name: "Test Company",
    first_name: "John",
    last_name: "Doe",
    addresses: [],
    ...overrides,
  };
}

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

/** Set up standard mocks for a successful login */
function setupSuccessfulLogin(
  userOverrides?: Record<string, unknown>,
  customerOverrides?: Record<string, unknown>
) {
  const user = createMockUser(userOverrides);
  mockFindOne.mockResolvedValue(user);
  mockFind.mockResolvedValue([createMockCustomer(customerOverrides)]);
  (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);
}

// ============================================
// TESTS
// ============================================

describe("api: SSO Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-set default mock implementations after clearing
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
    (validateClientForTenant as ReturnType<typeof vi.fn>).mockResolvedValue({ client_id: "test-client" });
    (createAuthCode as ReturnType<typeof vi.fn>).mockResolvedValue("test-auth-code");
    mockUpdateOne.mockReturnValue({ catch: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("portal user authentication", () => {
    it("should authenticate successfully via bcrypt", async () => {
      setupSuccessfulLogin();

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
      expect(data.tenant_id).toBe("test-tenant");
      expect(data.session_id).toBe("test-session-id");

      expect(mockFindOne).toHaveBeenCalled();
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password123",
        "$2a$10$hashedpassword"
      );
      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "test-tenant",
          user_id: "user-123",
          user_email: "test@example.com",
          user_role: "reseller",
        })
      );
    });

    it("should return 401 when user not found", async () => {
      mockFindOne.mockResolvedValue(null);

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

    it("should return 401 for invalid password", async () => {
      mockFindOne.mockResolvedValue(createMockUser());
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(false);

      const req = createRequest({
        email: "test@example.com",
        password: "wrongpassword",
        tenant_id: "test-tenant",
      });

      const response = await POST(req);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Invalid credentials");
    });

    it("should normalize email to lowercase", async () => {
      setupSuccessfulLogin();

      const req = createRequest({
        email: "TEST@EXAMPLE.COM",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      // The route normalizes to lowercase before querying
      expect(mockFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          username: "test@example.com",
        })
      );
    });
  });

  describe("OAuth flow", () => {
    it("should return authorization code for OAuth flow", async () => {
      setupSuccessfulLogin();

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
    it("should use customer company_name when available", async () => {
      setupSuccessfulLogin(
        undefined,
        { company_name: "Test Supplier Co" }
      );

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

    it("should fall back to customer first/last name", async () => {
      setupSuccessfulLogin(
        undefined,
        { company_name: undefined, first_name: "John", last_name: "Doe" }
      );

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

    it("should fall back to user email when no customer data", async () => {
      // No customer_access → no customers found
      mockFindOne.mockResolvedValue(createMockUser({ customer_access: [] }));
      mockFind.mockResolvedValue([]);
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const req = createRequest({
        email: "test@example.com",
        password: "password123",
        tenant_id: "test-tenant",
      });

      await POST(req);

      expect(createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: "test@example.com",
        })
      );
    });
  });
});
