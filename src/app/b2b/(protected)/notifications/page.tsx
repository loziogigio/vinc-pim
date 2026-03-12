"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Bell, Smartphone, MessageSquare, TrendingUp, AlertCircle, Send, Loader2 } from "lucide-react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Stats {
  sent_today: number;
  sent_this_week: number;
  sent_this_month: number;
  open_rate: number;
  click_rate: number;
  failed_today: number;
  by_status: {
    sent: number;
    failed: number;
    queued: number;
    bounced: number;
  };
  by_channel: {
    email: {
      sent: number;
      open_rate: number;
    };
    web_push: {
      sent: number;
      click_rate: number;
    };
    mobile_push: {
      sent: number;
      click_rate: number;
    };
    sms: {
      sent: number;
    };
  };
}

const DEFAULT_STATS: Stats = {
  sent_today: 0,
  sent_this_week: 0,
  sent_this_month: 0,
  open_rate: 0,
  click_rate: 0,
  failed_today: 0,
  by_status: {
    sent: 0,
    failed: 0,
    queued: 0,
    bounced: 0,
  },
  by_channel: {
    email: { sent: 0, open_rate: 0 },
    web_push: { sent: 0, click_rate: 0 },
    mobile_push: { sent: 0, click_rate: 0 },
    sms: { sent: 0 },
  },
};

export default function NotificationsDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);
  const [templateCount, setTemplateCount] = useState(0);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load stats and template count in parallel
      const [statsRes, templatesRes] = await Promise.all([
        fetch("/api/b2b/notifications/stats"),
        fetch("/api/b2b/notifications/templates?limit=1"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (templatesRes.ok) {
        const templatesData = await templatesRes.json();
        setTemplateCount(templatesData.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error loading notification stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb") },
        ]} />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("pages.notifications.dashboard.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("pages.notifications.dashboard.subtitle")}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label={t("pages.notifications.dashboard.sentToday")}
              value={stats.sent_today}
              icon={Mail}
              color="bg-blue-500"
            />
            <StatCard
              label={t("pages.notifications.dashboard.openRate")}
              value={`${stats.open_rate}%`}
              icon={TrendingUp}
              color="bg-emerald-500"
            />
            <StatCard
              label={t("pages.notifications.dashboard.clickRate")}
              value={`${stats.click_rate}%`}
              icon={TrendingUp}
              color="bg-violet-500"
            />
            <StatCard
              label={t("pages.notifications.dashboard.failedToday")}
              value={stats.failed_today}
              icon={AlertCircle}
              color="bg-rose-500"
            />
          </div>

          {/* Period Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">{t("pages.notifications.dashboard.thisWeek")}</p>
              <p className="text-2xl font-bold text-slate-900">{stats.sent_this_week}</p>
              <p className="text-xs text-slate-400">{t("pages.notifications.dashboard.emailsSent")}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">{t("pages.notifications.dashboard.thisMonth")}</p>
              <p className="text-2xl font-bold text-slate-900">{stats.sent_this_month}</p>
              <p className="text-xs text-slate-400">{t("pages.notifications.dashboard.emailsSent")}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-500 mb-1">{t("pages.notifications.dashboard.deliveryStatus")}</p>
              <div className="flex items-center gap-4 mt-2">
                <div>
                  <span className="text-lg font-bold text-emerald-600">{stats.by_status.sent}</span>
                  <span className="text-xs text-slate-400 ml-1">{t("pages.notifications.dashboard.sent")}</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-rose-600">{stats.by_status.failed}</span>
                  <span className="text-xs text-slate-400 ml-1">{t("pages.notifications.dashboard.failed")}</span>
                </div>
                <div>
                  <span className="text-lg font-bold text-amber-600">{stats.by_status.queued}</span>
                  <span className="text-xs text-slate-400 ml-1">{t("pages.notifications.dashboard.queued")}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Channel Stats */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("pages.notifications.dashboard.byChannel")}</h2>
            <div className="space-y-4">
              <ChannelRow
                icon={Mail}
                label={t("pages.notifications.dashboard.emailChannel")}
                count={stats.by_channel.email.sent}
                rate={stats.by_channel.email.open_rate}
                rateLabel={t("pages.notifications.dashboard.openRateLabel")}
                color="text-blue-500"
              />
              <ChannelRow
                icon={Bell}
                label={t("pages.notifications.dashboard.webPushChannel")}
                count={stats.by_channel.web_push.sent}
                rate={stats.by_channel.web_push.click_rate}
                rateLabel={t("pages.notifications.dashboard.clickRateLabel")}
                color="text-amber-500"
                disabled
                disabledLabel={t("pages.notifications.dashboard.comingSoon")}
              />
              <ChannelRow
                icon={Smartphone}
                label={t("pages.notifications.dashboard.mobilePushChannel")}
                count={stats.by_channel.mobile_push.sent}
                rate={stats.by_channel.mobile_push.click_rate}
                rateLabel={t("pages.notifications.dashboard.clickRateLabel")}
                color="text-violet-500"
                disabled
                disabledLabel={t("pages.notifications.dashboard.comingSoon")}
              />
              <ChannelRow
                icon={MessageSquare}
                label={t("pages.notifications.dashboard.smsChannel")}
                count={stats.by_channel.sms.sent}
                color="text-emerald-500"
                disabled
                disabledLabel={t("pages.notifications.dashboard.comingSoon")}
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <QuickActionCard
              href="/b2b/notifications/campaigns"
              title={t("pages.notifications.dashboard.sendCampaign")}
              description={t("pages.notifications.dashboard.sendNow")}
              icon={Send}
            />
            <QuickActionCard
              href="/b2b/notifications/templates"
              title={t("pages.notifications.dashboard.templates")}
              description={t("pages.notifications.dashboard.templatesConfigured").replace("{count}", String(templateCount))}
              icon={Mail}
            />
            <QuickActionCard
              href="/b2b/notifications/logs"
              title={t("pages.notifications.dashboard.logs")}
              description={t("pages.notifications.dashboard.viewHistory")}
              icon={TrendingUp}
            />
            <QuickActionCard
              href="/b2b/notifications/settings"
              title={t("pages.notifications.dashboard.settings")}
              description={t("pages.notifications.dashboard.configureChannels")}
              icon={Bell}
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({
  icon: Icon,
  label,
  count,
  rate,
  rateLabel,
  color,
  disabled,
  disabledLabel,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  rate?: number;
  rateLabel?: string;
  color: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const { t } = useTranslation();
  const maxCount = 1000; // For progress bar scaling
  const progressWidth = count > 0 ? Math.min((count / maxCount) * 100, 100) : 0;

  return (
    <div className={`flex items-center gap-4 ${disabled ? "opacity-50" : ""}`}>
      <Icon className={`w-5 h-5 ${color}`} />
      <span className="w-24 text-sm font-medium text-slate-700">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${color.replace("text-", "bg-")} transition-all`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
      <span className="w-20 text-right text-sm text-slate-600">
        {t("pages.notifications.dashboard.sentCount").replace("{count}", String(count))}
      </span>
      {rate !== undefined && rateLabel && (
        <span className="w-24 text-right text-sm text-slate-500">
          {rate}% {rateLabel}
        </span>
      )}
      {disabled && disabledLabel && (
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
          {disabledLabel}
        </span>
      )}
    </div>
  );
}

function QuickActionCard({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <a
      href={href}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-slate-400" />
        <div>
          <p className="font-medium text-slate-900">{title}</p>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
    </a>
  );
}
