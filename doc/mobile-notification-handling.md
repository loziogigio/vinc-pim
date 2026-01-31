# Mobile App Notification Handling Guide

This document describes how the mobile app (Flutter/iOS/Android) should handle push notifications from campaigns, including product-related notifications.

## FCM Notification Payload Structure

When a campaign notification is sent, the mobile app receives an FCM payload with the following structure:

### Standard Fields (in `notification` part)

```json
{
  "notification": {
    "title": "Nuova Offerta!",
    "body": "Scopri i nostri nuovi prodotti in promozione"
  }
}
```

### Data Fields (in `data` part)

```json
{
  "data": {
    "campaign_type": "product",
    "campaign_id": "cmp_abc123def456",
    "sku": "SKU12345",
    "products_url": "shop?text=caldaia&filters-brand_id=004",
    "action_url": "https://example.com/promo",
    "icon": "shopping_cart",
    "image": "https://example.com/promo-banner.jpg"
  }
}
```

**Key Fields:**
- `sku`: Single product SKU - use for "View Product" / product detail navigation
- `products_url`: Search URL - use for "See All" / shop page with filters
```

## Campaign Types

| Type | Description | Expected Action |
|------|-------------|-----------------|
| `generic` | General announcement | Open app or URL |
| `product` | Single product promotion | Go to product detail |
| `promo` | Promotional campaign | Go to search/shop page with filters |
| `order` | Order-related notification | Go to order detail |

## Handling Notification Click/Open

### 1. Product Type (`campaign_type: "product"`)

When the notification has a **single product** (`sku` is present):

```dart
void handleNotificationClick(Map<String, dynamic> data) {
  final campaignType = data['campaign_type'];
  final sku = data['sku'];
  final actionUrl = data['action_url'];

  if (campaignType == 'product' && sku != null) {
    // Navigate to product detail page
    Navigator.pushNamed(context, '/product/$sku');
  }
}
```

### 2. Promo/Search Type (`campaign_type: "promo"`)

When the notification has a **search URL** for "See All" functionality:

```dart
void handleNotificationClick(Map<String, dynamic> data) {
  final campaignType = data['campaign_type'];
  final actionUrl = data['action_url'];

  if (campaignType == 'promo' && actionUrl != null) {
    // Parse the action URL
    // Example: "shop?text=caldaia&filters-brand_id=004"

    final uri = Uri.parse(actionUrl);
    final keyword = uri.queryParameters['text'] ?? uri.queryParameters['q'];
    final filters = _extractFilters(uri.queryParameters);

    // Navigate to search/shop page with filters
    Navigator.pushNamed(
      context,
      '/shop',
      arguments: SearchArgs(keyword: keyword, filters: filters),
    );
  }
}

Map<String, dynamic> _extractFilters(Map<String, String> params) {
  final filters = <String, dynamic>{};

  params.forEach((key, value) {
    if (key.startsWith('filters-')) {
      final filterKey = key.replaceFirst('filters-', '');
      // Handle semicolon-separated values
      if (value.contains(';')) {
        filters[filterKey] = value.split(';');
      } else {
        filters[filterKey] = value;
      }
    }
  });

  return filters;
}
```

### 3. Action URL Format Reference

The `action_url` field can have these formats:

| Format | Example | Description |
|--------|---------|-------------|
| Shop with keyword | `shop?text=caldaia` | Search for "caldaia" |
| Shop with filters | `shop?filters-brand_id=004` | Filter by brand |
| Combined | `shop?text=moon&filters-brand_id=004` | Keyword + filter |
| Product detail | `/product/SKU12345` | Direct product link |
| External URL | `https://example.com/page` | Open in webview/browser |

### 4. Complete Example (Flutter)

```dart
class NotificationHandler {
  void onNotificationOpened(RemoteMessage message) {
    final data = message.data;

    final campaignType = data['campaign_type'] as String?;
    final campaignId = data['campaign_id'] as String?;
    final sku = data['sku'] as String?;
    final actionUrl = data['action_url'] as String?;

    // Track notification open
    _trackNotificationOpen(campaignId);

    // Handle navigation based on campaign type
    switch (campaignType) {
      case 'product':
        if (sku != null) {
          // Single product - go to detail
          _navigateToProduct(sku);
        } else if (actionUrl != null) {
          // Multiple products - go to search
          _navigateToSearch(actionUrl);
        }
        break;

      case 'promo':
        if (actionUrl != null) {
          _navigateToSearch(actionUrl);
        }
        break;

      case 'order':
        if (data['order_id'] != null) {
          _navigateToOrder(data['order_id']);
        }
        break;

      case 'generic':
      default:
        if (actionUrl != null) {
          _handleGenericUrl(actionUrl);
        } else {
          // Open app home
          _navigateToHome();
        }
    }
  }

  void _navigateToProduct(String sku) {
    Navigator.pushNamed(context, '/product', arguments: {'sku': sku});
  }

  void _navigateToSearch(String actionUrl) {
    // Parse: shop?text=keyword&filters-brand_id=004
    final uri = Uri.parse(actionUrl.startsWith('/') ? actionUrl : '/$actionUrl');

    final keyword = uri.queryParameters['text'] ?? uri.queryParameters['q'];
    final filters = <String, dynamic>{};

    uri.queryParameters.forEach((key, value) {
      if (key.startsWith('filters-')) {
        final filterKey = key.replaceFirst('filters-', '');
        filters[filterKey] = value.contains(';') ? value.split(';') : value;
      }
    });

    Navigator.pushNamed(
      context,
      '/shop',
      arguments: {'keyword': keyword, 'filters': filters},
    );
  }

  void _trackNotificationOpen(String? campaignId) {
    if (campaignId != null) {
      // Call API to track the open event
      api.post('/api/b2b/notifications/campaigns/$campaignId/track', {
        'event': 'opened',
        'platform': Platform.isIOS ? 'ios' : 'android',
      });
    }
  }
}
```

## Tracking Events

The mobile app should track these events:

### 1. Notification Received (Optional)
```dart
FirebaseMessaging.onMessage.listen((message) {
  // Track that notification was received while app was in foreground
});
```

### 2. Notification Opened (Required)
```dart
void onNotificationOpened(RemoteMessage message) {
  final campaignId = message.data['campaign_id'];
  if (campaignId != null) {
    api.post('/api/b2b/notifications/campaigns/$campaignId/track', {
      'event': 'opened',
    });
  }
}
```

### 3. Action Clicked (Optional)
```dart
void onProductViewed(String sku, String? campaignId) {
  if (campaignId != null) {
    api.post('/api/b2b/notifications/campaigns/$campaignId/track', {
      'event': 'clicked',
      'sku': sku,
    });
  }
}
```

## Filter Field Mapping (Legacy to PIM)

When parsing filter URLs, some legacy field names need to be mapped:

| URL Parameter | Internal Field |
|---------------|----------------|
| `filters-id_brand` | `brand_id` |
| `filters-is_new` | `attribute_is_new_b` |
| `filters-new` | `attribute_is_new_b` |
| `filters-category` | `category_ancestors` |
| `filters-family` | `category_ancestors` |
| `filters-promo_codes` | `promo_code` |

## Background vs Foreground Handling

### Foreground (App is open)
- Show an in-app banner/toast with the notification
- User can tap to navigate

### Background/Terminated
- System shows the notification
- On tap, app opens and `onNotificationOpened` is called

```dart
// Initialize in main.dart
FirebaseMessaging.onMessageOpenedApp.listen(onNotificationOpened);

// Check for initial message (app opened from terminated state)
final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
if (initialMessage != null) {
  onNotificationOpened(initialMessage);
}
```

## Summary of Data Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `campaign_type` | string | Yes | Type of campaign: `generic`, `product`, `promo`, `order` |
| `campaign_id` | string | Yes | Unique campaign identifier for tracking |
| `sku` | string | No | Product SKU (for single product campaigns) |
| `action_url` | string | No | URL/path for navigation (search, product, external) |
| `icon` | string | No | Icon name for display |
| `image` | string | No | Image URL for rich notifications |
