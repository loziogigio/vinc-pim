# Cart API - Complete Test Results

**Test Date:** 2026-01-31
**Tenant:** `dfl-eventi-it`
**Base URL:** `http://localhost:3001`

---

## Authentication

```
Content-Type: application/json
x-auth-method: api-key
x-api-key-id: ak_dfl-eventi-it_112233445566
x-api-secret: sk_112233445566778899aabbccddeeff00
```

---

## Full Test Cycle Summary

| Step | Operation | Method | Endpoint | Result |
|------|-----------|--------|----------|--------|
| 1 | Create Cart | POST | `/api/b2b/orders` | `order_id: H4Au48V2Y9a_` |
| 2 | Add 6 Items | POST | `/api/b2b/orders/{id}/items` | lines 10,20,30,40,50,60 |
| 3 | Get Cart | GET | `/api/b2b/orders/{id}` | €3,003.27 total |
| 4 | Update Qty | PATCH | `/api/b2b/orders/{id}/items` | lines 30,50 updated |
| 5 | Remove Items | DELETE | `/api/b2b/orders/{id}/items` | lines 20,40 removed |
| 6 | Delete Cart | DELETE | `/api/b2b/orders/{id}` | Deleted |

---

## Step 1: Create Cart

```bash
POST /api/b2b/orders
```

**Request:**
```json
{
  "customer_id": "-XK_EkTYC1UT",
  "order_type": "b2b",
  "notes": "Full packaging + promos test"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "H4Au48V2Y9a_",
    "cart_number": 17,
    "year": 2026,
    "status": "draft",
    "tenant_id": "dfl-eventi-it",
    "customer_id": "-XK_EkTYC1UT",
    "shipping_address_id": "Q8TMIGNO",
    "price_list_type": "wholesale",
    "order_type": "b2b",
    "currency": "EUR",
    "subtotal_gross": 0,
    "subtotal_net": 0,
    "order_total": 0,
    "items": []
  },
  "customer": {
    "customer_id": "-XK_EkTYC1UT",
    "company_name": "Test Company ggXvCw",
    "email": "company_ggXvCw@example.com"
  }
}
```

---

## Step 2: Add Items

### 2.1 PZ - No Promo (List Price)

```bash
POST /api/b2b/orders/H4Au48V2Y9a_/items
```

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-PZ",
  "quantity": 2,
  "list_price": 50,
  "unit_price": 50,
  "retail_price": 100,
  "vat_rate": 22,
  "name": "Prodotto Test Packaging (PZ)",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "pack_size": 1,
  "image_url": "https://s3.eu-de.cloud-object-storage.appdomain.cloud/vinc-dfl-eventi-it/app/...",
  "discount_chain": [
    {"type": "percentage", "value": -50, "source": "price_list", "order": 1}
  ]
}
```

**Response:** `line_number: 10, line_total: €244.00`

---

### 2.2 BOX - Sale Price (No Promo)

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-BOX",
  "quantity": 6,
  "list_price": 45,
  "unit_price": 40.5,
  "retail_price": 90,
  "vat_rate": 22,
  "name": "Prodotto Test Packaging (BOX sale)",
  "packaging_code": "BOX",
  "packaging_label": "Scatola da 6",
  "pack_size": 6,
  "min_order_quantity": 6,
  "discount_chain": [
    {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
    {"type": "percentage", "value": -10, "source": "price_list_sale", "order": 2}
  ]
}
```

**Response:** `line_number: 20, line_total: €296.46`

---

### 2.3 BOX - With Percentage Promo

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-BOX-PROMO",
  "quantity": 6,
  "list_price": 45,
  "unit_price": 36.45,
  "retail_price": 90,
  "vat_rate": 22,
  "name": "Prodotto Test Packaging (BOX + Promo)",
  "packaging_code": "BOX",
  "packaging_label": "Scatola da 6",
  "pack_size": 6,
  "min_order_quantity": 6,
  "promo_code": "TEST-PROMO-BOX",
  "promo_row": 1,
  "promo_label": "Sconto quantità test",
  "promo_discount_pct": -10,
  "discount_chain": [
    {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
    {"type": "percentage", "value": -10, "source": "price_list_sale", "order": 2},
    {"type": "percentage", "value": -10, "source": "promo", "order": 3}
  ]
}
```

**Response:** `line_number: 30, promo_code: "TEST-PROMO-BOX", line_total: €266.81`

---

### 2.4 CF - Sale Price with Amount Discount

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-CF",
  "quantity": 24,
  "list_price": 45,
  "unit_price": 38.75,
  "retail_price": 90,
  "vat_rate": 22,
  "name": "Prodotto Test Packaging (CF sale)",
  "packaging_code": "CF",
  "packaging_label": "Cartone da 24",
  "pack_size": 24,
  "min_order_quantity": 24,
  "discount_chain": [
    {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
    {"type": "amount", "value": -150, "source": "price_list_sale", "order": 2}
  ]
}
```

**Response:** `line_number: 40, line_total: €1,134.60`

---

### 2.5 CF - With Net Price Promo

```json
{
  "entity_code": "TEST-PKG-001",
  "sku": "TEST-PKG-001-CF-NET",
  "quantity": 24,
  "list_price": 45,
  "unit_price": 30,
  "retail_price": 90,
  "vat_rate": 22,
  "name": "Prodotto Test Packaging (CF Netto)",
  "packaging_code": "CF",
  "packaging_label": "Cartone da 24",
  "pack_size": 24,
  "min_order_quantity": 24,
  "promo_code": "NETTO-24",
  "promo_label": "Netto 24",
  "discount_chain": [
    {"type": "net", "value": 30, "source": "promo", "order": 1}
  ]
}
```

**Response:** `line_number: 50, promo_code: "NETTO-24", line_total: €878.40`

---

### 2.6 Different Product (TEST-PKG-FULL)

```json
{
  "entity_code": "TEST-PKG-FULL",
  "sku": "TEST-PKG-FULL-PZ",
  "quantity": 3,
  "list_price": 50,
  "unit_price": 50,
  "retail_price": 100,
  "vat_rate": 22,
  "name": "Test Full Pricing (PZ)",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "pack_size": 1,
  "discount_chain": [
    {"type": "percentage", "value": -50, "source": "price_list", "order": 1}
  ]
}
```

**Response:** `line_number: 60, line_total: €183.00`

---

## Step 3: Get Cart (After Adding All Items)

```bash
GET /api/b2b/orders/H4Au48V2Y9a_
```

**Response:**
```json
{
  "order_id": "H4Au48V2Y9a_",
  "status": "draft",
  "items": [
    {
      "line_number": 10,
      "sku": "TEST-PKG-001-PZ",
      "name": "Prodotto Test Packaging",
      "quantity": 4,
      "packaging_code": "PZ",
      "pack_size": 1,
      "list_price": 50,
      "unit_price": 50,
      "line_gross": 200,
      "line_net": 200,
      "line_vat": 44,
      "line_total": 244,
      "promo_code": null,
      "discount_chain": [
        {"type": "percentage", "value": -50, "source": "price_list", "order": 1}
      ]
    },
    {
      "line_number": 20,
      "sku": "TEST-PKG-001-BOX",
      "name": "Prodotto Test Packaging (BOX sale)",
      "quantity": 6,
      "packaging_code": "BOX",
      "pack_size": 6,
      "list_price": 45,
      "unit_price": 40.5,
      "line_gross": 270,
      "line_net": 243,
      "line_vat": 53.46,
      "line_total": 296.46,
      "promo_code": null,
      "discount_chain": [
        {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
        {"type": "percentage", "value": -10, "source": "price_list_sale", "order": 2}
      ]
    },
    {
      "line_number": 30,
      "sku": "TEST-PKG-001-BOX-PROMO",
      "name": "Prodotto Test Packaging (BOX + Promo)",
      "quantity": 6,
      "packaging_code": "BOX",
      "pack_size": 6,
      "list_price": 45,
      "unit_price": 36.45,
      "line_gross": 270,
      "line_net": 218.7,
      "line_vat": 48.11,
      "line_total": 266.81,
      "promo_code": "TEST-PROMO-BOX",
      "promo_label": "Sconto quantità test",
      "discount_chain": [
        {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
        {"type": "percentage", "value": -10, "source": "price_list_sale", "order": 2},
        {"type": "percentage", "value": -10, "source": "promo", "order": 3}
      ]
    },
    {
      "line_number": 40,
      "sku": "TEST-PKG-001-CF",
      "name": "Prodotto Test Packaging (CF sale)",
      "quantity": 24,
      "packaging_code": "CF",
      "pack_size": 24,
      "list_price": 45,
      "unit_price": 38.75,
      "line_gross": 1080,
      "line_net": 930,
      "line_vat": 204.6,
      "line_total": 1134.6,
      "promo_code": null,
      "discount_chain": [
        {"type": "percentage", "value": -50, "source": "price_list", "order": 1},
        {"type": "amount", "value": -150, "source": "price_list_sale", "order": 2}
      ]
    },
    {
      "line_number": 50,
      "sku": "TEST-PKG-001-CF-NET",
      "name": "Prodotto Test Packaging (CF Netto)",
      "quantity": 24,
      "packaging_code": "CF",
      "pack_size": 24,
      "list_price": 45,
      "unit_price": 30,
      "line_gross": 1080,
      "line_net": 720,
      "line_vat": 158.4,
      "line_total": 878.4,
      "promo_code": "NETTO-24",
      "promo_label": "Netto 24",
      "discount_chain": [
        {"type": "net", "value": 30, "source": "promo", "order": 1}
      ]
    },
    {
      "line_number": 60,
      "sku": "TEST-PKG-FULL-PZ",
      "name": "Test Full Pricing (PZ)",
      "quantity": 3,
      "packaging_code": "PZ",
      "pack_size": 1,
      "list_price": 50,
      "unit_price": 50,
      "line_gross": 150,
      "line_net": 150,
      "line_vat": 33,
      "line_total": 183,
      "promo_code": null,
      "discount_chain": [
        {"type": "percentage", "value": -50, "source": "price_list", "order": 1}
      ]
    }
  ],
  "totals": {
    "subtotal_gross": 3050,
    "subtotal_net": 2461.7,
    "total_discount": 588.3,
    "total_vat": 541.57,
    "order_total": 3003.27
  }
}
```

---

## Step 4: Update Item Quantities

```bash
PATCH /api/b2b/orders/H4Au48V2Y9a_/items
```

**Request:**
```json
{
  "items": [
    {"line_number": 30, "quantity": 12},
    {"line_number": 50, "quantity": 48}
  ]
}
```

**Response:**
```json
{
  "success": true,
  "results": [
    {"line_number": 30, "success": true},
    {"line_number": 50, "success": true}
  ],
  "order": {
    "order_total": 4148.49
  }
}
```

**Updated Items:**
- Line 30: qty 6 → 12, line_total: €533.63
- Line 50: qty 24 → 48, line_total: €1,756.80

**Note:** Quantity must be multiple of `pack_size`:
- BOX (pack_size: 6) → qty must be 6, 12, 18, 24...
- CF (pack_size: 24) → qty must be 24, 48, 72...

---

## Step 5: Remove Items

```bash
DELETE /api/b2b/orders/H4Au48V2Y9a_/items
```

**Request:**
```json
{
  "line_numbers": [20, 40]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Removed 2 item(s)",
  "results": [
    {"line_number": 20, "success": true},
    {"line_number": 40, "success": true}
  ],
  "order": {
    "items": [10, 30, 50, 60],
    "order_total": 2717.43
  }
}
```

---

## Step 6: Final Cart State (Before Delete)

```json
{
  "order_id": "H4Au48V2Y9a_",
  "status": "draft",
  "items": [
    {"line": 10, "sku": "TEST-PKG-001-PZ", "qty": 4, "unit_price": 50, "line_total": 244, "promo_code": null},
    {"line": 30, "sku": "TEST-PKG-001-BOX-PROMO", "qty": 12, "unit_price": 36.45, "line_total": 533.63, "promo_code": "TEST-PROMO-BOX"},
    {"line": 50, "sku": "TEST-PKG-001-CF-NET", "qty": 48, "unit_price": 30, "line_total": 1756.8, "promo_code": "NETTO-24"},
    {"line": 60, "sku": "TEST-PKG-FULL-PZ", "qty": 3, "unit_price": 50, "line_total": 183, "promo_code": null}
  ],
  "totals": {
    "subtotal_gross": 3050,
    "subtotal_net": 2227.4,
    "total_discount": 822.6,
    "total_vat": 490.03,
    "order_total": 2717.43
  }
}
```

---

## Step 7: Delete Cart

```bash
DELETE /api/b2b/orders/H4Au48V2Y9a_
```

**Response:**
```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

---

## Discount Chain Reference

### Type: `percentage`
Applies percentage discount to current price.

```json
{"type": "percentage", "value": -10, "source": "promo", "order": 1}
```
- `value`: Negative for discount (-10 = 10% off)

### Type: `amount`
Applies fixed amount discount.

```json
{"type": "amount", "value": -150, "source": "price_list_sale", "order": 2}
```
- `value`: Negative for discount (-150 = €150 off total)

### Type: `net`
Sets direct net price (ignores all other discounts).

```json
{"type": "net", "value": 30, "source": "promo", "order": 1}
```
- `value`: Final unit price (€30 per unit)

### Sources
- `price_list`: Base wholesale discount from retail
- `price_list_sale`: Sale price discount
- `promo`: Promotional discount

---

## Mobile App Endpoint Summary

| Operation | Method | Endpoint | Body |
|-----------|--------|----------|------|
| Create Cart | POST | `/api/b2b/orders` | `{customer_id}` |
| Add Item | POST | `/api/b2b/orders/{id}/items` | Item object |
| Get Cart | GET | `/api/b2b/orders/{id}` | - |
| Update Qty | PATCH | `/api/b2b/orders/{id}/items` | `{items: [{line_number, quantity}]}` |
| Remove Items | DELETE | `/api/b2b/orders/{id}/items` | `{line_numbers: [n, ...]}` |
| Delete Cart | DELETE | `/api/b2b/orders/{id}` | - |

---

## Key Points for Mobile Implementation

1. **`line_number`** is the unique identifier for cart items (server-assigned)
2. Same product can have multiple lines with different promos
3. Quantity must respect `pack_size` constraints
4. All totals are auto-recalculated server-side
5. Prices are **per unit** (per piece)
6. Include `image_url` when adding items for display
7. `promo_code` and `discount_chain` preserve promo data through qty updates

---

## Unique Item Identification (item_ref)

Each cart line is uniquely identified by the combination of:

```json
{
  "entity_code": "TEST-PKG-001",
  "packaging_code": "BOX",
  "promo_code": "TEST-PROMO-BOX",
  "promo_row": 1
}
```

### item_ref Format

The `item_ref` field provides a unique identifier string:

```text
{entity_code}:{packaging_code}[:promo_code:promo_row]
```

**Examples:**

| item_ref | Description |
|----------|-------------|
| `TEST-PKG-001:PZ` | Base unit, no promo |
| `TEST-PKG-001:BOX` | Box packaging, no promo |
| `TEST-PKG-001:BOX:TEST-PROMO-BOX:1` | Box with promo row 1 |
| `TEST-PKG-001:CF:NETTO-24` | Carton with net price promo |

### Mobile App: Matching Search Results with Cart

This enables the mobile app to check if a product variant is already in the cart:

```dart
// Generate item_ref from product/promo data
String generateItemRef(String entityCode, String packagingCode, String? promoCode, int? promoRow) {
  if (promoCode == null) {
    return '$entityCode:$packagingCode';
  }
  if (promoRow != null) {
    return '$entityCode:$packagingCode:$promoCode:$promoRow';
  }
  return '$entityCode:$packagingCode:$promoCode';
}

// Check if exact variant is in cart
bool isInCart(Cart cart, String entityCode, String packagingCode, String? promoCode, int? promoRow) {
  final itemRef = generateItemRef(entityCode, packagingCode, promoCode, promoRow);
  return cart.items.any((item) => item.itemRef == itemRef);
}

// Get quantity already in cart for this variant
int getCartQuantity(Cart cart, String itemRef) {
  final item = cart.items.firstWhere(
    (i) => i.itemRef == itemRef,
    orElse: () => null,
  );
  return item?.quantity ?? 0;
}
```

### Use Cases

| Feature | How to Implement |
|---------|------------------|
| **"In Cart" badge** | Check `isInCart()` for current product variant |
| **Show quantity** | Display "3 in cart" using `getCartQuantity()` |
| **Update vs Add** | If `isInCart()` → PATCH to update qty; else → POST to add new |
| **Multiple promos** | Same product with different promos = different `item_ref` = separate lines |

### Why This Matters

The same product can appear multiple times in cart with different configurations:

```text
TEST-PKG-001:PZ                    → €50/unit (list price)
TEST-PKG-001:BOX                   → €40.50/unit (box sale)
TEST-PKG-001:BOX:TEST-PROMO-BOX:1  → €36.45/unit (box + promo)
TEST-PKG-001:CF:NETTO-24           → €30/unit (carton net price)
```

Each represents a distinct purchasing option with different pricing, and the `item_ref` uniquely identifies which one the user selected.
