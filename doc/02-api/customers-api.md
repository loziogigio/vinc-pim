# Customers API

Complete guide to creating and managing customers in VINC Commerce Suite.

## Customer Types

| Type | Description | Required Fields |
|------|-------------|-----------------|
| `business` | Company / enterprise | `email`, `company_name` |
| `private` | Individual / freelancer | `email`, `first_name` or `last_name` |
| `reseller` | Reseller / distributor | `email`, `company_name` |

## Auto-Generated Fields

| Field | Format | Example |
|-------|--------|---------|
| `customer_id` | nanoid(12) | `abc123def456` |
| `public_code` | `C-XXXXX` (zero-padded, auto-incremented per tenant) | `C-00001` |
| `external_code` | defaults to `customer_id` if not provided | `abc123def456` |

---

## Create Customer

```
POST /api/b2b/customers
```

**Authentication:** Session (B2B admin) or API Key

### Request Body

```json
{
  "customer_type": "business",
  "email": "info@acme.it",
  "company_name": "Acme S.r.l.",
  "phone": "+39 02 1234 5678",
  "first_name": null,
  "last_name": null,
  "is_guest": false,
  "channel": "default",
  "external_code": "ERP-001",
  "legal_info": {
    "vat_number": "IT12345678901",
    "fiscal_code": "01062490469",
    "pec_email": "acme@pec.it",
    "sdi_code": "ABCDEFG"
  },
  "addresses": [
    {
      "address_type": "both",
      "is_default": true,
      "label": "Sede legale",
      "recipient_name": "Acme S.r.l.",
      "street_address": "Via Roma, 1",
      "city": "Milano",
      "province": "MI",
      "postal_code": "20100",
      "country": "IT"
    }
  ],
  "tags": ["categoria-di-sconto:sconto-45"]
}
```

### Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customer_type` | string | Yes | `"business"`, `"private"`, or `"reseller"` |
| `email` | string | Yes | Primary contact email (unique per tenant) |
| `company_name` | string | Business/Reseller | Company legal name |
| `first_name` | string | Private | First name |
| `last_name` | string | Private | Last name |
| `phone` | string | No | Phone number |
| `is_guest` | boolean | No | Default `false`. Guest = one-time buyer |
| `channel` | string | No | Default `"default"`. Sales channel code (kebab-case) |
| `external_code` | string | No | ERP system code. Defaults to `customer_id` |
| `legal_info` | object | No | Italian e-invoicing data (see below) |
| `addresses` | array | No | Initial addresses (see below) |
| `tags` | array | No | Customer tags for pricing/segmentation |

### Legal Info (Italian E-Invoicing)

| Field | Format | Validation |
|-------|--------|------------|
| `vat_number` | `IT` + 11 digits | e.g. `IT12345678901` |
| `fiscal_code` | 16 chars (individual) or 11 digits (company) | Codice Fiscale |
| `pec_email` | valid email | Certified email (PEC) |
| `sdi_code` | 7 alphanumeric chars | SDI/Codice Destinatario |

### Address Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `address_type` | string | Yes | `"delivery"`, `"billing"`, or `"both"` |
| `is_default` | boolean | No | Mark as default shipping/billing address |
| `label` | string | No | Display label (e.g. "Sede legale", "Magazzino") |
| `recipient_name` | string | No | Delivery recipient |
| `street_address` | string | No | Street and number |
| `city` | string | No | City name |
| `province` | string | No | 2-char province code (e.g. `"MI"`) |
| `postal_code` | string | No | ZIP/CAP code |
| `country` | string | No | ISO country code (default `"IT"`) |

Each address gets an auto-generated `address_id` (nanoid 8).

### Response (201 Created)

```json
{
  "success": true,
  "customer": {
    "customer_id": "abc123def456",
    "tenant_id": "hidros-it",
    "customer_type": "business",
    "is_guest": false,
    "channel": "default",
    "email": "info@acme.it",
    "company_name": "Acme S.r.l.",
    "phone": "+39 02 1234 5678",
    "external_code": "ERP-001",
    "public_code": "C-00001",
    "legal_info": {
      "vat_number": "IT12345678901",
      "fiscal_code": "01062490469",
      "pec_email": "acme@pec.it",
      "sdi_code": "ABCDEFG"
    },
    "tags": [
      {
        "prefix": "categoria-di-sconto",
        "code": "sconto-45",
        "full_tag": "categoria-di-sconto:sconto-45"
      }
    ],
    "addresses": [
      {
        "address_id": "addr1234",
        "external_code": "addr1234",
        "address_type": "both",
        "is_default": true,
        "label": "Sede legale",
        "recipient_name": "Acme S.r.l.",
        "street_address": "Via Roma, 1",
        "city": "Milano",
        "province": "MI",
        "postal_code": "20100",
        "country": "IT",
        "tag_overrides": [],
        "created_at": "2026-03-02T10:30:00.000Z",
        "updated_at": "2026-03-02T10:30:00.000Z"
      }
    ],
    "default_shipping_address_id": "addr1234",
    "default_billing_address_id": "addr1234",
    "created_at": "2026-03-02T10:30:00.000Z",
    "updated_at": "2026-03-02T10:30:00.000Z"
  }
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 400 | Missing required fields or validation failure |
| 401 | Not authenticated |
| 409 | Email already exists for this tenant |
| 500 | Internal server error |

---

## Examples by Customer Type

### Create a Business Customer

```json
{
  "customer_type": "business",
  "email": "info@acme.it",
  "company_name": "Acme S.r.l.",
  "phone": "+39 02 1234 5678",
  "legal_info": {
    "vat_number": "IT12345678901",
    "fiscal_code": "01062490469",
    "pec_email": "acme@pec.it",
    "sdi_code": "ABCDEFG"
  },
  "addresses": [
    {
      "address_type": "both",
      "is_default": true,
      "label": "Sede legale",
      "recipient_name": "Acme S.r.l.",
      "street_address": "Via Roma, 1",
      "city": "Milano",
      "province": "MI",
      "postal_code": "20100",
      "country": "IT"
    }
  ]
}
```

### Create a Private Customer

```json
{
  "customer_type": "private",
  "email": "mario.rossi@gmail.com",
  "first_name": "Mario",
  "last_name": "Rossi",
  "phone": "+39 333 1234567",
  "legal_info": {
    "fiscal_code": "RSSMRA85M01H501Z"
  },
  "addresses": [
    {
      "address_type": "both",
      "is_default": true,
      "label": "Casa",
      "recipient_name": "Mario Rossi",
      "street_address": "Via Verdi, 10",
      "city": "Roma",
      "province": "RM",
      "postal_code": "00100",
      "country": "IT"
    }
  ]
}
```

### Create a Reseller Customer

```json
{
  "customer_type": "reseller",
  "email": "ordini@distribuzione-nord.it",
  "company_name": "Distribuzione Nord S.r.l.",
  "phone": "+39 045 9876543",
  "legal_info": {
    "vat_number": "IT98765432109",
    "fiscal_code": "98765432109",
    "pec_email": "distribuzionenord@pec.it",
    "sdi_code": "X1Y2Z3W"
  },
  "addresses": [
    {
      "address_type": "billing",
      "is_default": true,
      "label": "Sede legale",
      "recipient_name": "Distribuzione Nord S.r.l.",
      "street_address": "Via Industria, 50",
      "city": "Verona",
      "province": "VR",
      "postal_code": "37100",
      "country": "IT"
    },
    {
      "address_type": "delivery",
      "is_default": true,
      "label": "Magazzino",
      "recipient_name": "Distribuzione Nord - Magazzino",
      "street_address": "Via Logistica, 12",
      "city": "Verona",
      "province": "VR",
      "postal_code": "37135",
      "country": "IT"
    }
  ],
  "tags": [
    "categoria-di-sconto:sconto-45",
    "categoria-clienti:ferramenta"
  ]
}
```

---

## Customer Tags

Tags control pricing visibility and promotions. Format: `prefix:code`.

### Well-Known Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `categoria-di-sconto` | Discount class | `categoria-di-sconto:sconto-45` |
| `categoria-clienti` | Customer category | `categoria-clienti:idraulico` |
| `categoria-acquisto-medio-mensile` | Monthly purchase bracket | `categoria-acquisto-medio-mensile:fascia-a` |

### Address-Level Tag Overrides

Addresses can override customer-level tags with the same prefix. This lets you assign different pricing per delivery address.

**Example:**
- Customer tags: `["categoria-di-sconto:sconto-45", "categoria-clienti:idraulico"]`
- Address override: `["categoria-di-sconto:sconto-50"]`
- Effective tags for that address: `["categoria-di-sconto:sconto-50", "categoria-clienti:idraulico"]`

The override replaces only tags with the same prefix; other prefixes are inherited from the customer.

---

## Portal Users (End-User Accounts)

Portal users are end-user login accounts (e.g. for B2C or mobile apps). They are separate from B2B admin users. Each portal user can access one or more customers.

### Create Portal User

```
POST /api/b2b/portal-users
```

**Authentication:** Session (B2B admin) or API Key

```json
{
  "username": "mario.rossi",
  "email": "mario.rossi@gmail.com",
  "password": "SecureP@ss123",
  "channel": "default",
  "customer_access": [
    {
      "customer_id": "abc123def456",
      "address_access": "all"
    }
  ],
  "tags": ["newsletter:opt-in"]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `username` | string | Yes | Login username (unique per tenant + channel) |
| `email` | string | Yes | Contact email (unique per tenant + channel) |
| `password` | string | Yes | Plain text, stored as bcrypt hash |
| `channel` | string | No | Default `"default"` |
| `customer_access` | array | No | Which customers this user can access |
| `tags` | array | No | Campaign targeting tags |

### Customer Access Control

Each portal user has a `customer_access` array defining which customers they can operate on:

```json
{
  "customer_access": [
    {
      "customer_id": "abc123def456",
      "address_access": "all"
    },
    {
      "customer_id": "xyz789ghi012",
      "address_access": ["addr001", "addr002"]
    }
  ]
}
```

| `address_access` | Meaning |
|-------------------|---------|
| `"all"` | Can use all addresses of the customer |
| `["addr1", "addr2"]` | Can only use specific address IDs |

### Portal User Login

```
POST /api/b2b/auth/portal-login
```

**Authentication:** API Key (tenant-level)

```json
{
  "username": "mario.rossi",
  "password": "SecureP@ss123"
}
```

**Response:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "portal_user": {
    "portal_user_id": "PU-abc123",
    "username": "mario.rossi",
    "email": "mario.rossi@gmail.com",
    "channel": "default",
    "is_active": true
  },
  "customer_access": [
    {
      "customer_id": "abc123def456",
      "customer_code": "abc123def456",
      "address_access": "all",
      "default_address_code": "addr1234",
      "delivery_addresses": [
        {
          "address_id": "addr1234",
          "label": "Casa",
          "street_address": "Via Verdi, 10",
          "city": "Roma"
        }
      ]
    }
  ],
  "customer_tags": ["categoria-di-sconto:sconto-45"]
}
```

The JWT token (7-day expiry) is then used as `Authorization: Bearer <token>` for subsequent requests that require user identity.

---

## Flow: Creating a Customer from the B2B Admin UI

1. Navigate to **Store > Customers** and click **New Customer**
2. Select customer type: **Business** or **Private**
3. Fill in the form:
   - **Business:** Company Name (required), Email (required), Phone, Legal Info, Address
   - **Private:** First Name / Last Name (at least one required), Email (required), Phone, Legal Info, Address
4. Click **Create** — sends `POST /api/b2b/customers`
5. Customer is created with auto-generated `customer_id` and `public_code`
6. Redirect to the new customer detail page

## Flow: Mobile App Registration

1. Mobile app authenticates with API key (tenant-level)
2. App calls `POST /api/b2b/portal-users` to create a portal user account
3. App calls `POST /api/b2b/customers` to create a customer profile
4. App calls `POST /api/b2b/auth/portal-login` to get a JWT token
5. Subsequent requests use `Authorization: Bearer <jwt>` for user identity

If the portal user creates a customer while authenticated (API Key + Bearer JWT), the customer is automatically linked to the portal user's `customer_access`.

---

## cURL Examples

### Create Business Customer (API Key Auth)

```bash
curl -X POST "http://localhost:3001/api/b2b/customers" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "customer_type": "business",
    "email": "info@acme.it",
    "company_name": "Acme S.r.l.",
    "legal_info": {
      "vat_number": "IT12345678901"
    }
  }'
```

### Create Private Customer (API Key Auth)

```bash
curl -X POST "http://localhost:3001/api/b2b/customers" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "customer_type": "private",
    "email": "mario.rossi@gmail.com",
    "first_name": "Mario",
    "last_name": "Rossi"
  }'
```

### Portal User Login

```bash
curl -X POST "http://localhost:3001/api/b2b/auth/portal-login" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant-id}_{key-suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "username": "mario.rossi",
    "password": "SecureP@ss123"
  }'
```

---

## Sales Channels

Channels segment customers and portal users into different business contexts (B2B, B2C, geographic markets, marketplaces, etc.).

**Authentication:** Session (B2B admin), API Key, or Bearer JWT — uses `requireTenantAuth`.

### Default Channels

On first access, every tenant is auto-seeded with:

| Code | Name | Default |
| ---- | ---- | ------- |
| `DEFAULT` | DEFAULT | Yes |
| `B2B` | B2B | No |
| `B2C` | B2C | No |

### Channel Rules

- Code must be **kebab-case** (lowercase alphanumeric + hyphens): `b2b`, `b2c`, `slovakia`, `czech-republic`
- Code is **immutable** after creation
- Only one channel can be `is_default: true` per tenant
- Cannot delete the default channel
- Delete = soft-delete (sets `is_active: false`)

### Channels API

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| GET | `/api/b2b/channels` | List all channels (`?include_inactive=true` for deactivated) |
| POST | `/api/b2b/channels` | Create a new channel |
| GET | `/api/b2b/channels/{code}` | Get single channel by code |
| PATCH | `/api/b2b/channels/{code}` | Update channel (name, description, color, is_default) |
| DELETE | `/api/b2b/channels/{code}` | Soft-delete (deactivate) channel |

### Create Channel

```
POST /api/b2b/channels
```

```json
{
  "code": "slovakia",
  "name": "Slovakia Market",
  "description": "Sales channel for Slovak market",
  "color": "#10b981",
  "is_default": false
}
```

| Field | Type | Required | Notes |
| ----- | ---- | -------- | ----- |
| `code` | string | Yes | Kebab-case, immutable after creation |
| `name` | string | Yes | Human-readable name (max 200 chars) |
| `description` | string | No | Max 500 chars |
| `color` | string | No | Hex color for UI badges (e.g. `"#10b981"`) |
| `is_default` | boolean | No | If `true`, previous default is automatically unset |

### How Channels Relate to Customers

Every customer has a `channel` field (defaults to `"default"`):

```json
{
  "customer_type": "business",
  "email": "info@acme.it",
  "company_name": "Acme S.r.l.",
  "channel": "b2b"
}
```

### How Channels Relate to Portal Users

Portal users also have a `channel` field. Username and email uniqueness is enforced **per channel**:

- `user@example.com` in channel `"b2b"` and `user@example.com` in channel `"b2c"` are two separate accounts
- Unique constraint: `tenant_id + username + channel` and `tenant_id + email + channel`

```json
{
  "username": "mario.rossi",
  "email": "mario@example.com",
  "password": "SecureP@ss123",
  "channel": "b2c"
}
```

### How Channels Relate to Products

Products can be published to multiple channels via an array field:

```json
{
  "entity_code": "PROD-001",
  "channels": ["b2b", "b2c", "slovakia"]
}
```

### Admin UI

Channels are managed at **Admin > Canali** (`/b2b/admin/channels`). A reusable `<ChannelSelect>` component (`src/components/shared/ChannelSelect.tsx`) is available for forms.

---

## B2C Guest Checkout (No Account Required)

For B2C storefronts, guest users can place orders **without creating a customer record**. All buyer and invoice data is embedded directly on the order document (transaction-scoped). A customer record is only created when the user registers an account.

### How It Works

| Scenario | Customer Record | Invoice Data Location |
|----------|----------------|----------------------|
| Guest checkout | Not created | Embedded on order (`buyer`, `invoice_data`, address snapshots) |
| Registered user checkout | Existing customer linked | Embedded on order (snapshot) + customer profile |
| Guest registers later | Created on registration | Past orders linked by `buyer.email` |

### Guest Order Data Model

When a guest places an order, the order document stores everything needed for invoicing:

```json
{
  "order_type": "b2c",
  "customer_id": null,
  "buyer": {
    "email": "mario.rossi@gmail.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "phone": "+39 333 1234567",
    "customer_type": "private",
    "company_name": null,
    "is_guest": true
  },
  "invoice_requested": true,
  "invoice_data": {
    "fiscal_code": "RSSMRA85M01H501Z"
  },
  "shipping_snapshot": {
    "recipient_name": "Mario Rossi",
    "street_address": "Via Verdi, 10",
    "city": "Roma",
    "province": "RM",
    "postal_code": "00100",
    "country": "IT",
    "phone": "+39 333 1234567"
  },
  "billing_snapshot": null
}
```

### Invoice Types

| Type | `customer_type` | Required Invoice Fields |
|------|-----------------|------------------------|
| Private person | `"private"` | `fiscal_code` (16-char Codice Fiscale) |
| Business / P.IVA | `"business"` | `company_name`, `vat_number` (IT + 11 digits), `fiscal_code`, + `sdi_code` OR `pec_email` |

### B2C Checkout Endpoint

```
POST /api/b2c/checkout
```

**Authentication:** API Key (from B2C storefront proxy)

**Request Body:**

```json
{
  "customer_id": null,
  "buyer": {
    "email": "mario.rossi@gmail.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "phone": "+39 333 1234567",
    "customer_type": "private"
  },
  "wants_invoice": true,
  "invoice_data": {
    "fiscal_code": "RSSMRA85M01H501Z"
  },
  "shipping_address": {
    "recipient_name": "Mario Rossi",
    "street_address": "Via Verdi, 10",
    "city": "Roma",
    "province": "RM",
    "postal_code": "00100",
    "country": "IT"
  },
  "billing_is_same_as_shipping": true,
  "items": [
    { "entity_code": "99658", "sku": "SW-9895KR", "quantity": 2 }
  ],
  "payment_method": "stripe",
  "shipping_method": "standard",
  "shipping_cost": 5.90
}
```

**Business customer example:**

```json
{
  "buyer": {
    "email": "info@acme.it",
    "first_name": "Anna",
    "last_name": "Verdi",
    "customer_type": "business",
    "company_name": "Acme S.r.l."
  },
  "wants_invoice": true,
  "invoice_data": {
    "vat_number": "IT12345678901",
    "fiscal_code": "01062490469",
    "sdi_code": "ABCDEFG"
  },
  "shipping_address": { "..." },
  "billing_is_same_as_shipping": false,
  "billing_address": {
    "recipient_name": "Acme S.r.l.",
    "street_address": "Via Roma, 1",
    "city": "Milano",
    "province": "MI",
    "postal_code": "20100",
    "country": "IT"
  },
  "items": [
    { "entity_code": "99658", "sku": "SW-9895KR", "quantity": 1 }
  ],
  "payment_method": "paypal"
}
```

### Registered User Checkout

When a registered user (portal user with JWT) checks out, the Nuxt proxy enriches the request with `customer_id`. The order still stores `buyer` + `invoice_data` snapshots (immutable at order time), but also links to the customer record.

### Account Registration → Order Linking

When a guest later registers an account:
1. A customer record is created (`POST /api/b2b/customers`)
2. A portal user is created and linked to the customer
3. Past guest orders are found by `buyer.email` (where `customer_id` is null)
4. Those orders are updated with the new `customer_id`

This gives the newly registered user access to their full order history.

---

## Test Results (simani-it tenant)

Tested on 2026-03-02 against `http://localhost:3001` with `ak_simani-it_ca06f0534d0d`.

### Created Customers

| Code | Type | Name | Email | Addresses | Legal |
|------|------|------|-------|-----------|-------|
| C-00001 | business | Simani Impianti S.r.l. | info@simani-srl.it | 1 (both) | VAT + FC + PEC + SDI |
| C-00002 | private | Marco Bianchi | marco.bianchi@gmail.com | 1 (both) | FC only |
| C-00003 | reseller | Termoidraulica Toscana S.r.l. | ordini@termoidraulica-toscana.it | 2 (billing + delivery) | VAT + FC + PEC + SDI |

### Validation Tests

| Test | Expected | Result |
|------|----------|--------|
| Duplicate email (`info@simani-srl.it`) | 409 Conflict | `"Customer with this email already exists"` |
| Missing email field | 400 Bad Request | `"email is required"` |
| Invalid VAT (`INVALID`) | 400 Bad Request | `"Invalid VAT number format (expected: IT + 11 digits)"` |

### Key Observations

- `public_code` auto-increments per tenant: `C-00001`, `C-00002`, `C-00003`
- `customer_id` and `external_code` default to the same nanoid(12) value
- Reseller with 2 addresses correctly assigns `default_shipping_address_id` (delivery) and `default_billing_address_id` (billing) to separate addresses
- Tags passed in creation body (`categoria-di-sconto:sconto-45`) are processed but stored via the tag upsert service (separate from the customer document `tags` array)
- `is_guest: false` is the default for all registered customers
