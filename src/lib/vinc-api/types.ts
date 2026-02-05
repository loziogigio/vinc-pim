/**
 * VINC API Types
 *
 * Types for communication with the VINC API internal endpoints.
 * Used for authentication and user management.
 */

// =============================================================================
// AUTH
// =============================================================================

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthProfileAddress {
  id: string;
  erp_address_id: string;
  label?: string;
  pricelist_code?: string;
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
}

export interface AuthProfileCustomer {
  id: string;
  erp_customer_id: string;
  name?: string;
  business_name?: string;
  addresses: AuthProfileAddress[];
}

export interface AuthProfileResponse {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  supplier_id?: string;
  supplier_name?: string;
  customers: AuthProfileCustomer[];
  has_password: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string;
}

// =============================================================================
// B2B
// =============================================================================

export interface B2BAddress {
  id: string;
  erp_address_id: string;
  customer_id: string;
  label?: string;
  street?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  phone?: string;
  email?: string;
  pricelist_code?: string;
  payment_terms_code?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface B2BCustomer {
  id: string;
  erp_customer_id: string;
  name?: string;
  business_name?: string;
  vat_number?: string;
  fiscal_code?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// USERS
// =============================================================================

export interface B2BUserAddress {
  id: string;
  erp_address_id: string;
  erp_customer_id?: string;
  customer_id: string;
  customer_name?: string;
  label?: string;
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
  province?: string;
  type?: string;
  is_default?: boolean;
  pricelist_code?: string;
  channel_code?: string;
}

export interface B2BUserCustomer {
  id: string;
  erp_customer_id: string;
  name?: string;
  addresses: {
    id: string;
    erp_address_id: string;
    label?: string;
  }[];
}

export interface B2BUserProfile {
  id: string;
  email: string;
  name?: string;
  role: string;
  status: string;
  supplier_id?: string;
  supplier_name?: string;
  customers: B2BUserCustomer[];
  addresses: B2BUserAddress[];
  has_password: boolean;
}

export interface B2BUsersListParams {
  tenant_id?: string;
  supplier_id?: string;
  email?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

// =============================================================================
// API ERROR
// =============================================================================

export interface ApiError {
  detail: string;
  status: number;
}
