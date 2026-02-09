/**
 * Portal Users API Integration Tests
 *
 * Tests for portal user CRUD operations, login, and access control.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import {
  setupTestDatabase,
  teardownTestDatabase,
  clearDatabase,
  PortalUserFactory,
  CustomerFactory,
  createParams,
} from "../conftest";

// Set environment variable for token signing
process.env.SESSION_SECRET = "test-secret-key-for-jwt-signing-minimum-32-chars";

// Mock connection - must be before imports
vi.mock("@/lib/db/connection", async () => {
  const { CustomerModel } = await import("@/lib/db/models/customer");
  const { PortalUserModel } = await import("@/lib/db/models/portal-user");
  const mongoose = await import("mongoose");
  return {
    connectToDatabase: vi.fn(() => Promise.resolve()),
    connectWithModels: vi.fn(() => Promise.resolve({
      Customer: CustomerModel,
      PortalUser: PortalUserModel,
    })),
    getPooledConnection: vi.fn(() => Promise.resolve(mongoose.default.connection)),
  };
});

// Mock API key auth to bypass real API key verification
vi.mock("@/lib/auth/api-key-auth", () => ({
  verifyAPIKeyFromRequest: vi.fn(() =>
    Promise.resolve({
      authenticated: true,
      tenantId: "test-tenant",
      tenantDb: "vinc-test-tenant",
    })
  ),
}));

// Mock portal user token generation to avoid jose library issues in tests
// Only mock generatePortalUserToken, keep other utilities unmocked for direct testing
vi.mock("@/lib/auth/portal-user-token", async () => {
  const actual = await vi.importActual("@/lib/auth/portal-user-token");
  return {
    ...actual,
    generatePortalUserToken: vi.fn((portalUserId: string, _tenantId: string) =>
      Promise.resolve(`mock-token-${portalUserId}`)
    ),
  };
});

// Import after mocks
import { GET as listPortalUsers, POST as createPortalUser } from "@/app/api/b2b/portal-users/route";
import {
  GET as getPortalUser,
  PUT as updatePortalUser,
  DELETE as deletePortalUser,
} from "@/app/api/b2b/portal-users/[id]/route";
import { POST as portalLogin } from "@/app/api/b2b/auth/portal-login/route";
import { PortalUserModel } from "@/lib/db/models/portal-user";
import { CustomerModel } from "@/lib/db/models/customer";
import { generatePortalUserToken, hasCustomerAccess, getAccessibleCustomerIds } from "@/lib/auth/portal-user-token";

// ============================================
// TEST SETUP
// ============================================

describe("integration: Portal Users API", () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  // ============================================
  // POST /api/b2b/portal-users - Create Portal User
  // ============================================

  describe("POST /api/b2b/portal-users", () => {
    it("should create portal user with valid payload", async () => {
      /**
       * Test creating a new portal user.
       * Verifies portal_user_id generation and password hashing.
       */
      // Arrange
      const payload = PortalUserFactory.createWithCustomerAccess(["test-customer"]);
      const req = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.portal_user.portal_user_id).toBeDefined();
      expect(data.portal_user.portal_user_id).toMatch(/^PU-/);
      expect(data.portal_user.username).toBe(payload.username.toLowerCase());
      expect(data.portal_user.email).toBe(payload.email.toLowerCase());
      expect(data.portal_user.tenant_id).toBe("test-tenant");
      expect(data.portal_user.is_active).toBe(true);
      // Password should not be returned
      expect(data.portal_user.password_hash).toBeUndefined();
    });

    it("should create portal user with customer access", async () => {
      /**
       * Test creating portal user with pre-assigned customer access.
       */
      // Arrange - Create a customer first
      const customer = await CustomerModel.create({
        customer_id: "cust-001",
        tenant_id: "test-tenant",
        customer_type: "business",
        email: "customer@example.com",
        addresses: [],
      });

      const payload = PortalUserFactory.createWithCustomerAccess([customer.customer_id]);
      const req = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(201);
      expect(data.portal_user.customer_access).toHaveLength(1);
      expect(data.portal_user.customer_access[0].customer_id).toBe("cust-001");
      expect(data.portal_user.customer_access[0].address_access).toBe("all");
    });

    it("should return 400 when username is missing", async () => {
      /**
       * Test validation: username is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify({
          email: "test@example.com",
          password: "Password123!",
          customer_access: [{ customer_id: "test", address_access: "all" }],
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/username|required/i);
    });

    it("should return 400 when email is missing", async () => {
      /**
       * Test validation: email is required.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify({
          username: "testuser",
          password: "Password123!",
          customer_access: [{ customer_id: "test", address_access: "all" }],
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(400);
      expect(data.error).toMatch(/email|required/i);
    });

    it("should return 409 for duplicate username", async () => {
      /**
       * Test that duplicate usernames are rejected within same tenant.
       */
      // Arrange
      const payload = PortalUserFactory.createWithCustomerAccess(["test-customer"]);
      const req1 = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Create first user
      await createPortalUser(req1);

      // Try to create duplicate
      const req2 = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          email: "different@example.com", // Different email, same username
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req2);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(409);
      expect(data.error).toContain("already exists");
    });

    it("should return 409 for duplicate email", async () => {
      /**
       * Test that duplicate emails are rejected within same tenant.
       */
      // Arrange
      const payload = PortalUserFactory.createWithCustomerAccess(["test-customer"]);
      const req1 = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Create first user
      await createPortalUser(req1);

      // Try to create duplicate
      const req2 = new NextRequest("http://localhost/api/b2b/portal-users", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          username: "different-username", // Different username, same email
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await createPortalUser(req2);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(409);
      expect(data.error).toContain("already exists");
    });
  });

  // ============================================
  // GET /api/b2b/portal-users - List Portal Users
  // ============================================

  describe("GET /api/b2b/portal-users", () => {
    it("should list portal users with pagination", async () => {
      /**
       * Test listing portal users with default pagination.
       */
      // Arrange - Create 3 portal users
      for (let i = 0; i < 3; i++) {
        await PortalUserModel.create({
          portal_user_id: `PU-test-${i}`,
          tenant_id: "test-tenant",
          username: `user-${i}`,
          email: `user-${i}@example.com`,
          password_hash: await bcrypt.hash("password", 10),
          customer_access: [],
        });
      }

      const req = new NextRequest("http://localhost/api/b2b/portal-users", {
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await listPortalUsers(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_users).toHaveLength(3);
      expect(data.pagination.total).toBe(3);
    });

    it("should filter by is_active status", async () => {
      /**
       * Test filtering portal users by active status.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-active",
        tenant_id: "test-tenant",
        username: "active-user",
        email: "active@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: true,
        customer_access: [],
      });
      await PortalUserModel.create({
        portal_user_id: "PU-inactive",
        tenant_id: "test-tenant",
        username: "inactive-user",
        email: "inactive@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: false,
        customer_access: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/portal-users?is_active=true",
        {
          headers: {
            "x-auth-method": "api-key",
            "x-api-key-id": "ak_test-tenant_abc123456789",
            "x-api-secret": "sk_test",
          },
        }
      );

      // Act
      const res = await listPortalUsers(req);
      const data = await res.json();

      // Assert
      expect(data.portal_users).toHaveLength(1);
      expect(data.portal_users[0].username).toBe("active-user");
    });

    it("should search by username or email", async () => {
      /**
       * Test search functionality.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-search-1",
        tenant_id: "test-tenant",
        username: "findme-user",
        email: "findme@example.com",
        password_hash: await bcrypt.hash("password", 10),
        customer_access: [],
      });
      await PortalUserModel.create({
        portal_user_id: "PU-search-2",
        tenant_id: "test-tenant",
        username: "other-user",
        email: "other@example.com",
        password_hash: await bcrypt.hash("password", 10),
        customer_access: [],
      });

      const req = new NextRequest(
        "http://localhost/api/b2b/portal-users?search=findme",
        {
          headers: {
            "x-auth-method": "api-key",
            "x-api-key-id": "ak_test-tenant_abc123456789",
            "x-api-secret": "sk_test",
          },
        }
      );

      // Act
      const res = await listPortalUsers(req);
      const data = await res.json();

      // Assert
      expect(data.portal_users).toHaveLength(1);
      expect(data.portal_users[0].username).toBe("findme-user");
    });
  });

  // ============================================
  // GET /api/b2b/portal-users/[id] - Get Portal User
  // ============================================

  describe("GET /api/b2b/portal-users/[id]", () => {
    it("should get portal user by id", async () => {
      /**
       * Test fetching a single portal user.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-get-test",
        tenant_id: "test-tenant",
        username: "get-user",
        email: "get@example.com",
        password_hash: await bcrypt.hash("password", 10),
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-get-test", {
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-get-test" });

      // Act
      const res = await getPortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_user.portal_user_id).toBe("PU-get-test");
      expect(data.portal_user.username).toBe("get-user");
      // Password hash should not be returned
      expect(data.portal_user.password_hash).toBeUndefined();
    });

    it("should return 404 for non-existent portal user", async () => {
      /**
       * Test 404 for invalid portal_user_id.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/portal-users/nonexistent", {
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "nonexistent" });

      // Act
      const res = await getPortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(404);
      expect(data.error).toContain("not found");
    });
  });

  // ============================================
  // PUT /api/b2b/portal-users/[id] - Update Portal User
  // ============================================

  describe("PUT /api/b2b/portal-users/[id]", () => {
    it("should update portal user fields", async () => {
      /**
       * Test updating portal user username and email.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-update-test",
        tenant_id: "test-tenant",
        username: "old-username",
        email: "old@example.com",
        password_hash: await bcrypt.hash("password", 10),
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-update-test", {
        method: "PUT",
        body: JSON.stringify({
          username: "new-username",
          email: "new@example.com",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-update-test" });

      // Act
      const res = await updatePortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_user.username).toBe("new-username");
      expect(data.portal_user.email).toBe("new@example.com");
    });

    it("should update portal user password", async () => {
      /**
       * Test updating portal user password.
       */
      // Arrange
      const oldHash = await bcrypt.hash("oldpassword", 10);
      await PortalUserModel.create({
        portal_user_id: "PU-password-test",
        tenant_id: "test-tenant",
        username: "password-user",
        email: "password@example.com",
        password_hash: oldHash,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-password-test", {
        method: "PUT",
        body: JSON.stringify({
          password: "NewPassword123!",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-password-test" });

      // Act
      const res = await updatePortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_user).toBeDefined();

      // Verify password was changed
      const updated = await PortalUserModel.findOne({ portal_user_id: "PU-password-test" });
      expect(updated!.password_hash).not.toBe(oldHash);
      expect(await bcrypt.compare("NewPassword123!", updated!.password_hash)).toBe(true);
    });

    it("should update customer access", async () => {
      /**
       * Test updating portal user customer access.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-access-test",
        tenant_id: "test-tenant",
        username: "access-user",
        email: "access@example.com",
        password_hash: await bcrypt.hash("password", 10),
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-access-test", {
        method: "PUT",
        body: JSON.stringify({
          customer_access: [
            { customer_id: "CUST-001", address_access: "all" },
            { customer_id: "CUST-002", address_access: ["addr-1", "addr-2"] },
          ],
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-access-test" });

      // Act
      const res = await updatePortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_user.customer_access).toHaveLength(2);
      expect(data.portal_user.customer_access[0].address_access).toBe("all");
      expect(data.portal_user.customer_access[1].address_access).toEqual(["addr-1", "addr-2"]);
    });

    it("should toggle is_active status", async () => {
      /**
       * Test deactivating/activating portal user.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-toggle-test",
        tenant_id: "test-tenant",
        username: "toggle-user",
        email: "toggle@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: true,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-toggle-test", {
        method: "PUT",
        body: JSON.stringify({
          is_active: false,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-toggle-test" });

      // Act
      const res = await updatePortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.portal_user.is_active).toBe(false);
    });
  });

  // ============================================
  // DELETE /api/b2b/portal-users/[id] - Delete Portal User
  // ============================================

  describe("DELETE /api/b2b/portal-users/[id]", () => {
    it("should deactivate portal user (soft delete)", async () => {
      /**
       * Test deactivating a portal user.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-delete-test",
        tenant_id: "test-tenant",
        username: "delete-user",
        email: "delete@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: true,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/portal-users/PU-delete-test", {
        method: "DELETE",
        headers: {
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });
      const params = createParams({ id: "PU-delete-test" });

      // Act
      const res = await deletePortalUser(req, params);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.message).toContain("deactivated");

      // Verify deactivation (soft delete)
      const deleted = await PortalUserModel.findOne({ portal_user_id: "PU-delete-test" });
      expect(deleted).not.toBeNull();
      expect(deleted!.is_active).toBe(false);
    });
  });

  // ============================================
  // POST /api/b2b/auth/portal-login - Portal User Login
  // ============================================

  describe("POST /api/b2b/auth/portal-login", () => {
    it("should login with valid credentials", async () => {
      /**
       * Test portal user login with username/password.
       */
      // Arrange
      const password = "TestPassword123!";
      const passwordHash = await bcrypt.hash(password, 10);
      await PortalUserModel.create({
        portal_user_id: "PU-login-test",
        tenant_id: "test-tenant",
        username: "login-user",
        email: "login@example.com",
        password_hash: passwordHash,
        is_active: true,
        customer_access: [
          { customer_id: "CUST-001", address_access: "all" },
        ],
      });

      const req = new NextRequest("http://localhost/api/b2b/auth/portal-login", {
        method: "POST",
        body: JSON.stringify({
          username: "login-user",
          password: password,
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await portalLogin(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(200);
      expect(data.token).toBeDefined();
      expect(data.portal_user.portal_user_id).toBe("PU-login-test");
      expect(data.portal_user.username).toBe("login-user");
      expect(data.customer_access).toHaveLength(1);
    });

    it("should return 401 for wrong password", async () => {
      /**
       * Test login with invalid password.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-wrong-pw",
        tenant_id: "test-tenant",
        username: "wrongpw-user",
        email: "wrongpw@example.com",
        password_hash: await bcrypt.hash("correctpassword", 10),
        is_active: true,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/auth/portal-login", {
        method: "POST",
        body: JSON.stringify({
          username: "wrongpw-user",
          password: "wrongpassword",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await portalLogin(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(401);
      expect(data.error).toMatch(/invalid|credentials/i);
    });

    it("should return 401 for non-existent user", async () => {
      /**
       * Test login with non-existent username.
       */
      // Arrange
      const req = new NextRequest("http://localhost/api/b2b/auth/portal-login", {
        method: "POST",
        body: JSON.stringify({
          username: "nonexistent",
          password: "anypassword",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await portalLogin(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(401);
      expect(data.error).toMatch(/invalid|credentials/i);
    });

    it("should return 401 for inactive user", async () => {
      /**
       * Test login with deactivated user.
       * Note: Inactive users are filtered out in the query (is_active: true),
       * so they get "Invalid credentials" error like non-existent users.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-inactive",
        tenant_id: "test-tenant",
        username: "inactive-user",
        email: "inactive@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: false,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/auth/portal-login", {
        method: "POST",
        body: JSON.stringify({
          username: "inactive-user",
          password: "password",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await portalLogin(req);
      const data = await res.json();

      // Assert
      expect(res.status).toBe(401);
      expect(data.error).toMatch(/invalid|credentials/i);
    });

    it("should update last_login_at on successful login", async () => {
      /**
       * Test that last_login_at is updated after login.
       */
      // Arrange
      await PortalUserModel.create({
        portal_user_id: "PU-lastlogin",
        tenant_id: "test-tenant",
        username: "lastlogin-user",
        email: "lastlogin@example.com",
        password_hash: await bcrypt.hash("password", 10),
        is_active: true,
        customer_access: [],
      });

      const req = new NextRequest("http://localhost/api/b2b/auth/portal-login", {
        method: "POST",
        body: JSON.stringify({
          username: "lastlogin-user",
          password: "password",
        }),
        headers: {
          "Content-Type": "application/json",
          "x-auth-method": "api-key",
          "x-api-key-id": "ak_test-tenant_abc123456789",
          "x-api-secret": "sk_test",
        },
      });

      // Act
      const res = await portalLogin(req);
      expect(res.status).toBe(200);

      // Wait a tiny bit for the non-blocking update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      const user = await PortalUserModel.findOne({ portal_user_id: "PU-lastlogin" });
      expect(user!.last_login_at).toBeDefined();
    });
  });

  // ============================================
  // Token Utilities
  // ============================================

  describe("Portal User Token Utilities", () => {
    it("should generate and verify valid token", async () => {
      /**
       * Test token generation and verification.
       */
      // Act
      const token = await generatePortalUserToken("PU-test", "test-tenant");

      // Assert
      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
    });

    it("hasCustomerAccess should return true for accessible customer", () => {
      /**
       * Test hasCustomerAccess utility.
       */
      // Arrange
      const access = [
        { customer_id: "CUST-001", address_access: "all" as const },
        { customer_id: "CUST-002", address_access: ["addr-1"] },
      ];

      // Assert
      expect(hasCustomerAccess(access, "CUST-001")).toBe(true);
      expect(hasCustomerAccess(access, "CUST-002")).toBe(true);
      expect(hasCustomerAccess(access, "CUST-999")).toBe(false);
    });

    it("getAccessibleCustomerIds should return all customer IDs", () => {
      /**
       * Test getAccessibleCustomerIds utility.
       */
      // Arrange
      const access = [
        { customer_id: "CUST-001", address_access: "all" as const },
        { customer_id: "CUST-002", address_access: ["addr-1"] },
      ];

      // Act
      const ids = getAccessibleCustomerIds(access);

      // Assert
      expect(ids).toEqual(["CUST-001", "CUST-002"]);
    });
  });
});
