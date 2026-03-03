# Shipping & Payments API

Complete guide to delivery costs (shipping) and payment processing in VINC Commerce Suite.

---

## Part 1 — Shipping / Delivery Costs

Shipping is zone-based with tiered pricing. Each tenant configures their own zones, methods, and cost tiers.

### Architecture

```
Shipping Config (per tenant)
 └─ Zones (geographic regions)
     └─ Methods (delivery options)
         └─ Tiers (price tiers based on order subtotal)
```

### Data Model

#### Shipping Zone

| Field | Type | Description |
|-------|------|-------------|
| `zone_id` | string | Unique identifier (nanoid) |
| `name` | string | Display name (e.g. "Italy", "Europe") |
| `countries` | string[] | ISO 3166-1 alpha-2 codes. Use `["*"]` for catch-all |
| `methods` | IShippingMethod[] | Available delivery methods in this zone |

#### Shipping Method

| Field | Type | Description |
|-------|------|-------------|
| `method_id` | string | Unique identifier (nanoid) |
| `name` | string | Display name (e.g. "Standard delivery") |
| `carrier` | string? | Carrier label (e.g. "BRT", "DHL", "GLS") |
| `tiers` | IShippingTier[] | Price tiers (**must include min_subtotal: 0**) |
| `estimated_days_min` | number? | Minimum estimated delivery days |
| `estimated_days_max` | number? | Maximum estimated delivery days |
| `enabled` | boolean | Whether this method is currently offered |
| `allowed_payment_methods` | string[]? | Payment methods allowed for this delivery method. Omit or empty = all tenant-enabled methods |

#### Shipping Tier

| Field | Type | Description |
|-------|------|-------------|
| `min_subtotal` | number | Minimum order subtotal_net (inclusive) |
| `rate` | number | Cost in tenant currency (0 = free shipping) |

### Tier Evaluation Algorithm

Tiers are sorted **descending** by `min_subtotal`. The first tier where `subtotal_net >= min_subtotal` is selected.

**Example — Standard delivery:**

| Tier | min_subtotal | rate |
|------|-------------|------|
| Free over €300 | 300 | 0 |
| Reduced over €100 | 100 | 7.00 |
| Base | 0 | 12.50 |

- Order subtotal €350 → **€0** (free shipping)
- Order subtotal €150 → **€7.00**
- Order subtotal €50 → **€12.50**

### Allowed Payment Methods per Shipping Method

Each shipping method can restrict which payment methods are available at checkout.

**Two-level resolution:**
1. **Tenant level:** `TenantPaymentConfig.enabled_methods` — globally enabled payment methods
2. **Shipping method level:** `IShippingMethod.allowed_payment_methods` — per-method restriction

**Effective available methods = intersection of both.**

| Scenario | Result |
|----------|--------|
| Method has `allowed_payment_methods` set | Intersect with tenant's `enabled_methods` |
| Method has no restriction (undefined/empty) | All tenant `enabled_methods` are available |
| Tenant has no config yet | All `PAYMENT_METHODS` values are available |

**Common examples:**

| Delivery Method | `allowed_payment_methods` | Effect |
|-----------------|--------------------------|--------|
| Pick up at warehouse | _(not set)_ | All tenant-enabled methods |
| Home delivery | `["credit_card", "bank_transfer"]` | Only card and bank transfer |
| Pay at delivery (contrassegno) | `["cash_on_delivery"]` | Only cash on delivery |

**Backend enforcement:** When recording a payment on an order, the backend validates that the payment method is allowed by the order's shipping method. Rejected with 400 if not.

### Zone Matching

1. **Exact match** — country code found in `zone.countries`
2. **Wildcard** — zone with `countries: ["*"]` (catch-all fallback)
3. **No match** — returns `null`, no shipping options available

---

### API Reference — Shipping Configuration

#### GET /api/b2b/shipping-config

Returns the tenant's shipping configuration.

**Authentication:** Session, API Key, or Bearer JWT

**Response (not configured):**
```json
{
  "success": true,
  "data": { "zones": [] }
}
```

**Response (configured):**
```json
{
  "success": true,
  "data": {
    "zones": [
      {
        "zone_id": "z-italy",
        "name": "Italy",
        "countries": ["IT"],
        "methods": [
          {
            "method_id": "m-pickup",
            "name": "Pick up at warehouse",
            "tiers": [{ "min_subtotal": 0, "rate": 0 }],
            "estimated_days_min": 1,
            "estimated_days_max": 2,
            "enabled": true
          },
          {
            "method_id": "m-standard",
            "name": "Standard delivery",
            "carrier": "BRT",
            "tiers": [
              { "min_subtotal": 0, "rate": 12.5 },
              { "min_subtotal": 100, "rate": 7 },
              { "min_subtotal": 300, "rate": 0 }
            ],
            "estimated_days_min": 3,
            "estimated_days_max": 5,
            "enabled": true
          }
        ]
      }
    ],
    "updated_at": "2026-03-02T13:35:21.251Z"
  }
}
```

#### PUT /api/b2b/shipping-config

Replace the tenant's full shipping configuration. Upsert — creates if not exists.

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "zones": [
    {
      "zone_id": "z-italy",
      "name": "Italy",
      "countries": ["IT"],
      "methods": [
        {
          "method_id": "m-pickup",
          "name": "Pick up at warehouse",
          "tiers": [{ "min_subtotal": 0, "rate": 0 }],
          "estimated_days_min": 1,
          "estimated_days_max": 2,
          "enabled": true
        },
        {
          "method_id": "m-standard",
          "name": "Standard delivery",
          "carrier": "BRT",
          "tiers": [
            { "min_subtotal": 0, "rate": 12.50 },
            { "min_subtotal": 100, "rate": 7.00 },
            { "min_subtotal": 300, "rate": 0 }
          ],
          "estimated_days_min": 3,
          "estimated_days_max": 5,
          "enabled": true,
          "allowed_payment_methods": ["credit_card", "bank_transfer"]
        },
        {
          "method_id": "m-cod",
          "name": "Pay at delivery",
          "carrier": "BRT",
          "tiers": [
            { "min_subtotal": 0, "rate": 17.00 },
            { "min_subtotal": 100, "rate": 7.00 }
          ],
          "estimated_days_min": 3,
          "estimated_days_max": 5,
          "enabled": true,
          "allowed_payment_methods": ["cash_on_delivery"]
        },
        {
          "method_id": "m-express",
          "name": "Express delivery",
          "carrier": "DHL",
          "tiers": [
            { "min_subtotal": 0, "rate": 18.00 },
            { "min_subtotal": 200, "rate": 9.50 }
          ],
          "estimated_days_min": 1,
          "estimated_days_max": 2,
          "enabled": true,
          "allowed_payment_methods": ["credit_card"]
        }
      ]
    },
    {
      "zone_id": "z-europe",
      "name": "Europe",
      "countries": ["DE", "FR", "ES", "AT", "NL", "BE", "PT", "CH"],
      "methods": [
        {
          "method_id": "m-eu-standard",
          "name": "European standard delivery",
          "carrier": "GLS",
          "tiers": [
            { "min_subtotal": 0, "rate": 25.00 },
            { "min_subtotal": 500, "rate": 15.00 }
          ],
          "estimated_days_min": 5,
          "estimated_days_max": 10,
          "enabled": true
        }
      ]
    }
  ]
}
```

**Validation rules:**

| Rule | Error |
|------|-------|
| `zones` not an array | `zones must be an array` |
| Zone without name | `Each zone must have a name` |
| Zone with empty countries | `Zone "{name}" must have at least one country code` |
| Method without name | `Each shipping method must have a name` |
| Method missing base tier | `Method "{name}" in zone "{zone}" must have at least one tier with min_subtotal: 0` |
| Invalid payment method in `allowed_payment_methods` | `Method "{name}": invalid payment methods: {values}` |

---

### API Reference — Order Shipping

#### GET /api/b2b/orders/[id]/shipping-options

Returns available shipping methods with computed costs for a draft order.

**Authentication:** Session, API Key, or Bearer JWT

**Resolution chain:** `order → shipping_address_id → customer address → country → zone → methods`

**Response:**
```json
{
  "success": true,
  "data": {
    "zone_name": "Italy",
    "country": "IT",
    "options": [
      {
        "method_id": "m-pickup",
        "name": "Pick up at warehouse",
        "computed_cost": 0,
        "is_free": true,
        "estimated_days_min": 1,
        "estimated_days_max": 2,
        "allowed_payment_methods": ["credit_card", "paypal"]
      },
      {
        "method_id": "m-standard",
        "name": "Standard delivery",
        "carrier": "BRT",
        "computed_cost": 7,
        "is_free": false,
        "estimated_days_min": 3,
        "estimated_days_max": 5,
        "allowed_payment_methods": ["credit_card"]
      },
      {
        "method_id": "m-cod",
        "name": "Pay at delivery",
        "carrier": "BRT",
        "computed_cost": 7,
        "is_free": false,
        "estimated_days_min": 3,
        "estimated_days_max": 5,
        "allowed_payment_methods": ["cash_on_delivery"]
      }
    ]
  }
}
```

Returns `{ zone_name: null, options: [] }` if no shipping address set or no zone matches.

#### POST /api/b2b/orders/[id]/shipping

Apply a shipping method to a draft order. Recomputes the cost against the current order subtotal.

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "method_id": "m-standard"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shipping_method": "Standard delivery",
    "shipping_cost": 7,
    "order_total": 134.15,
    "allowed_payment_methods": ["credit_card", "bank_transfer"]
  }
}
```

**Order total formula:**
```
order_total = subtotal_net + total_vat + shipping_cost
```

**Validation:**

| Condition | Error (status) |
|-----------|---------------|
| Order not found | `Order not found` (404) |
| Order not in draft status | `Shipping can only be set on draft orders` (400) |
| No shipping address | `Order must have a shipping address before selecting a shipping method` (400) |
| Address has no country | `Shipping address has no country set` (400) |
| No shipping config | `No shipping configuration found for this tenant` (400) |
| Country not in any zone | `No shipping zone configured for country: {code}` (400) |
| Method not found/disabled | `Shipping method not found or not available` (404) |

---

## Part 2 — Payments

Multi-provider payment system with commission tracking, transaction audit trail, and support for multiple payment types.

### Payment Types

| Type | Description | 3DS | Use Case |
|------|-------------|-----|----------|
| `onclick` | Standard e-commerce | Required | Customer on checkout page |
| `moto` | Mail Order / Telephone Order | Exempt | Operator enters card server-side |
| `recurrent` | Recurring / subscription | N/A | Tokenized card, merchant-initiated |

### Supported Providers

| Provider | OnClick | MOTO | Recurring | Auto Split |
|----------|---------|------|-----------|------------|
| Stripe | yes | yes | yes | yes |
| Mangopay | yes | no | yes | yes |
| PayPal | yes | no | yes | no |
| Nexi XPay | yes | yes | yes | no |
| Axerve (Fabrick) | yes | yes | yes | no |
| Satispay | yes | no | no | no |
| Scalapay | yes | no | no | no |
| Manual | no | no | no | no |

### Payment Methods

`credit_card`, `debit_card`, `bank_transfer`, `paypal`, `satispay`, `klarna`, `scalapay`, `apple_pay`, `google_pay`, `sepa_direct_debit`, `cash_on_delivery`

### Transaction Status Lifecycle

```
pending → processing → authorized → captured → completed
                                                    ↓
                                              refunded / partial_refund
pending → failed
pending → cancelled
```

| Status | Description |
|--------|-------------|
| `pending` | Transaction created, awaiting provider response |
| `processing` | Provider is processing the payment |
| `authorized` | Payment authorized, not yet captured |
| `captured` | Payment captured by provider |
| `completed` | Payment fully settled |
| `failed` | Payment failed |
| `cancelled` | Payment cancelled before completion |
| `refunded` | Fully refunded |
| `partial_refund` | Partially refunded |

### Commission System

Each transaction has a platform commission automatically calculated:

```
commission_amount = gross_amount × commission_rate
net_amount = gross_amount - commission_amount
```

- Default commission rate: **2.5%** (`PAYMENT_DEFAULTS.COMMISSION_RATE = 0.025`)
- Rate is configurable per tenant via `TenantPaymentConfig.commission_rate`
- Amounts are rounded to 2 decimal places

### Transaction Data Model

| Field | Type | Description |
|-------|------|-------------|
| `transaction_id` | string | Unique transaction ID |
| `tenant_id` | string | Tenant identifier |
| `order_id` | string? | Associated order ID |
| `provider` | string | Payment provider name |
| `provider_payment_id` | string | Provider's payment reference |
| `payment_type` | string | `onclick`, `moto`, or `recurrent` |
| `gross_amount` | number | Total payment amount |
| `currency` | string | Currency code (default: EUR) |
| `commission_rate` | number | Platform commission rate |
| `commission_amount` | number | Calculated commission |
| `net_amount` | number | Amount after commission |
| `status` | string | Transaction status |
| `method` | string? | Payment method used |
| `customer_id` | string? | Customer identifier |
| `customer_email` | string? | Customer email |
| `failure_reason` | string? | Failure description |
| `failure_code` | string? | Provider error code |
| `events` | IPaymentEvent[] | Audit trail |
| `idempotency_key` | string? | Prevents duplicate charges |

---

### API Reference — Payment Configuration

#### GET /api/b2b/payments/config

Returns the tenant's payment configuration.

**Authentication:** Session, API Key, or Bearer JWT

**Response (not configured):**
```json
{
  "success": true,
  "config": {
    "tenant_id": "my-tenant",
    "commission_rate": 0.025,
    "providers": {},
    "default_provider": null,
    "enabled_methods": []
  },
  "configured": false
}
```

**Response (configured):**
```json
{
  "success": true,
  "config": {
    "tenant_id": "my-tenant",
    "commission_rate": 0.025,
    "default_provider": "stripe",
    "enabled_methods": ["credit_card", "paypal"],
    "providers": {
      "stripe": {
        "account_id": "acct_xxx",
        "account_status": "active",
        "charges_enabled": true,
        "payouts_enabled": true
      }
    }
  },
  "configured": true
}
```

#### PUT /api/b2b/payments/config

Update tenant payment configuration.

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "default_provider": "stripe",
  "enabled_methods": ["credit_card", "paypal"]
}
```

**Validation:**

| Rule | Error |
|------|-------|
| Invalid provider name | `Invalid provider: {name}. Allowed: stripe, mangopay, paypal, nexi, axerve, satispay, scalapay, manual` |

---

### API Reference — Create Payment

#### POST /api/b2b/payments/create

Create a standard e-commerce payment (3DS required).

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "order_id": "ORD-001",
  "amount": 134.15,
  "currency": "EUR",
  "provider": "stripe",
  "method": "credit_card",
  "customer_id": "abc123",
  "customer_email": "customer@example.com",
  "return_url": "https://shop.example.com/checkout/complete",
  "idempotency_key": "pay_ORD-001_attempt1"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_id` | string | Yes | Order to charge |
| `amount` | number | Yes | Positive amount |
| `currency` | string | No | Default `"EUR"` |
| `provider` | string | Yes | Provider name |
| `method` | string | No | Payment method |
| `customer_id` | string | No | Customer reference |
| `customer_email` | string | No | Customer email |
| `return_url` | string | No | Redirect URL after 3DS |
| `idempotency_key` | string | No | Prevents duplicate charges (24h TTL) |
| `metadata` | object | No | Extra key-value pairs |

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_abc123",
  "provider_payment_id": "pi_xxx",
  "redirect_url": "https://checkout.stripe.com/...",
  "client_secret": "pi_xxx_secret_xxx",
  "status": "pending"
}
```

**Validation:**

| Condition | Error (status) |
|-----------|---------------|
| Missing order_id, amount, or provider | `Missing required fields: order_id, amount, provider` (400) |
| Amount <= 0 or non-numeric | `Amount must be a positive number` (400) |

---

### API Reference — MOTO Payment

#### POST /api/b2b/payments/moto

Create a MOTO (Mail Order / Telephone Order) payment. Card-not-present, 3DS exempt, operator-initiated.

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "order_id": "ORD-001",
  "amount": 134.15,
  "currency": "EUR",
  "provider": "nexi",
  "card_number": "4111111111111111",
  "expiry_month": "12",
  "expiry_year": "2027",
  "cvv": "123",
  "description": "Phone order for customer Acme"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_id` | string | Yes | Order to charge |
| `amount` | number | Yes | Positive amount |
| `provider` | string | Yes | Must support MOTO |
| `card_number` | string | Yes | Full card number |
| `expiry_month` | string | Yes | Card expiry month |
| `expiry_year` | string | Yes | Card expiry year |
| `cvv` | string | No | Card CVV |
| `description` | string | No | Operator note |

**MOTO-capable providers:** Stripe, Nexi, Axerve

**Response:**
```json
{
  "success": true,
  "transaction_id": "txn_def456",
  "provider_payment_id": "pi_xxx",
  "status": "completed"
}
```

---

### API Reference — Transactions

#### GET /api/b2b/payments/transactions

Server-side paginated list of payment transactions.

**Authentication:** Session, API Key, or Bearer JWT

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status |
| `provider` | string | Filter by provider |
| `payment_type` | string | Filter by type (`onclick`, `moto`, `recurrent`) |
| `order_id` | string | Filter by order |
| `date_from` | ISO date | From date |
| `date_to` | ISO date | To date |
| `search` | string | Search in transaction_id, provider_payment_id, customer_email, order_id |

**Response:**
```json
{
  "transactions": [
    {
      "transaction_id": "txn_abc123",
      "tenant_id": "my-tenant",
      "order_id": "ORD-001",
      "provider": "stripe",
      "provider_payment_id": "pi_xxx",
      "payment_type": "onclick",
      "gross_amount": 134.15,
      "currency": "EUR",
      "commission_rate": 0.025,
      "commission_amount": 3.35,
      "net_amount": 130.80,
      "status": "completed",
      "method": "credit_card",
      "customer_email": "customer@example.com",
      "created_at": "2026-03-01T10:30:00.000Z",
      "completed_at": "2026-03-01T10:30:05.000Z"
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

Note: The `events` audit trail is excluded from list view for performance.

---

### API Reference — Refund

#### POST /api/b2b/payments/refund

Refund a transaction (full or partial).

**Authentication:** Session, API Key, or Bearer JWT

**Request Body:**
```json
{
  "transaction_id": "txn_abc123",
  "amount": 50.00
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `transaction_id` | string | Yes | Transaction to refund |
| `amount` | number | No | Partial amount. Omit for full refund |

**Response:**
```json
{
  "success": true,
  "refund_id": "ref_xyz",
  "amount": 50.00
}
```

---

### API Reference — Payment Stats

#### GET /api/b2b/payments/stats

Aggregated payment statistics for tenant dashboard.

**Authentication:** Session, API Key, or Bearer JWT

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_transactions": 42,
    "total_volume": 12345.67,
    "successful_rate": 95.2,
    "pending_count": 3
  }
}
```

| Field | Description |
|-------|-------------|
| `total_transactions` | Total number of transactions |
| `total_volume` | Sum of completed transaction amounts |
| `successful_rate` | Percentage of completed vs total (×10 precision) |
| `pending_count` | Transactions in pending/processing status |

---

### API Reference — Recurring Contracts

#### GET /api/b2b/payments/recurring

Paginated list of recurring payment contracts.

**Authentication:** Session, API Key, or Bearer JWT

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |
| `status` | string | Filter by status (`active`, `paused`, `cancelled`, `expired`) |
| `provider` | string | Filter by provider |
| `contract_type` | string | `scheduled` or `unscheduled` |
| `search` | string | Search in contract_id, customer_id, provider_contract_id |

**Contract types:**

| Type | Description |
|------|-------------|
| `scheduled` | Fixed amount, fixed frequency (e.g. monthly subscription) |
| `unscheduled` | Variable amount, on-demand (e.g. usage-based billing) |

**Response:**
```json
{
  "contracts": [
    {
      "contract_id": "rc_abc123",
      "tenant_id": "my-tenant",
      "customer_id": "cust_xyz",
      "provider": "stripe",
      "provider_contract_id": "sub_xxx",
      "contract_type": "scheduled",
      "card_last_four": "4242",
      "card_brand": "visa",
      "frequency_days": 30,
      "max_amount": 99.99,
      "next_charge_date": "2026-04-01T00:00:00.000Z",
      "status": "active",
      "created_at": "2026-03-01T10:00:00.000Z"
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

## Provider Configuration Reference

Each provider has its own config shape stored in `TenantPaymentConfig.providers`:

| Provider | Key Fields |
|----------|-----------|
| Stripe | `account_id`, `account_status`, `charges_enabled`, `payouts_enabled` |
| Mangopay | `user_id`, `wallet_id`, `bank_account_id`, `kyc_level`, `status` |
| PayPal | `merchant_id`, `enabled` |
| Nexi | `api_key`, `terminal_id`, `environment`, `moto_enabled`, `recurring_enabled` |
| Axerve | `shop_login`, `api_key`, `environment`, `moto_profile`, `recurring_enabled` |
| Satispay | `key_id`, `enabled` |
| Scalapay | `api_key`, `environment`, `enabled` |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/types/shipping.ts` | Shipping type definitions |
| `src/lib/types/payment.ts` | Payment type definitions |
| `src/lib/constants/payment.ts` | Payment constants (providers, statuses, methods) |
| `src/lib/services/delivery-cost.service.ts` | Tier calculation, zone matching, DB wrappers |
| `src/lib/payments/payment.service.ts` | Payment processing orchestration |
| `src/lib/payments/commission.service.ts` | Commission calculation and recording |
| `src/app/api/b2b/shipping-config/route.ts` | Shipping config CRUD |
| `src/app/api/b2b/orders/[id]/shipping-options/route.ts` | Compute shipping options for order |
| `src/app/api/b2b/orders/[id]/shipping/route.ts` | Apply shipping to order |
| `src/app/api/b2b/payments/config/route.ts` | Payment config CRUD |
| `src/app/api/b2b/payments/create/route.ts` | Create OnClick payment |
| `src/app/api/b2b/payments/moto/route.ts` | Create MOTO payment |
| `src/app/api/b2b/payments/transactions/route.ts` | List transactions |
| `src/app/api/b2b/payments/refund/route.ts` | Process refunds |
| `src/app/api/b2b/payments/stats/route.ts` | Dashboard statistics |
| `src/app/api/b2b/payments/recurring/route.ts` | List recurring contracts |

---

## Live Test Results (simani-it, 2026-03-02)

All tests performed with API key authentication.

### Shipping Config

```
GET  /api/b2b/shipping-config          → 200  { zones: [] }  (empty before config)
PUT  /api/b2b/shipping-config          → 200  { zones: [Italy, Europe] }
GET  /api/b2b/shipping-config          → 200  { zones: 2 }  (confirms persistence)
```

**Validation tests:**
```
PUT  { zone with empty countries }     → 400  "Zone must have at least one country code"
PUT  { method missing base tier }      → 400  "Method must have at least one tier with min_subtotal: 0"
```

### Payment Config

```
GET  /api/b2b/payments/config          → 200  { configured: false, commission_rate: 0.025 }
PUT  { default_provider: "stripe" }    → 200  { default_provider: "stripe", enabled_methods: ["credit_card", "paypal"] }
PUT  { default_provider: "bitcoin" }   → 400  "Invalid provider: bitcoin. Allowed: stripe, mangopay, ..."
```

### Transactions & Stats

```
GET  /api/b2b/payments/transactions    → 200  { transactions: [], total: 0 }
GET  /api/b2b/payments/transactions?status=completed&provider=stripe  → 200  (filter works)
GET  /api/b2b/payments/stats           → 200  { total_transactions: 0, total_volume: 0 }
GET  /api/b2b/payments/recurring       → 200  { contracts: [], total: 0 }
```

### Payment Create Validation

```
POST /api/b2b/payments/create  { order_id only }         → 400  "Missing required fields"
POST /api/b2b/payments/create  { amount: -5 }            → 400  "Amount must be a positive number"
POST /api/b2b/payments/refund  { no transaction_id }     → 400  "Missing required field: transaction_id"
```

### Auth Migration

During testing, the following routes were migrated from `getB2BSession` to `requireTenantAuth` to support API key and Bearer JWT authentication:

- `src/app/api/b2b/shipping-config/route.ts` (GET + PUT)
- `src/app/api/b2b/orders/[id]/shipping-options/route.ts` (GET)
- `src/app/api/b2b/orders/[id]/shipping/route.ts` (POST)

All payment routes already used `requireTenantAuth`.
