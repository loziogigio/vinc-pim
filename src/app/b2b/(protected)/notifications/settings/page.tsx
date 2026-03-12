"use client";

import { useState, useEffect } from "react";
import { Mail, Bell, Smartphone, MessageSquare, ExternalLink, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function NotificationSettingsPage() {
  const { t } = useTranslation();
  const [fcmStatus, setFcmStatus] = useState<{
    loading: boolean;
    configured: boolean;
    enabled: boolean;
    project_id?: string;
  }>({ loading: true, configured: false, enabled: false });

  useEffect(() => {
    fetch("/api/b2b/settings/fcm")
      .then((res) => res.json())
      .then((data) => {
        setFcmStatus({
          loading: false,
          configured: data.configured || false,
          enabled: data.enabled || false,
          project_id: data.project_id,
        });
      })
      .catch(() => {
        setFcmStatus({ loading: false, configured: false, enabled: false });
      });
  }, []);

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb"), href: "/b2b/notifications" },
          { label: t("pages.notifications.settings.breadcrumb") },
        ]} />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">{t("pages.notifications.settings.title")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("pages.notifications.settings.subtitle")}
        </p>
      </div>

      {/* Company Info Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 mb-1">{t("pages.notifications.settings.companyInfoTitle")}</h3>
            <p className="text-sm text-amber-700 mb-3">
              {t("pages.notifications.settings.companyInfoDesc")}
            </p>
            <Link href="/b2b/home-settings">
              <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-amber-50">
                <ExternalLink className="w-4 h-4" />
                {t("pages.notifications.settings.configureHomeSettings")}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Email Channel */}
      <ChannelCard
        icon={Mail}
        name={t("pages.notifications.settings.emailName")}
        description={t("pages.notifications.settings.emailDesc")}
        configured
        configUrl="/b2b/home-settings"
        status={t("pages.notifications.settings.configuredViaSMTP")}
      />

      {/* Web Push Channel */}
      <ChannelCard
        icon={Bell}
        name={t("pages.notifications.settings.webPushName")}
        description={t("pages.notifications.settings.webPushDesc")}
        comingSoon
        comingSoonLabel={t("pages.notifications.settings.comingSoon")}
      />

      {/* Mobile Push Channel (FCM) */}
      <ChannelCard
        icon={Smartphone}
        name={t("pages.notifications.settings.mobilePushName")}
        description={t("pages.notifications.settings.mobilePushDesc")}
        configured={fcmStatus.configured && fcmStatus.enabled}
        configUrl="/b2b/notifications/settings/fcm"
        status={
          fcmStatus.loading
            ? "Loading..."
            : fcmStatus.configured
              ? fcmStatus.enabled
                ? t("pages.notifications.settings.enabledProject").replace("{id}", fcmStatus.project_id || "")
                : t("pages.notifications.settings.configuredDisabled")
              : t("pages.notifications.settings.notConfigured")
        }
        loading={fcmStatus.loading}
        configuredLabel={t("pages.notifications.settings.configured")}
        configureLabel={t("pages.notifications.settings.configure")}
      />

      {/* SMS Channel */}
      <ChannelCard
        icon={MessageSquare}
        name={t("pages.notifications.settings.smsName")}
        description={t("pages.notifications.settings.smsDesc")}
        comingSoon
        comingSoonLabel={t("pages.notifications.settings.comingSoon")}
      />

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">{t("pages.notifications.settings.multiChannelTitle")}</h3>
        <p className="text-sm text-blue-700">
          {t("pages.notifications.settings.multiChannelDesc")}
        </p>
      </div>
    </div>
  );
}

function ChannelCard({
  icon: Icon,
  name,
  description,
  configured,
  configUrl,
  status,
  comingSoon,
  loading,
  comingSoonLabel,
  configuredLabel,
  configureLabel,
}: {
  icon: React.ElementType;
  name: string;
  description: string;
  configured?: boolean;
  configUrl?: string;
  status?: string;
  comingSoon?: boolean;
  loading?: boolean;
  comingSoonLabel?: string;
  configuredLabel?: string;
  configureLabel?: string;
}) {
  const { t } = useTranslation();

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              loading
                ? "bg-slate-100 text-slate-400"
                : configured
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-slate-100 text-slate-400"
            }`}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Icon className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-slate-900">{name}</h3>
              {comingSoon && (
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
                  {comingSoonLabel || t("pages.notifications.settings.comingSoon")}
                </span>
              )}
              {configured && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                  {configuredLabel || t("pages.notifications.settings.configured")}
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{description}</p>
            {status && <p className="text-xs text-slate-400 mt-1">{status}</p>}
          </div>
        </div>
        {configUrl && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => (window.location.href = configUrl)}
          >
            <ExternalLink className="w-4 h-4" />
            {configureLabel || t("pages.notifications.settings.configure")}
          </Button>
        )}
      </div>
    </div>
  );
}
