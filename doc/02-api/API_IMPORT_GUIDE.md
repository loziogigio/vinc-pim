# PIM API Import Guide

## Overview

The PIM API allows you to import and manage products programmatically through RESTful HTTP endpoints. This is the recommended method for integrating external systems, real-time updates, and user-initiated imports.

**Base URL:** `http://localhost:3000/api/b2b/pim`

**Authentication:** Required (B2B user authentication)

**Last Updated:** 2025-11-21

---

## When to Use API Import

### ✅ Use API Import For:
- **Real-time product updates** from external systems
- **User-initiated imports** through the UI
- **Third-party integrations** (ERP, marketplace, etc.)
- **Single or small batch updates** (1-50 products)
- **Webhook-triggered updates**
- **Scheduled synchronization** with external systems

### ❌ Do NOT Use API Import For:
- **Initial bulk migration** (use batch scripts instead)
- **Very large datasets** (1,000+ products - use batch)
- **Development testing** (use batch scripts)
- **Emergency data recovery** (use batch scripts)

---

## Authentication

### B2B Login

**Endpoint:** `POST /api/b2b/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "jwt_token_here"
}
```

**Usage:**
Include the token in subsequent requests:
```bash
Authorization: Bearer jwt_token_here
```

Or use cookie-based authentication (automatically handled in browser).

---

## Product Endpoints

### 1. List Products

**Endpoint:** `GET /api/b2b/pim/products`

**Query Parameters:**
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 20, max: 100)
- `status` (string) - Filter by status: "published" | "draft" | "archived"
- `search` (string) - Search in name, SKU, entity_code

**Request:**
```bash
curl -X GET "http://localhost:3000/api/b2b/pim/products?page=1&limit=20&status=published" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "entity_code": "PROD-001",
        "sku": "SKU-001",
        "name": {
          "it": "Cacciavite Professionale",
          "en": "Professional Screwdriver"
        },
        "price": 15.99,
        "currency": "EUR",
        "stock_quantity": 100,
        "status": "published",
        "created_at": "2025-11-21T10:00:00Z",
        "updated_at": "2025-11-21T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

---

### 2. Get Single Product

**Endpoint:** `GET /api/b2b/pim/products/:entity_code`

**Request:**
```bash
curl -X GET "http://localhost:3000/api/b2b/pim/products/PROD-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "entity_code": "PROD-001",
    "sku": "SKU-001",
    "version": 1,
    "isCurrent": true,
    "status": "published",
    "name": {
      "it": "Cacciavite Professionale",
      "en": "Professional Screwdriver",
      "de": "Professioneller Schraubendreher"
    },
    "description": {
      "it": "Cacciavite di alta qualità...",
      "en": "High-quality screwdriver..."
    },
    "short_description": {
      "it": "Cacciavite professionale",
      "en": "Professional screwdriver"
    },
    "price": 15.99,
    "currency": "EUR",
    "stock_quantity": 100,
    "image": {
      "id": "img-123",
      "thumbnail": "/uploads/thumb-img-123.jpg",
      "original": "/uploads/img-123.jpg"
    },
    "completeness_score": 95,
    "analytics": {
      "views_30d": 150,
      "clicks_30d": 45,
      "add_to_cart_30d": 12,
      "conversions_30d": 5,
      "priority_score": 85,
      "last_synced_at": "2025-11-21T10:00:00Z"
    },
    "created_at": "2025-11-20T15:30:00Z",
    "updated_at": "2025-11-21T10:00:00Z"
  }
}
```

---

### 3. Create Product

**Endpoint:** `POST /api/b2b/pim/products`

**Request Body:**
```json
{
  "entity_code": "PROD-NEW-001",
  "sku": "SKU-NEW-001",
  "name": {
    "it": "Nuovo Prodotto",
    "en": "New Product"
  },
  "description": {
    "it": "Descrizione del nuovo prodotto",
    "en": "Description of the new product"
  },
  "short_description": {
    "it": "Nuovo prodotto",
    "en": "New product"
  },
  "price": 29.99,
  "currency": "EUR",
  "stock_quantity": 50,
  "status": "draft"
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/products" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_code": "PROD-NEW-001",
    "sku": "SKU-NEW-001",
    "name": {
      "it": "Nuovo Prodotto",
      "en": "New Product"
    },
    "price": 29.99,
    "currency": "EUR",
    "stock_quantity": 50,
    "status": "draft"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Product created successfully",
  "data": {
    "entity_code": "PROD-NEW-001",
    "sku": "SKU-NEW-001",
    "version": 1,
    "isCurrent": true,
    "status": "draft",
    "created_at": "2025-11-21T11:00:00Z"
  }
}
```

---

### 4. Update Product

**Endpoint:** `PUT /api/b2b/pim/products/:entity_code`

**Request Body:**
```json
{
  "name": {
    "it": "Prodotto Aggiornato",
    "en": "Updated Product"
  },
  "price": 34.99,
  "stock_quantity": 75,
  "status": "published"
}
```

**cURL Example:**
```bash
curl -X PUT "http://localhost:3000/api/b2b/pim/products/PROD-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 34.99,
    "stock_quantity": 75,
    "status": "published"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "entity_code": "PROD-001",
    "version": 2,
    "isCurrent": true,
    "updated_at": "2025-11-21T11:30:00Z"
  }
}
```

---

### 5. Bulk Import Products

**Endpoint:** `POST /api/b2b/pim/import`

**Description:** Import multiple products at once. Creates a background job for processing.

**Request Body:**
```json
{
  "source_id": "api-import",
  "products": [
    {
      "entity_code": "API-001",
      "sku": "API-SKU-001",
      "name": { "it": "Prodotto API 1" },
      "price": 19.99,
      "currency": "EUR",
      "stock_quantity": 100
    },
    {
      "entity_code": "API-002",
      "sku": "API-SKU-002",
      "name": { "it": "Prodotto API 2" },
      "price": 24.99,
      "currency": "EUR",
      "stock_quantity": 50
    }
  ]
}
```

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/import" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @products.json
```

**Response:**
```json
{
  "success": true,
  "message": "Import job created",
  "data": {
    "job_id": "job_abc123",
    "status": "pending",
    "total_products": 2,
    "created_at": "2025-11-21T12:00:00Z"
  }
}
```

---

### 6. Sync Product to Search Engine

**Endpoint:** `POST /api/b2b/pim/products/:entity_code/sync`

**Description:** Manually sync a published product to Solr search engine.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/products/PROD-001/sync" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Product synced to Solr successfully",
  "entity_code": "PROD-001",
  "synced_at": "2025-11-21T12:30:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Only published products can be synced to Solr",
  "status": "draft"
}
```

---

## Product Associations

### 7. Get Product Brands

**Endpoint:** `GET /api/b2b/pim/brands`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "brand_123",
      "name": { "it": "Marca A", "en": "Brand A" },
      "slug": "brand-a"
    }
  ]
}
```

### 8. Get Product Categories

**Endpoint:** `GET /api/b2b/pim/categories`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat_123",
      "name": { "it": "Utensili", "en": "Tools" },
      "slug": "tools",
      "parent_id": null,
      "order": 1
    }
  ]
}
```

### 9. Get Product Collections

**Endpoint:** `GET /api/b2b/pim/collections`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "col_123",
      "name": { "it": "Collezione Estate", "en": "Summer Collection" },
      "slug": "summer-collection"
    }
  ]
}
```

### 10. Get Product Types

**Endpoint:** `GET /api/b2b/pim/product-types`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "type_123",
      "name": { "it": "Utensile Elettrico", "en": "Power Tool" },
      "slug": "power-tool"
    }
  ]
}
```

---

## Image Management

### 11. Upload Product Image

**Endpoint:** `POST /api/b2b/pim/products/:entity_code/images`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (File) - Image file (JPG, PNG, WebP)
- `is_primary` (boolean) - Set as primary image (optional)

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/products/PROD-001/images" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "is_primary=true"
```

**Response:**
```json
{
  "success": true,
  "message": "Image uploaded successfully",
  "data": {
    "id": "img_abc123",
    "thumbnail": "/uploads/thumb-img_abc123.jpg",
    "original": "/uploads/img_abc123.jpg",
    "is_primary": true
  }
}
```

### 12. Reorder Product Images

**Endpoint:** `PUT /api/b2b/pim/products/:entity_code/images/order`

**Request Body:**
```json
{
  "image_ids": ["img_123", "img_456", "img_789"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Images reordered successfully"
}
```

---

## Media Management

### 13. Upload Product Media

**Endpoint:** `POST /api/b2b/pim/products/:entity_code/media`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file` (File) - Media file (PDF, DOC, XLS, etc.)
- `label` (string) - File label/description (optional)

**cURL Example:**
```bash
curl -X POST "http://localhost:3000/api/b2b/pim/products/PROD-001/media" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/manual.pdf" \
  -F "label=Product Manual"
```

**Response:**
```json
{
  "success": true,
  "message": "Media uploaded successfully",
  "data": {
    "id": "media_abc123",
    "filename": "manual.pdf",
    "url": "/uploads/media_abc123.pdf",
    "size": 1024000,
    "type": "application/pdf",
    "label": "Product Manual"
  }
}
```

---

## JavaScript/TypeScript Examples

### Example 1: Create Product with Fetch API

```typescript
async function createProduct(productData: any, token: string) {
  const response = await fetch('http://localhost:3000/api/b2b/pim/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(productData),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create product');
  }

  return response.json();
}

// Usage
const newProduct = {
  entity_code: 'PROD-JS-001',
  sku: 'JS-SKU-001',
  name: {
    it: 'Prodotto JavaScript',
    en: 'JavaScript Product'
  },
  price: 29.99,
  currency: 'EUR',
  stock_quantity: 100,
  status: 'draft'
};

const result = await createProduct(newProduct, 'your_jwt_token');
console.log('Created:', result.data.entity_code);
```

### Example 2: Bulk Import with Progress Tracking

```typescript
async function bulkImport(products: any[], token: string) {
  // Create import job
  const response = await fetch('http://localhost:3000/api/b2b/pim/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_id: 'api-import',
      products: products,
    }),
  });

  const result = await response.json();
  const jobId = result.data.job_id;

  // Poll job status
  while (true) {
    const statusResponse = await fetch(
      `http://localhost:3000/api/b2b/pim/jobs/${jobId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    const status = await statusResponse.json();

    console.log(`Progress: ${status.data.processed}/${status.data.total}`);

    if (status.data.status === 'completed') {
      console.log('Import completed!');
      break;
    }

    if (status.data.status === 'failed') {
      console.error('Import failed:', status.data.error);
      break;
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Usage
const products = [
  { entity_code: 'BULK-001', sku: 'B-001', name: { it: 'Prodotto 1' }, price: 10, currency: 'EUR', stock_quantity: 50 },
  { entity_code: 'BULK-002', sku: 'B-002', name: { it: 'Prodotto 2' }, price: 20, currency: 'EUR', stock_quantity: 30 },
];

await bulkImport(products, 'your_jwt_token');
```

### Example 3: Update Product with Error Handling

```typescript
async function updateProduct(
  entityCode: string,
  updates: any,
  token: string
) {
  try {
    const response = await fetch(
      `http://localhost:3000/api/b2b/pim/products/${entityCode}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Update failed');
    }

    const result = await response.json();
    console.log('✅ Updated:', result.data.entity_code);
    return result.data;

  } catch (error: any) {
    console.error('❌ Update failed:', error.message);
    throw error;
  }
}

// Usage
await updateProduct('PROD-001', {
  price: 39.99,
  stock_quantity: 125,
  status: 'published'
}, 'your_jwt_token');
```

### Example 4: Upload Image

```typescript
async function uploadProductImage(
  entityCode: string,
  imageFile: File,
  token: string
) {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('is_primary', 'true');

  const response = await fetch(
    `http://localhost:3000/api/b2b/pim/products/${entityCode}/images`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error('Image upload failed');
  }

  return response.json();
}

// Usage (in browser)
const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
const file = fileInput.files[0];

const result = await uploadProductImage('PROD-001', file, 'your_jwt_token');
console.log('Image uploaded:', result.data.thumbnail);
```

---

## Python Example

```python
import requests
import json

class PIMApiClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def create_product(self, product_data: dict):
        """Create a new product"""
        response = requests.post(
            f'{self.base_url}/api/b2b/pim/products',
            headers=self.headers,
            json=product_data
        )
        response.raise_for_status()
        return response.json()

    def update_product(self, entity_code: str, updates: dict):
        """Update an existing product"""
        response = requests.put(
            f'{self.base_url}/api/b2b/pim/products/{entity_code}',
            headers=self.headers,
            json=updates
        )
        response.raise_for_status()
        return response.json()

    def get_product(self, entity_code: str):
        """Get a single product"""
        response = requests.get(
            f'{self.base_url}/api/b2b/pim/products/{entity_code}',
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def bulk_import(self, products: list):
        """Import multiple products"""
        response = requests.post(
            f'{self.base_url}/api/b2b/pim/import',
            headers=self.headers,
            json={
                'source_id': 'api-import',
                'products': products
            }
        )
        response.raise_for_status()
        return response.json()

# Usage
client = PIMApiClient('http://localhost:3000', 'your_jwt_token')

# Create product
new_product = {
    'entity_code': 'PY-001',
    'sku': 'PY-SKU-001',
    'name': {'it': 'Prodotto Python'},
    'price': 49.99,
    'currency': 'EUR',
    'stock_quantity': 75
}

result = client.create_product(new_product)
print(f"Created: {result['data']['entity_code']}")

# Update product
client.update_product('PY-001', {'price': 54.99})

# Get product
product = client.get_product('PY-001')
print(f"Product: {product['data']['name']}")
```

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Product or resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `DUPLICATE_ENTITY_CODE` | 409 | Entity code already exists |
| `DUPLICATE_SKU` | 409 | SKU already exists |
| `INVALID_STATUS` | 400 | Invalid product status |
| `SYNC_ERROR` | 500 | Solr synchronization failed |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

**Current Limits:**
- 100 requests per minute per user
- 1,000 requests per hour per user

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637683200
```

**Rate Limit Exceeded Response:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60
}
```

---

## Best Practices

### 1. Authentication
- ✅ Store JWT tokens securely
- ✅ Refresh tokens before expiry
- ✅ Use HTTPS in production
- ❌ Don't hardcode credentials

### 2. Error Handling
- ✅ Always check response status
- ✅ Handle network errors gracefully
- ✅ Implement retry logic with exponential backoff
- ✅ Log errors for debugging

### 3. Data Validation
- ✅ Validate data before sending
- ✅ Use required field checking
- ✅ Verify data types
- ✅ Check multilingual format

### 4. Performance
- ✅ Use bulk import for multiple products
- ✅ Implement pagination for listings
- ✅ Cache frequently accessed data
- ✅ Batch related requests

### 5. Multilingual Content
- ✅ Always include default language (Italian)
- ✅ Use ISO 639-1 language codes
- ✅ Provide fallback to default language
- ✅ Keep translations synchronized

---

## Webhook Integration (Coming Soon)

### Webhook Events
- `product.created` - New product created
- `product.updated` - Product updated
- `product.deleted` - Product deleted
- `product.published` - Product status changed to published
- `product.synced` - Product synced to Solr

### Webhook Payload
```json
{
  "event": "product.updated",
  "timestamp": "2025-11-21T12:00:00Z",
  "data": {
    "entity_code": "PROD-001",
    "changes": {
      "price": { "old": 29.99, "new": 34.99 },
      "stock_quantity": { "old": 50, "new": 75 }
    }
  }
}
```

---

## API Response Times

| Endpoint | Average | P95 | P99 |
|----------|---------|-----|-----|
| GET /products | 50ms | 100ms | 200ms |
| GET /products/:id | 30ms | 60ms | 120ms |
| POST /products | 100ms | 200ms | 400ms |
| PUT /products/:id | 120ms | 250ms | 500ms |
| POST /import | 150ms | 300ms | 600ms |
| POST /sync | 200ms | 400ms | 800ms |

**Note:** Times may vary based on data size and server load.

---

## Testing with Postman

### Import Collection

Download our Postman collection:
- [PIM API Collection](./postman/pim-api-collection.json)

### Environment Variables
```json
{
  "base_url": "http://localhost:3000",
  "jwt_token": "your_jwt_token_here"
}
```

---

## Related Documentation

- [Batch Import Guide](BATCH_IMPORT_GUIDE.md) - For large-scale imports
- [Solr Sync Guide](SOLR_SYNC_GUIDE.md) - Search synchronization
- [Authentication Guide](../AUTH_GUIDE.md) - B2B authentication details
- [Image Upload Guide](../IMAGE_UPLOAD_GUIDE.md) - Image management
- [Media Management Guide](../MEDIA_MANAGEMENT_GUIDE.md) - Document uploads

---

## Support

For API issues or questions:
- Check error response messages
- Review examples above
- See troubleshooting in batch import guide
- Check daily summaries in `/doc/`

---

## Changelog

### Version 1.0 (2025-11-21)
- Initial API documentation
- Product CRUD endpoints
- Bulk import endpoint
- Image and media upload endpoints
- Sync to search engine endpoint
- JavaScript, TypeScript, and Python examples

---

**Document Version:** 1.0
**API Version:** 1.0
**Last Updated:** 2025-11-21
**Base URL:** `http://localhost:3000/api/b2b/pim`
