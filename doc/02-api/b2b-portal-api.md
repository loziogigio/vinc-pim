# B2B Portal API

API endpoints that vinc-b2b (B2B Portal) calls on vinc-commerce-suite to access VINC API data.

## Overview

The B2B Portal (vinc-b2b) communicates with vinc-commerce-suite, which proxies requests to the VINC API backend. This architecture provides:

- **Centralized Authentication** - SSO via commerce-suite
- **Data Transformation** - Converts VINC API formats to UI-friendly formats
- **Tenant Isolation** - Each tenant accesses only their data

```
┌─────────────────┐       ┌─────────────────────┐       ┌─────────────────┐
│   vinc-b2b      │       │ vinc-commerce-suite │       │    VINC API     │
│   (Port 3000)   │       │    (Port 3001)      │       │   (Python)      │
│                 │       │                     │       │                 │
│  Browser/SSR    │──────▶│  /api/b2b/*         │──────▶│ /api/v1/internal│
│                 │  HTTP │                     │ HTTP  │                 │
└─────────────────┘       └─────────────────────┘       └─────────────────┘
```

## Configuration (vinc-b2b)

### Environment Variables

```bash
# SSO Provider URL (Required for authentication)
SSO_API_URL=http://localhost:3001

# Optional: Fallback if SSO_API_URL not set
PIM_API_URL=http://localhost:3001

# OAuth Client Secret (if using confidential client)
SSO_CLIENT_SECRET=your-client-secret
```

---

## Authentication

### OAuth Login Flow

1. **Redirect to SSO Login:**
   ```
   {SSO_API_URL}/auth/login
     ?client_id=vinc-b2b
     &redirect_uri={your-callback-url}
     &tenant_id={tenant-id}
     &state={encoded-return-url}
   ```

2. **Receive callback with code:**
   ```
   /api/auth/callback?code={auth-code}&state={state}
   ```

3. **Exchange code for tokens:**
   ```bash
   POST {SSO_API_URL}/api/auth/token
   Content-Type: application/json

   {
     "grant_type": "authorization_code",
     "code": "{auth-code}",
     "redirect_uri": "{callback-url}",
     "client_id": "vinc-b2b",
     "client_secret": "{secret}"
   }
   ```

   **Token Response (includes full profile):**
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIs...",
     "token_type": "Bearer",
     "expires_in": 900,
     "refresh_token": "abc123...",
     "user": {
       "id": "973058c3-68b7-4bef-b955-c882b72b7324",
       "email": "user@example.com",
       "name": "Mario Rossi",
       "role": "reseller",
       "supplier_id": "eaef75b6-4095-4efc-bdbc-b41ea469a265",
       "supplier_name": "Hidros Point Srl",
       "customers": [...],
       "has_password": true
     },
     "tenant_id": "hidros-it",
     "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89"
   }
   ```

4. **Store tokens in cookies:**
   - `auth_token` - Access token (readable by JS)
   - `refresh_token` - Refresh token (httpOnly)
   - `session_id` - Session ID (httpOnly)

See [SSO API Documentation](./sso-api.md) for detailed authentication flow.

---

## Customer Endpoints

### POST /api/b2b/addresses

Get shipping addresses for a customer.

**Request:**

```bash
POST {SSO_API_URL}/api/b2b/addresses
Content-Type: application/json

{
  "customer_id": "026269",
  "tenant_id": "hidros-it"
}
```

**Response:**

```json
{
  "success": true,
  "addresses": [
    {
      "id": "000000",
      "title": "Via Roma 123 - Milano",
      "isLegalSeat": false,
      "isDefault": true,
      "address": {
        "street_address": "Via Roma 123",
        "city": "Milano",
        "state": "MI",
        "zip": "20100",
        "country": "IT"
      },
      "contact": {
        "phone": "+39 02 1234567",
        "email": "info@example.com"
      },
      "agent": {},
      "paymentTerms": {
        "code": "30GG"
      },
      "port": {},
      "carrier": {},
      "currency": {}
    }
  ]
}
```

**Address Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | ERP address ID |
| `title` | string | Display title (street - city) |
| `isLegalSeat` | boolean | Is legal headquarters |
| `isDefault` | boolean | Default shipping address |
| `address` | object | Address details |
| `contact` | object | Contact info (phone, email) |
| `paymentTerms` | object | Payment terms code |

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Customer ID is required` | Missing customer_id |
| 400 | `Tenant ID is required` | Missing tenant_id |
| 404 | `Customer not found` | Invalid customer_id |

---

## Password Management

### POST /api/auth/reset-password

Request password reset (forgot password).

**Request:**

```bash
POST {SSO_API_URL}/api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "tenant_id": "hidros-it"
}
```

**Response (success):**

```json
{
  "success": true,
  "message": "Email di recupero inviata"
}
```

**What happens:**
1. Generates temporary password
2. Sets password in VINC API
3. Sends email notification via tenant's SMTP

**Errors:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `Email is required` | Missing email |
| 400 | `Tenant ID is required` | Missing tenant_id |
| 404 | `Utente non trovato` | User not found |

---

### POST /api/auth/change-password

Change password for authenticated user. Verifies current password internally via VINC API login.

**Request:**

```bash
POST {SSO_API_URL}/api/auth/change-password
Authorization: Bearer {sso_access_token}
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "password": "newPassword456"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Password cambiata con successo"
}
```

**Note:** Current password is verified by logging in to VINC API. No VINC token required from client.

---

## Token Management

### POST /api/auth/refresh

Refresh expired access token.

**Request:**

```bash
POST {SSO_API_URL}/api/auth/refresh
Content-Type: application/json

{
  "refresh_token": "{refresh_token}"
}
```

**Response:**

```json
{
  "access_token": "new-access-token...",
  "refresh_token": "new-refresh-token...",
  "token_type": "Bearer",
  "expires_in": 900
}
```

---

### GET /api/auth/validate

Validate access token and get full user profile.

**Request:**

```bash
GET {SSO_API_URL}/api/auth/validate
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "authenticated": true,
  "user": {
    "id": "973058c3-68b7-4bef-b955-c882b72b7324",
    "email": "user@example.com",
    "name": "Mario Rossi",
    "role": "reseller",
    "supplier_id": "eaef75b6-4095-4efc-bdbc-b41ea469a265",
    "supplier_name": "Hidros Point Srl",
    "customers": [
      {
        "id": "fa6bb051-0908-433b-ad6a-3d0b5da1e25e",
        "erp_customer_id": "026269",
        "name": "PALUMBO SALVATORE",
        "business_name": "Palumbo Srl",
        "addresses": [
          {
            "id": "8265d7f9-a975-4717-aba9-8d3d5ba60eab",
            "erp_address_id": "000000",
            "label": "POMIGLIANO DARCO (NA)",
            "pricelist_code": "02"
          }
        ]
      }
    ],
    "has_password": true
  },
  "tenant_id": "hidros-it",
  "session_id": "f3849cba-7a20-4fc5-8d65-e7e1085dbb89",
  "expires_at": "2024-01-15T11:30:00.000Z"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `authenticated` | boolean | Whether the token is valid |
| `user.id` | string | User UUID |
| `user.email` | string | User email |
| `user.name` | string | User display name |
| `user.role` | string | User role (e.g., "reseller") |
| `user.supplier_id` | string | Supplier UUID (if applicable) |
| `user.supplier_name` | string | Supplier name |
| `user.customers` | array | List of customers the user can access |
| `user.has_password` | boolean | Whether user has set a password |
| `tenant_id` | string | Tenant identifier |
| `session_id` | string | Session UUID |
| `expires_at` | string | Token expiration (ISO 8601) |

---

### POST /api/auth/logout

End user session.

**Request:**

```bash
POST {SSO_API_URL}/api/auth/logout
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "success": true,
  "sessions_ended": 1
}
```

---

## JavaScript Client Example

```typescript
// lib/api-client.ts

const SSO_API_URL = process.env.SSO_API_URL || 'http://localhost:3001';

interface ApiOptions extends RequestInit {
  token?: string;
}

async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${SSO_API_URL}${endpoint}`, {
    ...fetchOptions,
    headers: { ...headers, ...fetchOptions.headers },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'API Error');
  }

  return response.json();
}

// Usage examples:

// Get customer addresses
export async function getCustomerAddresses(customerId: string, tenantId: string) {
  return apiClient<{ success: boolean; addresses: Address[] }>('/api/b2b/addresses', {
    method: 'POST',
    body: JSON.stringify({ customer_id: customerId, tenant_id: tenantId }),
  });
}

// Request password reset
export async function requestPasswordReset(email: string, tenantId: string) {
  return apiClient<{ success: boolean; message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ email, tenant_id: tenantId }),
  });
}

// Validate token
export async function validateToken(token: string) {
  return apiClient<{ authenticated: boolean; user?: User }>('/api/auth/validate', {
    token,
  });
}

// Refresh token
export async function refreshToken(refreshToken: string) {
  return apiClient<TokenResponse>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
```

---

## React Hook Example

```typescript
// hooks/useAddresses.ts
import { useState, useEffect } from 'react';
import { getCustomerAddresses } from '@/lib/api-client';

export function useAddresses(customerId: string, tenantId: string) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId || !tenantId) return;

    setLoading(true);
    setError(null);

    getCustomerAddresses(customerId, tenantId)
      .then((data) => {
        if (data.success) {
          setAddresses(data.addresses);
        } else {
          setError('Failed to fetch addresses');
        }
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [customerId, tenantId]);

  return { addresses, loading, error };
}
```

---

## Error Handling

All API responses follow this pattern:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "error_code"
}
```

### Common HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limited |
| 500 | Internal Server Error |
| 503 | Service Unavailable - VINC API down |

---

## Related Documentation

- [SSO Authentication API](./sso-api.md) - Full OAuth flow documentation
- [VINC API Client](./vinc-api-client.md) - Internal service client
