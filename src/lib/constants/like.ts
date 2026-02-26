/**
 * Like System Constants
 */

export const LIKE_TIME_PERIODS = ["1d", "7d", "30d", "90d"] as const;
export type LikeTimePeriod = (typeof LIKE_TIME_PERIODS)[number];

export const LIKE_TIME_PERIOD_DAYS: Record<LikeTimePeriod, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const LIKE_TIME_PERIOD_LABELS: Record<LikeTimePeriod, string> = {
  "1d": "Ultimo giorno",
  "7d": "Ultima settimana",
  "30d": "Ultimo mese",
  "90d": "Ultimo trimestre",
};

export const LIKE_PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const LIKE_CACHE_TTL = 3600; // 1 hour in seconds
