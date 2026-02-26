/**
 * Reminder System Constants
 */

export const REMINDER_STATUSES = ["active", "notified", "expired", "cancelled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const REMINDER_STATUS_LABELS: Record<ReminderStatus, string> = {
  active: "Attivo",
  notified: "Notificato",
  expired: "Scaduto",
  cancelled: "Annullato",
};

export const REMINDER_DEFAULTS = {
  EXPIRES_IN_DAYS: 30,
  MAX_EXPIRES_DAYS: 365,
} as const;

export const REMINDER_PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const REMINDER_CACHE_TTL = 3600; // 1 hour in seconds
