/**
 * B2B API Endpoints Configuration
 */

export const B2B_API_ENDPOINTS = {
  // Authentication
  LOGIN: '/api/b2b/login',
  LOGOUT: '/api/b2b/logout',
  SESSION: '/api/b2b/session',

  // Products
  SEARCH: '/api/b2b/search',
  PRODUCT_DETAIL: '/api/b2b/product',

  // User Management
  USERS: '/api/b2b/users',
  USER_PROFILE: '/api/b2b/profile',

  // Activity Logs
  ACTIVITY_LOGS: '/api/b2b/activity-logs',

  // Dashboard
  DASHBOARD_STATS: '/api/b2b/dashboard/stats',
} as const;

export type B2BAPIEndpoint = typeof B2B_API_ENDPOINTS[keyof typeof B2B_API_ENDPOINTS];
