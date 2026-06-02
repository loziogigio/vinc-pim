/**
 * Order dashboard stats computation.
 *
 * The orders dashboard ("orders today/week/month", status breakdown, revenue,
 * conversion, optional previous-period comparison and daily revenue series) is
 * built from a handful of MongoDB aggregations over the tenant's order set.
 *
 * This service owns those aggregations and the assembly of the stats object so
 * the GET /api/b2b/orders route stays thin. The route still owns the live order
 * list (find + count) and the short-TTL stats cache around computeOrderStats().
 */
import type { Model } from "mongoose";

// Orders that have made it past the confirmation stage. Used for "Orders today/week/month"
// counts where drafts, pending, cancelled, and deleted should not be considered real sales.
export const CONFIRMED_AND_BEYOND = [
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
];

// Orders that contribute to revenue / short summaries. Drafts (carts), quotations,
// cancellations, and soft-deleted records are excluded. Pending is kept since it's a
// real order awaiting confirmation.
export const REVENUE_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
];

/**
 * Empty stats block returned by the GET handler's early-return paths
 * (customer_code / address_code not found, public_code with no matches) so the
 * response shape stays identical to a fully-computed stats object. Spread it
 * (`stats: { ...EMPTY_ORDER_STATS }`) to avoid sharing a mutable reference.
 */
export const EMPTY_ORDER_STATS = {
  draft: 0,
  quotation: 0,
  pending: 0,
  confirmed: 0,
  preparing: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
  deleted: 0,
  total: 0,
  totalValue: 0,
  valueByStatus: {
    draft: 0,
    quotation: 0,
    pending: 0,
    confirmed: 0,
    preparing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    deleted: 0,
  },
  timePeriods: {
    today: 0,
    todayValue: 0,
    thisWeek: 0,
    thisWeekValue: 0,
    thisMonth: 0,
    thisMonthValue: 0,
  },
  avgOrderValue: 0,
  conversion: {
    totalDrafts: 0,
    submittedOrders: 0,
    conversionRate: 0,
  },
};

export interface ComputeOrderStatsOptions {
  compare: boolean;
  daily: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}

/**
 * Compute the orders-dashboard stats for a given filter scope.
 *
 * `baseQuery` is the search-free, status-free query describing the scope (tenant
 * + date + …). Runs the status/time-period facet plus the optional previous-period
 * and daily-revenue aggregations in parallel, then assembles the stats object.
 */
export async function computeOrderStats(
  OrderModel: Model<unknown>,
  baseQuery: Record<string, unknown>,
  opts: ComputeOrderStatsOptions,
): Promise<Record<string, unknown>> {
  const { compare, daily, dateFrom, dateTo } = opts;

  // Compute date boundaries for time-period metrics
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  const dow = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
  weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Optional previous-period aggregation. Built upfront so it can run in parallel with the main batch.
  let prevAggPromise: Promise<unknown[]> = Promise.resolve([]);
  if (compare && dateFrom && dateTo) {
    const fromMs = new Date(dateFrom).getTime();
    const toMs = new Date(dateTo).getTime();
    if (!Number.isNaN(fromMs) && !Number.isNaN(toMs) && toMs >= fromMs) {
      const spanMs = toMs - fromMs;
      const prevFrom = new Date(fromMs - spanMs - 24 * 60 * 60 * 1000);
      const prevTo = new Date(fromMs - 1);
      // Drop the current-period date filter from baseQuery; match the previous
      // window on the effective date (submitted_at, falling back to created_at).
      const { $and: _omitDateAnd, ...prevBaseQuery } = baseQuery as Record<
        string,
        unknown
      >;
      prevAggPromise = OrderModel.aggregate([
        {
          // Match the previous window on the REAL date fields (not a computed
          // _eff_date) so the {tenant_id, submitted_at} / {tenant_id, created_at}
          // indexes bound it — otherwise this scanned the tenant's entire order
          // history on every comparison.
          $match: {
            ...prevBaseQuery,
            $or: [
              { submitted_at: { $gte: prevFrom, $lte: prevTo } },
              {
                submitted_at: null,
                created_at: { $gte: prevFrom, $lte: prevTo },
              },
            ],
          },
        },
        {
          $group: {
            _id: null,
            revenueCount: {
              $sum: { $cond: [{ $in: ["$status", REVENUE_STATUSES] }, 1, 0] },
            },
            revenueValue: {
              $sum: {
                $cond: [
                  { $in: ["$status", REVENUE_STATUSES] },
                  "$order_total",
                  0,
                ],
              },
            },
            drafts: {
              $sum: { $cond: [{ $eq: ["$status", "draft"] }, 1, 0] },
            },
          },
        },
      ]);
    }
  }

  // Optional daily-revenue series for the sparkline. Same as above — parallelizable.
  const dailyPromise: Promise<
    Array<{ _id: string; value: number; count: number }>
  > = daily
    ? OrderModel.aggregate([
        { $match: { ...baseQuery, status: { $in: REVENUE_STATUSES } } },
        {
          $addFields: {
            _eff_date: { $ifNull: ["$submitted_at", "$created_at"] },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$_eff_date" },
            },
            value: { $sum: "$order_total" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
    : Promise.resolve([]);

  // Aggregate stats with $facet: status breakdown + time periods.
  const statsAggPromise: Promise<Record<string, unknown>[]> =
    OrderModel.aggregate([
      { $match: baseQuery },
      // Effective date for time-period metrics: submission date, falling back
      // to creation date for orders that were never submitted.
      {
        $addFields: {
          _eff_date: { $ifNull: ["$submitted_at", "$created_at"] },
        },
      },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                value: { $sum: "$order_total" },
              },
            },
          ],
          timePeriods: [
            {
              $group: {
                _id: null,
                today: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", todayStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                todayValue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", todayStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      "$order_total",
                      0,
                    ],
                  },
                },
                thisWeek: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", weekStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                thisWeekValue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", weekStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      "$order_total",
                      0,
                    ],
                  },
                },
                thisMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", monthStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                thisMonthValue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $gte: ["$_eff_date", monthStart] },
                          { $in: ["$status", CONFIRMED_AND_BEYOND] },
                        ],
                      },
                      "$order_total",
                      0,
                    ],
                  },
                },
                nonDraftValue: {
                  $sum: {
                    $cond: [
                      { $in: ["$status", REVENUE_STATUSES] },
                      "$order_total",
                      0,
                    ],
                  },
                },
                nonDraftCount: {
                  $sum: {
                    $cond: [{ $in: ["$status", REVENUE_STATUSES] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]);

  const [statsAgg, prevAgg, dailySeries] = await Promise.all([
    statsAggPromise,
    prevAggPromise,
    dailyPromise,
  ]);

  // Calculate stats from $facet aggregation
  const facetResult = statsAgg[0] || { byStatus: [], timePeriods: [] };
  const byStatus = facetResult.byStatus || [];
  const tp = facetResult.timePeriods?.[0] || {};

  const stats: Record<string, unknown> = {
    draft: 0,
    quotation: 0,
    pending: 0,
    confirmed: 0,
    preparing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    deleted: 0,
    total: 0,
    totalValue: 0,
    valueByStatus: {
      draft: 0,
      quotation: 0,
      pending: 0,
      confirmed: 0,
      preparing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      deleted: 0,
    },
    timePeriods: {
      today: tp.today || 0,
      todayValue: tp.todayValue || 0,
      thisWeek: tp.thisWeek || 0,
      thisWeekValue: tp.thisWeekValue || 0,
      thisMonth: tp.thisMonth || 0,
      thisMonthValue: tp.thisMonthValue || 0,
    },
    avgOrderValue:
      tp.nonDraftCount > 0
        ? Math.round((tp.nonDraftValue / tp.nonDraftCount) * 100) / 100
        : 0,
    conversion: {
      totalDrafts: 0,
      submittedOrders: 0,
      conversionRate: 0,
    },
  };

  const statusCounts = stats as Record<string, number>;
  const valueByStatus = stats.valueByStatus as Record<string, number>;
  const conversion = stats.conversion as {
    totalDrafts: number;
    submittedOrders: number;
    conversionRate: number;
  };

  byStatus.forEach((s: { _id: string; count: number; value: number }) => {
    if (s._id in statusCounts && s._id !== "total" && s._id !== "totalValue") {
      statusCounts[s._id] = s.count;
    }
    if (s._id in valueByStatus) {
      valueByStatus[s._id] = s.value || 0;
    }
    // `total` keeps its "all documents in scope" meaning so filter-clear buttons stay correct.
    statusCounts.total = (statusCounts.total || 0) + s.count;
    // `totalValue` is the revenue summary: drafts (carts), cancellations, and soft-deleted
    // records do not contribute. Quotation/pending remain since they may still close.
    if (REVENUE_STATUSES.includes(s._id)) {
      statusCounts.totalValue = (statusCounts.totalValue || 0) + (s.value || 0);
    }

    if (s._id === "draft") {
      conversion.totalDrafts = s.count;
    } else if (CONFIRMED_AND_BEYOND.includes(s._id) || s._id === "pending") {
      conversion.submittedOrders += s.count;
    }
  });

  const convTotal = conversion.totalDrafts + conversion.submittedOrders;
  conversion.conversionRate =
    convTotal > 0
      ? Math.round((conversion.submittedOrders / convTotal) * 1000) / 10
      : 0;

  if (Array.isArray(prevAgg) && prevAgg.length > 0) {
    const prev = (prevAgg[0] || {}) as {
      revenueCount?: number;
      revenueValue?: number;
      drafts?: number;
    };
    const prevAvg =
      (prev.revenueCount ?? 0) > 0
        ? Math.round(
            ((prev.revenueValue ?? 0) / (prev.revenueCount ?? 1)) * 100,
          ) / 100
        : 0;
    const prevConvTotal = (prev.drafts || 0) + (prev.revenueCount || 0);
    const prevConversionRate =
      prevConvTotal > 0
        ? Math.round(((prev.revenueCount || 0) / prevConvTotal) * 1000) / 10
        : 0;
    (stats as Record<string, unknown>).previousPeriod = {
      total: prev.revenueCount || 0,
      totalValue: prev.revenueValue || 0,
      avgOrderValue: prevAvg,
      conversionRate: prevConversionRate,
    };
  }

  if (daily) {
    (stats as Record<string, unknown>).revenueByDay = dailySeries.map((d) => ({
      date: d._id,
      value: d.value || 0,
      count: d.count || 0,
    }));
  }

  return stats;
}
