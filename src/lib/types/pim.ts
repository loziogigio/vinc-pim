/**
 * PIM Type Definitions
 * Reusable types for Product Information Management
 *
 * DESIGN PRINCIPLE: Keep types simple, clear, and reusable
 */

// ============================================
// CORE SHARED TYPES (matching customer_web)
// ============================================

export type Attachment = {
  id: string;
  thumbnail: string;
  original: string;
};

export type Brand = {
  id: string;
  name: string;
  slug: string;
  image?: Attachment;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  details?: string;
  image?: Attachment;
  icon?: string;
};

export type Tag = {
  id: string;
  name: string;
  slug: string;
};

export type ProductFeature = {
  label: string;
  value: string;
  unit?: string;
};

export type ProductDocument = {
  id: number;
  url: string;
  area?: string;
  filename?: string;
  ext?: string;
};

export type ProductMeta = {
  key: string;
  value: string;
};

export type PackagingOption = {
  packaging_uom: string;
  packaging_qty: number;
  ean?: string;
};

// ============================================
// PIM SPECIFIC TYPES
// ============================================

export type ProductStatus = "draft" | "published" | "archived";

export type StockStatus = "in_stock" | "out_of_stock" | "pre_order";

export type ImportSource = {
  source_id: string;
  source_name: string;
  imported_at: Date;
};

export type QualityMetrics = {
  completeness_score: number; // 0-100
  critical_issues: string[];
};

export type AutoPublishConfig = {
  enabled: boolean;
  eligible: boolean;
  reason?: string;
  min_score_threshold: number;
  required_fields: string[];
};

export type ProductAnalytics = {
  views_30d: number;
  clicks_30d: number;
  add_to_cart_30d: number;
  conversions_30d: number;
  priority_score: number;
  last_synced_at?: Date;
};

export type VersionControl = {
  version: number;
  isCurrent: boolean;
  isCurrentPublished: boolean;
};

export type ManualEdit = {
  locked_fields: string[];
  manually_edited: boolean;
  edited_by?: string;
  edited_at?: Date;
};

// ============================================
// PRODUCT CORE DATA
// ============================================

/**
 * Basic product information
 * This is the minimal data needed for a product
 */
export type ProductCore = {
  sku: string;
  name: string;
  slug: string;
  description?: string;
};

/**
 * Product pricing information
 */
export type ProductPricing = {
  price: number;
  sale_price?: number;
  min_price?: number;
  max_price?: number;
  currency: string;
};

/**
 * Product inventory information
 */
export type ProductInventory = {
  quantity: number;
  sold: number;
  unit: string;
  stock_status?: StockStatus;
};

/**
 * Product images
 */
export type ProductImages = {
  image: Attachment; // Primary image
  gallery?: Attachment[]; // Additional images
};

/**
 * Complete Product Data
 * This matches the Product interface from customer_web
 */
export type ProductData = ProductCore &
  ProductPricing &
  ProductInventory &
  ProductImages & {
    // Classification
    brand?: Brand;
    category?: Category;
    tag?: Tag[];

    // Content
    features?: ProductFeature[];
    docs?: ProductDocument[];
    meta?: ProductMeta[];

    // Variations
    parent_sku?: string;
    parent_entity_code?: string;
    variations?: string[];

    // Additional
    product_model?: string;
    short_description?: string;
    long_description?: string;
    product_status?: string;
    product_status_description?: string;

    // ERP
    packaging_options?: PackagingOption[];

    // SEO
    meta_title?: string;
    meta_description?: string;
  };

// ============================================
// PIM PRODUCT (Complete)
// ============================================

/**
 * Complete PIM Product structure
 * Combines PIM metadata with product data
 */
export type PIMProductData = {
  // Identity
  // wholesaler_id removed - database per wholesaler provides isolation
  entity_code: string;

  // PIM Metadata
  version_control: VersionControl;
  status: ProductStatus;
  published_at?: Date;

  // Import & Quality
  source: ImportSource;
  quality: QualityMetrics;
  auto_publish: AutoPublishConfig;

  // Analytics & Editing
  analytics: ProductAnalytics;
  manual_edit: ManualEdit;

  // Product Data
  product: ProductData;

  // Timestamps
  created_at: Date;
  updated_at: Date;
};

// ============================================
// API RESPONSE TYPES
// ============================================

export type PIMProductListItem = {
  _id: string;
  entity_code: string;
  sku: string;
  name: string;
  image: Attachment;
  price: number;
  completeness_score: number;
  status: ProductStatus;
  critical_issues: string[];
  analytics: ProductAnalytics;
};

export type PIMDashboardStats = {
  total_products: number;
  published_count: number;
  draft_count: number;
  critical_issues_count: number;
  avg_completeness_score: number;
  auto_published_today: number;
  pending_imports: number;
};

export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

export type ImportJobData = {
  _id: string;
  job_id: string;
  source_id: string;
  status: ImportJobStatus;
  file_name: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  auto_published_count: number;
  import_errors: {
    row: number;
    entity_code: string;
    error: string;
  }[];
  created_at: string;
  completed_at?: string;
};

// ============================================
// UTILITY TYPES
// ============================================

/**
 * Field mappings for imports
 */
export type FieldMapping = {
  source_field: string;
  pim_field: string;
  transform?: string;
};

/**
 * Score breakdown by field
 */
export type ScoreBreakdown = Record<
  string,
  {
    current: number;
    max: number;
    percentage: number;
  }
>;

/**
 * Auto-publish eligibility check result
 */
export type AutoPublishResult = {
  eligible: boolean;
  reason: string;
  score?: number;
  missing_fields?: string[];
};
