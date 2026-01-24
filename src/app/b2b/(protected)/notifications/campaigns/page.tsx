"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  Bell,
  Smartphone,
  MessageSquare,
  Users,
  UserCheck,
  Send,
  TestTube,
  Clock,
  Loader2,
  Check,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TRIGGER_LABELS } from "@/lib/constants/notification";
import type { INotificationTemplate, NotificationTrigger, NotificationChannel } from "@/lib/constants/notification";

type RecipientType = "all" | "selected" | "segment";

interface ChannelConfig {
  id: NotificationChannel;
  label: string;
  icon: React.ElementType;
  color: string;
}

const CHANNELS: ChannelConfig[] = [
  { id: "email", label: "Email", icon: Mail, color: "blue" },
  { id: "web_push", label: "Web Push", icon: Bell, color: "amber" },
  { id: "mobile_push", label: "Mobile", icon: Smartphone, color: "emerald" },
  { id: "sms", label: "SMS", icon: MessageSquare, color: "purple" },
];

export default function CampaignsPage() {
  const [templates, setTemplates] = useState<INotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [enabledChannels, setEnabledChannels] = useState<Set<NotificationChannel>>(new Set(["email"]));
  const [recipientType, setRecipientType] = useState<RecipientType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b/notifications/templates?limit=100");
      if (!res.ok) throw new Error("Failed to load templates");
      const data = await res.json();
      setTemplates(data.templates.filter((t: INotificationTemplate) => t.is_active));
    } catch (error) {
      console.error("Error loading templates:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const toggleChannel = (channel: NotificationChannel) => {
    setEnabledChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  const getSelectedTemplate = () => {
    return templates.find((t) => t.template_id === selectedTemplate);
  };

  const isChannelAvailable = (channel: NotificationChannel) => {
    const template = getSelectedTemplate();
    if (!template) return false;
    return template.channels?.[channel]?.enabled === true;
  };

  const handleSendTest = async () => {
    if (!selectedTemplate || !testEmail) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/b2b/notifications/campaigns/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          channels: Array.from(enabledChannels),
          test_email: testEmail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test");
      }

      setToast({ type: "success", message: "Test email sent successfully!" });
      setShowTestModal(false);
      setTestEmail("");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to send test" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!selectedTemplate || enabledChannels.size === 0) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/b2b/notifications/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplate,
          channels: Array.from(enabledChannels),
          recipient_type: recipientType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send campaign");
      }

      const data = await res.json();
      setToast({
        type: "success",
        message: `Campaign sent to ${data.recipients_count} recipients!`,
      });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to send campaign" });
    } finally {
      setIsSending(false);
    }
  };

  const template = getSelectedTemplate();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Send Campaign</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send notifications to your customers across multiple channels
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Template Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Template
              </label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Choose a template...</option>
                {templates.map((t) => (
                  <option key={t.template_id} value={t.template_id}>
                    {t.name} ({TRIGGER_LABELS[t.trigger as NotificationTrigger] || t.trigger})
                  </option>
                ))}
              </select>
              {template && template.description && (
                <p className="mt-2 text-sm text-slate-500">{template.description}</p>
              )}
            </div>

            {/* Channel Selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Channels
              </label>
              <div className="flex flex-wrap gap-3">
                {CHANNELS.map((channel) => {
                  const isEnabled = enabledChannels.has(channel.id);
                  const isAvailable = isChannelAvailable(channel.id);
                  const Icon = channel.icon;

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => isAvailable && toggleChannel(channel.id)}
                      disabled={!isAvailable}
                      className={cn(
                        "flex flex-col items-center justify-center w-24 h-24 rounded-xl border-2 transition-all",
                        isEnabled && isAvailable
                          ? `border-${channel.color}-500 bg-${channel.color}-50`
                          : "border-slate-200 bg-white",
                        !isAvailable && "opacity-50 cursor-not-allowed",
                        isAvailable && "hover:border-slate-300 cursor-pointer"
                      )}
                      style={{
                        borderColor: isEnabled && isAvailable ? `var(--${channel.color}-500, #3b82f6)` : undefined,
                        backgroundColor: isEnabled && isAvailable ? `var(--${channel.color}-50, #eff6ff)` : undefined,
                      }}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                          isEnabled && isAvailable
                            ? `bg-${channel.color}-100 text-${channel.color}-600`
                            : "bg-slate-100 text-slate-400"
                        )}
                        style={{
                          backgroundColor: isEnabled && isAvailable ? undefined : "#f1f5f9",
                          color: isEnabled && isAvailable
                            ? channel.color === "blue" ? "#2563eb"
                            : channel.color === "amber" ? "#d97706"
                            : channel.color === "emerald" ? "#059669"
                            : "#9333ea"
                            : "#94a3b8",
                        }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={cn(
                          "text-xs font-medium",
                          isEnabled && isAvailable ? "text-slate-700" : "text-slate-400"
                        )}
                      >
                        {channel.label}
                      </span>
                      {isEnabled && isAvailable && (
                        <Check className="w-3 h-3 text-emerald-500 absolute top-2 right-2" />
                      )}
                    </button>
                  );
                })}
              </div>
              {!selectedTemplate && (
                <p className="mt-2 text-xs text-slate-400">
                  Select a template to see available channels
                </p>
              )}
            </div>

            {/* Recipients */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Recipients
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="recipients"
                    value="all"
                    checked={recipientType === "all"}
                    onChange={() => setRecipientType("all")}
                    className="w-4 h-4 text-primary"
                  />
                  <Users className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">All Customers</p>
                    <p className="text-xs text-slate-500">Send to all active customers</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="radio"
                    name="recipients"
                    value="selected"
                    checked={recipientType === "selected"}
                    onChange={() => setRecipientType("selected")}
                    className="w-4 h-4 text-primary"
                  />
                  <UserCheck className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">Selected Customers</p>
                    <p className="text-xs text-slate-500">Choose specific customers (coming soon)</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                onClick={() => setShowTestModal(true)}
                disabled={!selectedTemplate || enabledChannels.size === 0}
                className="gap-2"
              >
                <TestTube className="w-4 h-4" />
                Send Test
              </Button>
              <Button
                variant="outline"
                disabled
                className="gap-2"
              >
                <Clock className="w-4 h-4" />
                Schedule
              </Button>
              <Button
                onClick={handleSendCampaign}
                disabled={!selectedTemplate || enabledChannels.size === 0 || isSending}
                className="gap-2"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Now
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTestModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Test Email</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Test Email Address
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTestModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendTest} disabled={!testEmail || isSending}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
