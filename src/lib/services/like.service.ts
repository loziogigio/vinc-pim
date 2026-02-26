/**
 * Like Service
 *
 * Business logic for product likes (wishlist/favorites).
 * Uses atomic $inc on LikeStats for O(1) like counts.
 * Redis caching with 1-hour TTL and targeted invalidation.
 */

import { connectWithModels } from "@/lib/db/model-registry";
import { getRedis } from "@/lib/cache/redis-client";
import { LIKE_TIME_PERIOD_DAYS, LIKE_CACHE_TTL } from "@/lib/constants/like";
import type { LikeTimePeriod } from "@/lib/constants/like";
import type {
  LikeResponse,
  LikeStatusResponse,
  LikeToggleResponse,
  PopularProductResponse,
  TrendingProductResponse,
  TrendingProductsResponse,
  LikeAnalyticsResponse,
} from "@/lib/types/like";

// ============================================
// CACHE HELPERS
// ============================================

function statusCacheKey(tenantId: string, userId: string, sku: string) {
  return `likes:status:${tenantId}:${userId}:${sku}`;
}

function popularCacheKey(tenantId: string, limit: number, days: number) {
  return `likes:popular:${tenantId}:${limit}:${days}`;
}

function trendingCacheKey(tenantId: string, period: string, page: number, limit: number) {
  return `likes:trending:${tenantId}:${period}:${page}:${limit}`;
}

async function invalidateUserSkuCache(tenantId: string, userId: string, sku: string) {
  const redis = getRedis();
  await redis.del(statusCacheKey(tenantId, userId, sku));
}

// ============================================
// CORE OPERATIONS
// ============================================

/**
 * Add a like (upsert). If already active, returns existing.
 * Atomically increments LikeStats.
 */
export async function addLike(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<LikeResponse> {
  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);

  const existing = await ProductLike.findOne({
    tenant_id: tenantId,
    user_id: userId,
    sku,
  }).lean();

  if (existing && (existing as { is_active: boolean }).is_active) {
    const stats = await LikeStats.findOne({ tenant_id: tenantId, sku }).lean();
    return {
      sku,
      user_id: userId,
      is_active: true,
      liked_at: (existing as { liked_at: Date }).liked_at.toISOString(),
      total_likes: (stats as { total_likes: number } | null)?.total_likes || 0,
    };
  }

  // Upsert: reactivate or create
  const now = new Date();
  await ProductLike.findOneAndUpdate(
    { tenant_id: tenantId, user_id: userId, sku },
    { $set: { is_active: true, liked_at: now } },
    { upsert: true }
  );

  // Atomic increment on stats
  const stats = await LikeStats.findOneAndUpdate(
    { tenant_id: tenantId, sku },
    { $inc: { total_likes: 1 }, $set: { last_updated: now } },
    { upsert: true, new: true }
  ).lean();

  await invalidateUserSkuCache(tenantId, userId, sku);

  return {
    sku,
    user_id: userId,
    is_active: true,
    liked_at: now.toISOString(),
    total_likes: (stats as { total_likes: number }).total_likes,
  };
}

/**
 * Remove a like (soft delete). Atomically decrements LikeStats.
 */
export async function removeLike(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<{ removed: boolean; total_likes: number }> {
  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);

  const result = await ProductLike.findOneAndUpdate(
    { tenant_id: tenantId, user_id: userId, sku, is_active: true },
    { $set: { is_active: false } }
  );

  if (!result) {
    const stats = await LikeStats.findOne({ tenant_id: tenantId, sku }).lean();
    return { removed: false, total_likes: (stats as { total_likes: number } | null)?.total_likes || 0 };
  }

  // Atomic decrement (never below 0)
  const stats = await LikeStats.findOneAndUpdate(
    { tenant_id: tenantId, sku, total_likes: { $gt: 0 } },
    { $inc: { total_likes: -1 }, $set: { last_updated: new Date() } },
    { new: true }
  ).lean();

  await invalidateUserSkuCache(tenantId, userId, sku);

  return {
    removed: true,
    total_likes: (stats as { total_likes: number } | null)?.total_likes || 0,
  };
}

/**
 * Toggle like: add if not active, remove if active.
 */
export async function toggleLike(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<LikeToggleResponse> {
  const { ProductLike } = await connectWithModels(tenantDb);

  const existing = await ProductLike.findOne({
    tenant_id: tenantId,
    user_id: userId,
    sku,
    is_active: true,
  }).lean();

  if (existing) {
    const { total_likes } = await removeLike(tenantDb, tenantId, userId, sku);
    return { sku, user_id: userId, action: "unliked", is_liked: false, total_likes };
  }

  const result = await addLike(tenantDb, tenantId, userId, sku);
  return { sku, user_id: userId, action: "liked", is_liked: true, total_likes: result.total_likes };
}

// ============================================
// STATUS QUERIES
// ============================================

/**
 * Get like status for a single SKU (with Redis cache).
 */
export async function getLikeStatus(
  tenantDb: string,
  tenantId: string,
  userId: string,
  sku: string
): Promise<LikeStatusResponse> {
  const redis = getRedis();
  const cacheKey = statusCacheKey(tenantId, userId, sku);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);

  const [like, stats] = await Promise.all([
    ProductLike.findOne({ tenant_id: tenantId, user_id: userId, sku, is_active: true }).lean(),
    LikeStats.findOne({ tenant_id: tenantId, sku }).lean(),
  ]);

  const result: LikeStatusResponse = {
    sku,
    is_liked: !!like,
    total_likes: (stats as { total_likes: number } | null)?.total_likes || 0,
    liked_at: like ? (like as { liked_at: Date }).liked_at.toISOString() : undefined,
  };

  await redis.setex(cacheKey, LIKE_CACHE_TTL, JSON.stringify(result));
  return result;
}

/**
 * Bulk status check for multiple SKUs.
 */
export async function getBulkLikeStatus(
  tenantDb: string,
  tenantId: string,
  userId: string,
  skus: string[]
): Promise<LikeStatusResponse[]> {
  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);

  const [likes, statsArr] = await Promise.all([
    ProductLike.find({
      tenant_id: tenantId,
      user_id: userId,
      sku: { $in: skus },
      is_active: true,
    }).lean(),
    LikeStats.find({ tenant_id: tenantId, sku: { $in: skus } }).lean(),
  ]);

  const likeMap = new Map<string, { liked_at: Date }>();
  for (const l of likes) {
    const like = l as { sku: string; liked_at: Date };
    likeMap.set(like.sku, { liked_at: like.liked_at });
  }

  const statsMap = new Map<string, number>();
  for (const s of statsArr) {
    const stat = s as { sku: string; total_likes: number };
    statsMap.set(stat.sku, stat.total_likes);
  }

  return skus.map((sku) => {
    const like = likeMap.get(sku);
    return {
      sku,
      is_liked: !!like,
      total_likes: statsMap.get(sku) || 0,
      liked_at: like?.liked_at.toISOString(),
    };
  });
}

/**
 * Get current user's liked products (wishlist), paginated.
 */
export async function getUserLikes(
  tenantDb: string,
  tenantId: string,
  userId: string,
  page: number,
  limit: number
): Promise<{ likes: LikeStatusResponse[]; total_count: number }> {
  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);
  const skip = (page - 1) * limit;

  const query = { tenant_id: tenantId, user_id: userId, is_active: true };

  const [likes, total_count] = await Promise.all([
    ProductLike.find(query).sort({ liked_at: -1 }).skip(skip).limit(limit).lean(),
    ProductLike.countDocuments(query),
  ]);

  // Batch fetch stats for the returned SKUs
  const skus = likes.map((l) => (l as { sku: string }).sku);
  const statsArr = await LikeStats.find({ tenant_id: tenantId, sku: { $in: skus } }).lean();

  const statsMap = new Map<string, number>();
  for (const s of statsArr) {
    const stat = s as { sku: string; total_likes: number };
    statsMap.set(stat.sku, stat.total_likes);
  }

  return {
    likes: likes.map((l) => {
      const like = l as { sku: string; liked_at: Date };
      return {
        sku: like.sku,
        is_liked: true,
        total_likes: statsMap.get(like.sku) || 0,
        liked_at: like.liked_at.toISOString(),
      };
    }),
    total_count,
  };
}

// ============================================
// ANALYTICS / POPULAR / TRENDING
// ============================================

/**
 * Get popular products sorted by total likes (with Redis cache).
 */
export async function getPopularProducts(
  tenantDb: string,
  tenantId: string,
  limit: number,
  days: number
): Promise<PopularProductResponse[]> {
  const redis = getRedis();
  const cacheKey = popularCacheKey(tenantId, limit, days);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { ProductLike } = await connectWithModels(tenantDb);
  const since = new Date(Date.now() - days * 86400000);

  const results = await ProductLike.aggregate([
    { $match: { tenant_id: tenantId, is_active: true, liked_at: { $gte: since } } },
    { $group: { _id: "$sku", total_likes: { $sum: 1 }, last_liked_at: { $max: "$liked_at" } } },
    { $sort: { total_likes: -1 } },
    { $limit: limit },
    { $project: { _id: 0, sku: "$_id", total_likes: 1, last_liked_at: 1 } },
  ]);

  const response: PopularProductResponse[] = results.map((r) => ({
    sku: r.sku,
    total_likes: r.total_likes,
    last_liked_at: r.last_liked_at?.toISOString(),
  }));

  await redis.setex(cacheKey, LIKE_CACHE_TTL, JSON.stringify(response));
  return response;
}

/**
 * Get trending products (velocity-based) with pagination (with Redis cache).
 */
export async function getTrendingProducts(
  tenantDb: string,
  tenantId: string,
  period: LikeTimePeriod,
  page: number,
  limit: number
): Promise<TrendingProductsResponse> {
  const redis = getRedis();
  const cacheKey = trendingCacheKey(tenantId, period, page, limit);

  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const { ProductLike } = await connectWithModels(tenantDb);
  const days = LIKE_TIME_PERIOD_DAYS[period];
  const since = new Date(Date.now() - days * 86400000);
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: { tenant_id: tenantId, is_active: true, liked_at: { $gte: since } } },
    { $group: { _id: "$sku", recent_likes: { $sum: 1 } } },
    { $addFields: { velocity_score: { $divide: ["$recent_likes", days] } } },
    { $sort: { velocity_score: -1 as const } },
    {
      $facet: {
        results: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ];

  const [result] = await ProductLike.aggregate(pipeline);
  const products: TrendingProductResponse[] = (result.results || []).map(
    (r: { _id: string; recent_likes: number; velocity_score: number }) => ({
      sku: r._id,
      recent_likes: r.recent_likes,
      velocity_score: Math.round(r.velocity_score * 1000) / 1000,
    })
  );
  const total_count = result.total?.[0]?.count || 0;

  const response: TrendingProductsResponse = {
    products,
    total_count,
    page,
    page_size: limit,
    has_next: page * limit < total_count,
    period,
  };

  await redis.setex(cacheKey, LIKE_CACHE_TTL, JSON.stringify(response));
  return response;
}

/**
 * Get analytics summary for a time period.
 */
export async function getAnalytics(
  tenantDb: string,
  tenantId: string,
  period: LikeTimePeriod
): Promise<LikeAnalyticsResponse> {
  const { ProductLike, LikeStats } = await connectWithModels(tenantDb);
  const days = LIKE_TIME_PERIOD_DAYS[period];
  const since = new Date(Date.now() - days * 86400000);

  const [periodStats, totalLikes, topProducts] = await Promise.all([
    // Period aggregation
    ProductLike.aggregate([
      { $match: { tenant_id: tenantId, is_active: true, liked_at: { $gte: since } } },
      {
        $group: {
          _id: null,
          likes_in_period: { $sum: 1 },
          unique_users: { $addToSet: "$user_id" },
          unique_products: { $addToSet: "$sku" },
        },
      },
      {
        $project: {
          _id: 0,
          likes_in_period: 1,
          unique_users: { $size: "$unique_users" },
          unique_products: { $size: "$unique_products" },
        },
      },
    ]),
    // Total all-time likes
    LikeStats.aggregate([
      { $match: { tenant_id: tenantId } },
      { $group: { _id: null, total: { $sum: "$total_likes" } } },
    ]),
    // Top 10 products in period
    ProductLike.aggregate([
      { $match: { tenant_id: tenantId, is_active: true, liked_at: { $gte: since } } },
      { $group: { _id: "$sku", total_likes: { $sum: 1 }, last_liked_at: { $max: "$liked_at" } } },
      { $sort: { total_likes: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const ps = periodStats[0] || { likes_in_period: 0, unique_users: 0, unique_products: 0 };

  return {
    period,
    total_likes: totalLikes[0]?.total || 0,
    unique_users: ps.unique_users,
    unique_products: ps.unique_products,
    likes_in_period: ps.likes_in_period,
    top_products: topProducts.map((p: { _id: string; total_likes: number; last_liked_at?: Date }) => ({
      sku: p._id,
      total_likes: p.total_likes,
      last_liked_at: p.last_liked_at?.toISOString(),
    })),
  };
}
