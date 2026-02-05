/**
 * VINC API Internal Client
 *
 * For service-to-service calls from vinc-commerce-suite to vinc-api.
 * Uses X-Internal-API-Key header for authentication (no JWT required).
 *
 * Usage:
 *   import { getVincApiForTenant } from '@/lib/vinc-api';
 *
 *   const vincApi = getVincApiForTenant('tenant-id');
 *   const tokens = await vincApi.auth.login({ email, password });
 *   const profile = await vincApi.auth.getProfile(tokens.access_token);
 */

import type {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthProfileResponse,
  ChangePasswordResponse,
  B2BAddress,
  B2BCustomer,
  B2BUserProfile,
  B2BUsersListParams,
} from "./types";

// =============================================================================
// ERROR CLASS
// =============================================================================

export class VincApiError extends Error {
  constructor(
    public status: number,
    public detail: string
  ) {
    super(detail);
    this.name = "VincApiError";
  }
}

// =============================================================================
// CLIENT CONFIG
// =============================================================================

interface VincApiConfig {
  baseUrl: string;
  apiKey: string;
  tenantId: string;
  serviceName?: string;
}

// =============================================================================
// CLIENT CLASS
// =============================================================================

class VincApiClient {
  private config: VincApiConfig;

  constructor(config: VincApiConfig) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/v1/internal${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Internal-API-Key": this.config.apiKey,
      "X-Tenant-ID": this.config.tenantId,
      ...(this.config.serviceName && {
        "X-Service-Name": this.config.serviceName,
      }),
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try {
        const error = await response.json();
        // Handle FastAPI validation errors (detail is an array)
        if (Array.isArray(error.detail)) {
          detail = error.detail[0]?.msg || "Validation error";
        } else {
          detail = error.detail || detail;
        }
      } catch {
        // ignore parse error
      }
      throw new VincApiError(response.status, detail);
    }

    return response.json();
  }

  // ==========================================================================
  // AUTH
  // ==========================================================================

  auth = {
    /**
     * Login with email and password
     * Returns JWT tokens from VINC API
     */
    login: (credentials: AuthLoginRequest): Promise<AuthLoginResponse> =>
      this.request("/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),

    /**
     * Get user profile using access token
     * Note: Uses Bearer token for user identity + internal API key for service auth
     */
    getProfile: async (accessToken: string): Promise<AuthProfileResponse> => {
      const url = `${this.config.baseUrl}/api/v1/internal/auth/me`;
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Internal-API-Key": this.config.apiKey,
          "X-Tenant-ID": this.config.tenantId,
        },
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          detail = error.detail || detail;
        } catch {
          // ignore parse error
        }
        throw new VincApiError(response.status, detail);
      }

      return response.json();
    },

    /**
     * Set password for a user (internal admin operation)
     */
    setPassword: (
      userId: string,
      password: string
    ): Promise<{ success: boolean }> =>
      this.request("/auth/set-password", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, password }),
      }),

    /**
     * Set password for a user by email (for password reset)
     */
    setPasswordByEmail: (
      email: string,
      password: string
    ): Promise<{ success: boolean }> =>
      this.request("/auth/set-password-by-email", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),

    /**
     * Change password for authenticated user
     * Note: Uses Bearer token for authentication
     */
    changePassword: async (
      accessToken: string,
      currentPassword: string,
      newPassword: string
    ): Promise<ChangePasswordResponse> => {
      const url = `${this.config.baseUrl}/api/v1/internal/auth/change-password`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Internal-API-Key": this.config.apiKey,
          "X-Tenant-ID": this.config.tenantId,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          if (Array.isArray(error.detail)) {
            detail = error.detail[0]?.msg || "Validation error";
          } else {
            detail = error.detail || detail;
          }
        } catch {
          // ignore parse error
        }
        throw new VincApiError(response.status, detail);
      }

      return response.json();
    },

    /**
     * Refresh access token using refresh token
     * Returns new access_token and refresh_token
     */
    refreshToken: async (refreshToken: string): Promise<AuthLoginResponse> => {
      const url = `${this.config.baseUrl}/api/v1/internal/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-API-Key": this.config.apiKey,
          "X-Tenant-ID": this.config.tenantId,
          "X-Refresh-Token": refreshToken,
        },
      });

      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          const error = await response.json();
          detail = error.detail || detail;
        } catch {
          // ignore parse error
        }
        throw new VincApiError(response.status, detail);
      }

      return response.json();
    },

    /**
     * Logout - invalidate token on backend
     * Note: Uses Bearer token for authentication
     */
    logout: async (accessToken: string): Promise<{ success: boolean }> => {
      const url = `${this.config.baseUrl}/api/v1/internal/auth/logout`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          "X-Internal-API-Key": this.config.apiKey,
          "X-Tenant-ID": this.config.tenantId,
        },
      });

      // Even if backend returns error, we still want to clear local state
      if (!response.ok) {
        console.warn(
          "[vincApi.auth.logout] Backend returned error:",
          response.status
        );
        return { success: false };
      }

      return response.json();
    },
  };

  // ==========================================================================
  // B2B
  // ==========================================================================

  b2b = {
    /**
     * Get B2B customer by ID (from PostgreSQL)
     */
    getCustomer: (customerId: string): Promise<B2BCustomer> =>
      this.request(`/b2b/customers/${customerId}`),

    /**
     * Get B2B customer addresses (from PostgreSQL)
     */
    getAddresses: (customerId: string): Promise<B2BAddress[]> =>
      this.request(`/b2b/customers/${customerId}/addresses`),

    /**
     * Get specific B2B address
     */
    getAddress: (customerId: string, addressId: string): Promise<B2BAddress> =>
      this.request(`/b2b/customers/${customerId}/addresses/${addressId}`),
  };

  // ==========================================================================
  // USERS
  // ==========================================================================

  users = {
    /**
     * List B2B users from VINC API (PostgreSQL)
     * Uses tenant_id from config to filter users by supplier slug
     */
    list: (params?: B2BUsersListParams): Promise<B2BUserProfile[]> => {
      const searchParams = new URLSearchParams();

      // Use config tenant_id by default for tenant filtering
      const tenantId = params?.tenant_id ?? this.config.tenantId;
      if (tenantId) searchParams.set("tenant_id", tenantId);

      if (params?.supplier_id) searchParams.set("supplier_id", params.supplier_id);
      if (params?.email) searchParams.set("email", params.email);
      if (params?.status) searchParams.set("status", params.status);
      if (params?.limit) searchParams.set("limit", String(params.limit));
      if (params?.offset) searchParams.set("offset", String(params.offset));

      const query = searchParams.toString();
      return this.request(`/users${query ? `?${query}` : ""}`);
    },

    /**
     * Get a single B2B user by ID
     */
    get: (userId: string): Promise<B2BUserProfile> =>
      this.request(`/users/${userId}`),
  };
}

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Configuration for multi-tenant VINC API client
 */
export interface TenantVincConfig {
  tenantId: string;
  vincApiUrl?: string;
  vincApiKey?: string;
}

/**
 * Get VINC API client for a specific tenant
 *
 * @param tenantConfig - Tenant-specific configuration or just tenant ID string
 * @returns VincApiClient instance configured for the tenant
 */
export function getVincApiForTenant(
  tenantConfig: TenantVincConfig | string
): VincApiClient {
  const config =
    typeof tenantConfig === "string"
      ? { tenantId: tenantConfig }
      : tenantConfig;

  const baseUrl = config.vincApiUrl || process.env.VINC_API_URL;
  const apiKey = config.vincApiKey || process.env.VINC_INTERNAL_API_KEY;
  const tenantId = config.tenantId;

  if (!baseUrl) {
    console.error("[VincApi] Missing VINC_API_URL for tenant:", tenantId);
    throw new Error("VINC_API_URL is required");
  }
  if (!apiKey) {
    console.error(
      "[VincApi] Missing VINC_INTERNAL_API_KEY for tenant:",
      tenantId
    );
    throw new Error("VINC_INTERNAL_API_KEY is required");
  }
  if (!tenantId) {
    console.error("[VincApi] Missing tenantId in config");
    throw new Error("tenantId is required");
  }

  return new VincApiClient({
    baseUrl,
    apiKey,
    tenantId,
    serviceName: "vinc-commerce-suite",
  });
}

export { VincApiClient };
export type { VincApiConfig };
