# VINC Commerce Suite - Development Plans

This document anchors all planning documents for the vinc-commerce-suite project.

---

## Active Plans

### 1. Payment System (Multi-Provider + Subscriptions)
**Status:** 📋 Planned
**Plan File:** `~/.claude/plans/enchanted-toasting-sketch.md`

Production-ready multi-provider payment system with platform commission model.

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | 📋 Planned | Core Infrastructure (types, services, models, OpenTelemetry) |
| Phase 2 | 📋 Planned | Primary Providers (Stripe, PayPal, Mangopay) |
| Phase 3 | 📋 Planned | Subscription System (dynamic service packages) |
| Phase 4 | 📋 Planned | Frontend Package (`vinc-payments-client`) |
| Phase 5 | 📋 Planned | Italian Gateways (Nexi, Axerve) |
| Phase 6 | 📋 Planned | Mobile & BNPL (Satispay, Scalapay) |
| Phase 7 | 📋 Planned | Production Readiness (tests, dashboards, alerts) |

**Key Features:**
- **Platform Commission Model** - Take % of each transaction (2.5% default)
- **Subscription Payments** - Dynamic service packages with trials
- **Multi-Provider Support** - Stripe, PayPal, Mangopay, Nexi, Axerve, etc.
- **Stripe Connect** - Tenant onboarding with Express accounts
- **Mangopay** - 30% cheaper EU alternative (wallet-based)
- **Split Payments** - Multi-vendor cart support (native where possible, app-level fallback)
- **OpenTelemetry** - Full monitoring stack

**Payment Types (all providers):**

| Type | Description | 3DS/SCA |
|------|-------------|---------|
| **MOTO** | Mail Order / Telephone Order — operator enters card data server-side | Exempt (PSD2) |
| **OnClick** | Standard e-commerce — customer enters card on checkout page | Required |
| **Recurrent** | Recurring/subscription — tokenized card, Merchant-Initiated Transactions | Not required on subsequent |

**Provider × Payment Type Matrix:**

| Provider | MOTO | OnClick | Recurrent | Split Payments |
|---|---|---|---|---|
| **Stripe Connect** | Via API (card-not-present) | Elements / Checkout | Billing (native) | Native (Connect) |
| **Mangopay** | Not supported | Payin (Direct/Web) | Recurring Payin | Native (wallets) |
| **PayPal Commerce** | N/A | PayPal Checkout | Subscriptions API | Native (disbursements) |
| **Nexi XPay** | `POST /orders/moto` (REST) | HPP / XPay Build / S2S | `POST /orders/mit` (contracts) | App-level only |
| **Axerve** | `callPagamS2S` (SOAP) | Redirect / Lightbox / iFrame | Token + MIT codes | App-level only |
| **Satispay** | N/A | Mobile payment | N/A | N/A |
| **Scalapay** | N/A | BNPL checkout | Managed by Scalapay | N/A |

**Cost Comparison (Marketplace):**

| Provider | Est. Fee (€100) | Marketplace Support |
|----------|-----------------|---------------------|
| Mangopay | ~€1.38 | Native (wallets) |
| Stripe Connect | ~€1.90 | Native (Connect) |
| PayPal Commerce | ~€3.25 | Native (disbursements) |
| Nexi XPay | ~€1.50 | App-level only |
| Axerve | ~€1.50 | App-level only |

**Architecture (Dual-Level: Platform + Tenant):**

```
vinc-commerce-suite/src/
│
├── app/api/vinc-admin/payments/    # SUPER ADMIN (platform-wide)
│   ├── commissions/                # Platform commission tracking & payouts
│   ├── tenants/[tenantId]/         # Per-tenant config override & monitoring
│   ├── service-packages/           # Dynamic subscription packages
│   ├── subscriptions/              # All subscriptions (cross-tenant)
│   ├── split/                      # Multi-vendor split payments
│   ├── connect/                    # Provider onboarding (Stripe/Mangopay/PayPal)
│   └── webhooks/                   # Provider webhooks
│
├── app/api/b2b/payments/           # TENANT-LEVEL (per-tenant)
│   ├── config/                     # Tenant's own gateway configuration
│   ├── gateways/[provider]/        # Provider credentials & status
│   ├── transactions/               # Own transaction history & export
│   ├── moto/                       # MOTO terminal (phone orders)
│   ├── recurring/                  # Contracts & tokens
│   └── subscriptions/              # Tenant's own VINC subscription
│
├── app/b2b/(protected)/
│   ├── vinc-admin/payments/        # Super admin payment dashboard UI
│   └── payments/                   # Tenant payment management UI
│       ├── gateways/               # Configure Nexi, Axerve, Stripe, etc.
│       ├── moto/                   # MOTO terminal page
│       └── transactions/           # Transaction history
│
├── lib/payments/
│   ├── providers/                  # Stripe, Mangopay, PayPal, Nexi, Axerve
│   ├── payment.service.ts
│   ├── commission.service.ts
│   └── subscription.service.ts
│
└── models/                         # Payment-related MongoDB models
```

**Frontend Package:**
```
packages/vinc-payments-client/
├── components/
│   ├── PaymentForm.tsx
│   ├── StripeCheckout.tsx
│   ├── PayPalButton.tsx
│   └── subscriptions/
│       ├── PlanSelector.tsx
│       └── SubscriptionCheckout.tsx
└── hooks/
    ├── usePayment.ts
    └── useSubscription.ts
```

---

### 2. Reminder Data Source + Shared Product Search Preview
**Status:** 📋 Planned
**Plan File:** `~/.claude/plans/temporal-purring-sonnet.md`

Add "reminder" as 4th data source to Product Carousel blocks and extract duplicated search preview into a shared component.

- **Part A:** Add `"reminder"` option to home builder, mobile builder, and type definitions
- **Part B:** Extract `ProductSearchPreview` shared component, reuse in both builders

**Files:** 1 new, 3 modified

---

### 3. Coupon Discount + Promotion System
**Status:** 📋 Planned
**Plan File:** `~/.claude/plans/zany-hugging-hearth.md`

Code-based coupons and auto-apply promotion engine with gift item support.

**Coupon Types (code-based):**

| Type | Effect |
|------|--------|
| Percentage | % off order subtotal |
| Fixed Amount | EUR X off subtotal |
| Free Shipping | Shipping cost = 0 |
| Buy X Get Y | Buy product A, get product B free |
| Free Gift | Add specific product as gift line |

**Promotion Types (auto-apply):**

| Type | Effect |
|------|--------|
| Buy X Get Y | Auto-add gift when trigger qty met |
| Gift with Purchase | Auto-add gift when trigger product in cart |
| Tiered Discount | Progressive % off by quantity thresholds |
| Bundle Discount | % off when all bundle products present |

**Integration:** Reuses existing `ICartDiscount` for monetary discounts and `is_gift_line` for free items. No changes to `recalculateOrderTotals()`.

**Files:** 14 new, 4 modified

---

## Related Packages

### vinc-cdn
**Location:** `../../packages/vinc-cdn`
**Status:** ✅ Published to npm

Shared CDN utilities for file uploads (IBM Cloud Object Storage / S3-compatible).

---

## Quick Links

| Resource | Path |
|----------|------|
| Payment Plan | `~/.claude/plans/enchanted-toasting-sketch.md` |
| Reminder + Search Preview Plan | `~/.claude/plans/temporal-purring-sonnet.md` |
| Coupon + Promotion Plan | `~/.claude/plans/zany-hugging-hearth.md` |
| CDN Config | `src/lib/services/cdn-config.ts` |
| Order Service | `src/lib/services/order.service.ts` |
| Queue System | `src/lib/queue/queues.ts` |
| Workers | `src/lib/workers/` |

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Complete | Implementation finished |
| 🔄 In Progress | Currently being worked on |
| 📋 Planned | Designed but not started |
| ⏸️ On Hold | Temporarily paused |
