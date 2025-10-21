/**
 * B2B Type Definitions
 * Types for B2B user management, catalog, and dashboard features
 */

export type B2BUserRole = "admin" | "manager" | "viewer";

export type B2BSessionData = {
  isLoggedIn: boolean;
  userId: string;
  username: string;
  email: string;
  role: B2BUserRole;
  companyName: string;
  lastLoginAt: string;
};

export type B2BUser = {
  _id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: B2BUserRole;
  companyName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
};

export type ProductStatus = "enhanced" | "not_enhanced" | "needs_attention" | "missing_data";

export type B2BProduct = {
  _id: string;
  sku: string;
  title: string;
  category: string;
  status: ProductStatus;
  description?: string;
  marketingContent?: string;
  images: string[];
  price?: number;
  stock?: number;
  erpData?: Record<string, any>;
  lastSyncedAt?: Date;
  enhancedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ActivityLogType =
  | "erp_sync"
  | "bulk_enhancement"
  | "product_update"
  | "image_upload"
  | "user_login"
  | "catalog_export";

export type ActivityLog = {
  _id: string;
  type: ActivityLogType;
  action: string;
  description: string;
  details?: Record<string, any>;
  performedBy: string;
  createdAt: Date;
};

export type CatalogOverview = {
  totalProducts: number;
  enhancedProducts: number;
  needsAttention: number;
  missingImages: number;
  missingMarketing: number;
  recentSync?: Date;
};
