# Mobile App API Reference

JSON API examples for mobile app integration with VINC Commerce Suite.

## Base Configuration

```
Base URL: https://cs.vendereincloud.it
Content-Type: application/json
```

### Authentication Headers

All authenticated requests require:

```
x-auth-method: api-key
x-api-key-id: ak_{tenant-id}_{key-suffix}
x-api-secret: sk_{secret}
```

For portal user restricted endpoints, also include:

```
x-portal-user-token: {jwt-token-from-login}
```

---

## 1. Authentication

### 1.1 Register

```http
POST /api/b2b/portal-users
```

**Request:**
```json
{
  "username": "mario.rossi",
  "email": "mario.rossi@example.com",
  "password": "SecurePass123!",
  "first_name": "Mario",
  "last_name": "Rossi",
  "phone": "+39 333 1234567"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "portal_user": {
    "portal_user_id": "PU-EKyHZ0uF",
    "username": "mario.rossi",
    "email": "mario.rossi@example.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "phone": "+39 333 1234567",
    "status": "pending",
    "customer_access": [],
    "created_at": "2024-01-15T10:30:00.000Z"
  },
  "message": "Portal user created successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Email already registered"
}
```

---

### 1.2 Login

```http
POST /api/b2b/portal-users/login
```

**Request:**
```json
{
  "email": "mario.rossi@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwb3J0YWxfdXNlcl9pZCI6IlBVLUVLeUhaMHVGIiwidGVuYW50X2lkIjoiaGlkcm9zLWl0IiwiaWF0IjoxNzA1MzE1ODAwLCJleHAiOjE3MDU0MDIyMDB9.abc123",
  "portal_user": {
    "portal_user_id": "PU-EKyHZ0uF",
    "username": "mario.rossi",
    "email": "mario.rossi@example.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "status": "active",
    "customer_access": [
      {
        "customer_id": "cust_xyz789abc",
        "address_access": "all"
      }
    ]
  },
  "expires_at": "2024-01-16T10:30:00.000Z"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Account is pending approval"
}
```

> **Mobile Storage:** Store `token` securely (Keychain on iOS, EncryptedSharedPreferences on Android).

---

### 1.3 Get Current User

```http
GET /api/b2b/portal-users/{portal_user_id}
```

**Headers:**
```
x-auth-method: api-key
x-api-key-id: ak_tenant_xxxx
x-api-secret: sk_xxxx
x-portal-user-token: eyJhbGciOiJIUzI1NiIs...
```

**Response (200 OK):**
```json
{
  "success": true,
  "portal_user": {
    "portal_user_id": "PU-EKyHZ0uF",
    "username": "mario.rossi",
    "email": "mario.rossi@example.com",
    "first_name": "Mario",
    "last_name": "Rossi",
    "phone": "+39 333 1234567",
    "status": "active",
    "customer_access": [
      {
        "customer_id": "cust_xyz789abc",
        "address_access": "all"
      }
    ],
    "last_login_at": "2024-01-15T10:30:00.000Z",
    "created_at": "2024-01-10T08:00:00.000Z"
  }
}
```

---

### 1.4 Forgot Password

```http
POST /api/b2b/portal-users/forgot-password
```

**Request:**
```json
{
  "email": "mario.rossi@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent."
}
```

---

### 1.5 Reset Password

```http
POST /api/b2b/portal-users/reset-password
```

**Request:**
```json
{
  "token": "reset_abc123xyz",
  "new_password": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password has been reset successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Invalid or expired reset token"
}
```

---

### 1.6 Change Password

```http
POST /api/b2b/portal-users/{portal_user_id}/change-password
```

**Request:**
```json
{
  "current_password": "SecurePass123!",
  "new_password": "NewSecurePass456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Current password is incorrect"
}
```

---

## 2. Profile & Addresses

### 2.1 Get Customer Profile

```http
GET /api/b2b/customers/{customer_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "customer": {
    "customer_id": "cust_xyz789abc",
    "external_code": "CLI-00123",
    "public_code": "C-00123",
    "customer_type": "business",
    "company_name": "Rossi Impianti S.r.l.",
    "first_name": "Mario",
    "last_name": "Rossi",
    "email": "info@rossi-impianti.it",
    "phone": "+39 02 1234567",
    "mobile": "+39 333 1234567",
    "legal_info": {
      "vat_number": "IT12345678901",
      "fiscal_code": "12345678901",
      "sdi_code": "XXXXXXX",
      "pec": "rossi@pec.it"
    },
    "addresses": [
      {
        "address_id": "addr_001",
        "address_type": "shipping",
        "is_default": true,
        "label": "Sede Principale",
        "company_name": "Rossi Impianti S.r.l.",
        "street": "Via Roma 1",
        "street_2": "Piano 3",
        "city": "Milano",
        "province": "MI",
        "postal_code": "20100",
        "country": "IT",
        "phone": "+39 02 1234567",
        "notes": "Citofono ROSSI"
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
    ],
    "price_list": "wholesale",
    "payment_terms": "30gg",
    "credit_limit": 50000,
    "created_at": "2023-06-01T00:00:00.000Z"
  }
}
```

---

### 2.2 Update Customer Profile

```http
PUT /api/b2b/customers/{customer_id}
```

**Request:**
```json
{
  "phone": "+39 02 9876543",
  "mobile": "+39 333 9876543",
  "legal_info": {
    "sdi_code": "YYYYYYY",
    "pec": "nuova@pec.it"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "customer": {
    "customer_id": "cust_xyz789abc",
    "phone": "+39 02 9876543",
    "mobile": "+39 333 9876543",
    "legal_info": {
      "vat_number": "IT12345678901",
      "fiscal_code": "12345678901",
      "sdi_code": "YYYYYYY",
      "pec": "nuova@pec.it"
    }
  },
  "message": "Customer updated successfully"
}
```

---

### 2.3 Add Address

```http
POST /api/b2b/customers/{customer_id}/addresses
```

**Request:**
```json
{
  "address_type": "shipping",
  "label": "Cantiere Nord",
  "company_name": "Rossi Impianti S.r.l.",
  "street": "Via Napoli 100",
  "city": "Roma",
  "province": "RM",
  "postal_code": "00100",
  "country": "IT",
  "phone": "+39 06 1234567",
  "is_default": false,
  "notes": "Ingresso da Via Milano"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "address": {
    "address_id": "addr_003",
    "address_type": "shipping",
    "label": "Cantiere Nord",
    "street": "Via Napoli 100",
    "city": "Roma",
    "province": "RM",
    "postal_code": "00100",
    "country": "IT",
    "is_default": false
  },
  "message": "Address added successfully"
}
```

---

### 2.4 Update Address

```http
PUT /api/b2b/customers/{customer_id}/addresses/{address_id}
```

**Request:**
```json
{
  "label": "Cantiere Milano Nord",
  "notes": "Nuovo ingresso da Via Torino"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "address": {
    "address_id": "addr_003",
    "label": "Cantiere Milano Nord",
    "notes": "Nuovo ingresso da Via Torino"
  }
}
```

---

### 2.5 Delete Address

```http
DELETE /api/b2b/customers/{customer_id}/addresses/{address_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Address deleted successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Cannot delete default address"
}
```

---

### 2.6 Set Default Address

```http
POST /api/b2b/customers/{customer_id}/addresses/{address_id}/set-default
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Default address updated"
}
```

---

## 3. Product Catalog

### 3.1 Search Products

```http
GET /api/search/search?q={query}&page=1&limit=20
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | - | Search query |
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Results per page (max 100) |
| `sort` | string | `relevance` | Sort: `relevance`, `price_asc`, `price_desc`, `name_asc`, `newest` |
| `brand` | string | - | Filter by brand code(s), comma-separated |
| `category` | string | - | Filter by category code |
| `price_min` | number | - | Minimum price |
| `price_max` | number | - | Maximum price |
| `in_stock` | bool | - | Only in-stock products |
| `lang` | string | `it` | Language code |

**Example Request:**
```
GET /api/search/search?q=pompa&brand=grundfos,dab&price_min=100&price_max=500&page=1&limit=20&sort=price_asc
```

**Response (200 OK):**
```json
{
  "success": true,
  "products": [
    {
      "entity_code": "PUMP-001",
      "sku": "GRF-PUMP-001",
      "name": "Pompa Centrifuga 1.5kW",
      "slug": "pompa-centrifuga-1-5kw",
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
      "retail_price": 499.00,
      "currency": "EUR",
      "vat_rate": 22,
      "images": [
        {
          "url": "https://cdn.example.com/products/pump-001-thumb.jpg",
          "alt": "Pompa Centrifuga",
          "is_primary": true
        }
      ],
      "in_stock": true,
      "stock_quantity": 15,
      "min_order_quantity": 1,
      "packaging_options": [
        {
          "code": "PZ",
          "label": "Pezzo",
          "qty": 1,
          "is_default": true
        }
      ]
    },
    {
      "entity_code": "PUMP-002",
      "sku": "DAB-PUMP-002",
      "name": "Pompa Sommergibile 0.75kW",
      "brand": {
        "code": "dab",
        "name": "DAB"
      },
      "category": {
        "code": "pompe-sommerse",
        "name": "Pompe Sommerse"
      },
      "price": 180.00,
      "list_price": 220.00,
      "currency": "EUR",
      "images": [
        {
          "url": "https://cdn.example.com/products/pump-002-thumb.jpg",
          "is_primary": true
        }
      ],
      "in_stock": true,
      "stock_quantity": 8
    }
  ],
  "facets": {
    "brand": [
      { "value": "grundfos", "label": "Grundfos", "count": 45, "selected": true },
      { "value": "dab", "label": "DAB", "count": 32, "selected": true },
      { "value": "wilo", "label": "Wilo", "count": 28 },
      { "value": "lowara", "label": "Lowara", "count": 19 }
    ],
    "category": [
      { "value": "pompe-centrifughe", "label": "Pompe Centrifughe", "count": 28 },
      { "value": "pompe-sommerse", "label": "Pompe Sommerse", "count": 17 },
      { "value": "pompe-autoadescanti", "label": "Pompe Autoadescanti", "count": 12 }
    ],
    "price_range": {
      "min": 50,
      "max": 2500,
      "ranges": [
        { "from": 0, "to": 100, "count": 15 },
        { "from": 100, "to": 500, "count": 45, "selected": true },
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
  },
  "query": {
    "q": "pompa",
    "filters": {
      "brand": ["grundfos", "dab"],
      "price_min": 100,
      "price_max": 500
    }
  }
}
```

---

### 3.2 Get Product Detail

```http
GET /api/b2b/pim/products/{entity_code}
```

**Response (200 OK):**
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
    "slug": "pompa-centrifuga-1-5kw",
    "description": {
      "it": "Pompa centrifuga ad alta efficienza per applicazioni industriali e civili. Corpo in ghisa, girante in acciaio inox.",
      "en": "High efficiency centrifugal pump for industrial and civil applications. Cast iron body, stainless steel impeller."
    },
    "short_description": {
      "it": "Pompa centrifuga 1.5kW, portata max 120 l/min",
      "en": "Centrifugal pump 1.5kW, max flow 120 l/min"
    },
    "brand": {
      "code": "grundfos",
      "name": "Grundfos",
      "logo_url": "https://cdn.example.com/brands/grundfos.png"
    },
    "category": {
      "code": "pompe-centrifughe",
      "name": { "it": "Pompe Centrifughe", "en": "Centrifugal Pumps" },
      "breadcrumb": [
        { "code": "pompe", "name": "Pompe" },
        { "code": "pompe-centrifughe", "name": "Pompe Centrifughe" }
      ]
    },
    "product_type": {
      "code": "pumps",
      "name": "Pompe"
    },
    "tags": [
      { "code": "bestseller", "label": "Bestseller" },
      { "code": "promo", "label": "In Promozione" }
    ],
    "status": "published",
    "price": 350.00,
    "list_price": 420.00,
    "retail_price": 499.00,
    "cost_price": 200.00,
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
          "list": 420.00,
          "retail": 499.00,
          "sale": 350.00
        },
        "barcode": "8001234567890"
      },
      {
        "code": "BOX",
        "label": { "it": "Scatola da 4", "en": "Box of 4" },
        "qty": 4,
        "uom": "BOX",
        "is_default": false,
        "pricing": {
          "list": 1600.00,
          "retail": 1900.00,
          "sale": 1300.00
        },
        "barcode": "8001234567891"
      }
    ],
    "features": [
      {
        "code": "potenza",
        "label": { "it": "Potenza", "en": "Power" },
        "value": "1.5 kW",
        "unit": "kW",
        "numeric_value": 1.5
      },
      {
        "code": "portata_max",
        "label": { "it": "Portata massima", "en": "Max flow" },
        "value": "120 l/min",
        "unit": "l/min",
        "numeric_value": 120
      },
      {
        "code": "prevalenza_max",
        "label": { "it": "Prevalenza massima", "en": "Max head" },
        "value": "45 m",
        "unit": "m",
        "numeric_value": 45
      },
      {
        "code": "materiale_corpo",
        "label": { "it": "Materiale corpo", "en": "Body material" },
        "value": "Ghisa"
      },
      {
        "code": "alimentazione",
        "label": { "it": "Alimentazione", "en": "Power supply" },
        "value": "230V / 50Hz"
      }
    ],
    "images": [
      {
        "url": "https://cdn.example.com/products/pump-001-1.jpg",
        "thumbnail_url": "https://cdn.example.com/products/pump-001-1-thumb.jpg",
        "alt": "Vista frontale",
        "is_primary": true,
        "order": 1
      },
      {
        "url": "https://cdn.example.com/products/pump-001-2.jpg",
        "thumbnail_url": "https://cdn.example.com/products/pump-001-2-thumb.jpg",
        "alt": "Vista laterale",
        "is_primary": false,
        "order": 2
      },
      {
        "url": "https://cdn.example.com/products/pump-001-3.jpg",
        "thumbnail_url": "https://cdn.example.com/products/pump-001-3-thumb.jpg",
        "alt": "Dettaglio connessioni",
        "is_primary": false,
        "order": 3
      }
    ],
    "documents": [
      {
        "type": "datasheet",
        "label": { "it": "Scheda Tecnica", "en": "Datasheet" },
        "url": "https://cdn.example.com/docs/pump-001-datasheet.pdf",
        "size_bytes": 524288,
        "lang": "it"
      },
      {
        "type": "manual",
        "label": { "it": "Manuale d'uso", "en": "User Manual" },
        "url": "https://cdn.example.com/docs/pump-001-manual.pdf",
        "size_bytes": 1048576,
        "lang": "it"
      },
      {
        "type": "certificate",
        "label": { "it": "Certificato CE", "en": "CE Certificate" },
        "url": "https://cdn.example.com/docs/pump-001-ce.pdf",
        "lang": "en"
      }
    ],
    "videos": [
      {
        "type": "youtube",
        "title": "Installazione pompa centrifuga",
        "video_id": "dQw4w9WgXcQ",
        "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
      }
    ],
    "stock": {
      "in_stock": true,
      "quantity": 15,
      "available_quantity": 12,
      "reserved_quantity": 3,
      "warehouse": "MI-01",
      "lead_time_days": 0
    },
    "dimensions": {
      "weight": 12.5,
      "weight_unit": "kg",
      "length": 30,
      "width": 25,
      "height": 35,
      "dimension_unit": "cm"
    },
    "min_order_quantity": 1,
    "order_multiple": 1,
    "related_products": [
      {
        "entity_code": "PUMP-002",
        "relation_type": "similar",
        "name": "Pompa Sommergibile 0.75kW",
        "price": 180.00,
        "image_url": "https://cdn.example.com/products/pump-002-thumb.jpg"
      },
      {
        "entity_code": "ACC-001",
        "relation_type": "accessory",
        "name": "Kit raccordi pompa",
        "price": 25.00,
        "image_url": "https://cdn.example.com/products/acc-001-thumb.jpg"
      }
    ],
    "seo": {
      "meta_title": "Pompa Centrifuga 1.5kW Grundfos | VINC",
      "meta_description": "Acquista Pompa Centrifuga 1.5kW Grundfos. Portata max 120 l/min, prevalenza 45m. Spedizione veloce.",
      "keywords": ["pompa centrifuga", "grundfos", "1.5kw"]
    },
    "created_at": "2023-06-01T00:00:00.000Z",
    "updated_at": "2024-01-10T14:30:00.000Z"
  }
}
```

---

### 3.3 Get Categories

```http
GET /api/public/categories
```

**Response (200 OK):**
```json
{
  "success": true,
  "categories": [
    {
      "code": "pompe",
      "name": { "it": "Pompe", "en": "Pumps" },
      "slug": "pompe",
      "image_url": "https://cdn.example.com/categories/pompe.jpg",
      "product_count": 156,
      "order": 1,
      "children": [
        {
          "code": "pompe-centrifughe",
          "name": { "it": "Pompe Centrifughe", "en": "Centrifugal Pumps" },
          "product_count": 45,
          "order": 1
        },
        {
          "code": "pompe-sommerse",
          "name": { "it": "Pompe Sommerse", "en": "Submersible Pumps" },
          "product_count": 32,
          "order": 2
        },
        {
          "code": "pompe-autoadescanti",
          "name": { "it": "Pompe Autoadescanti", "en": "Self-priming Pumps" },
          "product_count": 28,
          "order": 3
        }
      ]
    },
    {
      "code": "valvole",
      "name": { "it": "Valvole", "en": "Valves" },
      "slug": "valvole",
      "image_url": "https://cdn.example.com/categories/valvole.jpg",
      "product_count": 89,
      "order": 2,
      "children": []
    }
  ]
}
```

---

### 3.4 Get Products by Category

```http
GET /api/public/categories/{category_code}/products?page=1&limit=20
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Products per page |
| `include_subcategories` | bool | true | Include products from subcategories |
| `sort` | string | `order` | Sort field |

**Response (200 OK):**
```json
{
  "success": true,
  "category": {
    "code": "pompe-centrifughe",
    "name": { "it": "Pompe Centrifughe", "en": "Centrifugal Pumps" },
    "description": { "it": "Pompe centrifughe per ogni esigenza" },
    "image_url": "https://cdn.example.com/categories/pompe-centrifughe.jpg",
    "breadcrumb": [
      { "code": "pompe", "name": "Pompe", "slug": "pompe" },
      { "code": "pompe-centrifughe", "name": "Pompe Centrifughe", "slug": "pompe-centrifughe" }
    ]
  },
  "products": [
    {
      "entity_code": "PUMP-001",
      "name": "Pompa Centrifuga 1.5kW",
      "price": 350.00,
      "list_price": 420.00,
      "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg",
      "in_stock": true
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

---

### 3.5 Get Brands

```http
GET /api/b2b/pim/brands
```

**Response (200 OK):**
```json
{
  "success": true,
  "brands": [
    {
      "code": "grundfos",
      "name": "Grundfos",
      "logo_url": "https://cdn.example.com/brands/grundfos.png",
      "description": "Leader mondiale nelle pompe",
      "website": "https://www.grundfos.com",
      "product_count": 89
    },
    {
      "code": "dab",
      "name": "DAB Pumps",
      "logo_url": "https://cdn.example.com/brands/dab.png",
      "product_count": 67
    },
    {
      "code": "wilo",
      "name": "Wilo",
      "logo_url": "https://cdn.example.com/brands/wilo.png",
      "product_count": 54
    }
  ]
}
```

---

### 3.6 Get Products by Brand

```http
GET /api/b2b/pim/brands/{brand_code}/products?page=1&limit=20
```

**Response (200 OK):**
```json
{
  "success": true,
  "brand": {
    "code": "grundfos",
    "name": "Grundfos",
    "logo_url": "https://cdn.example.com/brands/grundfos.png",
    "description": "Leader mondiale nelle soluzioni di pompaggio"
  },
  "products": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 89,
    "totalPages": 5
  }
}
```

---

## 4. Shopping Cart

### 4.1 Get or Create Cart

First, check for existing draft order:

```http
GET /api/b2b/orders?status=draft&customer_id={customer_id}&limit=1
```

**Response (200 OK) - Cart Exists:**
```json
{
  "success": true,
  "orders": [
    {
      "order_id": "cart_bKcpZBHE",
      "status": "draft",
      "customer_id": "cust_xyz789abc",
      "items": [...],
      "order_total": 700.00
    }
  ],
  "pagination": {
    "total": 1
  }
}
```

**Response (200 OK) - No Cart:**
```json
{
  "success": true,
  "orders": [],
  "pagination": {
    "total": 0
  }
}
```

If no cart exists, create one:

```http
POST /api/b2b/orders
```

**Request:**
```json
{
  "customer_id": "cust_xyz789abc",
  "order_type": "b2b",
  "price_list_type": "wholesale",
  "currency": "EUR"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_newABC123",
    "status": "draft",
    "customer_id": "cust_xyz789abc",
    "items": [],
    "subtotal_gross": 0,
    "subtotal_net": 0,
    "total_vat": 0,
    "order_total": 0,
    "currency": "EUR",
    "item_count": 0,
    "total_quantity": 0,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 4.2 Add Item to Cart

```http
POST /api/b2b/orders/{order_id}/items
```

**Request:**
```json
{
  "entity_code": "PUMP-001",
  "sku": "GRF-PUMP-001",
  "quantity": 2,
  "list_price": 420.00,
  "retail_price": 499.00,
  "unit_price": 350.00,
  "vat_rate": 22,
  "name": "Pompa Centrifuga 1.5kW",
  "pack_size": 1,
  "quantity_unit": "PZ",
  "packaging_code": "PZ",
  "packaging_label": "Pezzo",
  "product_source": "pim",
  "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg",
  "brand": "Grundfos",
  "category": "Pompe Centrifughe"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "item": {
    "line_number": 1,
    "entity_code": "PUMP-001",
    "sku": "GRF-PUMP-001",
    "name": "Pompa Centrifuga 1.5kW",
    "quantity": 2,
    "pack_size": 1,
    "packaging_code": "PZ",
    "packaging_label": "Pezzo",
    "list_price": 420.00,
    "retail_price": 499.00,
    "unit_price": 350.00,
    "vat_rate": 22,
    "line_gross": 700.00,
    "line_net": 573.77,
    "line_vat": 126.23,
    "line_total": 700.00,
    "added_at": "2024-01-15T10:35:00.000Z"
  },
  "order": {
    "order_id": "cart_bKcpZBHE",
    "item_count": 1,
    "total_quantity": 2,
    "subtotal_gross": 700.00,
    "subtotal_net": 573.77,
    "total_vat": 126.23,
    "order_total": 700.00
  }
}
```

**Note:** If the same product with identical attributes (entity_code, pack_size, unit_price, promo) is already in cart, quantities are merged automatically.

---

### 4.3 Get Cart Detail

```http
GET /api/b2b/orders/{order_id}?page=1&limit=50
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Items page (for large carts) |
| `limit` | int | 20 | Items per page |
| `search` | string | - | Filter items by SKU/name |

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_bKcpZBHE",
    "status": "draft",
    "customer_id": "cust_xyz789abc",
    "order_type": "b2b",
    "price_list_type": "wholesale",
    "currency": "EUR",
    "shipping_address_id": null,
    "billing_address_id": null,
    "po_reference": null,
    "notes": null,
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
        "list_price": 420.00,
        "retail_price": 499.00,
        "unit_price": 350.00,
        "vat_rate": 22,
        "line_gross": 700.00,
        "line_net": 573.77,
        "line_vat": 126.23,
        "line_total": 700.00,
        "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg",
        "brand": "Grundfos",
        "category": "Pompe Centrifughe",
        "added_at": "2024-01-15T10:35:00.000Z"
      },
      {
        "line_number": 2,
        "entity_code": "ACC-001",
        "sku": "ACC-KIT-001",
        "name": "Kit raccordi pompa",
        "quantity": 1,
        "pack_size": 1,
        "unit_price": 25.00,
        "vat_rate": 22,
        "line_gross": 25.00,
        "line_net": 20.49,
        "line_vat": 4.51,
        "line_total": 25.00
      }
    ],
    "subtotal_gross": 725.00,
    "subtotal_net": 594.26,
    "total_vat": 130.74,
    "shipping_cost": 0,
    "order_total": 725.00,
    "item_count": 2,
    "total_quantity": 3,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:40:00.000Z"
  },
  "customer": {
    "customer_id": "cust_xyz789abc",
    "company_name": "Rossi Impianti S.r.l.",
    "email": "info@rossi-impianti.it"
  },
  "shippingAddress": null,
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "totalPages": 1,
    "totalItemsCount": 2
  }
}
```

---

### 4.4 Update Item Quantity

```http
PATCH /api/b2b/orders/{order_id}/items/{line_number}
```

**Request:**
```json
{
  "quantity": 5
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "item": {
    "line_number": 1,
    "entity_code": "PUMP-001",
    "quantity": 5,
    "line_gross": 1750.00,
    "line_net": 1434.43,
    "line_vat": 315.57,
    "line_total": 1750.00,
    "updated_at": "2024-01-15T10:45:00.000Z"
  },
  "order": {
    "order_id": "cart_bKcpZBHE",
    "item_count": 2,
    "total_quantity": 6,
    "order_total": 1775.00
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Quantity must be a multiple of 4"
}
```

---

### 4.5 Remove Item from Cart

```http
DELETE /api/b2b/orders/{order_id}/items/{line_number}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Item removed from order",
  "order": {
    "order_id": "cart_bKcpZBHE",
    "item_count": 1,
    "total_quantity": 5,
    "order_total": 1750.00
  }
}
```

---

### 4.6 Update Cart Details

```http
PATCH /api/b2b/orders/{order_id}
```

**Request:**
```json
{
  "shipping_address_id": "addr_001",
  "billing_address_id": "addr_001",
  "po_reference": "PO-2024-00123",
  "requested_delivery_date": "2024-01-25",
  "delivery_slot": "morning",
  "notes": "Consegna mattina, citofono ROSSI"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_bKcpZBHE",
    "shipping_address_id": "addr_001",
    "billing_address_id": "addr_001",
    "po_reference": "PO-2024-00123",
    "requested_delivery_date": "2024-01-25T00:00:00.000Z",
    "delivery_slot": "morning",
    "notes": "Consegna mattina, citofono ROSSI"
  },
  "message": "Order updated successfully"
}
```

---

### 4.7 Clear Cart (Remove All Items)

```http
DELETE /api/b2b/orders/{order_id}/items
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "All items removed from order",
  "order": {
    "order_id": "cart_bKcpZBHE",
    "item_count": 0,
    "total_quantity": 0,
    "order_total": 0
  }
}
```

---

### 4.8 Delete Cart

```http
DELETE /api/b2b/orders/{order_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order deleted successfully"
}
```

---

## 5. Checkout & Orders

### 5.1 Submit Order (Checkout)

```http
POST /api/b2b/orders/{order_id}/submit
```

**Request:**
```json
{
  "shipping_address_id": "addr_001",
  "billing_address_id": "addr_001",
  "po_reference": "PO-2024-00123",
  "requested_delivery_date": "2024-01-25",
  "notes": "Consegna mattina"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "order_id": "ORD-2024-00456",
    "status": "pending",
    "customer_id": "cust_xyz789abc",
    "submitted_at": "2024-01-15T11:00:00.000Z",
    "item_count": 2,
    "order_total": 1775.00,
    "shipping_address_id": "addr_001",
    "po_reference": "PO-2024-00123"
  },
  "message": "Order submitted successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Shipping address is required"
}
```

**Response (400 Bad Request):**
```json
{
  "error": "Cart is empty"
}
```

---

### 5.2 List Orders

```http
GET /api/b2b/orders?customer_id={customer_id}&page=1&limit=20
```

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `customer_id` | string | required | Filter by customer |
| `status` | string | - | Filter by status: `draft`, `pending`, `confirmed`, `shipped`, `delivered`, `cancelled` |
| `page` | int | 1 | Page number |
| `limit` | int | 20 | Orders per page |
| `sort` | string | `-created_at` | Sort field (prefix `-` for descending) |
| `from_date` | string | - | Filter orders from date (ISO 8601) |
| `to_date` | string | - | Filter orders to date (ISO 8601) |

**Response (200 OK):**
```json
{
  "success": true,
  "orders": [
    {
      "order_id": "ORD-2024-00456",
      "status": "shipped",
      "created_at": "2024-01-15T11:00:00.000Z",
      "submitted_at": "2024-01-15T11:00:00.000Z",
      "shipped_at": "2024-01-16T14:00:00.000Z",
      "po_reference": "PO-2024-00123",
      "item_count": 2,
      "total_quantity": 6,
      "order_total": 1775.00,
      "currency": "EUR",
      "shipping_address": {
        "label": "Sede Principale",
        "city": "Milano"
      },
      "tracking": {
        "carrier": "BRT",
        "tracking_number": "123456789"
      }
    },
    {
      "order_id": "ORD-2024-00398",
      "status": "delivered",
      "created_at": "2024-01-10T09:00:00.000Z",
      "delivered_at": "2024-01-12T10:30:00.000Z",
      "item_count": 5,
      "order_total": 3250.00,
      "currency": "EUR"
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

---

### 5.3 Get Order Detail

```http
GET /api/b2b/orders/{order_id}
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "order_id": "ORD-2024-00456",
    "status": "shipped",
    "customer_id": "cust_xyz789abc",
    "order_type": "b2b",
    "price_list_type": "wholesale",
    "currency": "EUR",
    "po_reference": "PO-2024-00123",
    "shipping_address_id": "addr_001",
    "billing_address_id": "addr_001",
    "requested_delivery_date": "2024-01-25T00:00:00.000Z",
    "notes": "Consegna mattina",
    "items": [
      {
        "line_number": 1,
        "entity_code": "PUMP-001",
        "sku": "GRF-PUMP-001",
        "name": "Pompa Centrifuga 1.5kW",
        "quantity": 5,
        "pack_size": 1,
        "packaging_code": "PZ",
        "packaging_label": "Pezzo",
        "list_price": 420.00,
        "retail_price": 499.00,
        "unit_price": 350.00,
        "vat_rate": 22,
        "line_gross": 1750.00,
        "line_net": 1434.43,
        "line_vat": 315.57,
        "line_total": 1750.00,
        "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg"
      },
      {
        "line_number": 2,
        "entity_code": "ACC-001",
        "sku": "ACC-KIT-001",
        "name": "Kit raccordi pompa",
        "quantity": 1,
        "unit_price": 25.00,
        "vat_rate": 22,
        "line_total": 25.00
      }
    ],
    "subtotal_gross": 1775.00,
    "subtotal_net": 1454.92,
    "total_vat": 320.08,
    "shipping_cost": 0,
    "order_total": 1775.00,
    "item_count": 2,
    "total_quantity": 6,
    "timeline": [
      {
        "status": "pending",
        "timestamp": "2024-01-15T11:00:00.000Z",
        "note": "Order submitted"
      },
      {
        "status": "confirmed",
        "timestamp": "2024-01-15T14:00:00.000Z",
        "note": "Order confirmed"
      },
      {
        "status": "shipped",
        "timestamp": "2024-01-16T14:00:00.000Z",
        "note": "Shipped via BRT"
      }
    ],
    "tracking": {
      "carrier": "BRT",
      "carrier_name": "Bartolini",
      "tracking_number": "123456789",
      "tracking_url": "https://tracking.brt.it/123456789",
      "shipped_at": "2024-01-16T14:00:00.000Z"
    },
    "created_at": "2024-01-15T10:30:00.000Z",
    "submitted_at": "2024-01-15T11:00:00.000Z",
    "confirmed_at": "2024-01-15T14:00:00.000Z",
    "shipped_at": "2024-01-16T14:00:00.000Z"
  },
  "customer": {
    "customer_id": "cust_xyz789abc",
    "company_name": "Rossi Impianti S.r.l.",
    "email": "info@rossi-impianti.it",
    "phone": "+39 02 1234567"
  },
  "shippingAddress": {
    "address_id": "addr_001",
    "label": "Sede Principale",
    "company_name": "Rossi Impianti S.r.l.",
    "street": "Via Roma 1",
    "city": "Milano",
    "province": "MI",
    "postal_code": "20100",
    "country": "IT",
    "phone": "+39 02 1234567"
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### 5.4 Reorder (Copy Previous Order to Cart)

```http
POST /api/b2b/orders/{order_id}/reorder
```

**Response (200 OK):**
```json
{
  "success": true,
  "order": {
    "order_id": "cart_newXYZ789",
    "status": "draft",
    "item_count": 2,
    "total_quantity": 6,
    "order_total": 1775.00
  },
  "message": "Items from order ORD-2024-00456 added to cart",
  "skipped_items": [],
  "price_changes": [
    {
      "entity_code": "PUMP-001",
      "old_price": 350.00,
      "new_price": 365.00,
      "message": "Price changed since original order"
    }
  ]
}
```

---

## 6. Home & Navigation

### 6.1 Get Home Page

```http
GET /api/public/home
```

**Response (200 OK):**
```json
{
  "success": true,
  "home": {
    "hero": {
      "title": { "it": "Benvenuto", "en": "Welcome" },
      "subtitle": { "it": "I migliori prodotti per la tua azienda" },
      "image_url": "https://cdn.example.com/hero/main.jpg",
      "cta_text": { "it": "Scopri i prodotti", "en": "Browse products" },
      "cta_url": "/products"
    },
    "banners": [
      {
        "id": "banner_1",
        "image_url": "https://cdn.example.com/banners/promo-winter.jpg",
        "mobile_image_url": "https://cdn.example.com/banners/promo-winter-mobile.jpg",
        "link": "/promo/winter-sale",
        "alt": "Saldi Invernali",
        "order": 1
      }
    ],
    "featured_categories": [
      {
        "code": "pompe",
        "name": "Pompe",
        "image_url": "https://cdn.example.com/categories/pompe.jpg",
        "product_count": 156
      },
      {
        "code": "valvole",
        "name": "Valvole",
        "image_url": "https://cdn.example.com/categories/valvole.jpg",
        "product_count": 89
      }
    ],
    "featured_products": [
      {
        "entity_code": "PUMP-001",
        "name": "Pompa Centrifuga 1.5kW",
        "price": 350.00,
        "list_price": 420.00,
        "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg",
        "brand": "Grundfos",
        "in_stock": true
      }
    ],
    "collections": [
      {
        "code": "bestsellers",
        "name": "Bestseller",
        "description": "I prodotti più venduti",
        "image_url": "https://cdn.example.com/collections/bestsellers.jpg"
      },
      {
        "code": "new-arrivals",
        "name": "Novità",
        "description": "Ultimi arrivi",
        "image_url": "https://cdn.example.com/collections/new.jpg"
      }
    ]
  }
}
```

---

### 6.2 Get Navigation Menu

```http
GET /api/public/menu
```

**Response (200 OK):**
```json
{
  "success": true,
  "menu": [
    {
      "id": "menu_1",
      "label": { "it": "Prodotti", "en": "Products" },
      "url": "/products",
      "icon": "package",
      "order": 1,
      "children": [
        {
          "id": "menu_1_1",
          "label": { "it": "Pompe", "en": "Pumps" },
          "url": "/category/pompe",
          "image_url": "https://cdn.example.com/menu/pompe.jpg",
          "order": 1,
          "children": [
            {
              "id": "menu_1_1_1",
              "label": "Pompe Centrifughe",
              "url": "/category/pompe-centrifughe",
              "order": 1
            },
            {
              "id": "menu_1_1_2",
              "label": "Pompe Sommerse",
              "url": "/category/pompe-sommerse",
              "order": 2
            }
          ]
        },
        {
          "id": "menu_1_2",
          "label": { "it": "Valvole", "en": "Valves" },
          "url": "/category/valvole",
          "order": 2,
          "children": []
        }
      ]
    },
    {
      "id": "menu_2",
      "label": { "it": "Brand", "en": "Brands" },
      "url": "/brands",
      "icon": "tag",
      "order": 2,
      "children": []
    },
    {
      "id": "menu_3",
      "label": { "it": "Contatti", "en": "Contact" },
      "url": "/contact",
      "icon": "phone",
      "order": 3,
      "children": []
    }
  ]
}
```

---

### 6.3 Get Collections

```http
GET /api/public/collections
```

**Response (200 OK):**
```json
{
  "success": true,
  "collections": [
    {
      "id": "coll_001",
      "code": "bestsellers",
      "name": { "it": "Bestseller", "en": "Bestsellers" },
      "description": { "it": "I prodotti più venduti" },
      "image_url": "https://cdn.example.com/collections/bestsellers.jpg",
      "product_count": 24,
      "is_active": true,
      "order": 1
    },
    {
      "id": "coll_002",
      "code": "new-arrivals",
      "name": { "it": "Novità", "en": "New Arrivals" },
      "description": { "it": "Ultimi arrivi nel catalogo" },
      "image_url": "https://cdn.example.com/collections/new.jpg",
      "product_count": 12,
      "is_active": true,
      "order": 2
    },
    {
      "id": "coll_003",
      "code": "on-sale",
      "name": { "it": "In Offerta", "en": "On Sale" },
      "product_count": 18,
      "is_active": true,
      "order": 3
    }
  ]
}
```

---

### 6.4 Get Collection Products

```http
GET /api/public/collections/{collection_code}/products?page=1&limit=20
```

**Response (200 OK):**
```json
{
  "success": true,
  "collection": {
    "code": "bestsellers",
    "name": "Bestseller",
    "description": "I prodotti più venduti"
  },
  "products": [
    {
      "entity_code": "PUMP-001",
      "name": "Pompa Centrifuga 1.5kW",
      "price": 350.00,
      "image_url": "https://cdn.example.com/products/pump-001-thumb.jpg",
      "in_stock": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 24,
    "totalPages": 2
  }
}
```

---

## 7. Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### HTTP Status Codes

| Status | Meaning | Common Causes |
|--------|---------|---------------|
| 400 | Bad Request | Validation error, missing required field |
| 401 | Unauthorized | Missing/invalid API key or token |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Valid request but cannot process |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Server Error | Internal error |

### Common Error Examples

**401 - Missing Authentication:**
```json
{
  "error": "Missing API credentials",
  "code": "UNAUTHORIZED"
}
```

**401 - Invalid API Key:**
```json
{
  "error": "Invalid API secret",
  "code": "UNAUTHORIZED"
}
```

**403 - Insufficient Permissions:**
```json
{
  "error": "Insufficient permissions. Required: orders",
  "code": "FORBIDDEN"
}
```

**403 - Portal User Access Denied:**
```json
{
  "error": "Access denied",
  "code": "ACCESS_DENIED"
}
```

**404 - Resource Not Found:**
```json
{
  "error": "Order not found",
  "code": "NOT_FOUND"
}
```

**400 - Validation Error:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Invalid email format",
    "quantity": "Must be greater than 0"
  }
}
```

**429 - Rate Limited:**
```json
{
  "error": "Rate limit exceeded (minute). Reset at: 2024-01-15T10:31:00.000Z",
  "code": "RATE_LIMITED",
  "retry_after": 45
}
```

---

## 8. Mobile Implementation Notes

### Secure Token Storage

**iOS (Keychain):**
```swift
// Store
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "portal_token",
    kSecValueData as String: token.data(using: .utf8)!
]
SecItemAdd(query as CFDictionary, nil)

// Retrieve
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: "portal_token",
    kSecReturnData as String: true
]
var result: AnyObject?
SecItemCopyMatching(query as CFDictionary, &result)
```

**Android (EncryptedSharedPreferences):**
```kotlin
val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

val encryptedPrefs = EncryptedSharedPreferences.create(
    context,
    "secure_prefs",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
)

// Store
encryptedPrefs.edit().putString("portal_token", token).apply()

// Retrieve
val token = encryptedPrefs.getString("portal_token", null)
```

### API Client Pattern

```typescript
// React Native / TypeScript
class APIClient {
  private baseUrl: string;
  private apiKeyId: string;
  private apiSecret: string;
  private portalToken: string | null = null;

  constructor(config: { baseUrl: string; apiKeyId: string; apiSecret: string }) {
    this.baseUrl = config.baseUrl;
    this.apiKeyId = config.apiKeyId;
    this.apiSecret = config.apiSecret;
  }

  setPortalToken(token: string | null) {
    this.portalToken = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-auth-method": "api-key",
      "x-api-key-id": this.apiKeyId,
      "x-api-secret": this.apiSecret,
      ...options.headers,
    };

    if (this.portalToken) {
      headers["x-portal-user-token"] = this.portalToken;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new APIError(data.error, response.status, data.code);
    }

    return data;
  }

  // Auth
  async login(email: string, password: string) {
    const data = await this.request<LoginResponse>("/api/b2b/portal-users/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    this.setPortalToken(data.token);
    return data;
  }

  async logout() {
    this.setPortalToken(null);
  }

  // Products
  async searchProducts(params: SearchParams) {
    const query = new URLSearchParams(params as Record<string, string>);
    return this.request<SearchResponse>(`/api/search/search?${query}`);
  }

  async getProduct(entityCode: string) {
    return this.request<ProductResponse>(`/api/b2b/pim/products/${entityCode}`);
  }

  // Cart
  async getCart(customerId: string) {
    return this.request<OrdersResponse>(
      `/api/b2b/orders?status=draft&customer_id=${customerId}&limit=1`
    );
  }

  async addToCart(orderId: string, item: AddItemRequest) {
    return this.request<AddItemResponse>(`/api/b2b/orders/${orderId}/items`, {
      method: "POST",
      body: JSON.stringify(item),
    });
  }

  // Orders
  async getOrders(customerId: string, page = 1) {
    return this.request<OrdersResponse>(
      `/api/b2b/orders?customer_id=${customerId}&page=${page}`
    );
  }

  async getOrder(orderId: string) {
    return this.request<OrderDetailResponse>(`/api/b2b/orders/${orderId}`);
  }

  async submitOrder(orderId: string, data: SubmitOrderRequest) {
    return this.request<SubmitOrderResponse>(`/api/b2b/orders/${orderId}/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

// Usage
const api = new APIClient({
  baseUrl: "https://cs.vendereincloud.it",
  apiKeyId: "ak_tenant_xxxx",
  apiSecret: "sk_xxxx",
});

// Login
const { token, portal_user } = await api.login("user@example.com", "password");
await SecureStorage.setItem("portal_token", token);

// Later, restore session
const savedToken = await SecureStorage.getItem("portal_token");
if (savedToken) {
  api.setPortalToken(savedToken);
}
```

### Offline Support

For offline-first mobile apps:

1. **Cache product catalog** - Store frequently accessed products locally
2. **Queue cart operations** - Allow adding to cart offline, sync when online
3. **Cache order history** - Store recent orders for offline viewing
4. **Sync on reconnect** - Check for price changes when back online

```typescript
// Example offline queue
interface OfflineOperation {
  id: string;
  type: "add_to_cart" | "update_quantity" | "remove_item";
  payload: unknown;
  timestamp: number;
}

class OfflineQueue {
  private queue: OfflineOperation[] = [];

  async enqueue(op: Omit<OfflineOperation, "id" | "timestamp">) {
    this.queue.push({
      ...op,
      id: uuid(),
      timestamp: Date.now(),
    });
    await AsyncStorage.setItem("offline_queue", JSON.stringify(this.queue));
  }

  async sync(api: APIClient) {
    for (const op of this.queue) {
      try {
        await this.executeOperation(api, op);
        this.queue = this.queue.filter((o) => o.id !== op.id);
      } catch (error) {
        console.error("Sync failed:", error);
        break;
      }
    }
    await AsyncStorage.setItem("offline_queue", JSON.stringify(this.queue));
  }
}
```

---

## 9. Rate Limits

| Limit Type | Default | Description |
|------------|---------|-------------|
| Per minute | 60 | Requests per minute per API key |
| Per day | 10,000 | Requests per day per API key |
| Concurrent | 10 | Simultaneous requests |

Rate limit headers in response:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705315860
```

When rate limited (429), the response includes:

```json
{
  "error": "Rate limit exceeded (minute). Reset at: 2024-01-15T10:31:00.000Z",
  "retry_after": 45
}
```

**Best practices:**
- Implement exponential backoff on 429
- Cache responses where appropriate
- Use pagination to reduce request count
- Batch operations when possible
