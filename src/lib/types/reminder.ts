/**
 * Reminder System Types
 */

import type { ReminderStatus } from "@/lib/constants/reminder";

// --- Input types ---

export interface ReminderInput {
  sku: string;
  email?: string;
  push_token?: string;
  expires_in_days?: number;
}

export interface ReminderCancelInput {
  sku: string;
}

export interface BulkReminderStatusInput {
  skus: string[];
}

// --- Response types ---

export interface ReminderResponse {
  sku: string;
  user_id: string;
  status: ReminderStatus;
  email?: string;
  push_token?: string;
  expires_at?: string;
  created_at: string;
}

export interface ReminderStatusResponse {
  sku: string;
  has_active_reminder: boolean;
  status?: ReminderStatus;
  created_at?: string;
  expires_at?: string;
}

export interface ReminderToggleResponse {
  sku: string;
  user_id: string;
  action: "created" | "cancelled";
  has_active_reminder: boolean;
}

export interface UserRemindersResponse {
  reminders: ReminderResponse[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface ReminderStatsResponse {
  sku: string;
  active_count: number;
  notified_count: number;
  total_count: number;
}

export interface ReminderSummaryResponse {
  user_id: string;
  total_reminders: number;
  active: number;
  notified: number;
  expired: number;
  cancelled: number;
}
