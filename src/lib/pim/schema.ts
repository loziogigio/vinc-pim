/**
 * PIM Product Schema Definition
 * Defines all available fields in the PIM product standard
 */

export type PIMFieldCategory = "core" | "pricing" | "inventory" | "media" | "taxonomy" | "features" | "additional";

export type PIMField = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
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
    type: "string",
    category: "core",
    required: true,
    description: "Product name/title",
    example: "Wireless Mouse"
  },
  {
    name: "slug",
    type: "string",
    category: "core",
    required: false,
    description: "URL-friendly slug",
    example: "wireless-mouse"
  },
  {
    name: "description",
    type: "string",
    category: "core",
    required: false,
    description: "Product description",
    example: "High-precision wireless mouse"
  },
  {
    name: "long_description",
    type: "string",
    category: "core",
    required: false,
    description: "Detailed product description (can contain HTML)",
    example: "<p>Ergonomic wireless mouse with <strong>RGB lighting</strong></p>"
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

  // Packaging - Smallest Option
  {
    name: "packaging_option_smallest",
    type: "object",
    category: "inventory",
    required: false,
    description: "Smallest packaging option (lowest qty_x_packaging)",
    example: '{"packaging_id": 1, "packaging_code": "PZ", "packaging_uom": "PZ", "qty_x_packaging": 1, "packaging_is_default": false, "packaging_is_smallest": true}'
  },

  // Packaging - Default Option
  {
    name: "packaging_option_default",
    type: "object",
    category: "inventory",
    required: false,
    description: "Default packaging option for sales",
    example: '{"packaging_id": 2, "packaging_code": "CT", "packaging_uom": "PZ", "qty_x_packaging": 12, "packaging_is_default": true, "packaging_is_smallest": false}'
  },

  // Packaging - All Options
  {
    name: "packaging_options_all",
    type: "array",
    category: "inventory",
    required: false,
    description: "All available packaging options",
    example: '[{"packaging_id": 1, "packaging_code": "PZ", "qty_x_packaging": 1}, {"packaging_id": 2, "packaging_code": "CT", "qty_x_packaging": 12}, {"packaging_id": 3, "packaging_code": "PAL", "qty_x_packaging": 576}]'
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
    name: "image",
    type: "object",
    category: "media",
    required: false,
    description: "Main product image with multiple sizes (thumbnail: 50x50 for lists, medium: 300x300 for cards, large: 1000x1000 for detail views, original: 2000x2000+ for zoom/download, blur: base64 placeholder)",
    example: '{"id": "img_001", "thumbnail": "50x50.webp", "medium": "300x300.webp", "large": "1000x1000.webp", "original": "2000x2000.jpg", "blur": "data:image/jpeg;base64,/9j/4AAQ..."}'
  },
  {
    name: "gallery",
    type: "array",
    category: "media",
    required: false,
    description: "Product image gallery"
  },
  {
    name: "images",
    type: "array",
    category: "media",
    required: false,
    description: "Array of image URLs",
    example: '["url1", "url2"]'
  },

  // Taxonomy
  {
    name: "category",
    type: "string",
    category: "taxonomy",
    required: false,
    description: "Product category",
    example: "Electronics"
  },
  {
    name: "subcategory",
    type: "string",
    category: "taxonomy",
    required: false,
    description: "Product subcategory",
    example: "Computer Accessories"
  },
  {
    name: "brand",
    type: "string",
    category: "taxonomy",
    required: false,
    description: "Brand name",
    example: "TechBrand"
  },
  {
    name: "tag",
    type: "array",
    category: "taxonomy",
    required: false,
    description: "Product tags"
  },

  // Features & Specifications
  {
    name: "features",
    type: "array",
    category: "features",
    required: false,
    description: "Product features (label, value, unit)",
    example: '[{label: "Weight", value: "0.2", unit: "kg"}]'
  },
  {
    name: "technical_specs",
    type: "array",
    category: "features",
    required: false,
    description: "Technical specifications"
  },
  {
    name: "meta",
    type: "array",
    category: "features",
    required: false,
    description: "Metadata key-value pairs"
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
    name: "barcode",
    type: "string",
    category: "additional",
    required: false,
    description: "Product barcode/EAN"
  },
  {
    name: "ean",
    type: "string",
    category: "additional",
    required: false,
    description: "EAN code"
  },
  {
    name: "docs",
    type: "array",
    category: "additional",
    required: false,
    description: "Product documents"
  },
  {
    name: "id_parent",
    type: "string",
    category: "additional",
    required: false,
    description: "Parent product ID (for variations)"
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
    name: "variations",
    type: "array",
    category: "additional",
    required: false,
    description: "Child variation SKUs"
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
