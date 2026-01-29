"use client";

import { useState, useEffect } from "react";
import { Mail, Bell, Smartphone, MessageSquare, ExternalLink, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotificationSettingsPage() {
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Notification Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Configure notification channels and delivery settings
        </p>
      </div>

      {/* Company Info Section */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-amber-900 mb-1">Company Information for Emails</h3>
            <p className="text-sm text-amber-700 mb-3">
              Set up your company name, address, phone, and contact details. This information appears in
              email headers and footers, providing professional branding and legal compliance.
            </p>
            <Link href="/b2b/home-settings">
              <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-amber-50">
                <ExternalLink className="w-4 h-4" />
                Configure in Home Settings → Company
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Email Channel */}
      <ChannelCard
        icon={Mail}
        name="Email"
        description="Send emails via SMTP"
        configured
        configUrl="/b2b/home-settings"
        status="Configured via Home Settings → SMTP"
      />

      {/* Web Push Channel */}
      <ChannelCard
        icon={Bell}
        name="Web Push"
        description="Browser push notifications"
        comingSoon
      />

      {/* Mobile Push Channel (FCM) */}
      <ChannelCard
        icon={Smartphone}
        name="Mobile Push (FCM)"
        description="Push notifications to iOS and Android apps"
        configured={fcmStatus.configured && fcmStatus.enabled}
        configUrl="/b2b/notifications/settings/fcm"
        status={
          fcmStatus.loading
            ? "Loading..."
            : fcmStatus.configured
              ? fcmStatus.enabled
                ? `Enabled - Project: ${fcmStatus.project_id}`
                : "Configured but disabled"
              : "Not configured"
        }
        loading={fcmStatus.loading}
      />

      {/* SMS Channel */}
      <ChannelCard
        icon={MessageSquare}
        name="SMS"
        description="Text message notifications"
        comingSoon
      />

      {/* Info */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">Multi-Channel Support</h3>
        <p className="text-sm text-blue-700">
          Email and Mobile Push (FCM) channels are available. Web Push and SMS
          channels are planned for future releases. Templates are designed to
          support all channels - configure each channel and enable it in your templates.
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
}: {
  icon: React.ElementType;
  name: string;
  description: string;
  configured?: boolean;
  configUrl?: string;
  status?: string;
  comingSoon?: boolean;
  loading?: boolean;
}) {
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
                  Coming soon
                </span>
              )}
              {configured && (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                  Configured
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
            Configure
          </Button>
        )}
      </div>
    </div>
  );
}
