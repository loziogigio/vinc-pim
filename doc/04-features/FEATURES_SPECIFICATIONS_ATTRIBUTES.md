# Features, Specifications & Attributes

Complete guide for understanding and using the three product data concepts in the PIM system.

---

## Overview

The PIM system uses **three distinct concepts** to describe product information:

| Concept | Italian | Purpose | Data Type | Use Case |
|---------|---------|---------|-----------|----------|
| **Features** | Caratteristiche | Marketing highlights | Array of strings | Customer-facing benefits |
| **Specifications** | Specifiche tecniche | Technical data | Array of objects with UOM | Precise measurements |
| **Attributes** | Attributi | Structured metadata | Flexible key-value | Filters, facets, internal data |

---

## 1. Features (Caratteristiche)

### Purpose
Marketing-focused highlights that communicate value to customers. These are the "selling points" of a product.

### Data Structure
```typescript
features?: string[];
```

### Examples
```json
{
  "features": [
    "Wireless Charging",
    "Water Resistant IP68",
    "5-year Warranty",
    "Energy Star Certified",
    "Made in Italy",
    "Free Shipping",
    "90-day Return Policy"
  ]
}
```

### UI Display
**Product Page:**
```
✓ Wireless Charging
✓ Water Resistant IP68
✓ 5-year Warranty
✓ Energy Star Certified
```

### When to Use
- ✅ Marketing benefits (warranties, certifications)
- ✅ Key selling points (wireless charging, water resistant)
- ✅ Customer-facing highlights (free shipping, easy returns)
- ❌ NOT for precise measurements (use specifications)
- ❌ NOT for internal metadata (use attributes)

### Solr Indexing
- **Field**: `features` (multiValued text_it)
- **Searchable**: ✅ Yes - included in full-text search
- **Faceting**: ✅ Possible (e.g., "Water Resistant" filter)
- **Display**: ✅ Returned in search results

---

## 2. Specifications (Specifiche tecniche)

### Purpose
Precise technical data with measurements and units of measure (UOM). Used for accurate product comparison.

### Data Structure
```typescript
specifications?: {
  key: string;        // Programmatic identifier
  label: string;      // Display label (i18n-friendly)
  value: string | number; // Specification value
  uom?: string;       // Unit of measure (optional)
  category?: string;  // Grouping (Physical, Electrical, etc.)
  order?: number;     // Display order
}[];
```

### Examples

**Laptop:**
```json
{
  "specifications": [
    {
      "key": "weight",
      "label": "Peso",
      "value": 2.0,
      "uom": "kg",
      "category": "Physical",
      "order": 1
    },
    {
      "key": "dimensions",
      "label": "Dimensioni",
      "value": "41.5 x 29.0 x 2.5",
      "uom": "cm",
      "category": "Physical",
      "order": 2
    },
    {
      "key": "processor",
      "label": "Processore",
      "value": "Intel Core i7-13700H",
      "category": "Performance",
      "order": 3
    },
    {
      "key": "ram",
      "label": "Memoria RAM",
      "value": 32,
      "uom": "GB",
      "category": "Performance",
      "order": 4
    },
    {
      "key": "storage",
      "label": "Storage",
      "value": 1,
      "uom": "TB",
      "category": "Performance",
      "order": 5
    },
    {
      "key": "power_consumption",
      "label": "Consumo energetico",
      "value": 65,
      "uom": "W",
      "category": "Electrical",
      "order": 6
    }
  ]
}
```

**Power Tool:**
```json
{
  "specifications": [
    {
      "key": "power",
      "label": "Potenza",
      "value": 750,
      "uom": "W",
      "category": "Electrical"
    },
    {
      "key": "voltage",
      "label": "Tensione",
      "value": 230,
      "uom": "V",
      "category": "Electrical"
    },
    {
      "key": "rpm",
      "label": "Velocità",
      "value": 3000,
      "uom": "rpm",
      "category": "Performance"
    },
    {
      "key": "cable_length",
      "label": "Lunghezza cavo",
      "value": 3.0,
      "uom": "m",
      "category": "Physical"
    }
  ]
}
```

### UI Display

**Grouped by Category:**
```
Specifiche Fisiche:
  Peso: 2.0 kg
  Dimensioni: 41.5 x 29.0 x 2.5 cm

Specifiche Prestazioni:
  Processore: Intel Core i7-13700H
  Memoria RAM: 32 GB
  Storage: 1 TB

Specifiche Elettriche:
  Consumo energetico: 65 W
```

**Product Comparison Table:**
```
                  Product A    Product B    Product C
Peso              2.0 kg       1.8 kg       2.2 kg
RAM               32 GB        16 GB        32 GB
Storage           1 TB         512 GB       2 TB
Consumo           65 W         45 W         80 W
```

### When to Use
- ✅ Precise measurements (weight, dimensions)
- ✅ Technical specs (processor, RAM, power)
- ✅ Any value with units (kg, cm, W, V, GB)
- ✅ Product comparison requirements
- ✅ Filtering by numeric ranges (e.g., weight < 2kg)

### Solr Indexing

**Full JSON storage:**
- **Field**: `specifications_json` (string, stored only)
- **Purpose**: Complete data for display

**Search & faceting:**
- **Fields**: `spec_labels`, `spec_values` (text, multiValued)
- **Purpose**: Full-text search on spec labels/values
- **Example query**: `spec_labels:peso OR spec_values:32`

**Common specs (dedicated fields):**
- `spec_weight` (pfloat) - Auto-extracted from `key: "weight"`
- `spec_length` (pfloat)
- `spec_width` (pfloat)
- `spec_height` (pfloat)
- `spec_power` (pfloat)
- `spec_voltage` (pfloat)

**Range filtering:**
```
q=*:*&fq=spec_weight:[1.5 TO 2.5]    // Weight between 1.5-2.5 kg
q=*:*&fq=spec_power:[500 TO 1000]    // Power 500-1000W
```

**Faceting:**
```
facet=true
facet.field=spec_weight
facet.range=spec_power
```

---

## 3. Attributes (Attributi)

### Purpose
Flexible structured metadata for filtering, faceting, and internal classification. Highly adaptable key-value pairs.

### Data Structure
```typescript
attributes?: Record<string, any>;
```

### Examples

```json
{
  "attributes": {
    "recyclable": true,
    "made_in": "Italy",
    "eco_friendly": true,
    "material": "aluminum",
    "color_family": "metallic",
    "warranty_years": 5,
    "requires_assembly": false,
    "indoor_outdoor": "outdoor",
    "compatible_models": ["MODEL-A", "MODEL-B", "MODEL-C"],
    "certifications": ["CE", "RoHS", "Energy Star"],
    "target_audience": "professional",
    "price_category": "premium",
    "seasonal": false
  }
}
```

### UI Display

**Filters (Sidebar):**
```
Filters:
  ☑ Made in Italy
  ☐ Eco-friendly
  ☐ Recyclable
  ☐ Requires Assembly

Material:
  ☐ Aluminum (120)
  ☐ Steel (45)
  ☐ Plastic (78)

Price Category:
  ☐ Budget (234)
  ☑ Premium (89)
  ☐ Luxury (23)
```

**Product Badge:**
```
🌍 Eco-friendly   🇮🇹 Made in Italy   ⭐ Energy Star Certified
```

### When to Use
- ✅ Boolean flags (recyclable, eco_friendly)
- ✅ Classification (price_category, target_audience)
- ✅ Internal metadata (vendor_id, import_source)
- ✅ Faceting/filtering values (material, color_family)
- ✅ Arrays of related data (compatible_models, certifications)
- ✅ Anything that doesn't fit features or specifications

### Solr Indexing
- **Field**: `attributes` (string, JSON-encoded)
- **Storage**: Full JSON stored for retrieval
- **Recommendation**: For heavy filtering, consider extracting common attributes to dedicated Solr fields

**Example dynamic fields (optional):**
```xml
<!-- In managed-schema.xml -->
<dynamicField name="attr_*_b" type="boolean" indexed="true" stored="true"/>
<dynamicField name="attr_*_s" type="string" indexed="true" stored="true"/>
<dynamicField name="attr_*_i" type="pint" indexed="true" stored="true"/>
```

**Usage:**
```json
{
  "attr_recyclable_b": true,
  "attr_made_in_s": "Italy",
  "attr_warranty_years_i": 5
}
```

**Query:**
```
q=*:*&fq=attr_recyclable_b:true&fq=attr_made_in_s:"Italy"
```

---

## Complete Example: Gaming Laptop

```json
{
  "entity_code": "LAPTOP-GAMING-001",
  "sku": "LG-ASUS-001",
  "title": "ASUS ROG Strix G16 Gaming Laptop",
  "description": "High-performance gaming laptop with RTX 4070...",

  "features": [
    "NVIDIA GeForce RTX 4070",
    "RGB Backlit Keyboard",
    "Dolby Atmos Audio",
    "Fast Charging (50% in 30 min)",
    "2-year Warranty",
    "Free Gaming Mouse Included"
  ],

  "specifications": [
    {
      "key": "weight",
      "label": "Peso",
      "value": 2.5,
      "uom": "kg",
      "category": "Physical",
      "order": 1
    },
    {
      "key": "dimensions",
      "label": "Dimensioni",
      "value": "35.4 x 25.9 x 2.7",
      "uom": "cm",
      "category": "Physical",
      "order": 2
    },
    {
      "key": "screen_size",
      "label": "Dimensione schermo",
      "value": 16,
      "uom": "inch",
      "category": "Display",
      "order": 3
    },
    {
      "key": "resolution",
      "label": "Risoluzione",
      "value": "2560x1600",
      "category": "Display",
      "order": 4
    },
    {
      "key": "refresh_rate",
      "label": "Refresh rate",
      "value": 165,
      "uom": "Hz",
      "category": "Display",
      "order": 5
    },
    {
      "key": "processor",
      "label": "Processore",
      "value": "Intel Core i9-13980HX",
      "category": "Performance",
      "order": 6
    },
    {
      "key": "ram",
      "label": "RAM",
      "value": 32,
      "uom": "GB",
      "category": "Performance",
      "order": 7
    },
    {
      "key": "storage",
      "label": "Storage",
      "value": 1,
      "uom": "TB",
      "category": "Performance",
      "order": 8
    },
    {
      "key": "gpu",
      "label": "Scheda grafica",
      "value": "NVIDIA GeForce RTX 4070",
      "category": "Performance",
      "order": 9
    },
    {
      "key": "battery",
      "label": "Batteria",
      "value": 90,
      "uom": "Wh",
      "category": "Electrical",
      "order": 10
    },
    {
      "key": "power_consumption",
      "label": "Alimentatore",
      "value": 240,
      "uom": "W",
      "category": "Electrical",
      "order": 11
    }
  ],

  "attributes": {
    "brand_tier": "premium",
    "target_audience": "gamers",
    "use_case": ["gaming", "content_creation", "video_editing"],
    "gaming_category": "high_end",
    "rgb_lighting": true,
    "webcam_resolution": "1080p",
    "fingerprint_reader": false,
    "thunderbolt_4": true,
    "ethernet_port": true,
    "wifi_generation": 6,
    "bluetooth_version": 5.2,
    "os_preinstalled": "Windows 11 Pro",
    "upgradeable_ram": true,
    "upgradeable_storage": true,
    "vr_ready": true,
    "color": "black",
    "finish": "matte",
    "certifications": ["Energy Star"]
  }
}
```

---

## UI Implementation

### Product Detail Page

**1. Hero Section**
```tsx
<div>
  <h1>{product.title}</h1>
  <p>{product.description}</p>

  {/* Features (badges/highlights) */}
  <div className="features">
    {product.features?.map(feature => (
      <span className="badge">✓ {feature}</span>
    ))}
  </div>
</div>
```

**2. Technical Specifications Tab**
```tsx
<div className="specifications">
  {groupSpecsByCategory(product.specifications).map(group => (
    <div key={group.category}>
      <h3>{group.category}</h3>
      <table>
        {group.specs.map(spec => (
          <tr key={spec.key}>
            <td>{spec.label}</td>
            <td>
              {spec.value} {spec.uom && <span className="unit">{spec.uom}</span>}
            </td>
          </tr>
        ))}
      </table>
    </div>
  ))}
</div>
```

**3. Filters (Sidebar)**
```tsx
<aside className="filters">
  {/* Attribute-based filters */}
  <FilterGroup title="Made in">
    <Checkbox value="Italy" count={120} />
    <Checkbox value="Germany" count={45} />
  </FilterGroup>

  <FilterGroup title="Eco-friendly">
    <Checkbox value="recyclable" count={89} />
    <Checkbox value="energy_star" count={134} />
  </FilterGroup>

  {/* Specification-based range filters */}
  <FilterGroup title="Weight">
    <RangeSlider min={0} max={5} unit="kg" />
  </FilterGroup>

  <FilterGroup title="Power">
    <RangeSlider min={0} max={1000} unit="W" />
  </FilterGroup>
</aside>
```

---

## Helper Functions

### Group Specifications by Category
```typescript
export function groupSpecsByCategory(specifications?: Specification[]) {
  if (!specifications) return [];

  const groups: Record<string, Specification[]> = {};

  specifications.forEach(spec => {
    const category = spec.category || 'General';
    if (!groups[category]) groups[category] = [];
    groups[category].push(spec);
  });

  return Object.entries(groups)
    .map(([category, specs]) => ({
      category,
      specs: specs.sort((a, b) => (a.order || 0) - (b.order || 0))
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
```

### Format Specification Value
```typescript
export function formatSpecValue(spec: Specification): string {
  const value = typeof spec.value === 'number'
    ? spec.value.toLocaleString('it-IT')
    : spec.value;

  return spec.uom ? `${value} ${spec.uom}` : value;
}
```

### Extract Attribute for Display
```typescript
export function getAttribute(product: PIMProduct, key: string, defaultValue: any = null) {
  return product.attributes?.[key] ?? defaultValue;
}

// Usage
const isMadeInItaly = getAttribute(product, 'made_in') === 'Italy';
const isEcoFriendly = getAttribute(product, 'eco_friendly', false);
```

---

## Migration Guide

If you have existing products with the old `features` structure:

### Old Structure (Before)
```typescript
features?: {
  label: string;
  value: string;
  unit?: string;
}[];
```

### Migration Script
```typescript
import { PIMProductModel } from '@/lib/db/models/pim-product';

async function migrateFeaturesToSpecifications() {
  const products = await PIMProductModel.find({
    features: { $exists: true, $ne: [] }
  });

  for (const product of products) {
    // Convert old features to specifications
    const specifications = product.features?.map((feature, index) => ({
      key: feature.label.toLowerCase().replace(/\s+/g, '_'),
      label: feature.label,
      value: feature.value,
      uom: feature.unit,
      order: index + 1,
    }));

    // Clear old features, set new specifications
    product.features = [];
    product.specifications = specifications;

    await product.save();
    console.log(`✓ Migrated product: ${product.entity_code}`);
  }

  console.log(`Migration complete: ${products.length} products updated`);
}

// Run migration
migrateFeaturesToSpecifications();
```

---

## Summary Table

| Aspect | Features | Specifications | Attributes |
|--------|----------|----------------|------------|
| **Data Type** | Array of strings | Array of objects | Flexible key-value |
| **Purpose** | Marketing highlights | Technical measurements | Metadata & filters |
| **Display** | Badges, bullet points | Tables, comparison | Filters, facets |
| **UOM Support** | ❌ No | ✅ Yes | ❌ No (unless custom) |
| **Full-text Search** | ✅ Yes | ✅ Yes (labels + values) | ⚠️ Limited (JSON) |
| **Range Filtering** | ❌ No | ✅ Yes (numeric specs) | ⚠️ Limited |
| **Faceting** | ✅ Yes | ✅ Yes | ✅ Yes |
| **i18n Support** | ⚠️ Direct translation | ✅ Label field supports i18n | ⚠️ Manual |
| **Product Comparison** | ❌ Not ideal | ✅ Perfect | ⚠️ Limited |

---

## Best Practices

### ✅ DO
- Use **features** for customer-facing benefits
- Use **specifications** for precise technical data with units
- Use **attributes** for internal metadata and filtering
- Include UOM in specifications when applicable
- Group specifications by category for better UX
- Extract common specs to dedicated Solr fields for range filtering

### ❌ DON'T
- Don't mix marketing and technical data
- Don't put measurements in features (use specifications)
- Don't put boolean flags in specifications (use attributes)
- Don't forget to include units of measure in specifications
- Don't over-complicate - choose the simplest structure that fits

---

**Last Updated:** 2025-11-18
