# Mobile App Cart API Documentation

Complete guide for implementing cart functionality in the mobile app.

## Authentication

### Step 1: Portal User Login

Portal users require **two-layer authentication**:
1. API Key headers (app-level authentication)
2. Username/password credentials (user-level authentication)

```bash
POST /api/b2b/auth/portal-login
```

**Headers:**
```
Content-Type: application/json
x-auth-method: api-key
x-api-key-id: ak_{tenant-id}_{key-suffix}
x-api-secret: sk_{secret}
```

**Request Body:**
```json
{
  "username": "user@example.com",
  "password": "UserPassword123"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "portal_user": {
    "portal_user_id": "pu_abc123",
    "tenant_id": "tenant-id",
    "username": "user@example.com",
    "email": "user@example.com",
    "customer_access": [
      {
        "customer_id": "cust_xyz789",
        "customer_code": "CLI001",
        "role": "buyer"
      }
    ],
    "is_active": true
  },
  "customer_access": [...]
}
```

**Using the Token:**

For all subsequent requests, include:
```
Authorization: Bearer {token}
x-auth-method: api-key
x-api-key-id: ak_{tenant-id}_{key-suffix}
x-api-secret: sk_{secret}
```

---

## Cart Operations

### Step 2: Create a New Cart

```bash
POST /api/b2b/ordersf
```

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {token}
x-auth-method: api-key
x-api-key-id: ak_{tenant-id}_{key-suffix}
x-api-secret: sk_{secret}
```

**Request Body:**
```json
{
  "customer_id": "cust_xyz789",
  "order_type": "b2b",
  "currency": "EUR",
  "price_list_id": "default",
  "price_list_type": "wholesale"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "tc_HCUsDbPpX",
    "status": "draft",
    "is_current": true,
    "customer_id": "cust_xyz789",
    "items": [],
    "subtotal_gross": 0,
    "subtotal_net": 0,
    "total_discount": 0,
    "total_vat": 0,
    "order_total": 0,
    "created_at": "2026-01-28T10:00:00.000Z"
  }
}
```

---

### Get Active Cart (Auto-Create)

Get the current active cart for the logged-in user. If no draft exists, creates one automatically.

```bash
GET /api/b2b/orders/active
```

**Headers:** (same as above)

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "tc_HCUsDbPpX",
    "status": "draft",
    "customer_id": "cust_xyz789",
    "items": [...],
    "subtotal_gross": 234.00,
    "subtotal_net": 199.10,
    "total_discount": 34.90,
    "total_vat": 43.80,
    "order_total": 242.90,
    "created_at": "2026-01-28T10:00:00.000Z"
  },
  "created": false
}
```

**Note:** `created: true` indicates a new cart was just created.

---

### Get Cart by ID (with Items Listing)

Get a specific cart with paginated items list.

```bash
GET /api/b2b/orders/{order_id}
```

**Headers:** (same as above)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `search` | string | - | Filter by SKU, entity_code, or name |

**Unique Line Identifier:**

Each line item has a unique `line_number` within the cart. Use this to identify and modify specific lines:

| Field | Purpose |
| ----- | ------- |
| `line_number` | **Primary key** - Use for PATCH/DELETE operations |
| `entity_code` | Product identifier (same product can have multiple lines with different promos) |
| `sku` | Stock keeping unit (includes packaging) |
| `packaging_code` | Packaging type (PZ, BOX, CF) |
| `promo_code` | Promotion applied (null if no promo) |

**Why `line_number`?**
- Same product can appear multiple times with different promotions
- Same product + packaging can have different promo prices
- `line_number` is always unique and auto-incremented (10, 20, 30...)

**Example:**
```bash
GET /api/b2b/orders/tc_HCUsDbPpX?page=1&limit=10&search=TEST
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "tc_HCUsDbPpX",
    "status": "draft",
    "customer_id": "cust_xyz789",
    "items": [
      {
        "line_number": 10,
        "entity_code": "TEST-PKG-001",
        "sku": "TEST-PKG-001-PZ",
        "name": "Test Product - Piece",
        "quantity": 5,
        "list_price": 10.00,
        "unit_price": 10.00,
        "vat_rate": 22,
        "line_gross": 50.00,
        "line_net": 50.00,
        "line_vat": 11.00,
        "line_total": 61.00,
        "packaging_code": "PZ",
        "packaging_label": "Pezzo",
        "pack_size": 1,
        "discount_chain": []
      },
      {
        "line_number": 20,
        "entity_code": "TEST-PKG-001",
        "sku": "TEST-PKG-001-BOX",
        "name": "Test Product - Box",
        "quantity": 12,
        "list_price": 9.00,
        "unit_price": 8.10,
        "vat_rate": 22,
        "line_gross": 108.00,
        "line_net": 97.20,
        "line_vat": 21.38,
        "line_total": 118.58,
        "packaging_code": "BOX",
        "packaging_label": "Scatola da 6",
        "pack_size": 6,
        "promo_code": "TEST-PROMO-BOX",
        "promo_label": "Sconto 10%",
        "promo_discount_pct": -10,
        "discount_chain": [
          { "type": "percentage", "value": -10, "source": "price_list", "order": 1 },
          { "type": "percentage", "value": -10, "source": "promo", "order": 2 }
        ]
      }
    ],
    "subtotal_gross": 234.00,
    "subtotal_net": 199.10,
    "total_discount": 34.90,
    "total_vat": 43.80,
    "order_total": 242.90
  },
  "customer": {
    "customer_id": "cust_xyz789",
    "external_code": "CLI001",
    "company_name": "ACME Corp",
    "email": "buyer@acme.com"
  },
  "shippingAddress": {
    "address_id": "addr_123",
    "recipient_name": "ACME Corp",
    "street_address": "Via Roma 123",
    "city": "Milano",
    "postal_code": "20100",
    "country": "IT"
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 7,
    "totalPages": 1,
    "totalItemsCount": 7,
    "hasSearch": false
  }
}
```

---

### Cart Summary

The cart summary is included in every order response. Key fields:

| Field | Type | Description |
|-------|------|-------------|
| `subtotal_gross` | number | Sum of all line gross (quantity × list_price) |
| `subtotal_net` | number | Sum of all line net (quantity × unit_price) |
| `total_discount` | number | Total discount amount (gross - net) |
| `total_vat` | number | Total VAT amount |
| `shipping_cost` | number | Shipping cost (0 for draft) |
| `order_total` | number | Final total (net + VAT + shipping) |

**Summary Calculation:**
```
subtotal_gross = Σ (quantity × list_price) for all items
subtotal_net = Σ (quantity × unit_price) for all items
total_discount = subtotal_gross - subtotal_net
total_vat = Σ (line_net × vat_rate / 100) for all items
order_total = subtotal_net + total_vat + shipping_cost
```

---

### Step 3: Add Items to Cart

```bash
POST /api/b2b/orders/{order_id}/items
```

**Headers:** (same as above)

#### 3.1 Basic Item (No Promotion)

Add a single unit without any promotions:

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-PZ",
  "quantity": 1,
  "list_price": 10.00,
  "unit_price": 10.00,
  "vat_rate": 22,
  "name": "Test Product - Piece",
  "image_url": "https://cdn.example.com/products/test-pkg-001.jpg",
  "brand": "Test Brand",
  "category": "Test Category",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "pack_size": 1,
  "quantity_unit": "PZ",
  "min_order_quantity": 1
}
```

#### 3.2 Item with Percentage Discount Promotion

Product with a -10% promo applied:

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-BOX",
  "quantity": 6,
  "list_price": 9.00,
  "unit_price": 8.10,
  "vat_rate": 22,
  "name": "Test Product - Box",
  "packaging_code": "BOX",
  "packaging_label": "Scatola da 6",
  "pack_size": 6,
  "quantity_unit": "PZ",
  "min_order_quantity": 6,
  "promo_code": "TEST-PROMO-BOX",
  "promo_label": "Sconto 10%",
  "promo_discount_pct": -10,
  "discount_chain": [
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list",
      "order": 1
    },
    {
      "type": "percentage",
      "value": -10,
      "source": "promo",
      "order": 2
    }
  ]
}
```

#### 3.3 Item with Sale Price Only (No Promo)

Product with price list sale discount but no promotion:

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-CF",
  "quantity": 1,
  "list_price": 45.00,
  "unit_price": 40.50,
  "vat_rate": 22,
  "name": "Test Product - Carton",
  "packaging_code": "CF",
  "packaging_label": "Cartone da 12",
  "pack_size": 12,
  "quantity_unit": "PZ",
  "min_order_quantity": 1,
  "discount_chain": [
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list",
      "order": 1
    },
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list_sale",
      "order": 2
    }
  ]
}
```

#### 3.4 Item with Amount Discount Promotion

Product with a €5.00 discount promo:

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-BOX",
  "quantity": 6,
  "list_price": 9.00,
  "unit_price": 4.00,
  "vat_rate": 22,
  "name": "Test Product - Box",
  "packaging_code": "BOX",
  "packaging_label": "Scatola da 6",
  "pack_size": 6,
  "quantity_unit": "PZ",
  "min_order_quantity": 6,
  "promo_code": "TEST-2",
  "promo_label": "Sconto €5",
  "promo_discount_amt": -5,
  "discount_chain": [
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list",
      "order": 1
    },
    {
      "type": "amount",
      "value": -5,
      "source": "promo",
      "order": 2
    }
  ]
}
```

#### 3.5 Item with Direct Net Price Promotion

Product with a fixed net price (€6.50):

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-PZ",
  "quantity": 1,
  "list_price": 10.00,
  "unit_price": 6.50,
  "vat_rate": 22,
  "name": "Test Product - Piece",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "pack_size": 1,
  "quantity_unit": "PZ",
  "min_order_quantity": 1,
  "promo_code": "DIRECT-NET",
  "promo_label": "Prezzo Netto €6.50",
  "discount_chain": [
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list",
      "order": 1
    },
    {
      "type": "net",
      "value": 6.50,
      "source": "promo",
      "order": 2
    }
  ]
}
```

#### 3.6 Item with Carton Net Price Promotion

Carton with fixed net price (€30.00):

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-CF",
  "quantity": 1,
  "list_price": 45.00,
  "unit_price": 30.00,
  "vat_rate": 22,
  "name": "Test Product - Carton",
  "packaging_code": "CF",
  "packaging_label": "Cartone da 12",
  "pack_size": 12,
  "quantity_unit": "PZ",
  "min_order_quantity": 1,
  "promo_code": "NETTO-24",
  "promo_label": "Prezzo Netto €30.00",
  "discount_chain": [
    {
      "type": "percentage",
      "value": -10,
      "source": "price_list",
      "order": 1
    },
    {
      "type": "net",
      "value": 30.00,
      "source": "promo",
      "order": 2
    }
  ]
}
```

**Response (all add item requests):**
```json
{
  "success": true,
  "order": {
    "order_id": "tc_HCUsDbPpX",
    "items": [...],
    "subtotal_gross": 234.00,
    "subtotal_net": 199.10,
    "total_discount": 34.90,
    "total_vat": 43.80,
    "order_total": 242.90
  },
  "item": {
    "line_number": 10,
    "entity_code": "TEST-PKG-001",
    "quantity": 1,
    "unit_price": 10.00,
    "line_net": 10.00,
    "line_vat": 2.20,
    "line_total": 12.20,
    "discount_chain": [...]
  }
}
```

---

### Step 4: Update Item Quantities (PATCH)

Update one or more item quantities in the cart:

```bash
PATCH /api/b2b/orders/{order_id}/items
```

**Headers:** (same as above)

**Request Body:**
```json
{
  "items": [
    { "line_number": 10, "quantity": 5 },
    { "line_number": 20, "quantity": 12 },
    { "line_number": 70, "quantity": 3 }
  ]
}
```

**Important Notes:**
- Quantity must respect `pack_size` (e.g., BOX with pack_size=6 must be multiples of 6)
- Quantity must be >= `min_order_quantity`
- All promo fields (`promo_code`, `promo_label`, `discount_chain`, etc.) are preserved

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "tc_HCUsDbPpX",
    "items": [...],
    "subtotal_gross": 456.00,
    "subtotal_net": 387.60,
    "total_discount": 68.40,
    "total_vat": 85.27,
    "order_total": 472.87
  },
  "results": [
    { "line_number": 10, "success": true, "new_quantity": 5 },
    { "line_number": 20, "success": true, "new_quantity": 12 },
    { "line_number": 70, "success": true, "new_quantity": 3 }
  ]
}
```

---

### Step 5: Remove Items from Cart

```bash
DELETE /api/b2b/orders/{order_id}/items
```

**Headers:** (same as above)

**Request Body (Option 1 - line_numbers array):**
```json
{
  "line_numbers": [10, 20, 30]
}
```

**Request Body (Option 2 - items array):**
```json
{
  "items": [
    { "line_number": 10 },
    { "line_number": 20 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "order": {...},
  "results": [
    { "line_number": 10, "success": true },
    { "line_number": 20, "success": true }
  ],
  "message": "Removed 2 item(s)"
}
```

---

## Field Reference

### Required Fields for Add Item

| Field | Type | Description |
|-------|------|-------------|
| `entity_code` | string | Product identifier |
| `sku` | string | Stock keeping unit |
| `quantity` | number | Quantity to add |
| `list_price` | number | Unit list/wholesale price |
| `unit_price` | number | Unit price after discounts |
| `vat_rate` | number | VAT percentage (22, 10, 4, 0) |
| `name` | string | Product name |

### Optional Product Snapshot Fields

**IMPORTANT:** Include these fields to display product info in the cart UI.

| Field | Type | Description |
|-------|------|-------------|
| `image_url` | string | **Product image URL** - Required for cart display |
| `brand` | string | Brand name |
| `category` | string | Category name |
| `retail_price` | number | MSRP (manufacturer's suggested retail price) |

### Optional Packaging Fields

| Field | Type | Description |
|-------|------|-------------|
| `packaging_code` | string | e.g., "PZ", "BOX", "CF" |
| `packaging_label` | string | e.g., "Scatola da 6" |
| `pack_size` | number | Units per package |
| `quantity_unit` | string | e.g., "PZ" |
| `min_order_quantity` | number | Minimum order quantity |

### Optional Promotion Fields

| Field | Type | Description |
|-------|------|-------------|
| `promo_code` | string | Promotion code |
| `promo_label` | string | Promotion description |
| `promo_discount_pct` | number | Percentage discount (e.g., -10) |
| `promo_discount_amt` | number | Amount discount (e.g., -5.00) |
| `discount_chain` | array | Full discount calculation chain |

### Discount Chain Structure

```typescript
interface DiscountStep {
  type: "percentage" | "amount" | "net";
  value?: number;
  source: "price_list" | "price_list_sale" | "promo";
  order: number;  // Sequence of application (1, 2, 3...)
}
```

**Discount Types:**
- `percentage`: Percentage discount (e.g., -10 for 10% off)
- `amount`: Fixed amount discount (e.g., -5.00 for €5 off)
- `net`: Direct net price override (e.g., 6.50 for €6.50 final price)

**Discount Sources:**
- `price_list`: Base price list discount (from retail to wholesale)
- `price_list_sale`: Sale price discount
- `promo`: Promotional discount

---

## Error Responses

### Authentication Errors

```json
// Missing API key headers
{ "error": "API key authentication required" }
// Status: 401

// Invalid credentials
{ "error": "Invalid credentials" }
// Status: 401
```

### Validation Errors

```json
// Missing required fields
{ "error": "Missing required fields: entity_code, quantity" }
// Status: 400

// Invalid quantity
{ "error": "Quantity must be a multiple of 6" }
// Status: 400

// Below minimum
{ "error": "Minimum order quantity is 6" }
// Status: 400
```

### Access Errors

```json
// Order not found or belongs to different tenant
{ "error": "Order not found" }
// Status: 404

// Portal user doesn't have access to this customer
{ "error": "Access denied" }
// Status: 403
```

---

## Price Calculation Logic

All prices are **per unit** (per piece). The mobile app should calculate:

1. **Line Gross**: `quantity × list_price`
2. **Line Net**: `quantity × unit_price`
3. **Line VAT**: `line_net × (vat_rate / 100)`
4. **Line Total**: `line_net + line_vat`

**Example for BOX (pack_size=6):**
- `list_price`: €9.00 per piece
- `unit_price`: €8.10 per piece (after -10% promo)
- `quantity`: 6
- `line_gross`: 6 × €9.00 = €54.00
- `line_net`: 6 × €8.10 = €48.60
- `line_vat`: €48.60 × 0.22 = €10.69
- `line_total`: €48.60 + €10.69 = €59.29

---

## Smart Merge Behavior

When adding an item to the cart, the API checks if an identical item already exists:

**Items are merged if ALL these match:**
- `entity_code`
- `sku`
- `promo_code`
- `unit_price`
- `packaging_code`

If matched, the quantity is **added** to the existing line. Otherwise, a new line is created.

This prevents duplicate lines for the same product/promo combination while allowing different promos for the same product.

---

## Additional Operations

### Update Cart Metadata

Update cart fields like shipping address, delivery date, notes, etc.

```bash
PATCH /api/b2b/orders/{order_id}
```

**Headers:** (same as above)

**Request Body:**
```json
{
  "shipping_address_id": "addr_123",
  "billing_address_id": "addr_456",
  "requested_delivery_date": "2026-02-15",
  "delivery_slot": "morning",
  "delivery_route": "route-north",
  "shipping_method": "courier",
  "po_reference": "PO-2026-0001",
  "cost_center": "DEPT-01",
  "notes": "Please call before delivery"
}
```

**Allowed Fields:**

| Field | Type | Description |
| ----- | ---- | ----------- |
| `shipping_address_id` | string | Shipping address ID |
| `billing_address_id` | string | Billing address ID |
| `requested_delivery_date` | string | ISO date (YYYY-MM-DD) |
| `delivery_slot` | string | morning, afternoon |
| `delivery_route` | string | Delivery route code |
| `shipping_method` | string | courier, pickup |
| `po_reference` | string | Purchase order reference |
| `cost_center` | string | Cost center code |
| `notes` | string | Customer notes |

**Response:**
```json
{
  "success": true,
  "order": {...},
  "message": "Order updated successfully"
}
```

**Note:** Only draft orders can be modified.

---

### Delete Cart

Delete a draft order (empty the cart completely).

```bash
DELETE /api/b2b/orders/{order_id}
```

**Headers:** (same as above)

**Response:**
```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

**Note:** Only draft orders can be deleted. Confirmed orders cannot be deleted.

---

## Complete Workflow Example

### Mobile App Flow

```
1. App Start
   └─ POST /api/b2b/auth/portal-login
      └─ Store token for all requests

2. Open Cart Screen
   └─ GET /api/b2b/orders/active
      └─ Returns existing or creates new cart
      └─ Display cart summary and items

3. Browse Products
   └─ When user taps "Add to Cart":
      └─ POST /api/b2b/orders/{order_id}/items
         └─ Include all promo fields from product data
         └─ Cart totals auto-recalculated

4. Cart Screen - Edit Quantity
   └─ PATCH /api/b2b/orders/{order_id}/items
      └─ {"items": [{"line_number": 10, "quantity": 5}]}
      └─ All promo data preserved

5. Cart Screen - Remove Item
   └─ DELETE /api/b2b/orders/{order_id}/items
      └─ {"line_numbers": [10]}

6. Cart Screen - Search/Filter Items
   └─ GET /api/b2b/orders/{order_id}?search=TERM&page=1&limit=20

7. Checkout
   └─ PATCH /api/b2b/orders/{order_id}
      └─ Set shipping_address_id, delivery date, notes
   └─ POST /api/b2b/orders/{order_id}/confirm (if implemented)
```

---

## Line Item Structure (Full Reference)

```json
{
  "line_number": 10,

  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-BOX",
  "product_source": "pim",
  "external_ref": "ERP-12345",

  "quantity": 6,
  "quantity_unit": "PZ",
  "min_order_quantity": 6,
  "pack_size": 6,
  "packaging_code": "BOX",
  "packaging_label": "Scatola da 6",

  "list_price": 9.00,
  "retail_price": 12.00,
  "unit_price": 8.10,
  "promo_price": 8.10,
  "vat_rate": 22,

  "line_gross": 54.00,
  "line_net": 48.60,
  "line_vat": 10.69,
  "line_total": 59.29,

  "discounts": [],
  "total_discount_percent": 10,

  "promo_id": "promo_abc123",
  "is_gift_line": false,
  "gift_with_purchase": null,

  "name": "Test Product - Box",
  "image_url": "https://cdn.example.com/products/test-pkg-001.jpg",
  "brand": "Test Brand",
  "category": "Test Category",

  "added_at": "2026-01-28T10:05:00.000Z",
  "updated_at": "2026-01-28T10:30:00.000Z",
  "added_from": "pdp",
  "added_via": "main_cta",

  "promo_code": "TEST-PROMO-BOX",
  "promo_row": 1,
  "promo_label": "Sconto 10%",
  "promo_discount_pct": -10,
  "promo_discount_amt": null,
  "discount_chain": [
    { "type": "percentage", "value": -10, "source": "price_list", "order": 1 },
    { "type": "percentage", "value": -10, "source": "promo", "order": 2 }
  ]
}
```
