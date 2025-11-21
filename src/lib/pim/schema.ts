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
 */

export type PIMFieldCategory = "core" | "pricing" | "inventory" | "media" | "taxonomy" | "features" | "additional";

export type PIMField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "multilingual_text" | "multilingual_array";
  category: PIMFieldCategory;
  required: boolean;
  description: string;
  example?: string;
};

/**
 * Complete PIM Product Schema
 * Based on IPIMProduct interface
 */
export const PIM_PRODUCT_SCHEMA: PIMField[] = [
  // Core Identity
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
    description: "Short product description (multilingual - supports all enabled languages)",
    example: '{"it": "Mouse wireless ad alta precisione", "de": "Hochpräzise kabellose Maus", "en": "High-precision wireless mouse"}'
  },
  {
    name: "long_description",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "Detailed product description (multilingual - supports all enabled languages, can contain HTML)",
    example: '{"it": "<p>Mouse wireless ergonomico con <strong>illuminazione RGB</strong></p>", "en": "<p>Ergonomic wireless mouse with <strong>RGB lighting</strong></p>"}'
  },
  {
    name: "product_status",
    type: "string",
    category: "core",
    required: false,
    description: "Product status code",
    example: "available"
  },
  {
    name: "product_status_description",
    type: "multilingual_text",
    category: "core",
    required: false,
    description: "Product status description (multilingual)",
    example: '{"it": "Disponibile - Spedizione in 1-2 giorni", "de": "Verfügbar - Versand in 1-2 Tagen", "en": "Available - Ships in 1-2 days"}'
  },

  // Pricing
  {
    name: "price",
    type: "number",
    category: "pricing",
    required: false,
    description: "Regular price",
    example: "29.99"
  },
  {
    name: "sale_price",
    type: "number",
    category: "pricing",
    required: false,
    description: "Sale/promotional price",
    example: "24.99"
  },
  {
    name: "min_price",
    type: "number",
    category: "pricing",
    required: false,
    description: "Minimum price"
  },
  {
    name: "max_price",
    type: "number",
    category: "pricing",
    required: false,
    description: "Maximum price"
  },

  // Inventory
  {
    name: "quantity",
    type: "number",
    category: "inventory",
    required: false,
    description: "Available quantity",
    example: "100"
  },
  {
    name: "stock",
    type: "number",
    category: "inventory",
    required: false,
    description: "Stock level",
    example: "100"
  },
  {
    name: "sold",
    type: "number",
    category: "inventory",
    required: false,
    description: "Units sold"
  },
  {
    name: "stock_status",
    type: "string",
    category: "inventory",
    required: false,
    description: "Stock status (in_stock, out_of_stock, pre_order)",
    example: "in_stock"
  },
  {
    name: "min_stock",
    type: "number",
    category: "inventory",
    required: false,
    description: "Minimum stock level",
    example: "10"
  },
  {
    name: "lot_size",
    type: "number",
    category: "inventory",
    required: false,
    description: "Lot/batch size",
    example: "100"
  },

  // Unit of Measure (Base)
  {
    name: "uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Base unit of measure (PZ=piece, KG=kilogram, LT=liter, MT=meter, etc.)",
    example: "PZ"
  },
  {
    name: "uom_description",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unit of measure description",
    example: "Pieces"
  },

  // Packaging Options
  {
    name: "packaging_options",
    type: "array",
    category: "inventory",
    required: false,
    description: "All available packaging options with multilingual labels (array of objects with id, code, label, qty, uom, is_default, is_smallest, ean, position)",
    example: '[{"id": "pkg-1", "code": "PZ", "label": {"it": "Pezzo singolo", "en": "Single Piece"}, "qty": 1, "uom": "PZ", "is_default": false, "is_smallest": true}, {"id": "pkg-2", "code": "CT", "label": {"it": "Cartone", "en": "Carton"}, "qty": 12, "uom": "PZ", "is_default": true, "is_smallest": false}]'
  },

  // Physical Properties - Weight
  {
    name: "gross_weight",
    type: "number",
    category: "inventory",
    required: false,
    description: "Gross weight",
    example: "0.5"
  },
  {
    name: "net_weight",
    type: "number",
    category: "inventory",
    required: false,
    description: "Net weight",
    example: "0.45"
  },
  {
    name: "weight_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unit of measure for weight (KG=kilogram, LB=pound, G=gram, etc.)",
    example: "KG"
  },

  // Physical Properties - Dimensions
  {
    name: "length",
    type: "number",
    category: "inventory",
    required: false,
    description: "Length",
    example: "20"
  },
  {
    name: "width",
    type: "number",
    category: "inventory",
    required: false,
    description: "Width",
    example: "15"
  },
  {
    name: "height",
    type: "number",
    category: "inventory",
    required: false,
    description: "Height",
    example: "10"
  },
  {
    name: "dimension_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unit of measure for dimensions (CM=centimeter, M=meter, IN=inch, FT=foot, etc.)",
    example: "CM"
  },

  // Physical Properties - Volume
  {
    name: "volume",
    type: "number",
    category: "inventory",
    required: false,
    description: "Volume",
    example: "0.003"
  },
  {
    name: "volume_uom",
    type: "string",
    category: "inventory",
    required: false,
    description: "Unit of measure for volume (L=liter, ML=milliliter, M3=cubic meter, GAL=gallon, etc.)",
    example: "L"
  },

  // Media
  {
    name: "gallery",
    type: "array",
    category: "media",
    required: false,
    description: "Product image gallery (array of image objects with id, url, s3_key, label, position - first image [position 0] is the cover/main image)",
    example: '[{"id": "img_001", "url": "https://cdn.../image1.jpg", "label": "Main product photo", "position": 0}, {"id": "img_002", "url": "https://cdn.../image2.jpg", "position": 1}]'
  },
  {
    name: "media",
    type: "array",
    category: "media",
    required: false,
    description: "Media files (documents, videos, 3D models) with multilingual labels - supports both uploaded files and external URLs (YouTube, Vimeo, etc.)",
    example: '[{"type": "document", "url": "https://cdn.../manual.pdf", "label": {"it": "Manuale d\'uso", "en": "User Manual"}, "language": "it", "position": 0}]'
  },

  // Taxonomy
  {
    name: "brand",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Brand object with id, name (universal, not translated), slug, and optional image",
    example: '{"id": "brand-bosch", "name": "Bosch Professional", "slug": "bosch-professional"}'
  },
  {
    name: "category",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Category object with id, name (multilingual), slug (multilingual), details (multilingual), icon, and optional image",
    example: '{"id": "cat-001", "name": {"it": "Trapani", "de": "Bohrmaschinen", "en": "Drills"}, "slug": {"it": "trapani", "de": "bohrmaschinen", "en": "drills"}}'
  },
  {
    name: "collections",
    type: "array",
    category: "taxonomy",
    required: false,
    description: "Array of collection objects with id, name (multilingual), and slug (multilingual)",
    example: '[{"id": "col-001", "name": {"it": "Utensili Elettrici", "en": "Power Tools"}, "slug": {"it": "utensili-elettrici", "en": "power-tools"}}]'
  },
  {
    name: "product_type",
    type: "object",
    category: "taxonomy",
    required: false,
    description: "Product type object with id, name (multilingual), slug (multilingual), and optional features array",
    example: '{"id": "type-001", "name": {"it": "Trapano", "en": "Drill"}, "slug": {"it": "trapano", "en": "drill"}}'
  },
  {
    name: "tags",
    type: "array",
    category: "taxonomy",
    required: false,
    description: "Array of tag objects with id, name (multilingual), and slug (universal)",
    example: '[{"id": "tag-bestseller", "name": {"it": "Più venduto", "en": "Bestseller"}, "slug": "bestseller"}]'
  },

  // Features & Specifications
  {
    name: "features",
    type: "multilingual_array",
    category: "features",
    required: false,
    description: "Product features (multilingual array of strings per language)",
    example: '{"it": ["Connessione wireless 2.4GHz", "Sensore ottico 1600 DPI"], "en": ["2.4GHz wireless connection", "1600 DPI optical sensor"]}'
  },
  {
    name: "specifications",
    type: "multilingual_array",
    category: "features",
    required: false,
    description: "Product specifications (multilingual array of objects with key, label, value, uom, category, order)",
    example: '{"it": [{"key": "peso", "label": "Peso", "value": "0.2", "uom": "kg"}], "en": [{"key": "weight", "label": "Weight", "value": "0.2", "uom": "kg"}]}'
  },
  {
    name: "attributes",
    type: "multilingual_array",
    category: "features",
    required: false,
    description: "Product attributes (multilingual array of objects with key, label, value, uom, type, order)",
    example: '{"it": [{"key": "colore", "label": "Colore", "value": "Nero"}], "en": [{"key": "color", "label": "Color", "value": "Black"}]}'
  },
  {
    name: "meta",
    type: "array",
    category: "features",
    required: false,
    description: "Metadata key-value pairs (array of objects with key and value)",
    example: '[{"key": "warranty_type", "value": "manufacturer"}, {"key": "origin_country", "value": "Italy"}]'
  },

  // Additional Fields
  {
    name: "model",
    type: "string",
    category: "additional",
    required: false,
    description: "Model number",
    example: "WM-2024"
  },
  {
    name: "product_model",
    type: "string",
    category: "additional",
    required: false,
    description: "Product model code"
  },
  {
    name: "color",
    type: "string",
    category: "additional",
    required: false,
    description: "Product color",
    example: "Black"
  },
  {
    name: "material",
    type: "string",
    category: "additional",
    required: false,
    description: "Material",
    example: "Plastic"
  },
  {
    name: "weight",
    type: "number",
    category: "additional",
    required: false,
    description: "Product weight",
    example: "0.2"
  },
  {
    name: "dimensions",
    type: "string",
    category: "additional",
    required: false,
    description: "Product dimensions",
    example: "10 x 5 x 3 cm"
  },
  {
    name: "warranty_months",
    type: "number",
    category: "additional",
    required: false,
    description: "Warranty period in months",
    example: "12"
  },
  {
    name: "manufacturer",
    type: "string",
    category: "additional",
    required: false,
    description: "Manufacturer name"
  },
  {
    name: "ean",
    type: "array",
    category: "additional",
    required: false,
    description: "EAN barcodes (array of strings for multiple codes)",
    example: '["5901234123457", "5901234123464"]'
  },
  {
    name: "docs",
    type: "array",
    category: "additional",
    required: false,
    description: "Product documents"
  },
  {
    name: "parent_entity_code",
    type: "string",
    category: "additional",
    required: false,
    description: "Parent product entity code (for product variations)",
    example: "PROD-PARENT-001"
  },
  {
    name: "parent_sku",
    type: "string",
    category: "additional",
    required: false,
    description: "Parent product SKU"
  },
  {
    name: "variations_sku",
    type: "array",
    category: "additional",
    required: false,
    description: "Child variation SKUs (array of SKU strings)",
    example: '["SKU-VAR-001", "SKU-VAR-002", "SKU-VAR-003"]'
  },
  {
    name: "variations_entity_code",
    type: "array",
    category: "additional",
    required: false,
    description: "Child variation entity_codes (array of entity_code strings)",
    example: '["PROD-VAR-001", "PROD-VAR-002", "PROD-VAR-003"]'
  },

  // Promotions
  {
    name: "promotions",
    type: "array",
    category: "additional",
    required: false,
    description: "Product promotions with multilingual labels (array of promotion objects with promo_code, is_active, promo_type, label, discount_percentage, discount_amount, is_stackable, priority, start_date, end_date, min_quantity, min_order_value)",
    example: '[{"promo_code": "PROMO-2024", "is_active": true, "promo_type": "percentage", "label": {"it": "Promozione di Natale", "en": "Christmas Promotion"}, "discount_percentage": 20, "is_stackable": false, "priority": 1, "start_date": "2024-12-01T00:00:00Z", "end_date": "2024-12-31T23:59:59Z"}]'
  },

  // SEO
  {
    name: "meta_title",
    type: "multilingual_text",
    category: "additional",
    required: false,
    description: "SEO meta title (multilingual - supports all enabled languages)",
    example: '{"it": "Bosch PSB 750 - Trapano Professionale | Miglior Prezzo", "de": "Bosch PSB 750 - Profi-Bohrmaschine | Bester Preis", "en": "Bosch PSB 750 - Professional Drill | Best Price"}'
  },
  {
    name: "meta_description",
    type: "multilingual_text",
    category: "additional",
    required: false,
    description: "SEO meta description (multilingual - supports all enabled languages)",
    example: '{"it": "Acquista il trapano professionale Bosch PSB 750. Potenza 750W, 2 velocità. Spedizione gratuita.", "en": "Buy Bosch PSB 750 professional drill. 750W power, 2 speeds. Free shipping."}'
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
