# Portal Users API Reference

API reference for portal user authentication in mobile apps and external frontends.

---

## Quick Start

```javascript
// 1. Login with credentials provided by admin
const loginRes = await fetch("https://api.example.com/api/b2b/auth/portal-login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-auth-method": "api-key",
    "x-api-key-id": "YOUR_API_KEY_ID",
    "x-api-secret": "YOUR_API_SECRET",
  },
  body: JSON.stringify({
    username: "your.username",
    password: "your-password"
  })
});
const { token, customer_access } = await loginRes.json();

// 2. Use token for all subsequent requests
const headers = {
  "Content-Type": "application/json",
  "x-auth-method": "api-key",
  "x-api-key-id": "YOUR_API_KEY_ID",
  "x-api-secret": "YOUR_API_SECRET",
  "x-portal-user-token": token
};

// 3. Fetch data (automatically filtered by your access)
const customers = await fetch("https://api.example.com/api/b2b/customers", { headers });
```

---

## Authentication

### Required Headers

All requests require API key authentication:

| Header | Description |
|--------|-------------|
| `x-auth-method` | Must be `api-key` |
| `x-api-key-id` | Your API key ID |
| `x-api-secret` | Your API secret |

After login, add the portal user token:

| Header | Description |
|--------|-------------|
| `x-portal-user-token` | JWT token from login |

---

## Login

### `POST /api/b2b/auth/portal-login`

Authenticate and receive a JWT token.

**Request:**

```json
{
  "username": "your.username",
  "password": "your-password"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "portal_user": {
    "portal_user_id": "PU-abc123",
    "username": "your.username",
    "email": "your.email@company.com",
    "is_active": true,
    "last_login_at": "2025-01-12T10:30:00.000Z"
  },
  "customer_access": [
    { "customer_id": "CUST-001", "address_access": "all" },
    { "customer_id": "CUST-002", "address_access": ["addr_1", "addr_2"] }
  ]
}
```

**Token Details:**
- Expiration: 24 hours
- Store securely and refresh before expiry

---

## Available Endpoints

Once authenticated, use the token to access these endpoints. Data is automatically filtered based on your `customer_access` permissions.

### Customers

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/b2b/customers` | GET | List your accessible customers |
| `/api/b2b/customers/{customer_id}` | GET | Get customer details |
| `/api/b2b/customers/{customer_id}/addresses` | GET | Get customer addresses |
| `/api/b2b/customers` | POST | Create new customer |
| `/api/b2b/customers/{customer_id}/addresses` | POST | Add address to customer |

### Orders

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/b2b/orders` | GET | List orders for your customers |
| `/api/b2b/orders/{order_id}` | GET | Get order details |

### Cart

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/b2b/cart` | GET | Get active cart |
| `/api/b2b/cart` | POST | Create cart or add items |
| `/api/b2b/cart/items/{item_id}` | PUT | Update cart item |
| `/api/b2b/cart/items/{item_id}` | DELETE | Remove cart item |

---

## Access Control

Your token determines what data you can access:

| Scenario | Behavior |
|----------|----------|
| List customers | Returns only customers in your `customer_access` |
| Get customer details | 403 error if not in your access list |
| List addresses | Filtered to your allowed addresses |
| List orders | Returns only orders for your accessible customers |
| Create customer | New customer auto-added to your access |
| Add address | New address auto-added to your access |

### Example: Customer Access

If your access is:
```json
{
  "customer_access": [
    { "customer_id": "CUST-001", "address_access": "all" },
    { "customer_id": "CUST-002", "address_access": ["addr_1", "addr_2"] }
  ]
}
```

Then:
- `GET /customers` → Returns CUST-001 and CUST-002 only
- `GET /customers/CUST-001/addresses` → All addresses
- `GET /customers/CUST-002/addresses` → Only addr_1 and addr_2
- `GET /customers/CUST-999` → 403 Forbidden

---

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad request - missing or invalid fields |
| 401 | Unauthorized - invalid credentials or expired token |
| 403 | Forbidden - no access to requested resource |
| 404 | Not found |
| 500 | Server error |

**Example errors:**

```json
{ "error": "Invalid username or password" }
```

```json
{ "error": "Access denied" }
```

```json
{ "error": "Token expired" }
```

---

## API Examples

All examples use these headers (replace with your credentials):

```
x-auth-method: api-key
x-api-key-id: YOUR_API_KEY_ID
x-api-secret: YOUR_API_SECRET
Content-Type: application/json
```

---

### Login

```
POST /api/b2b/auth/portal-login
```

```json
{
  "username": "mario.rossi",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "portal_user": { "portal_user_id": "PU-abc123", "username": "mario.rossi" },
  "customer_access": [{ "customer_id": "CUST-001", "address_access": "all" }]
}
```

---

### Create Portal User

```
POST /api/b2b/portal-users
```

```json
{
  "username": "new.user",
  "email": "new.user@company.com",
  "password": "SecurePass123",
  "customer_access": [
    { "customer_id": "CUST-001", "address_access": "all" }
  ]
}
```

Response:
```json
{
  "portal_user": {
    "portal_user_id": "PU-xyz789",
    "username": "new.user",
    "email": "new.user@company.com",
    "is_active": true,
    "customer_access": [{ "customer_id": "CUST-001", "address_access": "all" }]
  }
}
```

---

### List Portal Users

```
GET /api/b2b/portal-users?page=1&limit=20&search=mario&is_active=true
```

Response:
```json
{
  "portal_users": [...],
  "pagination": { "page": 1, "limit": 20, "total": 5, "pages": 1 }
}
```

---

### Get Portal User

```
GET /api/b2b/portal-users/{portal_user_id}
```

Response:
```json
{
  "portal_user": {
    "portal_user_id": "PU-abc123",
    "username": "mario.rossi",
    "email": "mario.rossi@company.com",
    "is_active": true,
    "customer_access": [...]
  }
}
```

---

### Activate User

```
PUT /api/b2b/portal-users/{portal_user_id}
```

```json
{
  "is_active": true
}
```

Response:
```json
{
  "portal_user": { "portal_user_id": "PU-abc123", "is_active": true, ... }
}
```

---

### Deactivate User

```
PUT /api/b2b/portal-users/{portal_user_id}
```

```json
{
  "is_active": false
}
```

Response:
```json
{
  "portal_user": { "portal_user_id": "PU-abc123", "is_active": false, ... }
}
```

---

### Reset Password

```
PUT /api/b2b/portal-users/{portal_user_id}
```

```json
{
  "password": "NewSecurePassword123"
}
```

Response:
```json
{
  "portal_user": { "portal_user_id": "PU-abc123", ... }
}
```

---

### Update Username/Email

```
PUT /api/b2b/portal-users/{portal_user_id}
```

```json
{
  "username": "mario.rossi.new",
  "email": "new.email@company.com"
}
```

Response:
```json
{
  "portal_user": { "portal_user_id": "PU-abc123", "username": "mario.rossi.new", ... }
}
```

---

### Update Customer Access

```
PUT /api/b2b/portal-users/{portal_user_id}
```

```json
{
  "customer_access": [
    { "customer_id": "CUST-001", "address_access": "all" },
    { "customer_id": "CUST-002", "address_access": ["addr_1", "addr_2"] },
    { "customer_id": "CUST-003", "address_access": "all" }
  ]
}
```

Response:
```json
{
  "portal_user": { "portal_user_id": "PU-abc123", "customer_access": [...] }
}
```

---

### Deactivate User (Soft Delete)

```
DELETE /api/b2b/portal-users/{portal_user_id}
```

Response:
```json
{
  "message": "Portal user deactivated",
  "portal_user": { "portal_user_id": "PU-abc123", "is_active": false, ... }
}
```

---

### Delete User (Permanent)

```
DELETE /api/b2b/portal-users/{portal_user_id}?hard=true
```

Response:
```json
{
  "message": "Portal user permanently deleted",
  "deleted_id": "PU-abc123"
}
```

---

### Get Customers (with token)

Add header: `x-portal-user-token: {token}`

```
GET /api/b2b/customers
```

Response:
```json
{
  "customers": [
    { "customer_id": "CUST-001", "company_name": "Acme Corp", ... }
  ]
}
```

---

### Get Orders (with token)

Add header: `x-portal-user-token: {token}`

```
GET /api/b2b/orders?customer_id=CUST-001
```

Response:
```json
{
  "orders": [
    { "order_id": "ORD-001", "status": "confirmed", "total": 1500.00, ... }
  ]
}
```
