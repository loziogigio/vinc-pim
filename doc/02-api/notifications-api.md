# Notifications API

In-App Notifications API for the VINC Commerce Suite. Provides Facebook-style bell icon notification system integrated with the multi-channel notification template system.

## Overview

The notification system supports multiple channels under a unified template system:

```
Template (e.g., "order_shipped")
├── email        → sends email
├── web_push     → browser push notification
├── mobile_push  → mobile app push
├── sms          → sends SMS
└── in_app       → creates in-app notification ← This API
```

## Authentication

All endpoints support three authentication methods:

| Method | Use Case | Headers |
|--------|----------|---------|
| Bearer Token | SSO/JWT authentication | `Authorization: Bearer <token>` |
| API Key | Server-to-server | `x-api-key-id`, `x-api-secret` |
| B2B Session | Browser (cookie) | `Cookie: vinc_b2b_session=<session>` |

## Endpoints

### List Notifications

```
GET /api/b2b/notifications
```

List notifications for the authenticated user with pagination.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max 100) |
| `unread_only` | boolean | false | Filter to unread only |
| `trigger` | string | - | Filter by trigger type |

**Response:**

```json
{
  "success": true,
  "notifications": [
    {
      "notification_id": "notif_abc123xyz",
      "user_id": "user123",
      "user_type": "b2b_user",
      "trigger": "order_shipped",
      "title": "Order Shipped",
      "body": "Your order #12345 has been shipped",
      "icon": "/icons/shipping.png",
      "action_url": "/orders/12345",
      "is_read": false,
      "created_at": "2024-01-26T10:00:00.000Z",
      "updated_at": "2024-01-26T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "total_pages": 3
  },
  "unread_count": 5
}
```

**Example:**

```bash
curl "http://localhost:3001/api/b2b/notifications?page=1&limit=20&unread_only=true" \
  -H "Authorization: Bearer <token>"
```

---

### Create Notification

```
POST /api/b2b/notifications
```

Create a new notification (admin/system use).

**Request Body:**

```json
{
  "user_id": "user123",
  "trigger": "order_shipped",
  "title": "Order Shipped",
  "body": "Your order #12345 has been shipped",
  "icon": "/icons/shipping.png",
  "action_url": "/orders/12345",
  "user_type": "b2b_user",
  "payload": {
    "category": "order",
    "order": {
      "id": "ord_abc",
      "number": "12345",
      "status": "shipped",
      "carrier": "BRT",
      "tracking_code": "BRT123456789",
      "item_ref": "ord_abc",
      "items": [
        { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "quantity": 2 }
      ]
    }
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `user_id` | string | Yes | Target user ID |
| `trigger` | string | Yes | Notification trigger type |
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body text |
| `icon` | string | No | Icon URL |
| `action_url` | string | No | Click action URL |
| `user_type` | string | No | `b2b_user` or `portal_user` |
| `payload` | object | No | Typed payload (see [Typed Payload System](#typed-payload-system)) |

**Response:**

```json
{
  "success": true,
  "notification": {
    "notification_id": "notif_abc123xyz",
    "user_id": "user123",
    "trigger": "order_shipped",
    "title": "Order Shipped",
    "body": "Your order #12345 has been shipped",
    "payload": {
      "category": "order",
      "order": { "id": "ord_abc", "number": "12345", "status": "shipped" }
    },
    "is_read": false,
    "created_at": "2024-01-26T10:00:00.000Z"
  }
}
```

**Example:**

```bash
curl -X POST "http://localhost:3001/api/b2b/notifications" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "user_id": "user@example.com",
    "trigger": "order_shipped",
    "title": "Order Shipped",
    "body": "Your order #12345 has been shipped",
    "payload": {
      "category": "order",
      "order": {
        "id": "ord_123",
        "number": "12345",
        "status": "shipped",
        "carrier": "BRT",
        "tracking_code": "BRT123456789",
        "item_ref": "ord_123"
      }
    }
  }'
```

---

### Get Unread Count

```
GET /api/b2b/notifications/unread-count
```

Get the unread notification count for the authenticated user.

**Response:**

```json
{
  "success": true,
  "count": 5
}
```

**Example:**

```bash
curl "http://localhost:3001/api/b2b/notifications/unread-count" \
  -H "Authorization: Bearer <token>"
```

---

### Get Single Notification

```
GET /api/b2b/notifications/{id}
```

Get a single notification by ID.

**Response:**

```json
{
  "success": true,
  "notification": {
    "notification_id": "notif_abc123xyz",
    "user_id": "user123",
    "trigger": "order_shipped",
    "title": "Order Shipped",
    "body": "Your order #12345 has been shipped",
    "is_read": false,
    "created_at": "2024-01-26T10:00:00.000Z"
  }
}
```

---

### Mark as Read

```
PATCH /api/b2b/notifications/{id}
```

Mark a notification as read.

**Response:**

```json
{
  "success": true,
  "notification": {
    "notification_id": "notif_abc123xyz",
    "is_read": true,
    "read_at": "2024-01-26T11:00:00.000Z"
  }
}
```

**Example:**

```bash
curl -X PATCH "http://localhost:3001/api/b2b/notifications/notif_abc123xyz" \
  -H "Authorization: Bearer <token>"
```

---

### Delete Notification

```
DELETE /api/b2b/notifications/{id}
```

Delete a notification.

**Response:**

```json
{
  "success": true,
  "deleted": true
}
```

---

### Bulk Actions

```
POST /api/b2b/notifications/bulk
```

Perform bulk actions on notifications.

**Request Body:**

```json
{
  "action": "mark_read",
  "notification_ids": ["notif_1", "notif_2", "notif_3"]
}
```

**Actions:**

| Action | Description | `notification_ids` Required |
|--------|-------------|----------------------------|
| `mark_read` | Mark specified notifications as read | Yes |
| `mark_all_read` | Mark ALL user notifications as read | No |
| `delete` | Delete specified notifications | Yes |

**Response:**

```json
{
  "success": true,
  "updated": 3
}
```

**Examples:**

```bash
# Mark specific as read
curl -X POST "http://localhost:3001/api/b2b/notifications/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "mark_read", "notification_ids": ["notif_1", "notif_2"]}'

# Mark all as read
curl -X POST "http://localhost:3001/api/b2b/notifications/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "mark_all_read"}'

# Delete multiple
curl -X POST "http://localhost:3001/api/b2b/notifications/bulk" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"action": "delete", "notification_ids": ["notif_1", "notif_2"]}'
```

---

## Available Triggers

| Trigger | Description |
|---------|-------------|
| `registration_request_admin` | Registration Request (Admin) |
| `registration_request_customer` | Registration Confirmation |
| `welcome` | Welcome Email |
| `forgot_password` | Forgot Password |
| `reset_password` | Password Reset Confirmation |
| `order_confirmation` | Order Confirmation |
| `order_shipped` | Order Shipped |
| `order_delivered` | Order Delivered |
| `order_cancelled` | Order Cancelled |
| `price_drop_alert` | Price Drop Alert |
| `back_in_stock` | Back in Stock |
| `abandoned_cart` | Abandoned Cart |
| `newsletter` | Newsletter |
| `custom` | Custom Template |

---

## Template Integration

In-app notifications are automatically created when:
1. A notification template has the `in_app` channel enabled
2. `sendNotification()` is called with a `targetUserId`

### Enabling In-App Channel

In the Notifications app, edit a template and enable the "In-App" channel:

- **Title**: Notification title (supports `{{variables}}`)
- **Body**: Notification body (supports `{{variables}}`)
- **Icon**: Optional icon URL
- **Action URL**: Optional click action (supports `{{variables}}`)

### Programmatic Usage

```typescript
import { sendNotification } from "@/lib/notifications/send.service";

await sendNotification({
  tenantDb: "vinc-hidros-it",
  trigger: "order_shipped",
  to: "customer@example.com",
  variables: {
    customer_name: "Mario",
    order_number: "12345",
    tracking_code: "BRT123456789"
  },
  targetUserId: "customer-user-id", // Required for in-app
  targetUserType: "b2b_user"        // Optional, defaults to "b2b_user"
});
```

This single call will:
- Send email (if `email` channel enabled)
- Send web push (if `web_push` channel enabled)
- Create in-app notification (if `in_app` channel enabled)

---

## Typed Payload System

Notifications support typed payloads organized by category. Each category has specific fields for rich frontend rendering.

### Categories

| Category | Object | Use Cases | Media |
|----------|--------|-----------|-------|
| `generic` | None | Welcome, announcements, system messages | Optional |
| `product` | Product(s) | New arrivals, back in stock, wishlist | Optional (or from products) |
| `order` | Order | Confirmation, shipped, delivered, cancelled | Optional (or from order.items) |
| `price` | Product + Pricing | Discounts, flash sales, price drops | Optional (or from products) |

### Navigation References (`item_ref`)

All payloads use `item_ref` as a generic reference for frontend/mobile app navigation:

| Context     | `item_ref` Value                 | Frontend Navigation                      |
|-------------|----------------------------------|------------------------------------------|
| Product     | SKU (e.g., `"ARPA160"`)          | Navigate to product detail               |
| Order       | Order ID (e.g., `"ord_abc123"`)  | Navigate to order detail                 |
| Price/Promo | SKU (e.g., `"ARPA160"`)          | Navigate to product with price highlight |

> **Important:** URLs are not included in payloads. The frontend/mobile app is responsible for building navigation routes based on `item_ref`. This keeps the API simple and allows each client to handle routing independently.

### Trigger to Category Mapping

| Trigger | Default Category |
|---------|------------------|
| `welcome`, `newsletter`, `custom` | `generic` |
| `registration_request_admin`, `registration_request_customer` | `generic` |
| `forgot_password`, `reset_password` | `generic` |
| `back_in_stock` | `product` |
| `order_confirmation`, `order_shipped`, `order_delivered`, `order_cancelled` | `order` |
| `price_drop_alert`, `abandoned_cart` | `price` |

### Payload Structures

#### Generic Payload

```json
{
  "category": "generic",
  "media": {
    "icon": "https://cdn.example.com/icon.png",
    "image": "https://cdn.example.com/banner.jpg",
    "images": ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"]
  },
  "url": "https://example.com/catalog.pdf",
  "open_in_new_tab": true
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | - | URL for documents, catalogs, external links |
| `open_in_new_tab` | boolean | `true` | Open URL in new tab/external browser |

**Example (catalog/flyer):**

```bash
curl -X POST "http://localhost:3001/api/b2b/notifications" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "user_id": "user@example.com",
    "trigger": "newsletter",
    "title": "Nuovo Catalogo Febbraio",
    "body": "Scopri le ultime novita nel nostro catalogo",
    "payload": {
      "category": "generic",
      "url": "https://cdn.example.com/catalogo-febbraio.pdf",
      "open_in_new_tab": true
    }
  }'
```

#### Product Payload

```json
{
  "category": "product",
  "products": [
    {
      "sku": "ARPA160",
      "name": "Pompa ARPA160",
      "image": "https://cdn.example.com/arpa160.jpg",
      "item_ref": "ARPA160"
    }
  ],
  "media": { "icon": "https://cdn.example.com/icon.png" }
}
```

> **Note:** `item_ref` is a generic reference (e.g., SKU, product ID) that the frontend/mobile app uses to navigate to the correct section. URLs are handled internally by the client.

#### Order Payload

```json
{
  "category": "order",
  "order": {
    "id": "ord_abc123",
    "number": "12345",
    "status": "shipped",
    "total": "€450,00",
    "carrier": "BRT",
    "tracking_code": "BRT123456789",
    "item_ref": "ord_abc123",
    "items": [
      { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "quantity": 2 },
      { "sku": "FILTRO-X1", "name": "Filtro X1", "image": "https://cdn.example.com/filtro.jpg", "quantity": 1 }
    ]
  }
}
```

> **Note:** `tracking_code` is the carrier's tracking number. `item_ref` is a generic reference for frontend navigation. Tracking URLs are built by the client based on carrier and tracking code.

#### Price Payload

```json
{
  "category": "price",
  "expires_at": "2026-01-26T18:00:00Z",
  "discount_label": "Fino al 40%",
  "products": [
    {
      "sku": "ARPA160",
      "name": "Pompa ARPA160",
      "image": "https://cdn.example.com/arpa160.jpg",
      "item_ref": "ARPA160",
      "original_price": "€450,00",
      "sale_price": "€270,00",
      "discount": "-40%"
    },
    {
      "sku": "FILTRO-X1",
      "name": "Filtro X1",
      "image": "https://cdn.example.com/filtro.jpg",
      "item_ref": "FILTRO-X1",
      "original_price": "€89,00",
      "sale_price": "€62,30",
      "discount": "-30%"
    }
  ]
}
```

### Usage Examples

**Product notification (back in stock):**

```bash
curl -X POST "http://localhost:3001/api/b2b/notifications" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "user_id": "mario@example.com",
    "trigger": "back_in_stock",
    "title": "Prodotto Disponibile!",
    "body": "Pompa ARPA160 è tornata disponibile",
    "payload": {
      "category": "product",
      "products": [
        { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "item_ref": "ARPA160" }
      ]
    }
  }'
```

**Price notification (flash sale):**

```bash
curl -X POST "http://localhost:3001/api/b2b/notifications" \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: ak_{tenant}_{suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "user_id": "mario@example.com",
    "trigger": "price_drop_alert",
    "title": "Flash Sale - Solo 3 ore rimaste!",
    "body": "Fino al 40% di sconto sui tuoi prodotti preferiti",
    "payload": {
      "category": "price",
      "expires_at": "2026-01-26T18:00:00Z",
      "discount_label": "Fino al 40%",
      "products": [
        { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "item_ref": "ARPA160", "original_price": "€450,00", "sale_price": "€270,00", "discount": "-40%" }
      ]
    }
  }'
```

### Programmatic Usage with Payload

```typescript
import { sendNotification } from "@/lib/notifications/send.service";

await sendNotification({
  tenantDb: "vinc-hidros-it",
  trigger: "order_shipped",
  to: "customer@example.com",
  variables: {
    customer_name: "Mario",
    order_number: "12345"
  },
  targetUserId: "customer@example.com",
  payload: {
    category: "order",
    order: {
      id: "ord_abc",
      number: "12345",
      status: "shipped",
      carrier: "BRT",
      tracking_code: "BRT123456789",
      item_ref: "ord_abc",
      items: [
        { sku: "ARPA160", name: "Pompa ARPA160", image: "https://cdn.example.com/arpa160.jpg", quantity: 2 }
      ]
    }
  }
});
```

---

## Data Model

### Notification Schema

```typescript
interface INotification {
  notification_id: string;        // Unique ID (notif_xxx)
  user_id: string;                // Recipient user ID
  user_type: "b2b_user" | "portal_user";

  // Content
  trigger: NotificationTrigger;
  title: string;
  body: string;
  icon?: string;
  action_url?: string;
  payload?: NotificationPayload;  // Typed payload (generic, product, order, price)

  // Status
  is_read: boolean;
  read_at?: Date;

  // Timestamps
  created_at: Date;
  updated_at: Date;
}
```

### Database Indexes

| Index | Purpose |
|-------|---------|
| `notification_id` (unique) | Fast lookups |
| `user_id + created_at` (desc) | List queries |
| `user_id + is_read` | Unread count |
| `user_id + trigger + created_at` | Filtered queries |

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid trigger | Trigger type not recognized |
| 400 | Missing required fields | `user_id`, `trigger`, `title`, or `body` missing |
| 401 | Authentication required | No valid auth provided |
| 401 | User identification required | Auth valid but no user ID |
| 404 | Notification not found | ID doesn't exist or not owned by user |
| 500 | Internal server error | Server-side error |

---

## Service Functions

For server-side usage:

```typescript
import {
  createInAppNotification,
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markManyAsRead,
  markAllAsRead,
  deleteNotification,
  deleteManyNotifications
} from "@/lib/notifications/in-app.service";
```
