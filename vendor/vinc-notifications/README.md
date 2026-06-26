# vinc-notifications

Single source of truth for VINC notification config types, the canonical flat-field
schema (`NOTIFICATION_SETTINGS_FIELDS`), the `recordToConfig` mapper, and Node transports
(email SMTP/Graph, SMS via provider registry, web push, FCM).

- `.` — client-safe: types, schema, mapper (no Node deps).
- `./server` — Node transports.

Vendored into vinc-commerce-suite via `pnpm sync:vendor` (see CS `scripts/sync-vendor.sh`).
