/**
 * PIM Type Definitions
 * Reusable types for Product Information Management
 *
 * DESIGN PRINCIPLE: Keep types simple, clear, and reusable
 */

// ============================================
// MULTILINGUAL TYPES
// ============================================

/**
 * Multilingual string - can be a plain string or an object with language keys
 * Use for fields that may come from different sources (API might return string or object)
 */
export type MultiLangString = string | { [lang: string]: string };

/**
 * Strict multilingual text - always an object with language keys
 * Use for PIM internal storage where we always want the object format
 */
export type MultilingualText = Record<string, string>;

/**
 * Extract string from multilingual field
 */
export function getLocalizedString(value: MultiLangString | undefined | null, fallback = "—"): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  // Try common languages in order of preference
  return value.it || value.en || Object.values(value)[0] || fallback;
}

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
 * Product image item (used in images[] array)
 * Primary image is always images[0] (position 0)
 */
export type ProductImage = {
  _id?: string;
  url: string;
  cdn_key: string;
  position: number;
  label?: string;
  file_name?: string;
  file_type?: string;
  size_bytes?: number;
  uploaded_at?: string;
  uploaded_by?: string;
};

/**
 * Product images
 * Uses images[] array - primary image is images[0]
 */
export type ProductImages = {
  images?: ProductImage[];
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
  images?: ProductImage[];
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

// ============================================
// ATTRIBUTE TYPES & HELPERS
// ============================================

/**
 * Attribute in the format expected by AttributesEditor
 * Flat structure: { slug: { label, value, uom } }
 */
export type FlatAttribute = {
  label: string | Record<string, string>;
  value: any;
  uom?: string;
};

/**
 * Attribute in the multilingual format stored in MongoDB
 * Nested structure: { lang: { slug: { key, label, value } } }
 */
export type MultilingualAttribute = {
  key: string;
  label: string;
  value: any;
  uom?: string;
};

/**
 * Extract attributes for a specific language from multilingual structure
 * Converts: { it: { attr1: {...}, attr2: {...} }, de: {...} }
 * To: { attr1: { label, value, uom }, attr2: {...} }
 * This format is expected by AttributesEditor
 */
export function extractAttributesForLanguage(
  attributes: Record<string, any> | undefined,
  languageCode: string
): Record<string, FlatAttribute> {
  if (!attributes) return {};

  // Check if attributes are already in flat format (legacy or non-multilingual)
  // Flat format: { slug: { label, value, uom } }
  const firstKey = Object.keys(attributes)[0];
  if (firstKey && attributes[firstKey]) {
    const firstValue = attributes[firstKey];
    // If first value has 'label' and 'value' directly (and no 'key'), it's flat format
    if (typeof firstValue === 'object' && 'value' in firstValue && !('key' in firstValue)) {
      return attributes as Record<string, FlatAttribute>;
    }
    // If first value is an object with nested attributes (multilingual format)
    // Check if it looks like a language code (2-3 chars)
    if (firstKey.length <= 3 && typeof firstValue === 'object') {
      // Multilingual format: { it: { attr1: {...} }, de: {...} }
      const langAttributes = attributes[languageCode] || {};
      // Convert from { key, label, value } to { label, value, uom }
      const result: Record<string, FlatAttribute> = {};
      for (const [slug, attrData] of Object.entries(langAttributes)) {
        if (typeof attrData === 'object' && attrData !== null) {
          const attr = attrData as MultilingualAttribute;
          result[slug] = {
            label: attr.label || slug,
            value: attr.value,
            ...(attr.uom && { uom: attr.uom }),
          };
        }
      }
      return result;
    }
  }

  return attributes as Record<string, FlatAttribute>;
}

/**
 * Merge flat attributes back into multilingual structure
 * Converts: { attr1: { label, value, uom } }
 * To: { [lang]: { attr1: { key, label, value, uom } } }
 */
export function mergeAttributesToMultilingual(
  flatAttributes: Record<string, FlatAttribute>,
  existingAttributes: Record<string, any> | undefined,
  languageCode: string
): Record<string, Record<string, MultilingualAttribute>> {
  const result = { ...(existingAttributes || {}) } as Record<string, Record<string, MultilingualAttribute>>;

  // Convert flat format to multilingual
  const langAttributes: Record<string, MultilingualAttribute> = {};
  for (const [slug, attrData] of Object.entries(flatAttributes)) {
    if (typeof attrData === 'object' && attrData !== null) {
      langAttributes[slug] = {
        key: slug,
        label: typeof attrData.label === 'string' ? attrData.label : (attrData.label?.[languageCode] || slug),
        value: attrData.value,
        ...(attrData.uom && { uom: attrData.uom }),
      };
    }
  }

  result[languageCode] = langAttributes;
  return result;
}
