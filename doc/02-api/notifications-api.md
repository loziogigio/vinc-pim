# Notifications API

In-App Notifications API for the VINC Commerce Suite. Provides Facebook-style bell icon notification system integrated with the multi-channel notification template system.

## Overview

The notification system supports multiple channels under a unified template system:

```
Template (e.g., "order_shipped")
├── email        → sends email via SMTP
├── mobile       → FCM push notification (iOS/Android)
├── web_in_app   → creates in-app notification (bell icon)
└── sms          → sends SMS (planned)
```

---

## Infrastructure

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     NOTIFICATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Campaign/Trigger                                              │
│        │                                                        │
│        ▼                                                        │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Email     │     │   Mobile    │     │  Web In-App │      │
│   │   Queue     │     │ (FCM) Queue │     │   Direct    │      │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘      │
│          │                   │                   │              │
│          ▼                   ▼                   ▼              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐      │
│   │   Email     │     │    FCM      │     │  MongoDB    │      │
│   │   Worker    │     │   Worker    │     │ (immediate) │      │
│   └──────┬──────┘     └──────┬──────┘     └─────────────┘      │
│          │                   │                                  │
│          ▼                   ▼                                  │
│   ┌─────────────┐     ┌─────────────┐                          │
│   │    SMTP     │     │  Firebase   │                          │
│   │   Server    │     │   Cloud     │                          │
│   └─────────────┘     └─────────────┘                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| **Redis** | Job queue backend | Redis 6+ |
| **BullMQ** | Queue management | Node.js |
| **Email Worker** | Processes email queue | SMTP |
| **FCM Worker** | Processes push queue | Firebase Cloud Messaging |
| **Notification Worker** | Scheduled campaigns | BullMQ delayed jobs |

### Required Workers

Workers must be running for queued notifications to be delivered:

```bash
# Development - run all workers
pnpm worker:all

# Or run individually
pnpm worker:email         # Email queue processing
pnpm worker:fcm           # FCM push notifications
pnpm worker:notification  # Scheduled campaigns
```

### Queue Names

| Queue | Purpose | Worker |
|-------|---------|--------|
| `email` | Email delivery | `worker:email` |
| `fcm` | FCM push notifications | `worker:fcm` |
| `notification` | Scheduled campaigns | `worker:notification` |

### Channel Availability

Channels are enabled per-tenant based on configuration:

| Channel | Enabled When |
|---------|--------------|
| `email` | SMTP settings configured in HomeSettings |
| `mobile` | FCM credentials configured for tenant |
| `web_in_app` | Always available (stored in MongoDB) |

Check channel availability via API:

```bash
GET /api/b2b/notifications/channels

# Response:
{
  "channels": {
    "email": true,
    "mobile": false,
    "web_in_app": true
  }
}
```

---

## User Types

The notification system supports two user types:

| Type | Storage | ID Field | Use Case |
|------|---------|----------|----------|
| `portal_user` | MongoDB (PortalUser) | `portal_user_id` | B2C customers |
| `b2b_user` | VINC API (PostgreSQL) | VINC API `user_id` (UUID) | B2B customers |

### User ID Resolution

- **Portal Users**: Use `portal_user_id` from MongoDB PortalUser collection
- **B2B Users**: Use VINC API `user_id` (UUID format: `973058c3-68b7-4bef-b955-c882b72b7324`)

> **Important**: B2B users use VINC API `user_id`, NOT `customer_id`. The `user_id` is the user account identifier, while `customer_id` is the business entity.

---

## Authentication

All endpoints support three authentication methods (via `requireTenantAuth`):

| Method | Use Case | Headers |
|--------|----------|---------|
| Bearer Token | SSO/JWT authentication | `Authorization: Bearer <token>` |
| API Key | Server-to-server | `x-auth-method: api-key`, `x-api-key-id`, `x-api-secret` |
| B2B Session | Browser (cookie) | `Cookie: vinc_b2b_session=<session>` |

---

## Endpoints

### In-App Notifications

#### List Notifications

```
GET /api/b2b/notifications
```

List notifications for the authenticated user with pagination.

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

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
      "payload": { "category": "order", "order": { "..." } },
      "campaign_id": null,
      "is_read": false,
      "created_at": "2024-01-26T10:00:00.000Z",
      "updated_at": "2024-01-26T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
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

#### Create Notification

```
POST /api/b2b/notifications
```

Create a new notification (admin/system use).

**Auth:** `requireTenantAuth(req)`

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

---

#### Get Unread Count

```
GET /api/b2b/notifications/unread-count
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

**Response:**

```json
{
  "success": true,
  "count": 5
}
```

---

#### Get Single Notification

```
GET /api/b2b/notifications/{id}
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

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

#### Mark as Read

```
PATCH /api/b2b/notifications/{id}
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

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

---

#### Delete Notification

```
DELETE /api/b2b/notifications/{id}
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

**Response:**

```json
{
  "success": true,
  "deleted": true
}
```

---

#### Bulk Actions

```
POST /api/b2b/notifications/bulk
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

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

---

### Trigger-Based Sending

#### List Available Triggers

```
GET /api/b2b/notifications/send
```

List all available triggers with their template variables and configuration status.

**Auth:** `requireTenantAuth(req)`

**Response:**

```json
{
  "triggers": [
    {
      "trigger": "order_confirmation",
      "label": "Order Confirmation",
      "variables": ["customer_name", "order_number", "order_date", "order_total", "items_list", "shipping_address", "order_url"],
      "is_configured": true
    }
  ],
  "total": 22,
  "configured": 5,
  "usage": {
    "endpoint": "POST /api/b2b/notifications/send",
    "headers": {
      "x-auth-method": "api-key",
      "x-api-key-id": "ak_{tenant-id}_{key}",
      "x-api-secret": "sk_{secret}"
    },
    "body": {
      "trigger": "order_confirmation",
      "to": "customer@example.com",
      "variables": { "customer_name": "Mario Rossi", "order_number": "ORD-12345" }
    }
  }
}
```

---

#### Send Notification by Trigger

```
POST /api/b2b/notifications/send
```

Send a notification using a configured template trigger. Automatically sends via all enabled channels (email, mobile, in-app).

**Auth:** `requireTenantAuth(req)`

**Request Body:**

```json
{
  "trigger": "order_shipped",
  "to": "customer@example.com",
  "variables": {
    "customer_name": "Mario",
    "order_number": "12345",
    "tracking_number": "BRT123456789"
  },
  "reply_to": "support@example.com",
  "portal_user_id": "portal_abc123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trigger` | string | Yes | Trigger ID (see [Available Triggers](#available-triggers)) |
| `to` | string | Yes | Recipient email address |
| `variables` | object | No | Template variables to replace |
| `reply_to` | string | No | Reply-to email address |
| `portal_user_id` | string | No | Portal user ID for in-app/push notifications |

**Response:**

```json
{
  "success": true,
  "trigger": "order_shipped",
  "to": "customer@example.com",
  "email_id": "email_abc123",
  "message_id": "<msg-id@smtp.example.com>",
  "in_app_id": "notif_xyz789",
  "push_result": { "sent": 1, "queued": 0, "failed": 0 },
  "fcm_result": { "sent": 2, "queued": 0, "failed": 0 }
}
```

**Example:**

```bash
curl -X POST "http://localhost:3001/api/b2b/notifications/send" \
  -H "Content-Type: application/json" \
  -H "x-auth-method: api-key" \
  -H "x-api-key-id: ak_{tenant}_{suffix}" \
  -H "x-api-secret: sk_{secret}" \
  -d '{
    "trigger": "order_shipped",
    "to": "customer@example.com",
    "variables": {
      "customer_name": "Mario Rossi",
      "order_number": "ORD-12345",
      "tracking_number": "BRT123456789",
      "carrier": "BRT"
    }
  }'
```

**Known Variables by Trigger:**

| Trigger | Variables |
|---------|-----------|
| `welcome` | `customer_name`, `company_name`, `username`, `password`, `login_url`, `shop_name` |
| `forgot_password` | `customer_name`, `temporary_password`, `login_url`, `shop_name` |
| `reset_password` | `customer_name`, `reset_date`, `ip_address`, `login_url`, `support_email`, `shop_name` |
| `order_confirmation` | `customer_name`, `order_number`, `order_date`, `order_total`, `items_list`, `shipping_address`, `order_url` |
| `order_shipped` | `customer_name`, `order_number`, `tracking_number`, `carrier`, `tracking_url`, `estimated_delivery` |
| `order_delivered` | `customer_name`, `order_number`, `delivery_date` |
| `order_cancelled` | `customer_name`, `order_number`, `cancellation_reason`, `support_email` |
| `back_in_stock` | `customer_name`, `product_name`, `product_url` |
| `registration_request_admin` | `customer_name`, `company_name`, `email`, `approval_url` |
| `registration_request_customer` | `customer_name`, `company_name` |

---

### Notification Tracking

```
POST /api/b2b/notifications/track
```

Track engagement events for notifications (opened, clicked, read, dismissed). Used by mobile apps and web clients to record user interactions.

**Auth:** `authenticateTenant(req)` (API key)

**Request Body:**

```json
{
  "log_id": "log_abc123xyz",
  "event": "opened",
  "platform": "mobile",
  "metadata": {
    "sku": "ARPA160",
    "screen": "product_detail",
    "type": "product"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `log_id` | string | Yes | The notification log ID (from notification's `log_id` field) |
| `event` | string | Yes | Event type: `delivered`, `opened`, `clicked`, `read`, `dismissed` |
| `platform` | string | No | Platform: `mobile`, `web`, `email`, `ios`, `android` (default: `web`) |
| `metadata` | object | No | Additional event data |

**Metadata Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | URL that was clicked |
| `sku` | string | Product SKU (for product clicks) |
| `order_number` | string | Order number (for order clicks) |
| `screen` | string | Screen navigated to (e.g., `product_detail`, `order_detail`) |
| `type` | string | Click type: `product`, `link`, `order` |

**Response:**

```json
{
  "success": true,
  "log_id": "log_abc123xyz",
  "event": "opened",
  "platform": "mobile"
}
```

> **Note:** Tracking failures are handled silently on the client side to avoid blocking user experience. The endpoint returns 404 if `log_id` is not found.

---

### FCM Token Registration

```
POST /api/b2b/fcm/register
```

Register or update an FCM token from a mobile app.

**Auth:** `requireTenantAuth(req)`

**Request Body:**

```json
{
  "fcm_token": "fcm_device_token_here",
  "platform": "android",
  "device_id": "unique-device-uuid",
  "device_model": "Pixel 7",
  "app_version": "1.2.0",
  "os_version": "14",
  "preferences": {
    "order_updates": true,
    "price_alerts": true,
    "marketing": false,
    "system": true
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fcm_token` | string | Yes | Firebase Cloud Messaging device token |
| `platform` | string | Yes | `ios` or `android` |
| `device_id` | string | No | Unique device identifier (recommended for deduplication) |
| `device_model` | string | No | Device model name |
| `app_version` | string | No | App version string |
| `os_version` | string | No | OS version string |
| `preferences` | object | No | Push notification preferences |

**Response:**

```json
{
  "success": true,
  "token_id": "tok_abc123xyz",
  "user_id": "portal_user_abc",
  "user_type": "portal_user",
  "preferences": {
    "order_updates": true,
    "price_alerts": true,
    "marketing": false,
    "system": true
  },
  "device_id_required": false
}
```

> **Note:** `device_id_required: true` indicates the client should provide a `device_id` on subsequent registrations for proper deduplication.

---

#### Check Token Status

```
GET /api/b2b/fcm/register?fcm_token={token}
```

**Auth:** `requireTenantAuth(req)`

**Response:**

```json
{
  "success": true,
  "registered": true,
  "token_id": "tok_abc123xyz",
  "platform": "android",
  "is_active": true,
  "preferences": { "order_updates": true, "price_alerts": true, "marketing": false, "system": true }
}
```

---

#### Delete FCM Token

```
DELETE /api/b2b/fcm/register?fcm_token={token}
```

Remove a single FCM token (e.g., on logout).

**Auth:** `requireTenantAuth(req)`

**Response:**

```json
{
  "success": true,
  "deleted": true
}
```

**Delete all user tokens (logout from all devices):**

```
DELETE /api/b2b/fcm/register?logout_all=true
```

**Response:**

```json
{
  "success": true,
  "deleted": 3,
  "message": "Removed 3 token(s)"
}
```

---

### FCM Preferences

#### Get Preferences

```
GET /api/b2b/fcm/preferences
```

Get the user's push notification preferences across all registered devices.

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `token_id` | string | Optional - get preferences for a specific token only |

**Response (all tokens):**

```json
{
  "success": true,
  "tokens": [
    {
      "token_id": "tok_abc123",
      "platform": "android",
      "device_model": "Pixel 7",
      "is_active": true,
      "preferences": {
        "order_updates": true,
        "price_alerts": true,
        "marketing": false,
        "system": true
      },
      "last_used_at": "2026-03-01T10:00:00.000Z"
    }
  ]
}
```

**Response (no tokens registered):**

```json
{
  "success": true,
  "tokens": [],
  "defaultPreferences": {
    "order_updates": true,
    "price_alerts": true,
    "marketing": false,
    "system": true
  }
}
```

---

#### Update Preferences

```
PATCH /api/b2b/fcm/preferences
```

**Auth:** `requireTenantAuth(req, { requireUserId: true })`

**Request Body:**

```json
{
  "token_id": "tok_abc123",
  "preferences": {
    "marketing": true
  },
  "update_all": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `preferences` | object | Yes | Preference keys to update |
| `token_id` | string | No | Update specific token (if omitted, updates all) |
| `update_all` | boolean | No | Explicitly update all user tokens |

**Valid preference keys:** `order_updates`, `price_alerts`, `marketing`, `system` (all boolean).

**Response (specific token):**

```json
{
  "success": true,
  "token_id": "tok_abc123",
  "preferences": { "marketing": true }
}
```

**Response (all tokens):**

```json
{
  "success": true,
  "updated_count": 2,
  "preferences": { "marketing": true }
}
```

---

### Templates

#### List Templates

```
GET /api/b2b/notifications/templates
```

**Auth:** `authenticateTenant(req)`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `trigger` | string | Filter by trigger type |
| `is_active` | boolean | Filter by active status |
| `is_default` | boolean | Filter by default status |
| `search` | string | Search by name |

---

#### Create Template

```
POST /api/b2b/notifications/templates
```

**Auth:** `authenticateTenant(req)`

---

#### Get / Update / Delete Template

```
GET    /api/b2b/notifications/templates/{id}
PUT    /api/b2b/notifications/templates/{id}
DELETE /api/b2b/notifications/templates/{id}
```

**Auth:** `authenticateTenant(req)`

---

#### Toggle Template Active Status

```
PATCH /api/b2b/notifications/templates/{id}/toggle
```

**Auth:** `authenticateTenant(req)`

---

#### Preview Template Email

```
POST /api/b2b/notifications/templates/{id}/preview
```

**Auth:** `authenticateTenant(req)`

---

#### Send Test Email from Template

```
POST /api/b2b/notifications/templates/{id}/test
```

**Auth:** `authenticateTenant(req)`

---

### Campaigns

#### List Campaigns

```
GET /api/b2b/notifications/campaigns
```

**Auth:** `authenticateTenant(req)`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status: `draft`, `scheduled`, `sending`, `sent`, `failed` |
| `search` | string | Search by name, title, campaign_id, or slug |
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20, max: 100) |

**Response:**

```json
{
  "campaigns": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

---

#### Create Campaign (Draft)

```
POST /api/b2b/notifications/campaigns
```

**Auth:** `authenticateTenant(req)`

**Request Body:**

```json
{
  "name": "Spring Sale 2026",
  "type": "product",
  "title": "Saldi di Primavera!",
  "body": "Scopri le offerte speciali",
  "push_image": "https://cdn.example.com/push-banner.jpg",
  "email_subject": "Saldi di Primavera - Fino al 40%",
  "email_html": "<p>HTML content for email body</p>",
  "email_link": "https://shop.example.com/sale",
  "products_url": "shop?text=sale&filters-brand_id=004",
  "products": [
    { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "item_ref": "ARPA160" }
  ],
  "channels": ["email", "mobile", "web_in_app"],
  "recipient_type": "all",
  "selected_users": [
    { "id": "user_abc", "email": "mario@example.com", "name": "Mario Rossi", "type": "portal" }
  ],
  "tag_ids": ["tag_vip", "tag_wholesale"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Campaign name |
| `type` | string | Yes | `product` or `generic` |
| `title` | string | Yes | Notification title |
| `body` | string | Yes | Notification body |
| `push_image` | string | No | Image for push notification |
| `email_subject` | string | No | Email subject (defaults to title) |
| `email_html` | string | No | Custom email HTML body |
| `email_link` | string | No | CTA link for email (separate from `products_url`) |
| `products_url` | string | No | Push notification action URL / "See All" link |
| `products` | array | No | Products for product campaigns |
| `url` | string | No | URL for generic campaigns |
| `image` | string | No | Image for generic campaigns |
| `open_in_new_tab` | boolean | No | Open URL in new tab |
| `channels` | array | Yes | Channels: `email`, `mobile`, `web_in_app` |
| `recipient_type` | string | Yes | `all`, `selected`, or `tagged` |
| `selected_user_ids` | array | No | User IDs (when `selected`) |
| `selected_users` | array | No | User details with type (when `selected`) |
| `tag_ids` | array | No | Tag IDs (when `tagged`) |

**Recipient Types:**

| Type | Description |
|------|-------------|
| `all` | All active Portal users |
| `selected` | Specific users (B2B or Portal) |
| `tagged` | Portal users with specific tags |

**Selected Users Format:**

```json
{
  "selected_users": [
    { "id": "973058c3-...", "email": "user@example.com", "name": "Mario Rossi", "type": "b2b" },
    { "id": "portal_abc123", "email": "customer@example.com", "name": "Luigi Verdi", "type": "portal" }
  ]
}
```

---

#### Get / Update / Delete Campaign

```
GET    /api/b2b/notifications/campaigns/{id}
PUT    /api/b2b/notifications/campaigns/{id}    # Draft only
DELETE /api/b2b/notifications/campaigns/{id}    # Draft or failed only
```

**Auth:** `authenticateTenant(req)`

---

#### Send Campaign

```
POST /api/b2b/notifications/campaigns/{id}/send
```

Send a draft campaign immediately to its recipients.

**Auth:** `authenticateTenant(req)`

**Response:**

```json
{
  "success": true,
  "campaign_id": "camp_abc123",
  "type": "product",
  "channels": ["email", "mobile", "web_in_app"],
  "recipient_type": "all",
  "recipients_count": 150,
  "results": {
    "email": { "sent": 148, "failed": 2, "opened": 0, "clicked": 0 },
    "mobile": { "sent": 95, "failed": 5, "clicked": 0 },
    "web_in_app": { "sent": 150, "failed": 0, "read": 0 }
  },
  "message": "Campaign sent to 150 recipients"
}
```

---

#### Schedule Campaign

```
POST /api/b2b/notifications/campaigns/{id}/schedule
```

Schedule a draft campaign for future delivery. Uses BullMQ delayed jobs.

**Auth:** `authenticateTenant(req)`

**Request Body:**

```json
{
  "scheduled_at": "2026-03-10T10:00:00Z"
}
```

> **Note:** `scheduled_at` must be at least 5 minutes in the future.

**Response:**

```json
{
  "success": true,
  "campaign_id": "camp_abc123",
  "scheduled_at": "2026-03-10T10:00:00.000Z",
  "job_id": "bullmq_job_123",
  "delay_minutes": 8640,
  "message": "Campaign scheduled for 2026-03-10T10:00:00.000Z (in 8640 minutes)"
}
```

**Cancel a scheduled campaign:**

```
DELETE /api/b2b/notifications/campaigns/{id}/schedule
```

Reverts campaign back to draft status and removes the BullMQ delayed job.

---

#### Get Campaign Results

```
GET /api/b2b/notifications/campaigns/{id}/results
```

Get detailed results per channel for a sent campaign. Includes live engagement stats from the unified notification log.

**Auth:** `authenticateTenant(req)`

**Response:**

```json
{
  "campaign_id": "camp_abc123",
  "name": "Spring Sale 2026",
  "status": "sent",
  "sent_at": "2026-03-01T10:00:00.000Z",
  "recipient_count": 150,
  "channels": ["email", "mobile", "web_in_app"],
  "results": {
    "email": { "sent": 148, "failed": 2, "opened": 45, "clicked": 12 },
    "mobile_app": { "sent": 95, "failed": 5, "opened": 60, "clicked": 25 },
    "web": { "sent": 150, "failed": 0, "opened": 80, "clicked": 30, "read": 65 }
  },
  "totals": {
    "sent": 393,
    "failed": 7,
    "delivery_rate": 0.9825,
    "open_rate": 0.47,
    "click_rate": 0.17
  }
}
```

---

#### Duplicate Campaign

```
POST /api/b2b/notifications/campaigns/{id}/duplicate
```

Create a copy of an existing campaign as a new draft.

**Auth:** `authenticateTenant(req)`

**Response:**

```json
{
  "success": true,
  "campaign": {
    "campaign_id": "camp_new456",
    "name": "Spring Sale 2026 (Copia)",
    "slug": "spring-sale-2026-copia",
    "status": "draft",
    "type": "product",
    "title": "Saldi di Primavera!",
    "created_at": "2026-03-04T10:00:00.000Z"
  },
  "message": "Campagna duplicata come \"Spring Sale 2026 (Copia)\""
}
```

---

#### Campaign Email Preview

```
POST /api/b2b/notifications/campaigns/preview
```

Generate an email preview with tenant header/footer for a campaign.

**Auth:** `authenticateTenant(req)`

**Request Body:**

```json
{
  "type": "product",
  "email_html": "<p>Campaign email content</p>",
  "email_link": "https://shop.example.com/sale",
  "products": [
    { "sku": "ARPA160", "name": "Pompa ARPA160", "image": "https://cdn.example.com/arpa160.jpg", "item_ref": "ARPA160" }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "html": "<html>...complete email with header/footer...</html>"
}
```

---

#### Campaign Test Send

```
POST /api/b2b/notifications/campaigns/test
```

Send a test notification across all configured channels to a specific email.

**Auth:** `requireTenantAuth(req)`

**Request Body:**

```json
{
  "type": "product",
  "title": "Test Campaign",
  "body": "This is a test notification",
  "email_html": "<p>Email body</p>",
  "email_link": "https://shop.example.com/sale",
  "channels": ["email", "mobile", "web_in_app"],
  "test_email": "test@example.com"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Test sent via: email, web_in_app",
  "test_email": "test@example.com",
  "channels_sent": ["email", "web_in_app"],
  "results": {
    "email": { "sent": 1, "failed": 0 },
    "mobile": { "sent": 0, "failed": 1, "error": "User has no registered mobile devices" },
    "web_in_app": { "sent": 1, "failed": 0 }
  }
}
```

---

### Email Components

#### List Components

```
GET /api/b2b/notifications/components
```

List email header/footer components.

**Auth:** `authenticateTenant(req)`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Filter by type: `header` or `footer` |
| `active` | boolean | Filter active only (default: true) |

---

#### Create / Get / Update / Delete Component

```
POST   /api/b2b/notifications/components
GET    /api/b2b/notifications/components/{id}
PUT    /api/b2b/notifications/components/{id}
DELETE /api/b2b/notifications/components/{id}
```

**Auth:** `authenticateTenant(req)`

---

#### Seed Default Components

```
POST /api/b2b/notifications/components/seed
```

Creates default header/footer components if none exist.

---

### Notification Logs

```
GET /api/b2b/notifications/logs
```

List email delivery logs (stored in admin database, filtered by tenant).

**Auth:** `authenticateTenant(req)`

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | number | Page number (default: 1) |
| `limit` | number | Items per page (default: 20) |
| `search` | string | Search by recipient email or subject |
| `status` | string | Filter by status |
| `dateFrom` | string | Start date (ISO format) |
| `dateTo` | string | End date (ISO format) |

---

#### Resend Log Entry

```
POST /api/b2b/notifications/logs/{id}/send
```

Resend a failed email from the log.

**Auth:** `authenticateTenant(req)`

---

### Dashboard Stats

```
GET /api/b2b/notifications/stats
```

Get notification dashboard statistics (last 30 days).

**Auth:** `authenticateTenant(req)`

**Response:**

```json
{
  "sent_today": 12,
  "sent_this_week": 85,
  "sent_this_month": 340,
  "open_rate": 35.2,
  "click_rate": 8.5,
  "failed_today": 1,
  "by_status": {
    "sent": 338,
    "failed": 2,
    "queued": 0,
    "bounced": 0
  },
  "by_channel": {
    "email": { "sent": 340, "open_rate": 35.2 },
    "web_push": { "sent": 0, "click_rate": 0 },
    "mobile_push": { "sent": 0, "click_rate": 0 },
    "sms": { "sent": 0 }
  }
}
```

---

### Recipient Management

#### Export Recipients

```
POST /api/b2b/notifications/recipients/export
```

Export users to CSV or JSON.

**Auth:** `authenticateTenant(req)`

**Request Body:**

```json
{
  "user_ids": ["portal_user_1", "portal_user_2"],
  "tag_ids": ["tag_vip"],
  "all": false,
  "format": "csv"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `user_ids` | array | Export specific portal users |
| `tag_ids` | array | Export users with specific tags |
| `all` | boolean | Export all active users |
| `format` | string | `csv` (default) or `json` |

> Provide one of `user_ids`, `tag_ids`, or `all: true`.

---

#### Import Recipients

```
POST /api/b2b/notifications/recipients/import
```

Import recipients from CSV.

**Auth:** `authenticateTenant(req)`

---

## Available Triggers

| Trigger | Label | Default Category |
|---------|-------|------------------|
| **Account** | | |
| `registration_request_admin` | Registration Request (Admin) | `generic` |
| `registration_request_customer` | Registration Confirmation | `generic` |
| `welcome` | Welcome Email | `generic` |
| `forgot_password` | Forgot Password | `generic` |
| `reset_password` | Password Reset Confirmation | `generic` |
| **Order** | | |
| `order_confirmation` | Order Confirmation | `order` |
| `order_shipped` | Order Shipped | `order` |
| `order_delivered` | Order Delivered | `order` |
| `order_cancelled` | Order Cancelled | `order` |
| **Marketing** | | |
| `back_in_stock` | Back in Stock | `product` |
| `newsletter` | Newsletter | `generic` |
| **Campaign** | | |
| `campaign_product` | Product Campaign | `product` |
| `campaign_generic` | Generic Campaign | `generic` |
| **Payment** | | |
| `payment_received` | Pagamento Ricevuto | `generic` |
| `payment_failed` | Pagamento Fallito | `generic` |
| `payment_refunded` | Rimborso Effettuato | `generic` |
| **Subscription** | | |
| `subscription_created` | Abbonamento Attivato | `generic` |
| `subscription_renewed` | Abbonamento Rinnovato | `generic` |
| `subscription_cancelled` | Abbonamento Cancellato | `generic` |
| `subscription_payment_failed` | Pagamento Abbonamento Fallito | `generic` |
| `subscription_expiring` | Abbonamento in Scadenza | `generic` |
| **Custom** | | |
| `custom` | Custom Template | `generic` |

---

## Template Integration

In-app notifications are automatically created when:
1. A notification template has the `web_in_app` channel enabled
2. `sendNotification()` is called with a `targetUserId`

### Enabling In-App Channel

In the Notifications app, edit a template and enable the "Web / In-App" channel:

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
- Send FCM push (if `mobile` channel enabled)
- Send web push (if `web_in_app` channel enabled)
- Create in-app notification (if `web_in_app` channel enabled)

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
  "filters": {
    "sku": ["ARPA160", "FILTRO-X1"],
    "brand": ["hidros"]
  },
  "products_url": "shop?text=moon&filters-brand_id=004",
  "media": { "icon": "https://cdn.example.com/icon.png" }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `products` | array | List of products with sku, name, image, item_ref |
| `filters` | object | Search filters for mobile/web app navigation (sku, brand, category, etc.) |
| `products_url` | string | Raw search URL for "See All" navigation |

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
    }
  ],
  "filters": {
    "brand": ["hidros"],
    "category": ["pumps"]
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `expires_at` | string | ISO timestamp for countdown (when offer expires) |
| `discount_label` | string | Discount label, e.g., "Fino al 40%" |
| `products` | array | Products with pricing info |
| `filters` | object | Search filters for navigation |

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

Collection: `notifications` (tenant database)

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

  // Campaign reference
  campaign_id?: string;           // Links to campaign that created this notification

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

### Notification Log Schema

Collection: `notificationlogs` (admin database). Unified logging for all channels with engagement tracking. TTL: 90 days.

```typescript
interface INotificationLog {
  log_id: string;                 // Unique ID (nlog_xxx)

  // Channel & Source
  channel: "email" | "mobile" | "web_in_app";
  source: "campaign" | "trigger" | "manual";
  campaign_id?: string;
  trigger?: string;

  // Target
  tenant_db: string;
  user_id?: string;
  recipient?: string;             // Email address

  // Content
  title: string;
  body: string;
  action_url?: string;

  // Delivery Status
  status: "queued" | "sending" | "sent" | "failed" | "bounced";
  sent_at?: Date;
  error?: string;

  // Engagement Events
  events: {
    type: "delivered" | "opened" | "clicked" | "read" | "dismissed";
    timestamp: Date;
    metadata?: { url?, ip?, user_agent?, platform?, sku?, order_number?, screen?, click_type? };
  }[];

  // Quick aggregation
  open_count: number;
  click_count: number;
  is_read: boolean;

  // Platform-specific counters
  mobile_open_count: number;
  mobile_click_count: number;
  web_open_count: number;
  web_click_count: number;

  created_at: Date;
  updated_at: Date;
}
```

---

## Campaign Statuses

| Status | Description | Allowed Actions |
|--------|-------------|-----------------|
| `draft` | Initial state | Update, Delete, Send, Schedule |
| `scheduled` | Scheduled for future | Cancel schedule (→ draft) |
| `sending` | Being sent (transient) | - |
| `sent` | Completed successfully | View results, Duplicate |
| `failed` | Send failed | Delete, Duplicate |

---

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid trigger | Trigger type not recognized |
| 400 | Missing required fields | `user_id`, `trigger`, `title`, or `body` missing |
| 400 | Invalid platform | FCM platform must be `ios` or `android` |
| 400 | FCM not enabled | FCM push notifications not configured for tenant |
| 401 | Authentication required | No valid auth provided |
| 401 | User identification required | Auth valid but no user ID (for user-specific endpoints) |
| 404 | Notification not found | ID doesn't exist or not owned by user |
| 404 | Template not found | No active template for trigger |
| 404 | Campaign not found | Campaign ID doesn't exist |
| 500 | Internal server error | Server-side error |

---

## Service Functions

For server-side usage:

```typescript
// In-App Notifications
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

// Trigger-Based Sending (all channels)
import { sendNotification } from "@/lib/notifications/send.service";

// Campaign Sending
import {
  sendCampaignDirect,
  sendCampaignNotification
} from "@/lib/notifications/campaign-send.service";

// Notification Logging
import {
  createNotificationLog,
  recordEngagement,
  getCampaignStats,
  markLogAsSent,
  markLogAsFailed,
  findLogById,
  findLogsByCampaign,
  findLogsByUser
} from "@/lib/notifications/notification-log.service";
```
