/**
 * Like System Types
 */

import type { LikeTimePeriod } from "@/lib/constants/like";

// --- Input types ---

export interface LikeInput {
  sku: string;
}

export interface BulkLikeStatusInput {
  skus: string[];
}

// --- Response types ---

export interface LikeResponse {
  sku: string;
  user_id: string;
  is_active: boolean;
  liked_at: string;
  total_likes: number;
}

export interface LikeStatusResponse {
  sku: string;
  is_liked: boolean;
  total_likes: number;
  liked_at?: string;
}

export interface LikeToggleResponse {
  sku: string;
  user_id: string;
  action: "liked" | "unliked";
  is_liked: boolean;
  total_likes: number;
}

export interface UserLikesResponse {
  likes: LikeStatusResponse[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface PopularProductResponse {
  sku: string;
  total_likes: number;
  last_liked_at?: string;
}

export interface TrendingProductResponse {
  sku: string;
  recent_likes: number;
  velocity_score: number;
}

export interface TrendingProductsResponse {
  products: TrendingProductResponse[];
  total_count: number;
  page: number;
  page_size: number;
  has_next: boolean;
  period: LikeTimePeriod;
}

export interface LikeAnalyticsResponse {
  period: LikeTimePeriod;
  total_likes: number;
  unique_users: number;
  unique_products: number;
  likes_in_period: number;
  top_products: PopularProductResponse[];
}
