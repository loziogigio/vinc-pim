# API Documentation

REST API documentation for the VINC Commerce Suite.

## Available Documentation

### Public API (No Authentication)

- **[Public API](./public-api.md)** - Unauthenticated endpoints for storefront consumption
  - Menu API - Navigation menus with hierarchical tree structure

### B2B API (Authenticated)

- **[Cart API](./cart-api.md)** - Cart and order management
  - Get/create active cart
  - Add, update, remove items
  - Order lifecycle (draft → pending → confirmed → shipped)
  - Price calculation

- **[Pricing & Packaging API](./pricing-packaging-api.md)** - Product pricing and packaging import
  - Packaging options (PZ, BOX, CF, PALLET)
  - Reference-based pricing with discount chains
  - List discount (retail → list) and sale discount (list → sale)
  - Packaging-level promotions with min quantity

- **[Portal Users API](./portal-users-api.md)** - Portal user authentication system
  - Portal user login (JWT tokens)
  - CRUD operations for portal users
  - Customer access control (per-customer, per-address)
  - Auto-assignment of created resources
  - External integration examples

- **[Correlations API](./correlations-api.md)** - Product correlations and relationships
  - Related products management (Articoli Correlati)
  - CRUD operations for correlations
  - Bulk import from ERP (CORRE00F)
  - Bidirectional correlation support
  - Statistics for dashboard

- **[Home Settings API](./home-settings-api.md)** - Tenant-wide storefront configuration
  - Company branding (logo, favicon, URLs)
  - Extended theme colors (14 color fields)
  - Product card styling
  - CDN credentials management
  - SMTP settings for email

- **[Notifications API](./notifications-api.md)** - In-app notifications system
  - List user notifications (paginated)
  - Create notifications (admin/system)
  - Mark as read (single/bulk)
  - Unread count endpoint
  - Multi-channel template integration (email, web_push, in_app)

### AI Search API

- **[ELIA AI Search](./elia-api.md)** - AI-powered natural language product search
  - Intent extraction endpoint
  - Synonym cascade strategy
  - Frontend integration examples
  - React hook implementation

### Authentication

- **[SSO API](./sso-api.md)** - Single Sign-On authentication system
  - Login via VINC API
  - Token validation and refresh
  - Session management
  - OAuth 2.0 authorization code flow with PKCE
  - Rate limiting and account lockout protection

### Service Integration

- **[B2B Portal API](./b2b-portal-api.md)** - APIs for vinc-b2b frontend integration
  - Customer addresses
  - Password management (reset, change)
  - Token validation and refresh
  - Configuration examples for vinc-b2b

- **[VINC API Client](./vinc-api-client.md)** - Internal service-to-service client
  - Authentication methods (login, profile, password)
  - B2B methods (customers, addresses)
  - Error handling
  - TypeScript types

## Authentication Methods

| Method | Use Case | Headers |
|--------|----------|---------|
| SSO Token | B2B applications | `Authorization: Bearer <token>` |
| Session | B2B Admin UI | Cookie-based |
| API Key | External integrations | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| Portal User Token | Customer self-service | API Key headers + `x-portal-user-token` |

## Coming Soon

- Customers API reference
- Orders API reference
- Webhooks
