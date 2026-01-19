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

### AI Search API

- **[ELIA AI Search](./elia-api.md)** - AI-powered natural language product search
  - Intent extraction endpoint
  - Synonym cascade strategy
  - Frontend integration examples
  - React hook implementation

## Authentication Methods

| Method | Use Case | Headers |
|--------|----------|---------|
| Session | B2B Admin UI | Cookie-based |
| API Key | External integrations | `x-auth-method`, `x-api-key-id`, `x-api-secret` |
| Portal User Token | Customer self-service | API Key headers + `x-portal-user-token` |

## Coming Soon

- Customers API reference
- Orders API reference
- Webhooks
- Rate limiting
