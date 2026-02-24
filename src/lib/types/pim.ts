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

/**
 * Physical packaging information for a product.
 * Source of truth for default/smallest designation — synced to packaging_options flags.
 */
export type PackagingInfo = {
  packaging_id: string;              // Unique identifier for this packaging record
  code: string;                      // Short packaging code (e.g., "MV", "CF", "PZ")
  description: string;               // Human-readable description
  qty: number;                       // Quantity (supports decimals, e.g., 0.75)
  uom: string;                       // Unit of measure (e.g., "pz", "kg")
  is_default?: boolean;              // This packaging is the default selling unit
  is_smallest?: boolean;             // This packaging is the minimum sellable quantity
};

export type PackagingOption = {
  pkg_id?: string;                // Unique packaging identifier (incremental: "1", "2", "3"...)
  code: string;                   // Packaging code (e.g., "PZ", "BOX", "CF", "PALLET")
  label: MultilingualText;        // Multilingual label
  qty: number;                    // Quantity per packaging unit
  uom: string;                    // Unit of measure (e.g., "PZ")
  is_default: boolean;            // Is this the default packaging?
  is_smallest: boolean;           // Is this the smallest unit?
  is_sellable?: boolean;          // Can this packaging be sold? (default: true)
  ean?: string;                   // EAN barcode (optional)
  position?: number;              // Display order (optional)
  pricing?: PackagingPricing;     // Optional pricing override for this packaging
  promotions?: Promotion[];       // Promotions specific to this packaging option
};

/**
 * Individual discount step in a discount chain
 * Tracks type, value, source, and order of application
 */
export type DiscountStep = {
  type: "percentage" | "amount" | "net";  // Type of discount
  value?: number;                          // Discount value (e.g., 10 for 10%, 5.00 for €5)
  source: "price_list" | "price_list_sale" | "promo";  // Origin of the discount
  order: number;                           // Application order (1, 2, 3...)
};

/**
 * Promotion data for packaging-level discounts
 * Supports multilingual labels and various discount types
 * Each promotion is tied to a specific packaging option
 */
export type Promotion = {
  promo_code?: string;            // Promotion code (e.g., "016", "BREVE-SCAD")
  promo_row?: number;             // Row number from ERP (for tracking/sorting)
  is_active: boolean;
  promo_type?: string;            // Business category (STD, XXX, OMG, EOL, BREVE-SCAD, etc.)
  calc_method?: string;           // Calculation method (RPNQMIN, RQCSC, RVMSC, RCNA, RQCOE)
  label: MultilingualText;        // Multilingual promotion label
  language?: string;              // Primary language of the promotion
  discount_percentage?: number;   // Percentage discount (e.g., 20 for 20% off)
  discount_amount?: number;       // Fixed amount discount (e.g., 10.00 for €10 off)
  buy_x?: number;                 // Buy X quantity (for buy_x_get_y type)
  get_y?: number;                 // Get Y quantity (for buy_x_get_y type)
  is_stackable: boolean;          // Can be combined with other promotions
  priority: number;               // Priority order (higher = more important)
  start_date?: Date;              // Promotion start date
  end_date?: Date;                // Promotion end date
  min_quantity?: number;          // Minimum quantity to qualify
  min_order_value?: number;       // Minimum order value to qualify
  promo_price?: number;           // Final price when this promotion applies
  discount_chain?: DiscountStep[];  // Array of discount steps with type, value, source, and order
  text_discount?: string;         // Computed: cumulative discount chain (e.g., "-50% -20%")
  /** Customer tag filter — empty/undefined = applies to all; otherwise requires matching customer tag */
  tag_filter?: string[];          // e.g., ["categoria-di-sconto:sconto-45"]
  /** Target packaging options — empty/undefined = all sellable; otherwise specific pkg_ids */
  target_pkg_ids?: string[];
};

// ============================================
// PIM PRICING TYPES (ERP-based)
// ============================================

/**
 * Product pricing from ERP
 * - list: User's purchase/cost price (from price list / net_price)
 * - retail: MSRP / suggested retail price (gross_price from ERP)
 * - sale: Discounted price (price_discount from ERP)
 */
export type PIMPricing = {
  list: number;                   // User's purchase/cost price
  retail?: number;                // MSRP / suggested retail price
  sale?: number;                  // Discounted price (if applicable)
  currency: string;               // Currency code (EUR, USD, etc.)
  vat_rate?: number;              // VAT percentage (22, 10, 4, 0)
};

/**
 * Partial pricing for packaging options (all fields optional)
 * Supports both unit-based and package-based pricing with discounts
 *
 * Pricing model:
 * - Unit prices (list_unit, retail_unit, sale_unit) are stored per single piece
 * - Package prices (list, retail, sale) are calculated: unit_price × qty
 * - UI edits unit prices, displays both unit and calculated package prices
 */
export type PackagingPricing = {
  // Unit prices (per single piece) - PRIMARY storage
  list_unit?: number;             // List price per unit (e.g., €45.00/pz)
  retail_unit?: number;           // MSRP per unit (e.g., €90.00/pz)
  sale_unit?: number;             // Sale price per unit (e.g., €40.50/pz)

  // Package prices (calculated: unit × qty) - for display/backward compatibility
  list?: number;                  // List price for this packaging (e.g., €270.00 for BOX of 6)
  retail?: number;                // MSRP for this packaging
  sale?: number;                  // Discounted price for this packaging

  // Reference-based pricing fields
  price_ref?: string;             // Reference packaging code (e.g., "PZ" for BOX)
  list_discount_pct?: number;     // Percentage discount from retail to get list (e.g., 50 for -50%)
  list_discount_amt?: number;     // Fixed amount discount from retail to get list (e.g., 5 for -€5)
  sale_discount_pct?: number;     // Percentage discount from list to get sale (e.g., 10 for -10%)
  sale_discount_amt?: number;     // Fixed amount discount from list to get sale (e.g., 5 for -€5)
  text_discount?: string;         // Computed: base discount chain (e.g., "-50%" or "-50% -10%")
  /** Customer tag filter — empty/undefined = applies to all; otherwise requires matching customer tag */
  tag_filter?: string[];          // e.g., ["categoria-di-sconto:sconto-45"]
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

    // Variants
    parent_sku?: string;
    parent_entity_code?: string;
    variants?: string[];

    // Additional
    product_model?: string;
    ean?: string[];  // EAN barcodes (array for multiple codes)
    short_description?: string;
    long_description?: string;
    product_status?: string;
    product_status_description?: string;

    // ERP
    packaging_options?: PackagingOption[];

    // Promotions
    promotions?: Promotion[];
    promo_code?: string[];          // Array of active promotion codes
    promo_type?: string[];          // Array of business categories for faceting
    discount_chains?: DiscountStep[];  // Aggregated discount steps from all active promotions
    has_active_promo?: boolean;     // Has any active promotion

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

  // Sales Channels
  channels?: string[];

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
  channels?: string[];
  // Variant/Parent relationships
  parent_sku?: string;
  parent_entity_code?: string;
  is_parent?: boolean;
  variants_entity_code?: string[];
  variants_sku?: string[];
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
  hide_in_commerce?: boolean; // Hide from commerce storefront (default: false)
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
  hide_in_commerce?: boolean; // Hide from commerce storefront (default: false)
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
            ...(attr.hide_in_commerce !== undefined && { hide_in_commerce: attr.hide_in_commerce }),
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
        ...(attrData.hide_in_commerce !== undefined && { hide_in_commerce: attrData.hide_in_commerce }),
      };
    }
  }

  result[languageCode] = langAttributes;
  return result;
}
