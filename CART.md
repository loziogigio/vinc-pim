# VINC Cart Implementation Plan

**Version:** 1.0  
**Date:** December 22, 2025  
**Status:** Active Plan  

---

## Overview

Cart is a **unified order document** with `status: "draft"`. No separate cart entity — same document evolves through entire lifecycle (cart → quote → order → invoice).

---

## Priority Roadmap

### P0: B2B Order Fulfillment (December 2025)

Core flow: **Add → Price → Quote → Confirm → ERP**

| Feature | Status | Notes |
|---------|--------|-------|
| Add item | Planned | `POST /orders/{id}/items` |
| Update quantity | Planned | `PATCH /orders/{id}/items/{item_id}` |
| Remove item | Planned | `DELETE /orders/{id}/items/{item_id}` |
| Get cart | Planned | `GET /orders/{id}` |
| Create cart | Planned | `POST /orders` (creates draft) |
| ERP real-time pricing | Planned | Windmill resolver |
| Customer-specific pricing | Planned | customer_code passed to ERP |
| Quote workflow | Planned | draft → quote_sent → quote_accepted |
| Goal-based cart discounts | Planned | Tiered, category mix, brand mix |
| Credit terms | Planned | Net 30/60/90 via CreditService |
| Order → ERP export | Planned | Windmill order_export |
| **Cart notes / PO reference** | **Add** | Trivial, high B2B value |
| **Pathway tracking** | **Add** | Store now, analyze later |

---

### P1: B2B Enhanced (January-February 2026)

| Feature | Why | Complexity |
|---------|-----|------------|
| Saved drafts / templates | "Repeat last order" — big for B2B | Low |
| Cart provenance / audit trail | Who added what, when (purchasing teams) | Low |
| Reorder from past order | Quick refill flow | Low |
| Cost center field | B2B accounting integration | Trivial |

---

### P2: B2B2C Extensions (Q1-Q2 2026)

| Feature | Why | Complexity |
|---------|-----|------------|
| Multi-supplier cart split | One cart → N supplier sub-orders | Medium |
| Cart merge (guest → login) | UX for anonymous browsing | Low |
| Dropship flag per line | Fulfillment routing | Low |
| Quotation bundles | Per-supplier quote lines | Medium |

---

### P3: Analytics & Tracking (Parallel with P0)

| Feature | When | Notes |
|---------|------|-------|
| Pathway tracking fields | P0 | Store on line item |
| Matomo event mapping | P0 | Standard dimensions |
| flow_id for shopping missions | P1 | Group user intent |

---

### P4: Nice to Have (Future)

| Feature | Notes |
|---------|-------|
| Cart sharing (token/link) | B2B collaboration |
| Multiple ship addresses per order | Complex fulfillment |
| Wishlist | Separate intent object or tagged draft |
| Cart expiration / cleanup | MongoDB TTL + soft warnings |
| Shipping estimator | Only if logistics complexity demands |

---

## Cart Line Item Schema

### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| item_id | string | Unique line identifier |
| sku | string | Product SKU |
| quantity | int | Quantity |
| unit_price | decimal | Price from ERP |
| subtotal | decimal | quantity × unit_price |
| added_at | datetime | When added |

### B2B Fields (P0)

| Field | Type | Description |
|-------|------|-------------|
| notes | string | Line-level notes |
| po_reference | string | Customer PO number |
| cost_center | string | For B2B accounting |

### Pathway Tracking Fields (P0)

| Field | Type | Description |
|-------|------|-------------|
| trigger_page | string | Where add happened |
| trigger_id | string | Page/entity ID |
| trigger_action | string | What user did |
| trigger_placement | string | UI element clicked |
| path_steps | array | Journey (last 5 steps) |
| flow_id | string | Shopping mission ID |
| session_id | string | Frontend session |

---

## Pathway Tracking Detail

### Trigger Page Values (Canonical)

| Value | Description |
|-------|-------------|
| `pdp` | Product detail page |
| `plp` | Product listing / category page |
| `search` | Search results (ELIA/Solr) |
| `quote` | Quote import/accept |
| `quick_order` | SKU entry / bulk paste |
| `reorder` | Past order repeat |
| `barcode` | Mobile scan |
| `rec` | Recommendation / cross-sell |
| `external` | Deep link / QR code |

### Trigger Action Values

| Value | Description |
|-------|-------------|
| `add_to_cart` | Standard add |
| `import_lines` | From quote acceptance |
| `reorder_all` | Repeat entire past order |
| `reorder_item` | Single item from past order |
| `quick_add` | From quick order form |
| `scan_add` | From barcode scan |

### Trigger Placement Values

| Value | Description |
|-------|-------------|
| `main_cta` | Primary add button |
| `row_action` | Inline row button (listings) |
| `carousel_1` | First carousel position |
| `modal_confirm` | Modal confirmation |
| `bulk_submit` | Bulk order form |

### Path Steps Structure

Last 5 navigation steps before add:

```
[
  {"type": "dem", "id": "dem-44"},
  {"type": "dening", "id": "den-12"},
  {"type": "pdp", "id": "SKU123"}
]
```

### Displayable Path String

Format: `{step1} > {step2} > {trigger} | {action}:{placement}`

Example:
```
dem:dem-44 > dening:den-12 > pdp:SKU123 | add_to_cart:main_cta
```

Use for: Admin UI, debug logs, Matomo event name

---

## Matomo Event Mapping

### Cart Events

| Action | When |
|--------|------|
| `AddItem` | Item added to cart |
| `RemoveItem` | Item removed |
| `UpdateQty` | Quantity changed |
| `CreateDraft` | New cart created |
| `MergeCart` | Carts merged (P2) |
| `SplitBySupplier` | Multi-supplier split (P2) |
| `QuoteSent` | Quote sent to customer |
| `QuoteAccepted` | Quote accepted |

### Custom Dimensions

| Dimension | Value |
|-----------|-------|
| dim1 | tenant_id |
| dim2 | customer_code (hashed) |
| dim3 | order_id |
| dim4 | supplier_id |
| dim5 | trigger_page (entry source) |
| dim6 | flow_id |

### Event Structure

| Field | Value |
|-------|-------|
| Category | `Cart` |
| Action | See cart events above |
| Name | SKU or path string |
| Value | quantity or subtotal |

---

## Cart-Level Fields

### Core

| Field | Type | Description |
|-------|------|-------------|
| order_id | string | Unique identifier |
| status | string | `draft` for cart |
| tenant_id | string | Multi-tenant isolation |
| customer_id | string | Linked customer (optional for guest) |
| session_id | string | For guest carts |
| created_at | datetime | Cart creation |
| updated_at | datetime | Last modification |

### B2B Fields (P0)

| Field | Type | Description |
|-------|------|-------------|
| notes | string | Cart-level notes |
| po_reference | string | Customer PO number |
| cost_center | string | Default for all lines |
| requested_delivery_date | date | B2B delivery scheduling |

### Totals

| Field | Type | Description |
|-------|------|-------------|
| subtotal | decimal | Sum of line subtotals |
| discount | decimal | From goals / promotions |
| tax | decimal | Calculated tax |
| total | decimal | Final amount |
| currency | string | EUR, USD |

---

## Goal-Based Pricing (Cart-Level)

### Goal Types

| Type | Description | Example |
|------|-------------|---------|
| `min_value` | Tiered by cart value | €500=5%, €1000=10%, €2000=15% |
| `category_mix` | Buy from N categories | 3+ categories = 12% off |
| `brand_mix` | Multi-brand orders | 2+ brands = 8% off |
| `product_inclusion` | Specific SKUs required | Include SKU-X = 5% off |

### Goal Analysis Response

| Field | Description |
|-------|-------------|
| goals | List of evaluated goals |
| applicable_discount | Current discount earned |
| next_best_goal | Closest unmet goal |
| total_potential_savings | If all goals met |

---

## API Endpoints (P0)

### Cart CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders` | Create draft (cart) |
| GET | `/orders/{id}` | Get cart with items |
| POST | `/orders/{id}/items` | Add item |
| PATCH | `/orders/{id}/items/{item_id}` | Update quantity |
| DELETE | `/orders/{id}/items/{item_id}` | Remove item |

### Goals & Pricing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/orders/{id}/goals` | Get goal analysis |
| POST | `/pricing/calculate` | Calculate item price |

### Transitions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orders/{id}/send-quote` | draft → quote_sent |
| POST | `/orders/{id}/accept-quote` | quote_sent → quote_accepted |
| POST | `/orders/{id}/confirm` | → confirmed (Sales Order) |

---

## December 2025 Deliverables

### Must Ship

1. Cart CRUD (add/update/remove/get)
2. ERP pricing integration (Windmill)
3. Goal-based discounts (min_value tier at minimum)
4. Quote workflow (draft → sent → accepted)
5. Cart notes + PO reference fields
6. Pathway tracking fields (store on add)
7. Basic Matomo events (AddItem, RemoveItem, QuoteSent)

### Not in December

- Multi-supplier split
- Cart merge
- Saved templates
- Wishlist
- Cart sharing

---

## Open Questions

1. **Guest cart expiration** — How long before cleanup? (Suggest: 30 days)
2. **Path steps limit** — Confirm last 5 is enough
3. **flow_id generation** — Frontend or backend? (Suggest: frontend)
4. **Matomo vs PostHog** — Primary analytics tool? (Suggest: PostHog unified)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-22 | Initial plan |
