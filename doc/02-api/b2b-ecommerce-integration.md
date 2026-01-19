# B2B E-commerce Integration Guide

This guide covers how to integrate a B2B storefront (e.g., `vinc-b2b`) with the VINC Commerce Suite API.

## Implementation Status

### Portal Users

| Feature | Status | Endpoint |
|---------|--------|----------|
| Registration | ✅ Implemented | `POST /api/b2b/portal-users` |
| Get User | ✅ Implemented | `GET /api/b2b/portal-users/{id}` |
| Update User | ✅ Implemented | `PUT /api/b2b/portal-users/{id}` |
| Login | 🚧 Planned | `POST /api/b2b/portal-users/login` |
| Change Password | 🚧 Planned | `POST /api/b2b/portal-users/{id}/change-password` |
| Forgot Password | 🚧 Planned | `POST /api/b2b/portal-users/forgot-password` |

### Customers

| Feature | Status | Endpoint |
|---------|--------|----------|
| Create | ✅ Implemented | `POST /api/b2b/customers` |
| Get | ✅ Implemented | `GET /api/b2b/customers/{id}` |
| Update | ✅ Implemented | `PUT /api/b2b/customers/{id}` |
| Add Address | ✅ Implemented | Requires `recipient_name` field |

### Products

| Feature | Status | Endpoint |
|---------|--------|----------|
| List Products | ✅ Implemented | `GET /api/b2b/pim/products` |
| Get Product | ✅ Implemented | `GET /api/b2b/pim/products/{code}` |
| List Categories | ✅ Implemented | `GET /api/b2b/pim/categories` |
| List Brands | ✅ Implemented | `GET /api/b2b/pim/brands` |
| Search (Solr) | ⚠️ Partial | Requires Solr index population |

### Cart/Orders

| Feature | Status | Endpoint |
|---------|--------|----------|
| Create Order | ✅ Implemented | `POST /api/b2b/orders` |
| Add Item | ✅ Implemented | `POST /api/b2b/orders/{id}/items` |
| Update Item | ✅ Implemented | `PATCH /api/b2b/orders/{id}/items/{line}` |
| Remove Item | ✅ Implemented | `DELETE /api/b2b/orders/{id}/items/{line}` |
| Get Order | ✅ Implemented | `GET /api/b2b/orders/{id}` |
| List Orders | ✅ Implemented | `GET /api/b2b/orders` |
| Submit Order | 🚧 Planned | `POST /api/b2b/orders/{id}/submit` |

### Public

| Feature | Status | Endpoint |
|---------|--------|----------|
| Menu | ✅ Implemented | `GET /api/public/menu` |
| Collections | ✅ Implemented | `GET /api/public/collections` |
| Collection Products | ✅ Implemented | `GET /api/public/collections/{code}/products` |

**Legend:** ✅ Implemented | ⚠️ Partial | 🚧 Planned

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           B2B STOREFRONT (vinc-b2b)                         │
│  ┌─────────────────┐    ┌──────────────────────────────────────────────┐   │
│  │   Browser/App   │───▶│   Next.js API Routes (Proxy Layer - BFF)     │   │
│  │   (No secrets)  │    │   - Session management (httpOnly cookies)    │   │
│  │                 │◀───│   - API key stored server-side only          │   │
│  └─────────────────┘    └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ HTTPS (API Key + Portal Token)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VINC COMMERCE SUITE API                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ /api/b2b/portal-users/*    Portal user authentication               │   │
│  │ /api/b2b/customers/*       Customer profile management              │   │
│  │ /api/b2b/orders/*          Order management                         │   │
│  │ /api/b2b/cart/*            Shopping cart                            │   │
│  │ /api/b2b/pim/products/*    Product catalog                          │   │
│  │ /api/search/*              Search and faceting                      │   │
│  │ /api/public/*              Public endpoints (no auth required)      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Security Model

### Authentication Layers

| Layer | Purpose | Storage | Scope |
|-------|---------|---------|-------|
| API Key + Secret | Server-to-server auth | Server-side env vars | Full tenant access |
| Portal User Token | Customer-level auth | httpOnly cookie | Assigned customers only |
| Session Cookie | Browser session | httpOnly cookie | Current user |

### Key Principles

1. **Never expose API keys to the browser** - All API calls go through your server-side proxy
2. **Use httpOnly cookies** - Prevents XSS from stealing tokens
3. **Validate on every request** - Check session validity before proxying
4. **Customer-level isolation** - Portal users can only access their assigned customers

---

## 1. Portal User Authentication

### 1.1 Registration

Create a new portal user account.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users
```

**Request Body:**
```json
{
  "username": "mario.rossi",
  "email": "mario.rossi@example.com",
  "password": "SecurePass123!",
  "first_name": "Mario",
  "last_name": "Rossi",
  "phone": "+39 02 1234567"
}
```

**Response:**
```json
{
  "success": true,
  "portal_user": {
    "portal_user_id": "PU-abc123xyz",
    "username": "mario.rossi",
    "email": "mario.rossi@example.com",
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Registration successful. Account pending approval."
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.COMMERCE_SUITE_API_URL;
const API_KEY_ID = process.env.API_KEY_ID;
const API_SECRET = process.env.API_SECRET;

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Validate input
  if (!body.email || !body.password || !body.username) {
    return NextResponse.json(
      { error: "Email, username, and password are required" },
      { status: 400 }
    );
  }

  const res = await fetch(`${API_URL}/api/b2b/portal-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-method": "api-key",
      "x-api-key-id": API_KEY_ID!,
      "x-api-secret": API_SECRET!,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

### 1.2 Login

Authenticate a portal user and obtain a session token.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users/login
```

**Request Body:**
```json
{
  "email": "mario.rossi@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "portal_user": {
    "portal_user_id": "PU-abc123xyz",
    "username": "mario.rossi",
    "email": "mario.rossi@example.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "status": "active",
    "customer_access": [
      {
        "customer_id": "cust_xyz789",
        "address_access": "all"
      }
    ]
  },
  "expires_at": "2024-01-16T10:30:00Z"
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const res = await fetch(`${API_URL}/api/b2b/portal-users/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-method": "api-key",
      "x-api-key-id": API_KEY_ID!,
      "x-api-secret": API_SECRET!,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (res.ok && data.success) {
    // Store session in httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("portal_session", JSON.stringify({
      token: data.token,
      portalUserId: data.portal_user.portal_user_id,
      customerId: data.portal_user.customer_access?.[0]?.customer_id,
      email: data.portal_user.email,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    // Don't send token to browser - only user info
    return NextResponse.json({
      success: true,
      user: {
        portal_user_id: data.portal_user.portal_user_id,
        username: data.portal_user.username,
        email: data.portal_user.email,
        first_name: data.portal_user.first_name,
        last_name: data.portal_user.last_name,
      },
    });
  }

  return NextResponse.json(data, { status: res.status });
}
```

### 1.3 Logout

End the portal user session.

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete("portal_session");

  return NextResponse.json({ success: true });
}
```

### 1.4 Password Reset Request

Request a password reset email.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users/forgot-password
```

**Request Body:**
```json
{
  "email": "mario.rossi@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent."
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/forgot-password/route.ts
export async function POST(req: NextRequest) {
  const { email } = await req.json();

  const res = await fetch(`${API_URL}/api/b2b/portal-users/forgot-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-method": "api-key",
      "x-api-key-id": API_KEY_ID!,
      "x-api-secret": API_SECRET!,
    },
    body: JSON.stringify({ email }),
  });

  // Always return success to prevent email enumeration
  return NextResponse.json({
    success: true,
    message: "If the email exists, a password reset link has been sent.",
  });
}
```

### 1.5 Password Reset (with token)

Reset password using the token from email.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users/reset-password
```

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "new_password": "NewSecurePass456!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

### 1.6 Change Password (authenticated)

Change password while logged in.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users/{portal_user_id}/change-password
```

**Request Body:**
```json
{
  "current_password": "SecurePass123!",
  "new_password": "NewSecurePass456!"
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/change-password/route.ts
export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const res = await fetch(
    `${API_URL}/api/b2b/portal-users/${session.portalUserId}/change-password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
        "x-portal-user-token": session.token,
      },
      body: JSON.stringify(body),
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 1.7 Get Current User Session

Get the current logged-in user info.

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/auth/me/route.ts
export async function GET() {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Optionally fetch fresh user data from API
  const res = await fetch(
    `${API_URL}/api/b2b/portal-users/${session.portalUserId}`,
    {
      headers: {
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
      },
    }
  );

  if (!res.ok) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const data = await res.json();
  return NextResponse.json({
    authenticated: true,
    user: data.portal_user,
  });
}
```

---

## 2. Profile Management

### 2.1 Get Profile

Get the customer profile associated with the portal user.

**Commerce Suite Endpoint:**
```
GET /api/b2b/customers/{customer_id}
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "customer_id": "cust_xyz789",
    "customer_type": "business",
    "company_name": "Rossi S.r.l.",
    "email": "info@rossi-srl.it",
    "phone": "+39 02 1234567",
    "legal_info": {
      "vat_number": "IT12345678901",
      "fiscal_code": "RSSMRA80A01H501Z",
      "sdi_code": "XXXXXXX",
      "pec": "rossi@pec.it"
    },
    "addresses": [
      {
        "address_id": "addr_001",
        "address_type": "shipping",
        "is_default": true,
        "label": "Sede",
        "street": "Via Roma 1",
        "city": "Milano",
        "province": "MI",
        "postal_code": "20100",
        "country": "IT"
      },
      {
        "address_id": "addr_002",
        "address_type": "shipping",
        "is_default": false,
        "label": "Magazzino",
        "street": "Via Torino 50",
        "city": "Milano",
        "province": "MI",
        "postal_code": "20123",
        "country": "IT"
      }
    ]
  }
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/profile/route.ts
export async function GET() {
  const session = await getPortalSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(
    `${API_URL}/api/b2b/customers/${session.customerId}`,
    {
      headers: {
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
        "x-portal-user-token": session.token,
      },
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 2.2 Update Profile

Update customer profile information.

**Commerce Suite Endpoint:**
```
PUT /api/b2b/customers/{customer_id}
```

**Request Body:**
```json
{
  "phone": "+39 02 9876543",
  "legal_info": {
    "sdi_code": "YYYYYYY",
    "pec": "nuova@pec.it"
  }
}
```

### 2.3 Manage Addresses

#### Add Address
```
POST /api/b2b/customers/{customer_id}/addresses
```

**Request Body:**
```json
{
  "address_type": "shipping",
  "label": "Nuovo Magazzino",
  "street": "Via Napoli 100",
  "city": "Roma",
  "province": "RM",
  "postal_code": "00100",
  "country": "IT",
  "is_default": false
}
```

#### Update Address
```
PUT /api/b2b/customers/{customer_id}/addresses/{address_id}
```

#### Delete Address
```
DELETE /api/b2b/customers/{customer_id}/addresses/{address_id}
```

#### Set Default Address
```
POST /api/b2b/customers/{customer_id}/addresses/{address_id}/set-default
```

### 2.4 Portal User Profile Update

Update portal user info (name, email, phone).

**Commerce Suite Endpoint:**
```
PUT /api/b2b/portal-users/{portal_user_id}
```

**Request Body:**
```json
{
  "first_name": "Mario",
  "last_name": "Rossi",
  "phone": "+39 333 1234567"
}
```

### 2.5 Disable/Deactivate Account

Portal user can request account deactivation.

**Commerce Suite Endpoint:**
```
POST /api/b2b/portal-users/{portal_user_id}/deactivate
```

**Response:**
```json
{
  "success": true,
  "message": "Account has been deactivated."
}
```

---

## 3. Product Catalog

### 3.1 Search Products

Full-text search with faceting.

**Commerce Suite Endpoint:**
```
GET /api/search/search
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |
| `sort` | string | Sort field (e.g., `price_asc`, `price_desc`, `name_asc`) |
| `brand` | string | Filter by brand code (comma-separated for multiple) |
| `category` | string | Filter by category code |
| `price_min` | number | Minimum price |
| `price_max` | number | Maximum price |
| `in_stock` | boolean | Only show in-stock products |
| `lang` | string | Language code (default: `it`) |

**Example Request:**
```
GET /api/search/search?q=pompa&brand=grundfos,dab&price_min=100&price_max=500&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "entity_code": "PUMP-001",
      "sku": "GRF-PUMP-001",
      "name": "Pompa Centrifuga 1.5kW",
      "brand": {
        "code": "grundfos",
        "name": "Grundfos"
      },
      "category": {
        "code": "pompe-centrifughe",
        "name": "Pompe Centrifughe"
      },
      "price": 350.00,
      "list_price": 420.00,
      "currency": "EUR",
      "images": [
        {
          "url": "https://cdn.example.com/pump-001.jpg",
          "alt": "Pompa Centrifuga",
          "is_primary": true
        }
      ],
      "in_stock": true,
      "stock_quantity": 15
    }
  ],
  "facets": {
    "brand": [
      { "value": "grundfos", "label": "Grundfos", "count": 45 },
      { "value": "dab", "label": "DAB", "count": 32 }
    ],
    "category": [
      { "value": "pompe-centrifughe", "label": "Pompe Centrifughe", "count": 28 },
      { "value": "pompe-sommerse", "label": "Pompe Sommerse", "count": 17 }
    ],
    "price_range": {
      "min": 50,
      "max": 2500,
      "ranges": [
        { "from": 0, "to": 100, "count": 15 },
        { "from": 100, "to": 500, "count": 45 },
        { "from": 500, "to": 1000, "count": 23 },
        { "from": 1000, "to": null, "count": 8 }
      ]
    }
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 77,
    "totalPages": 4
  }
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/products/search/route.ts
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // Forward all query params to Commerce Suite
  const res = await fetch(
    `${API_URL}/api/search/search?${searchParams.toString()}`,
    {
      headers: {
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
      },
    }
  );

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 3.2 Get Product Detail

Get full product information.

**Commerce Suite Endpoint:**
```
GET /api/b2b/pim/products/{entity_code}
```

**Response:**
```json
{
  "success": true,
  "product": {
    "entity_code": "PUMP-001",
    "sku": "GRF-PUMP-001",
    "name": {
      "it": "Pompa Centrifuga 1.5kW",
      "en": "Centrifugal Pump 1.5kW"
    },
    "description": {
      "it": "Pompa centrifuga ad alta efficienza...",
      "en": "High efficiency centrifugal pump..."
    },
    "brand": {
      "code": "grundfos",
      "name": "Grundfos"
    },
    "category": {
      "code": "pompe-centrifughe",
      "name": { "it": "Pompe Centrifughe", "en": "Centrifugal Pumps" }
    },
    "price": 350.00,
    "list_price": 420.00,
    "retail_price": 499.00,
    "vat_rate": 22,
    "currency": "EUR",
    "packaging_options": [
      {
        "code": "PZ",
        "label": { "it": "Pezzo", "en": "Piece" },
        "qty": 1,
        "uom": "PZ",
        "is_default": true,
        "is_smallest": true,
        "pricing": {
          "list": 350.00,
          "retail": 499.00,
          "sale": 350.00
        }
      },
      {
        "code": "BOX",
        "label": { "it": "Scatola da 4", "en": "Box of 4" },
        "qty": 4,
        "uom": "BOX",
        "is_default": false,
        "pricing": {
          "list": 1300.00,
          "retail": 1800.00,
          "sale": 1300.00
        }
      }
    ],
    "features": [
      { "code": "potenza", "label": "Potenza", "value": "1.5 kW" },
      { "code": "portata", "label": "Portata max", "value": "120 l/min" },
      { "code": "prevalenza", "label": "Prevalenza max", "value": "45 m" }
    ],
    "images": [
      {
        "url": "https://cdn.example.com/pump-001-1.jpg",
        "alt": "Vista frontale",
        "is_primary": true,
        "order": 1
      },
      {
        "url": "https://cdn.example.com/pump-001-2.jpg",
        "alt": "Vista laterale",
        "is_primary": false,
        "order": 2
      }
    ],
    "documents": [
      {
        "type": "datasheet",
        "label": "Scheda Tecnica",
        "url": "https://cdn.example.com/pump-001-datasheet.pdf"
      }
    ],
    "related_products": ["PUMP-002", "PUMP-003"],
    "stock": {
      "in_stock": true,
      "quantity": 15,
      "warehouse": "MI-01"
    }
  }
}
```

### 3.3 Browse by Category

Get products in a category with subcategories.

**Commerce Suite Endpoint:**
```
GET /api/public/categories/{category_code}/products
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number |
| `limit` | number | Products per page |
| `include_subcategories` | boolean | Include products from subcategories |

**Response:**
```json
{
  "success": true,
  "category": {
    "code": "pompe",
    "name": { "it": "Pompe", "en": "Pumps" },
    "subcategories": [
      { "code": "pompe-centrifughe", "name": "Pompe Centrifughe", "product_count": 28 },
      { "code": "pompe-sommerse", "name": "Pompe Sommerse", "product_count": 17 }
    ]
  },
  "products": [...],
  "pagination": {...}
}
```

### 3.4 Browse by Brand

Get products from a brand.

**Commerce Suite Endpoint:**
```
GET /api/b2b/pim/brands/{brand_code}/products
```

### 3.5 Get Facet Options

Get available filter options for the current search context.

**Commerce Suite Endpoint:**
```
GET /api/search/facet
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `context` | string | Category or brand code for context |
| `facets` | string | Comma-separated facet fields to return |

---

## 4. Shopping Cart (Order Draft)

### 4.1 Get Current Cart

Get the current draft order (cart).

**Commerce Suite Endpoint:**
```
GET /api/b2b/orders?status=draft&customer_id={customer_id}&limit=1
```

Or by cart ID:
```
GET /api/b2b/orders/{order_id}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_abc123",
    "status": "draft",
    "customer_id": "cust_xyz789",
    "items": [
      {
        "line_number": 1,
        "entity_code": "PUMP-001",
        "sku": "GRF-PUMP-001",
        "name": "Pompa Centrifuga 1.5kW",
        "quantity": 2,
        "pack_size": 1,
        "packaging_code": "PZ",
        "packaging_label": "Pezzo",
        "list_price": 350.00,
        "retail_price": 499.00,
        "unit_price": 350.00,
        "vat_rate": 22,
        "line_gross": 700.00,
        "line_net": 573.77,
        "line_vat": 126.23,
        "line_total": 700.00
      }
    ],
    "subtotal_gross": 700.00,
    "subtotal_net": 573.77,
    "total_vat": 126.23,
    "order_total": 700.00,
    "currency": "EUR",
    "item_count": 1,
    "total_quantity": 2
  }
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/cart/route.ts
export async function GET() {
  const session = await getPortalSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get or create cart
  const res = await fetch(
    `${API_URL}/api/b2b/orders?status=draft&customer_id=${session.customerId}&limit=1`,
    {
      headers: {
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
        "x-portal-user-token": session.token,
      },
    }
  );

  const data = await res.json();

  if (data.orders?.length > 0) {
    return NextResponse.json({ cart: data.orders[0] });
  }

  // No cart exists - return empty cart structure
  return NextResponse.json({
    cart: null,
    message: "No active cart",
  });
}
```

### 4.2 Create Cart

Create a new draft order (cart).

**Commerce Suite Endpoint:**
```
POST /api/b2b/orders
```

**Request Body:**
```json
{
  "customer_id": "cust_xyz789",
  "order_type": "b2b",
  "price_list_type": "wholesale",
  "currency": "EUR"
}
```

### 4.3 Add Item to Cart

Add a product to the cart.

**Commerce Suite Endpoint:**
```
POST /api/b2b/orders/{order_id}/items
```

**Request Body:**
```json
{
  "entity_code": "PUMP-001",
  "sku": "GRF-PUMP-001",
  "quantity": 2,
  "list_price": 350.00,
  "retail_price": 499.00,
  "unit_price": 350.00,
  "vat_rate": 22,
  "name": "Pompa Centrifuga 1.5kW",
  "pack_size": 1,
  "quantity_unit": "PZ",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "product_source": "pim"
}
```

**Response:**
```json
{
  "success": true,
  "item": {
    "line_number": 1,
    "entity_code": "PUMP-001",
    "quantity": 2,
    "line_total": 700.00
  },
  "order": {
    "order_id": "cart_abc123",
    "item_count": 1,
    "total_quantity": 2,
    "order_total": 700.00
  }
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/cart/items/route.ts
export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { cartId, ...itemData } = body;

  // Get or create cart
  let orderId = cartId;
  if (!orderId) {
    // Create new cart
    const createRes = await fetch(`${API_URL}/api/b2b/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-auth-method": "api-key",
        "x-api-key-id": API_KEY_ID!,
        "x-api-secret": API_SECRET!,
        "x-portal-user-token": session.token,
      },
      body: JSON.stringify({
        customer_id: session.customerId,
        order_type: "b2b",
        price_list_type: "wholesale",
        currency: "EUR",
      }),
    });
    const createData = await createRes.json();
    orderId = createData.order?.order_id;
  }

  // Add item
  const res = await fetch(`${API_URL}/api/b2b/orders/${orderId}/items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-auth-method": "api-key",
      "x-api-key-id": API_KEY_ID!,
      "x-api-secret": API_SECRET!,
      "x-portal-user-token": session.token,
    },
    body: JSON.stringify(itemData),
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 4.4 Update Cart Item Quantity

**Commerce Suite Endpoint:**
```
PATCH /api/b2b/orders/{order_id}/items/{line_number}
```

**Request Body:**
```json
{
  "quantity": 5
}
```

### 4.5 Remove Item from Cart

**Commerce Suite Endpoint:**
```
DELETE /api/b2b/orders/{order_id}/items/{line_number}
```

### 4.6 Clear Cart

Remove all items from cart.

**Commerce Suite Endpoint:**
```
DELETE /api/b2b/orders/{order_id}/items
```

### 4.7 Update Cart (Shipping Address, Notes)

**Commerce Suite Endpoint:**
```
PATCH /api/b2b/orders/{order_id}
```

**Request Body:**
```json
{
  "shipping_address_id": "addr_002",
  "requested_delivery_date": "2024-01-25",
  "po_reference": "PO-2024-001",
  "notes": "Consegna mattina"
}
```

---

## 5. Order Checkout & History

### 5.1 Submit Order (Checkout)

Convert draft to submitted order.

**Commerce Suite Endpoint:**
```
POST /api/b2b/orders/{order_id}/submit
```

**Request Body:**
```json
{
  "shipping_address_id": "addr_001",
  "billing_address_id": "addr_001",
  "po_reference": "PO-2024-001",
  "requested_delivery_date": "2024-01-25",
  "notes": "Consegna mattina, citofono ROSSI"
}
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "ORD-2024-00123",
    "status": "pending",
    "submitted_at": "2024-01-15T14:30:00Z",
    "order_total": 854.00,
    "message": "Order submitted successfully"
  }
}
```

### 5.2 Get Order History

List customer's orders.

**Commerce Suite Endpoint:**
```
GET /api/b2b/orders?customer_id={customer_id}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `customer_id` | string | Filter by customer |
| `status` | string | Filter by status (e.g., `pending`, `confirmed`, `shipped`) |
| `page` | number | Page number |
| `limit` | number | Orders per page |
| `sort` | string | Sort field (e.g., `-created_at` for newest first) |

**Response:**
```json
{
  "success": true,
  "orders": [
    {
      "order_id": "ORD-2024-00123",
      "status": "shipped",
      "created_at": "2024-01-15T14:30:00Z",
      "order_total": 854.00,
      "item_count": 3,
      "shipping_address": {
        "label": "Sede",
        "city": "Milano"
      }
    },
    {
      "order_id": "ORD-2024-00098",
      "status": "delivered",
      "created_at": "2024-01-10T09:15:00Z",
      "order_total": 1250.00,
      "item_count": 5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Storefront Proxy Route:**
```typescript
// vinc-b2b/src/app/api/orders/route.ts
export async function GET(req: NextRequest) {
  const session = await getPortalSession();
  if (!session?.customerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = searchParams.get("page") || "1";
  const status = searchParams.get("status") || "";

  const params = new URLSearchParams({
    customer_id: session.customerId,
    page,
    limit: "20",
  });
  if (status) params.set("status", status);

  const res = await fetch(`${API_URL}/api/b2b/orders?${params.toString()}`, {
    headers: {
      "x-auth-method": "api-key",
      "x-api-key-id": API_KEY_ID!,
      "x-api-secret": API_SECRET!,
      "x-portal-user-token": session.token,
    },
  });

  return NextResponse.json(await res.json(), { status: res.status });
}
```

### 5.3 Get Order Detail

Get full order details with items.

**Commerce Suite Endpoint:**
```
GET /api/b2b/orders/{order_id}
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Items page (for orders with many items) |
| `limit` | number | Items per page |

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "ORD-2024-00123",
    "status": "shipped",
    "customer_id": "cust_xyz789",
    "created_at": "2024-01-15T14:30:00Z",
    "submitted_at": "2024-01-15T14:30:00Z",
    "confirmed_at": "2024-01-15T15:00:00Z",
    "shipped_at": "2024-01-16T10:00:00Z",
    "po_reference": "PO-2024-001",
    "shipping_method": "standard",
    "shipping_address_id": "addr_001",
    "items": [
      {
        "line_number": 1,
        "entity_code": "PUMP-001",
        "name": "Pompa Centrifuga 1.5kW",
        "quantity": 2,
        "unit_price": 350.00,
        "line_total": 700.00,
        "packaging_code": "PZ",
        "packaging_label": "Pezzo"
      }
    ],
    "subtotal_gross": 700.00,
    "subtotal_net": 573.77,
    "total_vat": 126.23,
    "shipping_cost": 0,
    "order_total": 700.00,
    "tracking": {
      "carrier": "BRT",
      "tracking_number": "123456789",
      "tracking_url": "https://tracking.brt.it/123456789"
    }
  },
  "customer": {
    "customer_id": "cust_xyz789",
    "company_name": "Rossi S.r.l.",
    "email": "info@rossi-srl.it"
  },
  "shippingAddress": {
    "label": "Sede",
    "street": "Via Roma 1",
    "city": "Milano",
    "province": "MI",
    "postal_code": "20100",
    "country": "IT"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

### 5.4 Reorder

Create a new cart from a previous order.

**Commerce Suite Endpoint:**
```
POST /api/b2b/orders/{order_id}/reorder
```

**Response:**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_new123",
    "status": "draft",
    "item_count": 3,
    "order_total": 700.00,
    "message": "Items from order ORD-2024-00123 added to cart"
  }
}
```

---

## 6. Home Page

### 6.1 Get Home Page Content

Get configured home page with hero, featured products, etc.

**Commerce Suite Endpoint:**
```
GET /api/public/home
```

**Response:**
```json
{
  "success": true,
  "home": {
    "hero": {
      "title": "Benvenuto",
      "subtitle": "I migliori prodotti per la tua azienda",
      "image_url": "https://cdn.example.com/hero.jpg",
      "cta_text": "Scopri i prodotti",
      "cta_url": "/products"
    },
    "featured_products": [
      {
        "entity_code": "PUMP-001",
        "name": "Pompa Centrifuga 1.5kW",
        "price": 350.00,
        "image_url": "https://cdn.example.com/pump-001.jpg"
      }
    ],
    "featured_categories": [
      {
        "code": "pompe",
        "name": "Pompe",
        "image_url": "https://cdn.example.com/cat-pompe.jpg"
      }
    ],
    "banners": [
      {
        "image_url": "https://cdn.example.com/banner-promo.jpg",
        "link": "/promo/winter-sale",
        "alt": "Saldi Invernali"
      }
    ]
  }
}
```

### 6.2 Get Menu/Navigation

Get navigation menu structure.

**Commerce Suite Endpoint:**
```
GET /api/public/menu
```

**Response:**
```json
{
  "success": true,
  "menu": [
    {
      "id": "menu_1",
      "label": "Prodotti",
      "url": "/products",
      "children": [
        {
          "id": "menu_1_1",
          "label": "Pompe",
          "url": "/category/pompe",
          "children": [
            { "id": "menu_1_1_1", "label": "Centrifughe", "url": "/category/pompe-centrifughe" },
            { "id": "menu_1_1_2", "label": "Sommerse", "url": "/category/pompe-sommerse" }
          ]
        },
        {
          "id": "menu_1_2",
          "label": "Valvole",
          "url": "/category/valvole"
        }
      ]
    },
    {
      "id": "menu_2",
      "label": "Brand",
      "url": "/brands"
    },
    {
      "id": "menu_3",
      "label": "Contatti",
      "url": "/contact"
    }
  ]
}
```

### 6.3 Get Collections

Get curated product collections.

**Commerce Suite Endpoint:**
```
GET /api/public/collections
```

**Response:**
```json
{
  "success": true,
  "collections": [
    {
      "id": "coll_bestsellers",
      "code": "bestsellers",
      "name": "Bestseller",
      "description": "I prodotti più venduti",
      "image_url": "https://cdn.example.com/bestsellers.jpg",
      "product_count": 24
    },
    {
      "id": "coll_new",
      "code": "new-arrivals",
      "name": "Novità",
      "description": "Ultimi arrivi",
      "product_count": 12
    }
  ]
}
```

---

## 7. Session Helper Utilities

### 7.1 Get Portal Session Helper

```typescript
// vinc-b2b/src/lib/auth/session.ts
import { cookies } from "next/headers";

export interface PortalSession {
  token: string;
  portalUserId: string;
  customerId: string;
  email: string;
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("portal_session");

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value);
  } catch {
    return null;
  }
}

export async function requirePortalSession(): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}
```

### 7.2 API Client Helper

```typescript
// vinc-b2b/src/lib/api/client.ts
const API_URL = process.env.COMMERCE_SUITE_API_URL!;
const API_KEY_ID = process.env.API_KEY_ID!;
const API_SECRET = process.env.API_SECRET!;

interface FetchOptions {
  method?: string;
  body?: unknown;
  portalToken?: string;
}

export async function apiClient(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { method = "GET", body, portalToken } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-auth-method": "api-key",
    "x-api-key-id": API_KEY_ID,
    "x-api-secret": API_SECRET,
  };

  if (portalToken) {
    headers["x-portal-user-token"] = portalToken;
  }

  return fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
```

---

## 8. Error Handling

### Standard Error Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 401 | `UNAUTHORIZED` | Missing or invalid authentication |
| 403 | `ACCESS_DENIED` | Authenticated but not authorized |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Storefront Error Handler

```typescript
// vinc-b2b/src/lib/api/error-handler.ts
export function handleApiError(error: unknown): NextResponse {
  console.error("API Error:", error);

  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Please log in to continue" },
        { status: 401 }
      );
    }
  }

  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
```

---

## 9. Environment Variables

### Storefront (vinc-b2b) .env

```bash
# Commerce Suite API
COMMERCE_SUITE_API_URL=https://cs.vendereincloud.it
API_KEY_ID=ak_your-tenant_xxxxxxxxxxxx
API_SECRET=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Session
SESSION_SECRET=your-session-secret-min-32-chars

# App
NEXT_PUBLIC_APP_URL=https://b2b.your-domain.com
```

### Security Notes

1. **Never commit secrets** - Use environment variables
2. **Rotate API keys periodically** - Generate new keys every 90 days
3. **Use HTTPS in production** - All API communication should be encrypted
4. **Set secure cookie options** - `httpOnly`, `secure`, `sameSite`
5. **Validate all input** - Never trust client-side data

---

## 10. Complete Flow Examples

### 10.1 New Customer Registration Flow

```
1. User fills registration form
   ↓
2. POST /api/auth/register (storefront proxy)
   → POST /api/b2b/portal-users (commerce suite)
   ↓
3. Portal user created with status="pending"
   ↓
4. Admin approves user, assigns customer_access
   ↓
5. User can now login
```

### 10.2 Login and Browse Flow

```
1. User enters credentials
   ↓
2. POST /api/auth/login (storefront proxy)
   → POST /api/b2b/portal-users/login (commerce suite)
   ↓
3. Session cookie set (httpOnly)
   ↓
4. GET /api/products/search?q=pompa
   → GET /api/search/search?q=pompa (commerce suite)
   ↓
5. Browse products with facets
```

### 10.3 Add to Cart and Checkout Flow

```
1. User clicks "Add to Cart"
   ↓
2. POST /api/cart/items
   → POST /api/b2b/orders (create cart if needed)
   → POST /api/b2b/orders/{id}/items
   ↓
3. User views cart, updates quantities
   ↓
4. User selects shipping address
   ↓
5. POST /api/cart/checkout
   → POST /api/b2b/orders/{id}/submit
   ↓
6. Order confirmed, redirect to order detail
```

---

## Appendix: API Endpoint Summary

| Feature | Method | Storefront Route | Commerce Suite Endpoint |
|---------|--------|------------------|-------------------------|
| **Auth** ||||
| Register | POST | `/api/auth/register` | `/api/b2b/portal-users` |
| Login | POST | `/api/auth/login` | `/api/b2b/portal-users/login` |
| Logout | POST | `/api/auth/logout` | - |
| Forgot Password | POST | `/api/auth/forgot-password` | `/api/b2b/portal-users/forgot-password` |
| Reset Password | POST | `/api/auth/reset-password` | `/api/b2b/portal-users/reset-password` |
| Get Session | GET | `/api/auth/me` | `/api/b2b/portal-users/{id}` |
| **Profile** ||||
| Get Profile | GET | `/api/profile` | `/api/b2b/customers/{id}` |
| Update Profile | PUT | `/api/profile` | `/api/b2b/customers/{id}` |
| Add Address | POST | `/api/profile/addresses` | `/api/b2b/customers/{id}/addresses` |
| **Products** ||||
| Search | GET | `/api/products/search` | `/api/search/search` |
| Detail | GET | `/api/products/{code}` | `/api/b2b/pim/products/{code}` |
| By Category | GET | `/api/categories/{code}/products` | `/api/public/categories/{code}/products` |
| By Brand | GET | `/api/brands/{code}/products` | `/api/b2b/pim/brands/{code}/products` |
| **Cart** ||||
| Get Cart | GET | `/api/cart` | `/api/b2b/orders?status=draft` |
| Add Item | POST | `/api/cart/items` | `/api/b2b/orders/{id}/items` |
| Update Item | PATCH | `/api/cart/items/{line}` | `/api/b2b/orders/{id}/items/{line}` |
| Remove Item | DELETE | `/api/cart/items/{line}` | `/api/b2b/orders/{id}/items/{line}` |
| Checkout | POST | `/api/cart/checkout` | `/api/b2b/orders/{id}/submit` |
| **Orders** ||||
| List Orders | GET | `/api/orders` | `/api/b2b/orders?customer_id=...` |
| Order Detail | GET | `/api/orders/{id}` | `/api/b2b/orders/{id}` |
| Reorder | POST | `/api/orders/{id}/reorder` | `/api/b2b/orders/{id}/reorder` |
| **Home** ||||
| Home Content | GET | `/api/home` | `/api/public/home` |
| Menu | GET | `/api/menu` | `/api/public/menu` |
| Collections | GET | `/api/collections` | `/api/public/collections` |
