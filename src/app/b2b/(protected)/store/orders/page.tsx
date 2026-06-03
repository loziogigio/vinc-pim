"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  ShoppingCart,
  Clock,
  CheckCircle,
  Truck,
  TrendingUp,
  TrendingDown,
  Package,
  Plus,
  AlertTriangle,
  Bell,
  Mail,
  ArrowRight,
  X,
  ChevronDown,
  Filter,
} from "lucide-react";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ── Types ──

interface DailyPoint {
  date: string;
  value: number;
  count: number;
}

interface PreviousPeriod {
  total: number;
  totalValue: number;
  avgOrderValue: number;
  conversionRate: number;
}

interface OrderStats {
  draft: number;
  quotation: number;
  pending: number;
  confirmed: number;
  preparing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
  deleted: number;
  total: number;
  totalValue: number;
  valueByStatus: Record<string, number>;
  timePeriods: {
    today: number;
    todayValue: number;
    thisWeek: number;
    thisWeekValue: number;
    thisMonth: number;
    thisMonthValue: number;
  };
  avgOrderValue: number;
  conversion: { totalDrafts: number; submittedOrders: number; conversionRate: number };
  previousPeriod?: PreviousPeriod;
  revenueByDay?: DailyPoint[];
}

interface RecentOrder {
  order_id: string;
  display_ref?: string;
  status: string;
  order_total: number;
  items_count: number;
  created_at: string;
  customer_name?: string;
  po_reference?: string;
}

interface DashboardFilters {
  datePreset: string;
  dateFrom: string;
  dateTo: string;
  channel: string;
}

const emptyStats: OrderStats = {
  draft: 0, quotation: 0, pending: 0, confirmed: 0, preparing: 0,
  shipped: 0, delivered: 0, cancelled: 0, deleted: 0, total: 0, totalValue: 0,
  valueByStatus: { draft: 0, quotation: 0, pending: 0, confirmed: 0, preparing: 0, shipped: 0, delivered: 0, cancelled: 0, deleted: 0 },
  timePeriods: { today: 0, todayValue: 0, thisWeek: 0, thisWeekValue: 0, thisMonth: 0, thisMonthValue: 0 },
  avgOrderValue: 0,
  conversion: { totalDrafts: 0, submittedOrders: 0, conversionRate: 0 },
};

const currencyFormat = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

// Plain (non-compact) currency with no decimals. Compact notation produces different output
// between Node ICU and browser ICU, which causes Next.js hydration mismatches in pipeline cards.
const compactCurrencyFormat = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

// Hours a confirmed order can wait before showing up in "needs attention".
const CONFIRMED_STALE_HOURS = 48;
// Hours a pending order can wait before flagging.
const PENDING_STALE_HOURS = 24;

// ── Date Preset Helpers ──

function getDateRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  switch (preset) {
    case "today":
      return { from: fmt(now), to: fmt(now) };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      return { from: d, to: d };
    }
    case "thisWeek": {
      const ws = new Date(now);
      const dow = ws.getDay();
      ws.setDate(ws.getDate() - (dow === 0 ? 6 : dow - 1));
      return { from: fmt(ws), to: fmt(now) };
    }
    case "thisMonth":
      return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(now) };
    case "thisQuarter": {
      const qm = Math.floor(now.getMonth() / 3) * 3;
      return { from: fmt(new Date(now.getFullYear(), qm, 1)), to: fmt(now) };
    }
    case "thisYear":
      return { from: fmt(new Date(now.getFullYear(), 0, 1)), to: fmt(now) };
    case "last7": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { from: fmt(d), to: fmt(now) };
    }
    case "last30": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { from: fmt(d), to: fmt(now) };
    }
    case "last90": {
      const d = new Date(now);
      d.setDate(d.getDate() - 89);
      return { from: fmt(d), to: fmt(now) };
    }
    default:
      return null;
  }
}

// ── Attention Hints (purely client-side, based on order shape) ──

type AttentionLevel = "danger" | "warning" | "info";

interface AttentionHint {
  level: AttentionLevel;
  /** Short tag like "attesa 52h" showing how long the order has waited. */
  label: string;
  icon: typeof Clock;
}

function hoursSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 36e5));
}

function attentionFor(order: RecentOrder, t: (k: string, p?: Record<string, string | number>) => string): AttentionHint | null {
  const hours = hoursSince(order.created_at);

  // Only stale orders awaiting action count as "needs attention":
  // confirmed orders sitting > 48h, and pending (In Attesa) orders > 24h.
  if (order.status === "confirmed" && hours >= CONFIRMED_STALE_HOURS) {
    return { level: "danger", label: t("pages.store.orders.waitHours", { hours }), icon: Clock };
  }
  if (order.status === "pending" && hours >= PENDING_STALE_HOURS) {
    return { level: "danger", label: t("pages.store.orders.waitHours", { hours }), icon: Clock };
  }
  return null;
}

// ── Area-line sparkline for the headline revenue card ──

function Sparkline({ points }: { points: DailyPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Measure the actual rendered width so the SVG viewBox matches the container
  // (avoids the letterboxing caused by preserveAspectRatio="meet").
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setWidth(Math.round(w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!points.length) {
    return (
      <div
        ref={wrapperRef}
        className="h-[340px] flex items-center justify-center text-xs text-muted-foreground/60"
      >
        —
      </div>
    );
  }
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  // Inset the plot so dots/labels at the first and last day don't get clipped at the edges.
  const padX = 24;
  const plotLeft = padX;
  const plotRight = width - padX;
  const plotWidth = Math.max(plotRight - plotLeft, 1);
  // Reserve label bands so dates / values don't crowd the line.
  const labelTop = 40;
  const labelBottom = 50;
  const plotHeight = 220;
  const height = labelTop + plotHeight + labelBottom;
  const plotBottom = labelTop + plotHeight;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : plotWidth;
  const slot = points.length > 0 ? width / points.length : width;

  const coords = points.map((p, i) => {
    const x = plotLeft + i * step;
    const y = plotBottom - 6 - ((p.value - min) / range) * (plotHeight - 12);
    return [x, y] as const;
  });

  // Adaptive: how often we surface a date tick / value label so we don't overlap text.
  const dateStep =
    points.length <= 7 ? 1 : points.length <= 14 ? 2 : points.length <= 31 ? 4 : points.length <= 60 ? 7 : 14;
  const valueStep =
    points.length <= 7 ? 1 : points.length <= 14 ? 2 : points.length <= 31 ? 3 : 0; // 0 = peaks only when dense
  const maxValueIndex = values.indexOf(max);

  // Pick which x-axis ticks to draw. Edges (first day + today) are always shown;
  // intermediate ticks are dropped if they would crowd those labels.
  const lastIdx = points.length - 1;
  const firstX = coords[0][0];
  const lastX = coords[lastIdx][0];
  const minTickGap = 64; // pixels; viewBox is now in real px
  const dateTickIndices = points
    .map((_, i) => i)
    .filter((i) => {
      if (i === 0 || i === lastIdx) return true;
      if (i % dateStep !== 0) return false;
      const x = coords[i][0];
      // Hide ticks that would crowd the first or last (today) label.
      return Math.abs(lastX - x) >= minTickGap && Math.abs(x - firstX) >= minTickGap;
    });

  const linePath = coords
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${plotBottom} L${coords[0][0]},${plotBottom} Z`;

  const hoveredPoint = hovered !== null ? points[hovered] : null;
  const hoveredCoord = hovered !== null ? coords[hovered] : null;
  // Flip the tooltip to the left of the cursor once the hovered day is past ~60% of the chart.
  const tooltipFlip = hovered !== null && hovered / Math.max(points.length - 1, 1) > 0.6;

  return (
    <div ref={wrapperRef} className="w-full">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="block w-full"
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
      role="img"
      aria-label="Revenue trend"
      onMouseLeave={() => setHovered(null)}
    >
      <defs>
        <linearGradient id="sparkline-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.45" />
          <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      {/* Soft baseline at the plot floor — only across the plot area, not the full viewBox. */}
      <line
        x1={plotLeft}
        x2={plotRight}
        y1={plotBottom - 0.5}
        y2={plotBottom - 0.5}
        stroke="hsl(var(--primary))"
        strokeOpacity="0.25"
        strokeWidth="1"
      />
      <path d={areaPath} fill="url(#sparkline-fill)" />
      <path
        d={linePath}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Always-visible dots at each data point. */}
      {coords.map(([x, y], i) => (
        <circle
          key={`dot-${points[i].date}`}
          cx={x}
          cy={y}
          r={points[i].value > 0 ? 2.5 : 1.5}
          fill="hsl(var(--primary))"
          opacity={points[i].value > 0 ? 1 : 0.4}
        />
      ))}

      {/* Value labels above notable points. */}
      {points.map((p, i) => {
        const showThis =
          valueStep > 0
            ? p.value > 0 && i % valueStep === 0
            : i === maxValueIndex && p.value > 0;
        if (!showThis) return null;
        const [x, y] = coords[i];
        const anchor: "start" | "middle" | "end" =
          i === 0 ? "start" : i === points.length - 1 ? "end" : "middle";
        return (
          <text
            key={`val-${p.date}`}
            x={x}
            y={Math.max(14, y - 8)}
            textAnchor={anchor}
            className="fill-foreground/80"
            style={{ fontSize: "11px", fontWeight: 500, fontFamily: "inherit" }}
          >
            {compactCurrencyFormat.format(p.value)}
          </text>
        );
      })}

      {/* X-axis date ticks. */}
      {dateTickIndices.map((i) => {
        const p = points[i];
        const [x] = coords[i];
        const isLast = i === lastIdx;
        const anchor: "start" | "middle" | "end" =
          i === 0 ? "start" : isLast ? "end" : "middle";
        return (
          <g key={`tick-${p.date}`}>
            <line
              x1={x}
              x2={x}
              y1={plotBottom}
              y2={plotBottom + 4}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={isLast ? 0.6 : 0.35}
              strokeWidth="1"
            />
            <text
              x={x}
              y={plotBottom + 16}
              textAnchor={anchor}
              className={isLast ? "fill-foreground" : "fill-muted-foreground"}
              style={{
                fontSize: "11px",
                fontFamily: "inherit",
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {new Date(p.date).toLocaleDateString("it-IT", {
                day: "numeric",
                month: "short",
              })}
            </text>
          </g>
        );
      })}

      {/* Hover guide + dot */}
      {hoveredCoord && hoveredPoint && (() => {
        const tooltipW = 220;
        const tooltipH = 56;
        const boxX = tooltipFlip
          ? Math.max(plotLeft, hoveredCoord[0] - 12 - tooltipW)
          : Math.min(plotRight - tooltipW, hoveredCoord[0] + 12);
        const boxY = Math.max(4, Math.min(plotBottom - tooltipH, hoveredCoord[1] - tooltipH / 2));
        return (
          <g pointerEvents="none">
            <line
              x1={hoveredCoord[0]}
              x2={hoveredCoord[0]}
              y1={labelTop}
              y2={plotBottom}
              stroke="hsl(var(--primary))"
              strokeOpacity="0.4"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <circle
              cx={hoveredCoord[0]}
              cy={hoveredCoord[1]}
              r="6"
              fill="hsl(var(--primary))"
              stroke="hsl(var(--card))"
              strokeWidth="2"
            />
            {/* Tooltip pill with background. */}
            <rect
              x={boxX}
              y={boxY}
              width={tooltipW}
              height={tooltipH}
              rx="8"
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth="1"
              style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.08))" }}
            />
            <text
              x={boxX + 12}
              y={boxY + 22}
              className="fill-foreground"
              style={{ fontSize: "14px", fontWeight: 600, fontFamily: "inherit" }}
            >
              {currencyFormat.format(hoveredPoint.value)}
            </text>
            <text
              x={boxX + 12}
              y={boxY + 42}
              className="fill-muted-foreground"
              style={{ fontSize: "11px", fontFamily: "inherit" }}
            >
              {new Date(hoveredPoint.date).toLocaleDateString("it-IT", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
              {` · ${hoveredPoint.count} ord.`}
            </text>
          </g>
        );
      })()}

      {/* Invisible hover catchers, one per day, spanning each day's slot. */}
      {points.map((p, i) => (
        <rect
          key={p.date}
          x={i * slot}
          y={0}
          width={slot}
          height={height}
          fill="transparent"
          onMouseEnter={() => setHovered(i)}
        />
      ))}
    </svg>
    </div>
  );
}

// ── Day-by-day bar chart ──

const BAR_SLOT = 80; // horizontal pixels per day
const BAR_WIDTH = 64;
const BAR_PLOT_HEIGHT = 220;
const BAR_LABEL_TOP = 110; // headroom for two-line diagonal value labels above bars
const BAR_LABEL_BOTTOM = 88; // headroom for diagonal date labels below bars

function DailyBars({ points }: { points: DailyPoint[] }) {
  if (!points.length) {
    return (
      <div className="h-[380px] flex items-center justify-center text-xs text-muted-foreground/60">
        —
      </div>
    );
  }

  const maxValue = Math.max(...points.map((p) => p.value), 1);
  const totalWidth = points.length * BAR_SLOT;
  const totalHeight = BAR_LABEL_TOP + BAR_PLOT_HEIGHT + BAR_LABEL_BOTTOM;
  const baselineY = BAR_LABEL_TOP + BAR_PLOT_HEIGHT;
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div
      className="overflow-x-scroll overflow-y-hidden"
      style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--muted-foreground) / 0.4) transparent" }}
    >
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        role="img"
        aria-label="Daily orders submitted"
        className="block"
      >
        {/* Faint baseline so empty days still read as a real day on the axis. */}
        <line
          x1={0}
          x2={totalWidth}
          y1={baselineY}
          y2={baselineY}
          stroke="hsl(var(--border))"
          strokeWidth="1"
        />

        {points.map((p, i) => {
          const isToday = p.date === todayKey;
          const isEmpty = p.value <= 0;
          const barHeight = isEmpty
            ? 6
            : Math.max(4, (p.value / maxValue) * (BAR_PLOT_HEIGHT - 16));
          const slotX = i * BAR_SLOT;
          const x = slotX + (BAR_SLOT - BAR_WIDTH) / 2;
          const y = baselineY - barHeight;
          const formattedDate = new Date(p.date).toLocaleDateString("it-IT", {
            weekday: "short",
            day: "numeric",
            month: "short",
          });
          const centerX = slotX + BAR_SLOT / 2;
          const valueLabelY = y - 12;
          const dateLabelY = baselineY + 24;
          return (
            <g key={p.date}>
              <title>{`${formattedDate} — ${p.count} ordini · ${currencyFormat.format(p.value)}`}</title>
              <rect
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barHeight}
                rx="6"
                fill={isEmpty ? "hsl(var(--muted-foreground))" : "hsl(var(--primary))"}
                opacity={isEmpty ? 0.25 : isToday ? 1 : 0.65}
                className="hover:opacity-100 transition-opacity"
              />
              {!isEmpty && (
                <text
                  x={centerX}
                  y={valueLabelY}
                  transform={`rotate(-45, ${centerX}, ${valueLabelY})`}
                  style={{ fontSize: "16px", fontFamily: "inherit" }}
                  textAnchor="start"
                >
                  <tspan x={centerX} className="fill-foreground/80 font-medium">
                    {compactCurrencyFormat.format(p.value)}
                  </tspan>
                  <tspan x={centerX} dy="1.2em" className="fill-muted-foreground">
                    ({p.count})
                  </tspan>
                </text>
              )}
              <text
                x={centerX}
                y={dateLabelY}
                transform={`rotate(-45, ${centerX}, ${dateLabelY})`}
                className="fill-muted-foreground"
                style={{ fontSize: "16px", fontFamily: "inherit" }}
                textAnchor="end"
              >
                {new Date(p.date).toLocaleDateString("it-IT", {
                  day: "numeric",
                  month: "short",
                })}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Subcomponents ──

interface DeltaProps {
  current: number;
  previous: number | undefined;
  /** "percent" → render "+12.4%", "absolute" → render "+8 vs ieri", "points" → "+1,8 pp". */
  format?: "percent" | "absolute" | "points";
  comparisonLabel?: string;
}

function Delta({ current, previous, format = "percent", comparisonLabel }: DeltaProps) {
  if (previous === undefined || previous === null) return null;
  const diff = current - previous;
  if (format === "percent" && previous === 0) {
    if (current === 0) return null;
  }
  const positive = diff > 0;
  const negative = diff < 0;
  const Icon = positive ? TrendingUp : negative ? TrendingDown : TrendingUp;
  const color = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : negative
    ? "text-red-600 dark:text-red-400"
    : "text-muted-foreground";

  let text = "";
  if (format === "percent") {
    const pct = previous === 0 ? 0 : (diff / previous) * 100;
    const sign = diff > 0 ? "+" : "";
    text = `${sign}${pct.toFixed(1).replace(".", ",")}%`;
  } else if (format === "points") {
    const sign = diff > 0 ? "+" : "";
    text = `${sign}${diff.toFixed(1).replace(".", ",")} pp`;
  } else {
    const sign = diff > 0 ? "+" : "";
    text = `${sign}${diff}`;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {text}
      {comparisonLabel ? <span className="text-muted-foreground font-normal ml-0.5">{comparisonLabel}</span> : null}
    </span>
  );
}

interface PipelineCardProps {
  icon: typeof ShoppingCart;
  label: string;
  count: number;
  amount: number;
  href: string;
  tone: "amber" | "blue" | "emerald" | "violet" | "orange" | "gray";
  highlight?: boolean;
  badge?: string;
}

const PIPELINE_TONES: Record<PipelineCardProps["tone"], { bg: string; text: string }> = {
  amber: { bg: "bg-amber-100 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300" },
  blue: { bg: "bg-blue-100 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300" },
  emerald: { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300" },
  violet: { bg: "bg-violet-100 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300" },
  orange: { bg: "bg-orange-100 dark:bg-orange-500/15", text: "text-orange-700 dark:text-orange-300" },
  gray: { bg: "bg-muted text-muted-foreground", text: "text-muted-foreground" },
};

function PipelineCard({ icon: Icon, label, count, amount, href, tone, highlight, badge }: PipelineCardProps) {
  const palette = PIPELINE_TONES[tone];
  return (
    <Link
      href={href}
      className={`relative rounded-lg bg-card border ${
        highlight ? "border-violet-300 dark:border-violet-500/40" : "border-border"
      } p-3 shadow-sm hover:shadow-md hover:border-foreground/20 transition`}
    >
      {badge ? (
        <span className="absolute -top-2 right-2 rounded-full bg-violet-600 text-white text-[9px] font-medium px-2 py-0.5 tracking-wider">
          {badge}
        </span>
      ) : null}
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-6 h-6 rounded-md flex items-center justify-center ${palette.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${palette.text}`} />
        </div>
        <span className="text-[11px] text-muted-foreground truncate">{label}</span>
      </div>
      <div className="text-xl font-semibold text-foreground leading-tight">{count}</div>
      <div className="text-[11px] text-muted-foreground">
        {compactCurrencyFormat.format(amount)}
      </div>
    </Link>
  );
}

interface KpiTileProps {
  label: string;
  value: string;
  delta?: React.ReactNode;
  caption?: string;
}

function KpiTile({ label, value, delta, caption }: KpiTileProps) {
  return (
    <div className="rounded-lg bg-card border border-border p-3 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <div className="text-xl font-semibold text-foreground">{value}</div>
        {delta}
      </div>
      {caption ? <div className="text-[10px] text-muted-foreground/80 mt-0.5">{caption}</div> : null}
    </div>
  );
}

// ── Main Component ──

const PERIOD_CHIPS = [
  { value: "today", labelKey: "pages.store.orders.chipToday" },
  { value: "last7", labelKey: "pages.store.orders.chip7d" },
  { value: "last30", labelKey: "pages.store.orders.chip30d" },
  { value: "thisYear", labelKey: "pages.store.orders.chipYTD" },
  { value: "custom", labelKey: "pages.store.orders.chipCustom" },
] as const;

export default function OrdersOverviewPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [stats, setStats] = useState<OrderStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [channels, setChannels] = useState<{ code: string; name: string }[]>([]);
  const [filters, setFilters] = useState<DashboardFilters>({
    datePreset: "last30",
    dateFrom: "",
    dateTo: "",
    channel: "",
  });

  useEffect(() => {
    fetch("/api/b2b/channels")
      .then((r) => r.json())
      .then((d) => setChannels(d.channels || []))
      .catch(() => {});
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    params.set("compare", "1");
    params.set("daily", "1");

    let dateFrom = filters.dateFrom;
    let dateTo = filters.dateTo;

    if (filters.datePreset !== "all" && filters.datePreset !== "custom") {
      const range = getDateRange(filters.datePreset);
      if (range) {
        dateFrom = range.from;
        dateTo = range.to;
      }
    }

    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (filters.channel) params.set("channel", filters.channel);

    return params.toString();
  }, [filters]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/b2b/orders?${queryString}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const apiStats = data.stats || {};
        const orders = (data.orders || []) as Array<{
          order_id: string;
          display_ref?: string;
          status: string;
          order_total: number;
          items?: unknown[];
          created_at: string;
          customer_name?: string;
          po_reference?: string;
        }>;

        setStats({
          ...emptyStats,
          ...apiStats,
          valueByStatus: { ...emptyStats.valueByStatus, ...apiStats.valueByStatus },
          timePeriods: { ...emptyStats.timePeriods, ...apiStats.timePeriods },
          conversion: { ...emptyStats.conversion, ...apiStats.conversion },
        });
        setRecentOrders(
          orders.map((o) => ({
            order_id: o.order_id,
            display_ref: o.display_ref,
            status: o.status,
            order_total: o.order_total,
            items_count: o.items?.length || 0,
            created_at: o.created_at,
            customer_name: o.customer_name,
            po_reference: o.po_reference,
          }))
        );
      } catch (error) {
        console.error("Error fetching order stats:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [queryString]);

  const updateFilter = useCallback((updates: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Derived data ──

  const attentionRows = useMemo(() => {
    return recentOrders
      .map((o) => ({ order: o, hint: attentionFor(o, t) }))
      .filter((r): r is { order: RecentOrder; hint: AttentionHint } => r.hint !== null)
      .sort((a, b) => {
        const w = { danger: 0, warning: 1, info: 2 } as const;
        return w[a.hint.level] - w[b.hint.level];
      });
  }, [recentOrders, t]);

  const confirmedStaleCount = attentionRows.filter((r) => r.order.status === "confirmed").length;
  const pendingStaleCount = attentionRows.filter((r) => r.order.status === "pending").length;

  // Filled daily series: API returns only days that had orders. For an honest
  // day-by-day chart we backfill missing days with zero-value entries spanning
  // the active filter window (or first/last observed dates as fallback).
  const dailySeries = useMemo<DailyPoint[]>(() => {
    const raw = stats?.revenueByDay;
    if (!raw || raw.length === 0) return [];

    let from = filters.dateFrom;
    let to = filters.dateTo;
    if (filters.datePreset !== "all" && filters.datePreset !== "custom") {
      const range = getDateRange(filters.datePreset);
      if (range) {
        from = range.from;
        to = range.to;
      }
    }
    if (!from) from = raw[0].date;
    if (!to) to = raw[raw.length - 1].date;

    const byDate = new Map(raw.map((p) => [p.date, p]));
    // Iterate in UTC so the YYYY-MM-DD keys round-trip cleanly. Using local-time
    // Dates with toISOString() shifts every key by the timezone offset and silently
    // drops today (e.g. CEST: local 16 May midnight → "2026-05-15" in UTC).
    const parseUtc = (iso: string): number | null => {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
      if (!m) return null;
      return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    };
    const startMs = parseUtc(from);
    const endMs = parseUtc(to);
    if (startMs === null || endMs === null || endMs < startMs) {
      return raw;
    }
    const out: DailyPoint[] = [];
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    for (let ms = startMs; ms <= endMs; ms += MS_PER_DAY) {
      const key = new Date(ms).toISOString().slice(0, 10);
      out.push(byDate.get(key) || { date: key, value: 0, count: 0 });
    }
    return out;
  }, [stats?.revenueByDay, filters.datePreset, filters.dateFrom, filters.dateTo]);

  const totalRevenue = stats?.totalValue || 0;
  const previousRevenue = stats?.previousPeriod?.totalValue;
  const avgOrder = stats?.avgOrderValue || 0;
  const previousAvg = stats?.previousPeriod?.avgOrderValue;
  const conversion = stats?.conversion?.conversionRate || 0;
  const previousConversion = stats?.previousPeriod?.conversionRate;

  const pipeline: PipelineCardProps[] = [
    {
      icon: ShoppingCart,
      label: t("pages.store.orders.activeCarts"),
      count: stats?.draft || 0,
      amount: stats?.valueByStatus?.draft || 0,
      href: `${tenantPrefix}/b2b/store/orders/carts`,
      tone: "amber",
    },
    {
      icon: Clock,
      label: t("pages.store.ordersList.pending"),
      count: stats?.pending || 0,
      amount: stats?.valueByStatus?.pending || 0,
      href: `${tenantPrefix}/b2b/store/orders/pending`,
      tone: "blue",
    },
    {
      icon: CheckCircle,
      label: t("pages.store.ordersList.confirmed"),
      count: stats?.confirmed || 0,
      amount: stats?.valueByStatus?.confirmed || 0,
      href: `${tenantPrefix}/b2b/store/orders/confirmed`,
      tone: "emerald",
    },
    {
      icon: Package,
      label: t("pages.store.ordersList.preparing"),
      count: stats?.preparing || 0,
      amount: stats?.valueByStatus?.preparing || 0,
      href: `${tenantPrefix}/b2b/store/orders/preparing`,
      tone: "violet",
      highlight: true,
      badge: t("pages.store.orders.badgeNew"),
    },
    {
      icon: Truck,
      label: t("pages.store.ordersList.shipped"),
      count: stats?.shipped || 0,
      amount: stats?.valueByStatus?.shipped || 0,
      href: `${tenantPrefix}/b2b/store/orders/shipped`,
      tone: "orange",
    },
    {
      icon: X,
      label: t("pages.store.ordersList.cancelled"),
      count: stats?.cancelled || 0,
      amount: stats?.valueByStatus?.cancelled || 0,
      href: `${tenantPrefix}/b2b/store/orders/cancelled`,
      tone: "gray",
    },
  ];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
      quotation: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
      pending: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
      confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
      preparing: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
      shipped: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
      delivered: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
      cancelled: "bg-gray-100 text-gray-700 dark:bg-muted dark:text-muted-foreground",
    };
    return styles[status] || "bg-muted text-muted-foreground";
  };

  const statusBadgeLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      draft: t("pages.store.orders.activeCarts"),
      quotation: t("pages.store.ordersList.quotation"),
      pending: t("pages.store.ordersList.pending"),
      confirmed: t("pages.store.ordersList.confirmed"),
      preparing: t("pages.store.orders.statusPreparingShort"),
      shipped: t("pages.store.ordersList.shipped"),
      delivered: t("pages.store.ordersList.delivered"),
      cancelled: t("pages.store.ordersList.cancelled"),
      abandoned: t("pages.store.orders.statusAbandoned"),
    };
    return labelMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="space-y-5">
      <Breadcrumbs items={[{ label: t("pages.store.orders.title") }]} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {t("pages.store.orders.dashboard")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("pages.store.orders.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t("pages.store.orders.newOrder")}
        </button>
      </div>

      {/* Period chips */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
          {t("pages.store.orders.periodLabel")}
        </span>
        {PERIOD_CHIPS.map((chip) => {
          const active = filters.datePreset === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() =>
                updateFilter({ datePreset: chip.value, dateFrom: "", dateTo: "" })
              }
              className={
                active
                  ? "rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground border border-primary transition"
                  : "rounded-full px-3 py-1 text-xs font-medium bg-card text-foreground border border-border hover:border-foreground/30 transition"
              }
            >
              {t(chip.labelKey)}
            </button>
          );
        })}
        {filters.datePreset === "custom" && (
          <div className="flex items-center gap-2 ml-1">
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter({ dateFrom: e.target.value })}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter({ dateTo: e.target.value })}
              className="rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        )}
        <div className="hidden flex-1 sm:block" />
        {channels.length > 0 && (
          <div className="relative w-full sm:w-auto">
            <select
              value={filters.channel}
              onChange={(e) => updateFilter({ channel: e.target.value })}
              className="w-full sm:w-auto appearance-none rounded-full bg-card border border-border pl-3 pr-8 py-1 text-xs font-medium cursor-pointer hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="">{t("pages.store.orders.allChannels")}</option>
              {channels.map((ch) => (
                <option key={ch.code} value={ch.code}>
                  {ch.name || ch.code}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          </div>
        )}
        {isLoading && (
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
      </div>

      {/* Action banner */}
      {attentionRows.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 border-l-4 border-l-red-500 p-3 flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 text-red-700 dark:text-red-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-red-900 dark:text-red-200">
              {t("pages.store.orders.attentionTitle", { count: attentionRows.length })}
            </div>
            <div className="text-xs text-red-800/80 dark:text-red-300/80 mt-0.5">
              {confirmedStaleCount > 0 && (
                <span>
                  {t("pages.store.orders.attentionStaleConfirmed", { count: confirmedStaleCount })}
                </span>
              )}
              {confirmedStaleCount > 0 && pendingStaleCount > 0 && <span> · </span>}
              {pendingStaleCount > 0 && (
                <span>
                  {t("pages.store.orders.attentionStalePending", { count: pendingStaleCount })}
                </span>
              )}
            </div>
          </div>
          <a
            href="#da-gestire"
            className="inline-flex items-center gap-1 rounded-md bg-card border border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-200 px-3 py-1 text-xs font-medium hover:bg-red-100/50 dark:hover:bg-red-500/15 transition flex-shrink-0"
          >
            {t("pages.store.orders.viewActions")}
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Pipeline */}
      <section className="space-y-2">
        <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {t("pages.store.orders.pipelineLabel")}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {pipeline.map((card) => (
            <PipelineCard key={card.label} {...card} />
          ))}
        </div>
      </section>

      {/* Revenue — full width with trend sparkline */}
      <section className="rounded-lg bg-card border border-border p-4 shadow-sm">
        <div className="text-xs text-muted-foreground">
          {t("pages.store.orders.revenueRange")}
        </div>
        <div className="flex items-baseline gap-3 mt-1 mb-3 flex-wrap">
          <div className="text-3xl font-semibold text-foreground">
            {currencyFormat.format(totalRevenue)}
          </div>
          <Delta
            current={totalRevenue}
            previous={previousRevenue}
            format="percent"
            comparisonLabel={t("pages.store.orders.vsPrevPeriod")}
          />
        </div>
        <Sparkline points={dailySeries} />
      </section>

      {/* KPI strip: rates + time-period volumes */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <KpiTile
          label={t("pages.store.orders.avgOrderValue")}
          value={currencyFormat.format(avgOrder)}
          delta={<Delta current={avgOrder} previous={previousAvg} format="percent" />}
        />
        <KpiTile
          label={t("pages.store.orders.conversionRate")}
          value={`${conversion.toString().replace(".", ",")}%`}
          delta={
            <Delta
              current={conversion}
              previous={previousConversion}
              format="points"
            />
          }
          caption={t("pages.store.orders.conversionCaption", {
            submitted: stats?.conversion?.submittedOrders || 0,
            total:
              (stats?.conversion?.submittedOrders || 0) +
              (stats?.conversion?.totalDrafts || 0),
          })}
        />
        <KpiTile
          label={t("pages.store.orders.ordersToday")}
          value={compactCurrencyFormat.format(stats?.timePeriods?.todayValue || 0)}
          delta={
            <span className="text-sm font-medium text-muted-foreground">
              ({stats?.timePeriods?.today || 0})
            </span>
          }
        />
        <KpiTile
          label={t("pages.store.orders.thisWeek")}
          value={compactCurrencyFormat.format(stats?.timePeriods?.thisWeekValue || 0)}
          delta={
            <span className="text-sm font-medium text-muted-foreground">
              ({stats?.timePeriods?.thisWeek || 0})
            </span>
          }
        />
        <KpiTile
          label={t("pages.store.orders.thisMonth")}
          value={compactCurrencyFormat.format(stats?.timePeriods?.thisMonthValue || 0)}
          delta={
            <span className="text-sm font-medium text-muted-foreground">
              ({stats?.timePeriods?.thisMonth || 0})
            </span>
          }
        />
      </div>

      {/* Day-by-day orders chart (full width) */}
      <section className="rounded-lg bg-card border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="text-sm font-semibold text-foreground">
            {t("pages.store.orders.dailyOrdersTitle")}
          </div>
          <div className="text-xs text-muted-foreground">
            {t("pages.store.orders.dailyOrdersHint")}
          </div>
        </div>
        <DailyBars points={dailySeries} />
      </section>

      {/* Da gestire */}
      <section
        id="da-gestire"
        className="rounded-lg bg-card border border-border shadow-sm"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Bell className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <h2 className="text-sm font-semibold text-foreground">
              {t("pages.store.orders.toHandle")}
            </h2>
            <span className="rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-800 dark:text-blue-300 text-[11px] px-2 py-0.5 font-medium">
              {attentionRows.length}
            </span>
          </div>
          <Link
            href={`${tenantPrefix}/b2b/store/orders/list`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1"
          >
            {t("pages.store.orders.viewAll")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {attentionRows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-30 text-emerald-500" />
            <p className="text-sm">{t("pages.store.orders.noActionsNeeded")}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <ul className="divide-y divide-border">
            {attentionRows.slice(0, 6).map(({ order, hint }) => {
              const HintIcon = hint.icon;
              const hintColor =
                hint.level === "danger"
                  ? "text-red-700 dark:text-red-400"
                  : hint.level === "warning"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-blue-700 dark:text-blue-400";
              const isAbandoned = hint.level === "warning" && order.status === "draft";
              const badgeStatus = isAbandoned ? "abandoned" : order.status;
              return (
                <li key={order.order_id}>
                  <Link
                    href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                    className="grid grid-cols-[110px_1fr_140px_110px_100px] gap-3 items-center px-4 py-2.5 hover:bg-muted/40 transition text-sm"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground truncate">
                      {order.display_ref || order.order_id}
                    </span>
                    <span className="truncate text-foreground">
                      {order.customer_name || order.order_id}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[11px] ${hintColor} truncate`}>
                      <HintIcon className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{hint.label}</span>
                    </span>
                    <span className="font-medium text-foreground text-right tabular-nums">
                      {currencyFormat.format(order.order_total)}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full text-center ${
                        isAbandoned
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                          : getStatusBadge(order.status)
                      }`}
                    >
                      {statusBadgeLabel(badgeStatus)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          </div>
        )}
      </section>

      <NewOrderModal
        isOpen={showNewOrderModal}
        onClose={() => setShowNewOrderModal(false)}
      />
    </div>
  );
}
