# B2B storefront runtime configuration

Commerce Suite super-admin is the control plane for tenant-wide vinc-b2b
runtime defaults. vinc-b2b reads the shared `vinc-admin.tenants` collection
directly when it resolves a request hostname.

## Registry contract

```json
{
  "b2b_theme": "default",
  "features": {
    "pricing_source": "inline"
  },
  "api": {
    "pim_api_url": "https://cs.example.com",
    "b2b_api_url": "https://legacy-b2b.example.com",
    "erp_url": "https://user:password@erp.example.com/service"
  }
}
```

| Registry path             | Values                    | Default   | Purpose                                          |
| ------------------------- | ------------------------- | --------- | ------------------------------------------------ |
| `b2b_theme`               | `default`, `time`         | `default` | Selects a compiled vinc-b2b component theme.     |
| `features.pricing_source` | `inline`, `erp`, `hybrid` | `inline`  | Selects the product price-data origin.           |
| `api.erp_url`             | URL                       | unset     | Optional direct server-side ERP/MyMB connection. |

`settings.features` is a separate legacy Commerce Suite feature-id array. It
must not be used for the storefront pricing source.

## Theme versus home content template

`b2b_theme` selects compiled application components (`default` or `time`). It
does not select the versioned page-builder content stored in the tenant's home
template collection. Home content continues to use the `home-page` template
and its draft/publish workflow.

Adding another value to the super-admin selector is not sufficient to add a
theme: the corresponding vinc-b2b components must exist and be deployed first.

There is a separate read/write mismatch to resolve before super-admin can
select home-content presets: the newer portal builder publishes portal-scoped
`templateId: "home"`, while vinc-b2b currently renders a direct Mongo lookup of
`templateId: "home-page"` and does not consume the `homeTemplate` returned by
the public-home response. That migration is intentionally not represented by
`b2b_theme`.

## Price sources

- `inline`: use PIM product and packaging pricing already returned by Commerce
  Suite. This is the explicit default and does not make an ERP price request.
- `erp`: request customer-specific price and availability data from ERP.
- `hybrid`: paint inline data first and overlay customer-specific ERP values
  when the ERP response arrives.

An explicit tenant value overrides vinc-b2b's theme and deployment fallbacks.
This keeps the super-admin tenant record authoritative and avoids behavior
changing when a deployment-level environment variable changes.

New tenants are provisioned explicitly as `default` + `inline`. Existing
registry rows with no `features.pricing_source` are not silently backfilled:
the super-admin shows an inherited-fallback state until an operator makes a
choice. Migrate existing `time`/ERP tenants to explicit `erp` deliberately;
the current multi-tenant deployment fallback is ERP. Unset or nonstandard
legacy theme/source values are also left unchanged by unrelated super-admin
saves; selecting a supported value performs the migration deliberately.

## Current ERP routing constraint

ERP transport is not yet independent of the visual theme in vinc-b2b:

- `time` uses the secured in-app direct ERP route and prefers `api.erp_url`;
- `default` uses the legacy B2B proxy route and `api.b2b_api_url`.

The super-admin UI exposes this constraint. A future runtime cleanup should
select ERP transport by configured provider/capability instead of by theme.
Commerce Suite's `TenantPricingConfig` provider subsystem is currently separate
from the price path used by vinc-b2b.

## Inline pricing trust boundary

The public vinc-b2b PIM proxy must not turn browser-provided customer context
into a privileged Commerce Suite request. For search requests it validates the
same-tenant SSO session, removes browser `authenticated`/`tag_filter` values,
and forwards `customer_code` + `address_code` only when the exact pair belongs
to that session. Anonymous requests continue as guest catalog requests; an
authenticated user selecting a foreign pair receives `403`.

Commerce Suite additionally derives private-content visibility from a verified
Suite session or a signed SSO bearer plus its active same-tenant session. It
does not trust `x-user-id`/`x-user-type` or the API key as proof of an end user.
For API-key searches it accepts a customer/address pair only when that active
session profile owns both values and the live active portal-user record still
grants those internal customer/address IDs. Portal login also builds the
profile using `customer_access.address_access`. This intersection constrains
sessions created before the fix and makes access removal/deactivation effective
without waiting for session expiry. The SSO validation endpoint returns this
live-filtered profile as well, so B2B and non-search proxy paths see the same
permissions. Empty tag sets are still filtered, fallback internal IDs work when
ERP codes are absent, unknown addresses have no pricing context, and unmatched
tagged prices/promotions and their derived promo metadata are removed with their
packaging tiers. Reconstructing a public package price never carries fields over
from a rejected tagged top-level price.

Promotion facet buckets (`promo_type`, `promo_code`, `has_active_promo`) are
still catalog-level Solr metadata rather than customer-tag-authorized counts.
They contain no price values, but deployments that treat promotion codes as
sensitive should disable those facets until tag-aware facet indexing exists.

Browser and SSR calls forward the SSO bearer to Commerce Suite for this second
validation. Credentialed SSR product fetches use `no-store`; guest product
fetches keep the shared tenant cache. The SSR cache hydrates a neutral customer
context because the selected customer/address is browser-local; the client
refetches under its customer-scoped query key when a selection exists.

For a rolling release, deploy the vinc-b2b proxy/SSR bearer forwarding first
and Commerce Suite second. The hardened B2B instance still sends the derived
compatibility flag to an older Suite, while the hardened Suite requires the
forwarded bearer rather than trusting proxy user headers.

## Updates and cache

The admin PATCH endpoint validates both enums. `updateTenant()` writes nested
feature paths so other flags such as `features.is_demo` are preserved, then
merges API connection fields so partial ERP updates cannot erase PIM
credentials, and calls vinc-b2b's authenticated tenant-cache clear endpoint.
If notification delivery fails, vinc-b2b's normal registry cache TTL remains
the fallback.
The proxy's category and promotion-label caches include the tenant ID so tenants
sharing one Commerce Suite base URL cannot reuse each other's cached metadata.
That cache is currently process-local: in a multi-replica deployment, only the
replica receiving the clear request is invalidated immediately and other
replicas can retain the old value until the five-minute TTL expires. Use
replica-wide invalidation before requiring immediate global consistency.
