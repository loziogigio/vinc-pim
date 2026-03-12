# Coupons API

API for managing discount coupons: CRUD operations, validation, application to orders, and removal.

## Base URL

```
/api/b2b/coupons
```

## Authentication

All endpoints require B2B authentication via `requireTenantAuth`.

| Method    | Headers                                          |
| --------- | ------------------------------------------------ |
| Session   | Cookie-based                                     |
| API Key   | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| JWT Token | `Authorization: Bearer <token>`                  |

---

## Coupon Model

| Field                    | Type     | Required | Default  | Description                                         |
| ------------------------ | -------- | -------- | -------- | --------------------------------------------------- |
| `coupon_id`              | string   | auto     | `cpn_*`  | Unique coupon ID (nanoid)                           |
| `code`                   | string   | yes      | —        | Coupon code (uppercase, unique, max 30 chars)       |
| `channel`                | string   | yes      | —        | Sales channel code (e.g. `b2c`, `b2c-de`)          |
| `description`            | string   | no       | —        | Internal description (max 500 chars)                |
| `label`                  | string   | no       | —        | Display label (max 200 chars)                       |
| `status`                 | string   | auto     | `active` | `active`, `inactive`, or `depleted`                 |
| `discount_type`          | string   | yes      | —        | `percentage` or `fixed`                             |
| `discount_value`         | number   | yes      | —        | Discount amount (% or absolute value)               |
| `start_date`             | ISO date | no       | —        | Coupon valid from                                   |
| `end_date`               | ISO date | no       | —        | Coupon valid until                                  |
| `max_uses`               | number   | no       | —        | Maximum total uses (auto-depletes when reached)     |
| `max_uses_per_customer`  | number   | no       | —        | Maximum uses per customer                           |
| `usage_count`            | number   | auto     | `0`      | Current usage count                                 |
| `customer_emails`        | string[] | no       | `[]`     | Restrict to these emails (supports guests)          |
| `scope_type`             | string   | auto     | `order`  | Discount scope (MVP: `order` only)                  |
| `include_shipping`       | boolean  | no       | `false`  | Include shipping in discount calculation            |
| `is_cumulative`          | boolean  | no       | `true`   | Allow stacking with other discounts                 |
| `min_order_amount`       | number   | no       | —        | Minimum order subtotal (net) required               |
| `max_order_amount`       | number   | no       | —        | Maximum order subtotal (net) allowed                |
| `max_discount_amount`    | number   | no       | —        | Cap on discount value (e.g. "10% off, max 50 EUR")  |
| `notes`                  | string   | no       | —        | Internal notes (max 1000 chars)                     |
| `created_by`             | string   | auto     | —        | User ID who created the coupon                      |
| `created_at`             | date     | auto     | —        | Creation timestamp                                  |
| `updated_at`             | date     | auto     | —        | Last update timestamp                               |

### Status Lifecycle

| Status     | Description                                          |
| ---------- | ---------------------------------------------------- |
| `active`   | Coupon can be used                                   |
| `inactive` | Manually disabled by admin                           |
| `depleted` | Auto-set when `usage_count` reaches `max_uses`       |

When a coupon is removed from an order, if `usage_count` drops below `max_uses`, the status is automatically restored to `active`.

---

## List Coupons

**Endpoint:** `GET /api/b2b/coupons`

**Query Parameters:**

| Param    | Type   | Default | Description                              |
| -------- | ------ | ------- | ---------------------------------------- |
| `page`   | number | 1       | Page number                              |
| `limit`  | number | 20      | Items per page                           |
| `status` | string | —       | Filter by `active`, `inactive`, `depleted` |
| `search` | string | —       | Search by code or description            |

**Response:**

```json
{
  "success": true,
  "items": [
    {
      "coupon_id": "cpn_abc123",
      "code": "SUMMER10",
      "channel": "b2c",
      "discount_type": "percentage",
      "discount_value": 10,
      "status": "active",
      "usage_count": 3,
      "max_uses": 100,
      "start_date": "2026-06-01T00:00:00.000Z",
      "end_date": "2026-08-31T23:59:59.000Z",
      "created_at": "2026-05-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## Create Coupon

**Endpoint:** `POST /api/b2b/coupons`

**Body:**

```json
{
  "code": "SUMMER10",
  "channel": "b2c",
  "discount_type": "percentage",
  "discount_value": 10,
  "description": "Summer sale 10% off",
  "label": "Summer Sale",
  "start_date": "2026-06-01T00:00:00Z",
  "end_date": "2026-08-31T23:59:59Z",
  "max_uses": 100,
  "max_uses_per_customer": 1,
  "customer_emails": [],
  "is_cumulative": true,
  "min_order_amount": 50,
  "max_discount_amount": 200
}
```

**Required fields:** `code`, `channel`, `discount_type`, `discount_value`

**Response (201):**

```json
{
  "success": true,
  "coupon": {
    "coupon_id": "cpn_abc123",
    "code": "SUMMER10",
    "channel": "b2c",
    "discount_type": "percentage",
    "discount_value": 10,
    "status": "active",
    "usage_count": 0,
    ...
  }
}
```

**Errors:**

| Status | Condition                                  |
| ------ | ------------------------------------------ |
| 400    | Missing or invalid required fields         |
| 400    | `percentage` discount_value > 100          |
| 409    | Duplicate coupon code                      |

---

## Get Coupon

**Endpoint:** `GET /api/b2b/coupons/{coupon_id}`

**Response:**

```json
{
  "success": true,
  "coupon": {
    "coupon_id": "cpn_abc123",
    "code": "SUMMER10",
    "channel": "b2c",
    "discount_type": "percentage",
    "discount_value": 10,
    "status": "active",
    "usage_count": 3,
    "usage_history": [
      {
        "order_id": "ord_xyz789",
        "customer_id": "cust_456",
        "used_at": "2026-06-15T14:30:00.000Z",
        "discount_amount": 80.00
      }
    ],
    ...
  }
}
```

---

## Update Coupon

**Endpoint:** `PATCH /api/b2b/coupons/{coupon_id}`

Send only the fields you want to update.

**Body:**

```json
{
  "label": "Updated Label",
  "status": "inactive",
  "end_date": "2026-12-31T23:59:59Z",
  "max_uses": 200,
  "customer_emails": ["vip@example.com"],
  "min_order_amount": 100
}
```

**Updatable fields:** `code`, `channel`, `description`, `label`, `status` (`active`/`inactive`), `start_date`, `end_date`, `max_uses`, `max_uses_per_customer`, `customer_emails`, `discount_type`, `discount_value`, `include_shipping`, `is_cumulative`, `min_order_amount`, `max_order_amount`, `max_discount_amount`, `notes`

**Response:**

```json
{
  "success": true,
  "coupon": { ... }
}
```

---

## Delete Coupon

**Endpoint:** `DELETE /api/b2b/coupons/{coupon_id}`

Permanently removes the coupon. Coupons already applied to orders remain in effect until manually removed.

**Response:**

```json
{
  "success": true
}
```

---

## Validate Coupon

Checks if a coupon code is valid for a specific order without applying it. Returns the estimated discount amount.

**Endpoint:** `POST /api/b2b/coupons/validate`

**Body:**

```json
{
  "code": "SUMMER10",
  "order_id": "ord_xyz789",
  "customer_id": "cust_456"
}
```

| Field         | Required | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| `code`        | yes      | Coupon code to validate                          |
| `order_id`    | yes      | Order to validate against (for totals, channel)  |
| `customer_id` | no       | Customer ID (for per-customer usage checks)      |

**Response (valid):**

```json
{
  "success": true,
  "valid": true,
  "coupon": {
    "coupon_id": "cpn_abc123",
    "code": "SUMMER10",
    "label": "Summer Sale",
    "discount_type": "percentage",
    "discount_value": 10,
    "scope_type": "order",
    "estimated_discount": 80.00
  }
}
```

**Response (invalid):**

```json
{
  "success": true,
  "valid": false,
  "error": "Coupon has expired"
}
```

### Validation Checks

The following are checked in order:

1. Coupon exists and matches code (case-insensitive)
2. Status is `active`
3. Current date is within `start_date` / `end_date` range
4. `usage_count` < `max_uses` (if set)
5. Per-customer usage < `max_uses_per_customer` (if set)
6. Customer email is in `customer_emails` list (if restricted, case-insensitive)
7. Order `subtotal_net` >= `min_order_amount` (if set)
8. Order `subtotal_net` <= `max_order_amount` (if set)
9. Order channel matches coupon `channel`

---

## Apply Coupon to Order

Validates and applies a coupon to an order. Updates order totals and increments coupon usage.

**Endpoint:** `POST /api/b2b/orders/{order_id}/coupon`

**Body:**

```json
{
  "code": "SUMMER10",
  "customer_id": "cust_456"
}
```

| Field         | Required | Description                                    |
| ------------- | -------- | ---------------------------------------------- |
| `code`        | yes      | Coupon code to apply                           |
| `customer_id` | no       | Customer ID (resolved automatically from order if omitted) |

**Response:**

```json
{
  "success": true,
  "order": {
    "order_id": "ord_xyz789",
    "coupon_code": "SUMMER10",
    "coupon_id": "cpn_abc123",
    "subtotal_net": 800.00,
    "discount_net": 80.00,
    "total_net": 720.00,
    ...
  },
  "discount_applied": 80.00
}
```

**Errors:**

| Status | Condition                                     |
| ------ | --------------------------------------------- |
| 400    | Missing `code`                                |
| 400    | Order already has a coupon applied            |
| 400    | Coupon validation failed (expired, depleted, etc.) |

### Behavior

- Runs full validation (same as `/validate`)
- Rejects if the order already has a coupon (one coupon per order)
- For **non-cumulative** coupons (`is_cumulative: false`): removes any existing promo/coupon discounts before applying
- Adds a `cart_discount` entry with `reason: "coupon"` to the order
- Sets `coupon_code` and `coupon_id` on the order
- Recalculates order totals (`subtotal_net`, `discount_net`, `total_net`, `total_gross`, etc.)
- Increments coupon `usage_count` and adds a record to `usage_history`
- If `usage_count` reaches `max_uses`, coupon status becomes `depleted`
- Customer email is resolved automatically: from `order.buyer.email` (B2C guest orders) or from customer record lookup (B2B orders)

---

## Remove Coupon from Order

Removes the applied coupon and restores the original order totals.

**Endpoint:** `DELETE /api/b2b/orders/{order_id}/coupon`

**Response:**

```json
{
  "success": true,
  "order": {
    "order_id": "ord_xyz789",
    "coupon_code": null,
    "coupon_id": null,
    "subtotal_net": 800.00,
    "discount_net": 0,
    "total_net": 800.00,
    ...
  }
}
```

### Behavior

- Removes the `cart_discount` entry with `reason: "coupon"`
- Clears `coupon_code` and `coupon_id` from the order
- Recalculates order totals
- Decrements coupon `usage_count` and removes the usage record from `usage_history`
- If the coupon was `depleted` and `usage_count` drops below `max_uses`, status is restored to `active`

---

## Examples

### Create a 10% Coupon for a Specific Channel

```bash
curl -X POST /api/b2b/coupons \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_tenant_abc" \
  -H "x-api-secret: sk_secret" \
  -d '{
    "code": "WELCOME10",
    "channel": "b2c",
    "discount_type": "percentage",
    "discount_value": 10,
    "description": "Welcome discount",
    "max_uses": 500,
    "max_uses_per_customer": 1
  }'
```

### Create a Fixed Discount with Minimum Order

```bash
curl -X POST /api/b2b/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "code": "SAVE50",
    "channel": "b2c",
    "discount_type": "fixed",
    "discount_value": 50,
    "min_order_amount": 200,
    "is_cumulative": false,
    "max_uses": 1
  }'
```

### Create a VIP Coupon Restricted by Email

```bash
curl -X POST /api/b2b/coupons \
  -H "Content-Type: application/json" \
  -d '{
    "code": "VIP20",
    "channel": "b2c",
    "discount_type": "percentage",
    "discount_value": 20,
    "customer_emails": ["vip@example.com", "gold@example.com"],
    "description": "VIP customers only"
  }'
```

### Validate Before Applying

```bash
curl -X POST /api/b2b/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME10",
    "order_id": "ord_xyz789"
  }'
```

### Apply Coupon to Order

```bash
curl -X POST /api/b2b/orders/ord_xyz789/coupon \
  -H "Content-Type: application/json" \
  -d '{ "code": "WELCOME10" }'
```

### Remove Coupon from Order

```bash
curl -X DELETE /api/b2b/orders/ord_xyz789/coupon
```
