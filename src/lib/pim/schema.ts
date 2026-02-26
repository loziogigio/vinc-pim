/**
 * PIM Product Schema Definition
 * Defines all available fields in the PIM product standard
 *
 * MULTILINGUAL SUPPORT:
 * - Fields marked as "multilingual_text" use the structure: { "it": "text", "de": "text", "en": "text", ... }
 * - Fields marked as "multilingual_array" use the structure: { "it": ["item1", "item2"], "en": ["item1", "item2"], ... }
 * - Language codes follow ISO 639-1 standard (2-letter lowercase codes)
 * - All enabled languages in the system can be used
 * - When importing, if a plain string is provided, it will be automatically converted to the default language
 *
 * SYNCHRONIZED WITH: src/lib/db/models/pim-product.ts (IPIMProduct interface)
 */

export type PIMFieldCategory = "core" | "pricing" | "inventory" | "media" | "taxonomy" | "features" | "additional";

export type PIMField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "multilingual_text" | "multilingual_array" | "date";
  category: PIMFieldCategory;
  required: boolean;
  description: string;
  example?: string;
};

/**
 * Complete PIM Product Schema
 * Based on IPIMProduct interface from src/lib/db/models/pim-product.ts
 */
export const PIM_PRODUCT_SCHEMA: PIMField[] = [
  // ============================================
  // CORE IDENTITY (9 fields)
  // ============================================
  {
    name: "entity_code",
    type: "string",
    category: "core",
    required: true,
    description: "Unique product identifier",
    example: "PROD-001"
  },
  {
    name: "sku",
    type: "string",
    category: "core",
    required: true,
    description: "Product SKU code",
    example: "SKU-001"
  },
  {
    name: "name",
    type: "multilingual_text",
    category: "core",
    required: true,
    description: "Product name/title (multilingual - supports all enabled languages)",
    example: '{"it": "Mouse Wireless", "de": "Kabellose Maus", "en": "Wireless Mouse"}'
  },
  {
    name: "slug",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "URL-friendly slug (multilingual - supports all enabled languages)",
    example: '{"it": "mouse-wireless", "de": "kabellose-maus", "en": "wireless-mouse"}'
  },
  {
    name: "description",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "Product description (multilingual - supports all enabled languages)",
    example: '{"it": "Mouse wireless ad alta precisione", "de": "Hochpräzise kabellose Maus", "en": "High-precision wireless mouse"}'
  },
  {
    name: "short_description",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "Short product description for listings (multilingual)",
    example: '{"it": "Mouse wireless compatto", "en": "Compact wireless mouse"}'
  },
  {
    name: "long_description",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "Detailed product description (multilingual, can contain HTML)",
    example: '{"it": "<p>Mouse wireless ergonomico con <strong>illuminazione RGB</strong></p>", "en": "<p>Ergonomic wireless mouse with <strong>RGB lighting</strong></p>"}'
  },
  {
    name: "product_model",
    type: "string",
    category: "core",
    required: false,
    description: "Product model number/code",
    example: "WM-2024-PRO"
  },
  {
    name: "ean",
    type: "array",
    category: "core",
    required: false,
    description: "EAN barcodes (array of strings for multiple codes)",
    example: '["5901234123457", "5901234123464"]'
  },

  // ============================================
  // PRICING (ProductPricing object + promotions)
  // ============================================
  {
    name: "pricing",
    type: "object",
    category: "pricing",
    required: false,
    description: "Product pricing object with list (user's cost), retail (MSRP), sale (discounted), currency, and vat_rate",
    example: '{"list": 80.02, "retail": 160.04, "sale": 72.02, "currency": "EUR", "vat_rate": 22}'
  },
  {
    name: "pricing.list",
    type: "number",
    category: "pricing",
    required: false,
    description: "User's purchase/cost price (from ERP net_price or price)",
    example: "80.02"
  },
  {
    name: "pricing.retail",
    type: "number",
    category: "pricing",
    required: false,
    description: "MSRP / suggested retail price (from ERP gross_price)",
    example: "160.04"
  },
  {
    name: "pricing.sale",
    type: "number",
    category: "pricing",
    required: false,
    description: "Discounted price (from ERP price_discount)",
    example: "72.02"
  },
  {
    name: "pricing.currency",
    type: "string",
    category: "pricing",
    required: false,
    description: "Currency code (EUR, USD, etc.)",
    example: "EUR"
  },
  {
    name: "pricing.vat_rate",
    type: "number",
    category: "pricing",
    required: false,
    description: "VAT percentage (22, 10, 4, 0)",
    example: "22"
  },
  {
    name: "promotions",
    type: "array",
    category: "pricing",
    required: false,
    description: "Product-level promotions (legacy - prefer packaging_options.promotions). Includes promo_code, promo_row, is_active, promo_type, calc_method, label (multilingual), discount_percentage, discount_amount, buy_x, get_y, is_stackable, priority, start_date, end_date, min_quantity, min_order_value, promo_price",
    example: '[{"promo_code": "PROMO-2024", "promo_row": 1, "is_active": true, "promo_type": "STD", "label": {"it": "Promozione", "en": "Promotion"}, "discount_percentage": 20, "promo_price": 65.00, "is_stackable": false, "priority": 1}]'
  },
  {
    name: "promo_code",
    type: "array",
    category: "pricing",
    required: false,
    description: "Array of active promotion codes (for faceting/filtering)",
    example: '["016", "017"]'
  },
  {
    name: "promo_type",
    type: "array",
    category: "pricing",
    required: false,
    description: "Array of promotion business categories (STD, XXX, OMG, EOL, etc.) for faceting",
    example: '["STD", "OMG"]'
  },
  {
    name: "has_active_promo",
    type: "boolean",
    category: "pricing",
    required: false,
    description: "Has any active promotion",
    example: "true"
  },

  // ============================================
  // INVENTORY & STOCK (18 fields)
  // ============================================
  {
    name: "quantity",
    type: "number",
    category: "inventory",
    required: true,
    description: "Available quantity in stock",
    example: "100"
  },
  {
    name: "sold",
    type: "number",
    category: "inventory",
    required: true,
    description: "Units sold",
    example: "50"
  },
  {
    name: "unit",
    type: "string",
    category: "inventory",
    required: true,
    description: "Base unit of measure (default: pcs)",
    example: "pcs"
  },
  {
    name: "stock_status",
    type: "string",
    category: "inventory",
    required: false,
    description: "Stock status: in_stock, out_of_stock, pre_order",
    example: "in_stock"
  },
  {
    name: "product_status",
    type: "string",
    category: "inventory",
    required: false,
    description: "Product status code from ERP",
    example: "A"
  },
  {
    name: "product_status_description",
    type: "multilingual_text",
    category: "inventory",
    required: false,
    description: "Product status description (multilingual)",
    example: '{"it": "Disponibile", "de": "Verfügbar", "en": "Available"}'
  },
  // Physical - Weight
  {
    name: "weight",
    type: "number",
    category: "inventory",
    required: false,
    description: "Product weight value",
    example: "0.12"
  },
  {
    name: "weight_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Weight unit of measure (KG, G, LB)",
    example: "KG"
  },
  // Physical - Volume
  {
    name: "volume",
    type: "number",
    category: "inventory",
    required: false,
    description: "Product volume value",
    example: "420"
  },
  {
    name: "volume_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Volume unit of measure (CM3, L, ML)",
    example: "CM3"
  },
  // Physical - Dimensions
  {
    name: "dimension_height",
    type: "number",
    category: "inventory",
    required: false,
    description: "Height dimension",
    example: "3.5"
  },
  {
    name: "dimension_width",
    type: "number",
    category: "inventory",
    required: false,
    description: "Width dimension",
    example: "4.5"
  },
  {
    name: "dimension_length",
    type: "number",
    category: "inventory",
    required: false,
    description: "Length dimension",
    example: "26.8"
  },
  {
    name: "dimension_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Dimension unit of measure (CM, MM, M)",
    example: "CM"
  },
  // Packaging with embedded promotions
  {
    name: "packaging_options",
    type: "array",
    category: "inventory",
    required: false,
    description: "Packaging options with code, label (multilingual), qty, uom, is_default, is_smallest, ean, position, pricing object (list, retail, sale), and promotions array (promo_code, promo_row, promo_type, label, discount_percentage, promo_price, etc.)",
    example: '[{"code": "PZ", "label": {"it": "Pezzo", "en": "Piece"}, "qty": 1, "uom": "PZ", "is_default": false, "is_smallest": true, "pricing": {"list": 80.02, "retail": 160.04}}, {"code": "BOX", "label": {"it": "Scatola", "en": "Box"}, "qty": 4, "uom": "PZ", "is_default": true, "is_smallest": false, "pricing": {"list": 320.08, "retail": 640.16, "sale": 288.07}, "promotions": [{"promo_code": "BREVE-SCAD", "promo_row": 1, "is_active": true, "promo_type": "BREVE-SCAD", "label": {"it": "Merce a breve scadenza", "en": "Short expiry goods"}, "discount_percentage": 10, "promo_price": 288.07, "is_stackable": false, "priority": 1, "end_date": "2026-02-07"}]}]'
  },
  // Physical packaging info (informational, not related to selling packaging_options)
  {
    name: "packaging_info",
    type: "array",
    category: "inventory",
    required: false,
    description: "Physical packaging information (informational only, not related to selling). Each entry has: packaging_id (unique), code, description, qty (decimal supported), uom",
    example: '[{"packaging_id": "1", "code": "BOX12", "description": "Standard box", "qty": 12, "uom": "pz"}]'
  },
  {
    name: "packaging_info[0].packaging_id",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unique identifier for this packaging record",
    example: "1"
  },
  {
    name: "packaging_info[0].code",
    type: "string",
    category: "inventory",
    required: false,
    description: "Short packaging code (e.g., BOX12, PALLET)",
    example: "BOX12"
  },
  {
    name: "packaging_info[0].description",
    type: "string",
    category: "inventory",
    required: false,
    description: "Human-readable description of this packaging format",
    example: "Standard carton box"
  },
  {
    name: "packaging_info[0].qty",
    type: "number",
    category: "inventory",
    required: false,
    description: "Quantity per packaging unit (supports decimals, e.g., 0.75)",
    example: "12"
  },
  {
    name: "packaging_info[0].uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unit of measure (e.g., pz, kg)",
    example: "pz"
  },
  {
    name: "packaging_info[0].is_default",
    type: "boolean",
    category: "inventory",
    required: false,
    description: "Whether this packaging is the default selling unit. Syncs is_default to matching packaging_option.",
    example: "true"
  },
  {
    name: "packaging_info[0].is_smallest",
    type: "boolean",
    category: "inventory",
    required: false,
    description: "Whether this packaging is the minimum sellable quantity. Syncs is_smallest to matching packaging_option.",
    example: "true"
  },
  // Import source
  {
    name: "source",
    type: "object",
    category: "inventory",
    required: false,
    description: "Import source info (source_id, source_name, batch_id, imported_at)",
    example: '{"source_id": "erp-sync", "source_name": "ERP Sync", "imported_at": "2024-01-15T10:00:00Z"}'
  },
  {
    name: "item_creation_date",
    type: "date",
    category: "inventory",
    required: false,
    description: "When item was originally created in ERP",
    example: "2024-01-15T10:00:00Z"
  },

  // ============================================
  // MEDIA & IMAGES (2 fields)
  // ============================================
  {
    name: "images",
    type: "array",
    category: "media",
    required: false,
    description: "Product images array (position 0 = cover/main image). Each has: url, cdn_key, position, file_name, file_type, size_bytes, uploaded_at, uploaded_by",
    example: '[{"url": "https://cdn.../image1.jpg", "cdn_key": "products/image1.jpg", "position": 0}]'
  },
  {
    name: "media",
    type: "array",
    category: "media",
    required: false,
    description: "Media files: documents, videos, 3D models. Supports uploads and external URLs (YouTube/Vimeo). Each has: type, url, s3_key, label (multilingual), language, file_type, size_bytes, is_external_link, position",
    example: '[{"type": "document", "url": "https://cdn.../manual.pdf", "label": {"it": "Manuale", "en": "Manual"}, "position": 0}]'
  },

  // ============================================
  // CATEGORY & BRAND (5 fields)
  // ============================================
  {
    name: "brand",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Brand with hierarchy support: brand_id, label, slug, description, logo_url, website_url, parent_brand_id, brand_family, level, path, hierarchy",
    example: '{"brand_id": "brand-bosch", "label": "Bosch Professional", "slug": "bosch-professional"}'
  },
  {
    name: "category",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Category with hierarchy: category_id, name (multilingual), slug (multilingual), details, image, icon, parent_id, level, path, hierarchy",
    example: '{"category_id": "cat-001", "name": {"it": "Trapani", "en": "Drills"}, "slug": {"it": "trapani", "en": "drills"}}'
  },
  {
    name: "collections",
    type: "array",
    category: "taxonomy",
    required: false,
    description: "Multiple collections with hierarchy: collection_id, name (multilingual), slug (multilingual), description, parent_collection_id, level, path, hierarchy",
    example: '[{"collection_id": "col-001", "name": {"it": "Utensili Elettrici", "en": "Power Tools"}}]'
  },
  {
    name: "product_type",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Product type with features: product_type_id, name (multilingual), slug (multilingual), features, inherited_features, parent_type_id, level, path, hierarchy",
    example: '{"product_type_id": "type-001", "name": {"it": "Trapano", "en": "Drill"}}'
  },
  {
    name: "tags",
    type: "array",
    category: "taxonomy",
    required: false,
    description: "Marketing/SEO tags: tag_id, name (multilingual), slug, description, color, tag_category, tag_group, tag_group_data",
    example: '[{"tag_id": "tag-bestseller", "name": {"it": "Più venduto", "en": "Bestseller"}, "slug": "bestseller"}]'
  },

  // ============================================
  // FEATURES & SPECS (4 fields)
  // ============================================
  {
    name: "marketing_features",
    type: "multilingual_array",
    category: "features",
    required: false,
    description: "Marketing features/highlights per language (array of strings)",
    example: '{"it": ["Connessione wireless 2.4GHz", "Sensore 1600 DPI"], "en": ["2.4GHz wireless", "1600 DPI sensor"]}'
  },
  {
    name: "technical_specifications",
    type: "object",
    category: "features",
    required: false,
    description: "Technical specs per language (array of objects with key, label, value, uom, category, order)",
    example: '{"it": [{"key": "peso", "label": "Peso", "value": "0.2", "uom": "kg"}], "en": [{"key": "weight", "label": "Weight", "value": "0.2", "uom": "kg"}]}'
  },
  {
    name: "attributes",
    type: "object",
    category: "features",
    required: false,
    description: "Product attributes per language (array of objects with key, label, value)",
    example: '{"it": [{"key": "color", "label": "Colore", "value": "Nero"}], "en": [{"key": "color", "label": "Color", "value": "Black"}]}'
  },
  {
    name: "synonym_keys",
    type: "array",
    category: "features",
    required: false,
    description: "References to SynonymDictionary.key for search expansion",
    example: '["trapano", "drill", "bohrmaschine"]'
  },

  // ============================================
  // ADDITIONAL FIELDS (17 fields)
  // ============================================
  // Variant relationships
  {
    name: "parent_entity_code",
    type: "string",
    category: "additional",
    required: false,
    description: "Parent product entity_code (for variants)",
    example: "PROD-PARENT-001"
  },
  {
    name: "parent_sku",
    type: "string",
    category: "additional",
    required: false,
    description: "Parent product SKU (for variants)"
  },
  {
    name: "variants_entity_code",
    type: "array",
    category: "additional",
    required: false,
    description: "Child variant entity_codes (for parent products)",
    example: '["PROD-VAR-001", "PROD-VAR-002"]'
  },
  {
    name: "variants_sku",
    type: "array",
    category: "additional",
    required: false,
    description: "Child variant SKUs (for parent products)",
    example: '["SKU-VAR-001", "SKU-VAR-002"]'
  },
  {
    name: "parent_product",
    type: "object",
    category: "additional",
    required: false,
    description: "Self-contained parent product data for variant displays: entity_code, sku, name, slug, cover_image_url, price, brand, category",
    example: '{"entity_code": "PARENT-001", "name": {"it": "Prodotto Base"}}'
  },
  {
    name: "sibling_variants",
    type: "array",
    category: "additional",
    required: false,
    description: "Self-contained sibling variants data: entity_code, sku, name, variant_attributes, cover_image_url, price, stock_status",
    example: '[{"entity_code": "VAR-002", "variant_attributes": {"color": "blue"}}]'
  },
  {
    name: "is_parent",
    type: "boolean",
    category: "additional",
    required: false,
    description: "Is this a parent product? (true for single products and parents, false for variants)",
    example: "true"
  },
  {
    name: "include_faceting",
    type: "boolean",
    category: "additional",
    required: false,
    description: "Include in Solr faceting? (false for parent products with variants)",
    example: "true"
  },
  {
    name: "share_images_with_variants",
    type: "boolean",
    category: "additional",
    required: false,
    description: "Share parent images with all child variants in search",
    example: "false"
  },
  {
    name: "share_media_with_variants",
    type: "boolean",
    category: "additional",
    required: false,
    description: "Share parent media (docs, videos) with all child variants",
    example: "false"
  },
  // SEO
  {
    name: "meta_title",
    type: "multilingual_text",
    category: "additional",
    required: false,
    description: "SEO meta title (multilingual)",
    example: '{"it": "Bosch PSB 750 - Trapano | Miglior Prezzo", "en": "Bosch PSB 750 - Drill | Best Price"}'
  },
  {
    name: "meta_description",
    type: "multilingual_text",
    category: "additional",
    required: false,
    description: "SEO meta description (multilingual)",
    example: '{"it": "Acquista il trapano Bosch PSB 750. Spedizione gratuita.", "en": "Buy Bosch PSB 750 drill. Free shipping."}'
  },
  // Metadata
  {
    name: "meta",
    type: "array",
    category: "additional",
    required: false,
    description: "Generic metadata key-value pairs",
    example: '[{"key": "warranty_type", "value": "manufacturer"}]'
  },
  // PIM internal fields (usually auto-managed)
  {
    name: "status",
    type: "string",
    category: "additional",
    required: false,
    description: "PIM status: draft, published, archived (auto-managed)",
    example: "draft"
  },
  {
    name: "completeness_score",
    type: "number",
    category: "additional",
    required: false,
    description: "Quality score 0-100 (auto-calculated)",
    example: "85"
  },
  {
    name: "auto_publish_enabled",
    type: "boolean",
    category: "additional",
    required: false,
    description: "Enable auto-publish when score threshold is met",
    example: "false"
  },
  {
    name: "min_score_threshold",
    type: "number",
    category: "additional",
    required: false,
    description: "Minimum completeness score for auto-publish (default: 80)",
    example: "80"
  }
];

/**
 * Get fields by category
 */
export function getFieldsByCategory(category: PIMFieldCategory): PIMField[] {
  return PIM_PRODUCT_SCHEMA.filter(field => field.category === category);
}

/**
 * Get required fields only
 */
export function getRequiredFields(): PIMField[] {
  return PIM_PRODUCT_SCHEMA.filter(field => field.required);
}

/**
 * Get field by name
 */
export function getField(name: string): PIMField | undefined {
  return PIM_PRODUCT_SCHEMA.find(field => field.name === name);
}

/**
 * Field categories with labels
 */
export const FIELD_CATEGORIES: { key: PIMFieldCategory; label: string }[] = [
  { key: "core", label: "Core Identity" },
  { key: "pricing", label: "Pricing" },
  { key: "inventory", label: "Inventory & Stock" },
  { key: "media", label: "Media & Images" },
  { key: "taxonomy", label: "Category & Brand" },
  { key: "features", label: "Features & Specs" },
  { key: "additional", label: "Additional Fields" }
];
