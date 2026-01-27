/**
 * VINC API Client Tests
 *
 * Unit tests for the VINC API client module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getVincApiForTenant,
  VincApiError,
} from "@/lib/vinc-api";

describe("unit: VINC API Client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      VINC_API_URL: "http://test-api.example.com",
      VINC_INTERNAL_API_KEY: "test-api-key-12345",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getVincApiForTenant", () => {
    it("should create client with string tenant ID", () => {
      const client = getVincApiForTenant("test-tenant");
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it("should create client with config object", () => {
      const client = getVincApiForTenant({
        tenantId: "test-tenant",
        vincApiUrl: "http://custom-api.example.com",
        vincApiKey: "custom-api-key",
      });
      expect(client).toBeDefined();
      expect(client.auth).toBeDefined();
    });

    it("should throw error when VINC_API_URL is missing", () => {
      delete process.env.VINC_API_URL;
      expect(() => getVincApiForTenant("test-tenant")).toThrow(
        "VINC_API_URL is required"
      );
    });

    it("should throw error when VINC_INTERNAL_API_KEY is missing", () => {
      delete process.env.VINC_INTERNAL_API_KEY;
      expect(() => getVincApiForTenant("test-tenant")).toThrow(
        "VINC_INTERNAL_API_KEY is required"
      );
    });

    it("should throw error when tenantId is missing", () => {
      expect(() => getVincApiForTenant({ tenantId: "" })).toThrow(
        "tenantId is required"
      );
    });

    it("should use custom vincApiUrl from config", () => {
      const client = getVincApiForTenant({
        tenantId: "test-tenant",
        vincApiUrl: "http://custom.example.com",
      });
      expect(client).toBeDefined();
    });

    it("should use custom vincApiKey from config", () => {
      const client = getVincApiForTenant({
        tenantId: "test-tenant",
        vincApiKey: "custom-key",
      });
      expect(client).toBeDefined();
    });
  });

  describe("VincApiError", () => {
    it("should create error with status and detail", () => {
      const error = new VincApiError(401, "Unauthorized");
      expect(error.status).toBe(401);
      expect(error.detail).toBe("Unauthorized");
      expect(error.message).toBe("Unauthorized");
      expect(error.name).toBe("VincApiError");
    });

    it("should be instance of Error", () => {
      const error = new VincApiError(500, "Server Error");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("auth methods", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      global.fetch = fetchMock;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("login", () => {
      it("should call correct endpoint with credentials", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "test-access-token",
              refresh_token: "test-refresh-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.login({
          email: "test@example.com",
          password: "password123",
        });

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/login",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "Content-Type": "application/json",
              "X-Internal-API-Key": "test-api-key-12345",
              "X-Tenant-ID": "test-tenant",
              "X-Service-Name": "vinc-commerce-suite",
            }),
            body: JSON.stringify({
              email: "test@example.com",
              password: "password123",
            }),
          })
        );

        expect(result.access_token).toBe("test-access-token");
        expect(result.refresh_token).toBe("test-refresh-token");
      });

      it("should throw VincApiError on 401 response", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: "Invalid credentials" }),
        });

        const client = getVincApiForTenant("test-tenant");

        await expect(
          client.auth.login({
            email: "test@example.com",
            password: "wrong",
          })
        ).rejects.toThrow(VincApiError);
      });

      it("should handle JSON parse error gracefully", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error("Parse error")),
        });

        const client = getVincApiForTenant("test-tenant");

        await expect(
          client.auth.login({
            email: "test@example.com",
            password: "password",
          })
        ).rejects.toThrow("HTTP 500");
      });
    });

    describe("getProfile", () => {
      it("should call correct endpoint with Bearer token", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "user-123",
              email: "test@example.com",
              name: "Test User",
              role: "reseller",
              status: "active",
              customers: [],
              has_password: true,
            }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.getProfile("access-token-123");

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/me",
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: "Bearer access-token-123",
              "X-Internal-API-Key": "test-api-key-12345",
              "X-Tenant-ID": "test-tenant",
            }),
          })
        );

        expect(result.id).toBe("user-123");
        expect(result.email).toBe("test@example.com");
        expect(result.role).toBe("reseller");
      });

      it("should throw VincApiError on unauthorized", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: "Token expired" }),
        });

        const client = getVincApiForTenant("test-tenant");

        await expect(
          client.auth.getProfile("expired-token")
        ).rejects.toThrow(VincApiError);
      });
    });

    describe("setPassword", () => {
      it("should call correct endpoint", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.setPassword("user-123", "newpassword");

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/set-password",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              user_id: "user-123",
              password: "newpassword",
            }),
          })
        );

        expect(result.success).toBe(true);
      });
    });

    describe("setPasswordByEmail", () => {
      it("should call correct endpoint", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.setPasswordByEmail(
          "test@example.com",
          "newpassword"
        );

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/set-password-by-email",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              email: "test@example.com",
              password: "newpassword",
            }),
          })
        );

        expect(result.success).toBe(true);
      });
    });

    describe("changePassword", () => {
      it("should call correct endpoint with Bearer token", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({ success: true, message: "Password changed" }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.changePassword(
          "access-token",
          "oldpass",
          "newpass"
        );

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/change-password",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer access-token",
            }),
            body: JSON.stringify({
              current_password: "oldpass",
              new_password: "newpass",
            }),
          })
        );

        expect(result.success).toBe(true);
      });

      it("should handle FastAPI validation errors", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 422,
          json: () =>
            Promise.resolve({
              detail: [{ msg: "Password too short", loc: ["body", "new_password"] }],
            }),
        });

        const client = getVincApiForTenant("test-tenant");

        await expect(
          client.auth.changePassword("token", "old", "new")
        ).rejects.toThrow("Password too short");
      });
    });

    describe("refreshToken", () => {
      it("should call correct endpoint with refresh token header", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: "new-access-token",
              refresh_token: "new-refresh-token",
              token_type: "Bearer",
              expires_in: 3600,
            }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.refreshToken("old-refresh-token");

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/refresh",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              "X-Refresh-Token": "old-refresh-token",
            }),
          })
        );

        expect(result.access_token).toBe("new-access-token");
      });
    });

    describe("logout", () => {
      it("should call correct endpoint", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.logout("access-token");

        expect(fetchMock).toHaveBeenCalledWith(
          "http://test-api.example.com/api/v1/internal/auth/logout",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              Authorization: "Bearer access-token",
            }),
          })
        );

        expect(result.success).toBe(true);
      });

      it("should return success: false on error without throwing", async () => {
        fetchMock.mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

        const client = getVincApiForTenant("test-tenant");
        const result = await client.auth.logout("token");

        expect(result.success).toBe(false);
      });
    });
  });
});
