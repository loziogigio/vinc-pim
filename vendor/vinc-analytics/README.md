# vinc-analytics

Shared customer-tracking convention for VINC apps: canonical event taxonomy,
cross-subdomain identity (`.vendereincloud.it` anonymousId), first/last-touch
campaign attribution, and thin RudderStack wrappers (browser + server).

Backend: RudderStack (`https://events.crm.vendereincloud.it`) → ClickHouse → Superset.

## Entries
- `vinc-analytics` — core: `EVENTS`, `initAnalytics`, `track/identify/page`, attribution helpers.
- `vinc-analytics/react` — `AnalyticsProvider`, `useAnalytics`, `PageTracker`.
- `vinc-analytics/server` — `serverTrack`, `serverIdentify` (ad-blocker-proof conversions).

Consent is the consuming app's responsibility: call `initAnalytics()` only when the
user has granted `analytics` consent; call `reset()` on withdrawal.
