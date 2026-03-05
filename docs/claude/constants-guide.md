# Constants & Enumerations Guide

**NEVER hard-code values directly in business logic.** Use typed constants and enumerations for maintainability, type safety, and refactoring support.

## Location

```
src/lib/constants/
  ├── index.ts              # Barrel export
  ├── order.ts              # Order-related constants
  ├── customer.ts           # Customer-related constants
  └── common.ts             # Shared constants (currencies, countries, etc.)
```

## Pattern 1: String Literal Union Types (Preferred for simple enums)

```typescript
// src/lib/constants/order.ts
export const ORDER_STATUSES = [
  "draft", "pending", "confirmed", "shipped", "delivered", "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft (Cart)",
  pending: "Pending",
  confirmed: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

// Usage:
import { ORDER_STATUSES, OrderStatus } from "@/lib/constants/order";
function updateOrderStatus(orderId: string, status: OrderStatus) { ... }
```

## Pattern 2: Object Constants (For related values)

```typescript
export const CUSTOMER_TYPES = {
  BUSINESS: "business",
  PRIVATE: "private",
  RESELLER: "reseller",
} as const;

export type CustomerType = (typeof CUSTOMER_TYPES)[keyof typeof CUSTOMER_TYPES];

export const CUSTOMER_TYPE_CONFIG = {
  business: { label: "Business", icon: "Building2", color: "emerald", requiresVAT: true },
  private: { label: "Private", icon: "User", color: "purple", requiresVAT: false },
  reseller: { label: "Reseller", icon: "Store", color: "amber", requiresVAT: true },
} as const;
```

## Pattern 3: Numeric Constants

```typescript
export const PAGINATION = { DEFAULT_PAGE: 1, DEFAULT_LIMIT: 20, MAX_LIMIT: 100 } as const;
export const VAT_RATES = { STANDARD: 22, REDUCED: 10, SUPER_REDUCED: 4, ZERO: 0 } as const;
export const CODE_PREFIXES = { CUSTOMER_PUBLIC: "C-", ORDER: "ORD-", CART: "CART-", INVOICE: "INV-" } as const;
```

## Pattern 4: Mongoose Schema with Constants

```typescript
import { ORDER_STATUSES } from "@/lib/constants/order";
const OrderSchema = new Schema({
  status: { type: String, enum: ORDER_STATUSES, default: "draft" },
});
```

## What to Extract vs Not

| Extract                                   | Don't Extract                      |
| ----------------------------------------- | ---------------------------------- |
| Status values (order, customer, payment)  | One-time configuration values      |
| Type classifications                      | Values from environment variables  |
| VAT rates, currencies                     | Truly unique identifiers           |
| Error codes and messages                  | CSS class names (use Tailwind)     |
| Code prefixes (C-, ORD-, etc.)            | Component-specific UI strings      |
