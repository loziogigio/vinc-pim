/**
 * Portal User Type Definitions
 *
 * Portal users are separate from B2B admin users. They can login via username/password
 * and access specific customers with address-level permissions.
 */

/**
 * Customer access configuration for a portal user
 */
export interface ICustomerAccess {
  /** Customer ID this user can access */
  customer_id: string;
  /** "all" for all addresses, or array of specific address_ids */
  address_access: "all" | string[];
}

/**
 * User tag reference (embedded in portal user)
 */
export interface IUserTagRef {
  tag_id: string;
  name: string;
  slug: string;
  color?: string;
}

/**
 * Portal User document interface
 */
export interface IPortalUser {
  /** Unique identifier: "PU-{nanoid}" */
  portal_user_id: string;
  /** Tenant this user belongs to */
  tenant_id: string;

  /** Username for login - unique per tenant */
  username: string;
  /** Email address - can equal username */
  email: string;
  /** bcrypt hashed password */
  password_hash: string;

  /** List of customers and addresses this user can access */
  customer_access: ICustomerAccess[];

  /** Tags assigned to this user for campaign targeting */
  tags?: IUserTagRef[];

  /** Sales channel this portal user belongs to (default: "default") */
  channel: string;

  /** Whether the user account is active */
  is_active: boolean;
  /** Last successful login timestamp */
  last_login_at?: Date;

  /** Timestamps */
  created_at: Date;
  updated_at: Date;
}

/**
 * Portal user data for creating a new user (password instead of hash)
 */
export interface IPortalUserCreate {
  username: string;
  email: string;
  password: string;
  customer_access: ICustomerAccess[];
  channel?: string;
}

/**
 * Portal user data for updating (all fields optional)
 */
export interface IPortalUserUpdate {
  username?: string;
  email?: string;
  password?: string;
  customer_access?: ICustomerAccess[];
  is_active?: boolean;
  channel?: string;
}

/**
 * Portal user token payload (stored in JWT)
 */
export interface IPortalUserTokenPayload {
  portalUserId: string;
  tenantId: string;
  /** Customer pricing tags (full_tag values, e.g. "categoria-sconto:scont-50") */
  customerTags?: string[];
  /** Sales channel (default: "default") */
  channel?: string;
  /** Token issued at timestamp */
  iat?: number;
  /** Token expiration timestamp */
  exp?: number;
}

/**
 * Portal user context extracted from request
 */
export interface IPortalUserContext {
  portalUserId: string;
  tenantId: string;
  customerAccess: ICustomerAccess[];
}

/**
 * Safe portal user data (without password_hash) for API responses
 */
export type PortalUserSafe = Omit<IPortalUser, "password_hash">;
