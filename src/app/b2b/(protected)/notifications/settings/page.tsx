"use client";

import { Mail, Bell, Smartphone, MessageSquare, ExternalLink, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotificationSettingsPage() {
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

      {/* Mobile Push Channel */}
      <ChannelCard
        icon={Smartphone}
        name="Mobile Push"
        description="Push notifications to mobile apps"
        comingSoon
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
          Currently, only the Email channel is available. Web Push, Mobile Push, and SMS
          channels are planned for future releases. Templates are already designed to
          support all channels - when a new channel becomes available, you can simply
          enable it in your existing templates.
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
}: {
  icon: React.ElementType;
  name: string;
  description: string;
  configured?: boolean;
  configUrl?: string;
  status?: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              configured ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            <Icon className="w-5 h-5" />
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
