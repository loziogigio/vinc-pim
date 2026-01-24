"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Mail,
  Bell,
  Smartphone,
  MessageSquare,
  Variable,
  Eye,
  Send,
  AlertCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { MonacoHtmlEditor } from "@/components/shared/MonacoHtmlEditor";
import { TRIGGER_LABELS, NOTIFICATION_TRIGGERS, NOTIFICATION_CHANNELS } from "@/lib/constants/notification";
import type { INotificationTemplate, NotificationTrigger, NotificationChannel } from "@/lib/constants/notification";

interface EmailComponent {
  component_id: string;
  type: "header" | "footer";
  name: string;
  is_default: boolean;
}

type ChannelTab = "email" | "web_push" | "mobile_push" | "sms";

interface ChannelTabConfig {
  id: ChannelTab;
  label: string;
  icon: React.ElementType;
}

const CHANNEL_TABS: ChannelTabConfig[] = [
  { id: "email", label: "Email", icon: Mail },
  { id: "web_push", label: "Web Push", icon: Bell },
  { id: "mobile_push", label: "Mobile Push", icon: Smartphone },
  { id: "sms", label: "SMS", icon: MessageSquare },
];

export default function TemplateEditorPage() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.id as string;

  const [template, setTemplate] = useState<INotificationTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<ChannelTab>("email");
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [previewData, setPreviewData] = useState<{
    subject?: string;
    html?: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [headers, setHeaders] = useState<EmailComponent[]>([]);
  const [footers, setFooters] = useState<EmailComponent[]>([]);

  const loadPreview = useCallback(async () => {
    if (!templateId || !template) return;
    setIsLoadingPreview(true);
    try {
      // Send current template state for real-time preview (including unsaved changes)
      const res = await fetch(`/api/b2b/notifications/templates/${templateId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "email",
          // Include current template data for real-time preview
          template_data: {
            subject: template.channels?.email?.subject || "",
            html_body: template.channels?.email?.html_body || "",
            text_body: template.channels?.email?.text_body || "",
            use_default_header: template.use_default_header,
            use_default_footer: template.use_default_footer,
            header_id: template.header_id,
            footer_id: template.footer_id,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewData(data);
      }
    } catch (error) {
      console.error("Error loading preview:", error);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [templateId, template]);

  const loadTemplate = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/notifications/templates/${templateId}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push("/b2b/notifications/templates");
          return;
        }
        throw new Error("Failed to load template");
      }
      const data = await res.json();
      setTemplate(data);
    } catch (error) {
      console.error("Error loading template:", error);
      setToast({ type: "error", message: "Failed to load template" });
    } finally {
      setIsLoading(false);
    }
  }, [templateId, router]);

  const loadComponents = useCallback(async () => {
    try {
      const res = await fetch("/api/b2b/notifications/components");
      if (res.ok) {
        const data = await res.json();
        const components = data.components || [];
        setHeaders(components.filter((c: EmailComponent) => c.type === "header"));
        setFooters(components.filter((c: EmailComponent) => c.type === "footer"));
      }
    } catch (error) {
      console.error("Error loading components:", error);
    }
  }, []);

  useEffect(() => {
    loadTemplate();
    loadComponents();
  }, [loadTemplate, loadComponents]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Load preview when panel opens or template changes (including header/footer)
  useEffect(() => {
    if (showPreview && template?.channels?.email?.enabled) {
      // Debounce preview updates for smoother editing experience
      const timer = setTimeout(() => {
        loadPreview();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    showPreview,
    template?.channels?.email?.html_body,
    template?.channels?.email?.subject,
    template?.use_default_header,
    template?.use_default_footer,
    template?.header_id,
    template?.footer_id,
    loadPreview
  ]);

  const updateTemplate = <K extends keyof INotificationTemplate>(
    key: K,
    value: INotificationTemplate[K]
  ) => {
    setTemplate((prev) => (prev ? { ...prev, [key]: value } : null));
    setIsDirty(true);
  };

  const updateChannel = (
    channel: ChannelTab,
    field: string,
    value: string | boolean
  ) => {
    setTemplate((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        channels: {
          ...prev.channels,
          [channel]: {
            ...prev.channels?.[channel],
            [field]: value,
          },
        },
      };
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!template) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/notifications/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          trigger: template.trigger,
          channels: template.channels,
          variables: template.variables,
          header_id: template.header_id,
          footer_id: template.footer_id,
          use_default_header: template.use_default_header,
          use_default_footer: template.use_default_footer,
          is_active: template.is_active,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save template");
      }

      setIsDirty(false);
      setToast({ type: "success", message: "Template saved successfully" });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to save" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail || !template) return;

    setIsSendingTest(true);
    try {
      const res = await fetch("/api/b2b/notifications/campaigns/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          channels: ["email"],
          test_email: testEmail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test");
      }

      setToast({ type: "success", message: `Test email sent to ${testEmail}` });
      setTestEmail("");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Failed to send test" });
    } finally {
      setIsSendingTest(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.activeElement as HTMLTextAreaElement | null;
    if (textarea && textarea.tagName === "TEXTAREA") {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + `{{${variable}}}` + value.substring(end);
      textarea.value = newValue;
      textarea.selectionStart = textarea.selectionEnd = start + variable.length + 4;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <p className="text-slate-500">Template not found</p>
      </div>
    );
  }

  const emailChannel = template.channels?.email;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/b2b/notifications/templates")}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{template.name}</h1>
            <p className="text-sm text-slate-500">
              {TRIGGER_LABELS[template.trigger as NotificationTrigger] || template.trigger}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save
          </Button>
        </div>
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
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      <div className={cn("grid gap-6", showPreview ? "grid-cols-2" : "grid-cols-1")}>
        {/* Editor */}
        <div className="space-y-6">
          {/* Template Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Template Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={template.name}
                  onChange={(e) => updateTemplate("name", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={template.description || ""}
                  onChange={(e) => updateTemplate("description", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trigger</label>
                <select
                  value={template.trigger}
                  onChange={(e) => updateTemplate("trigger", e.target.value as NotificationTrigger)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {NOTIFICATION_TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {TRIGGER_LABELS[trigger]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={template.is_active}
                  onChange={(e) => updateTemplate("is_active", e.target.checked)}
                  className="w-4 h-4 text-primary rounded"
                />
                <label htmlFor="is_active" className="text-sm text-slate-700">
                  Template is active
                </label>
              </div>
            </div>
          </div>

          {/* Variables */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">Variables</h2>
              <Variable className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              {template.variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => insertVariable(variable)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-mono transition-colors"
                  title={`Click to insert {{${variable}}}`}
                >
                  {`{{${variable}}}`}
                </button>
              ))}
              {template.variables.length === 0 && (
                <p className="text-sm text-slate-400">No variables defined</p>
              )}
            </div>
          </div>

          {/* Channel Tabs */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              {CHANNEL_TABS.map((tab) => {
                const Icon = tab.icon;
                const isEnabled = template.channels?.[tab.id]?.enabled;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "text-primary border-b-2 border-primary bg-primary/5"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                    {isEnabled && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-6">
              {/* Email Channel */}
              {activeTab === "email" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="email_enabled"
                      checked={emailChannel?.enabled || false}
                      onChange={(e) => updateChannel("email", "enabled", e.target.checked)}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <label htmlFor="email_enabled" className="text-sm text-slate-700">
                      Enable email channel
                    </label>
                  </div>

                  {emailChannel?.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={emailChannel.subject || ""}
                          onChange={(e) => updateChannel("email", "subject", e.target.value)}
                          placeholder="Email subject with {{variables}}"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {/* Header Selection */}
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-medium text-slate-700">Email Header</h3>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={template.use_default_header !== false}
                              onChange={(e) => updateTemplate("use_default_header", e.target.checked)}
                              className="w-4 h-4 text-primary rounded"
                            />
                            <span className="text-sm text-slate-600">Use default header</span>
                          </label>
                        </div>
                        {template.use_default_header === false && (
                          <select
                            value={template.header_id || ""}
                            onChange={(e) => updateTemplate("header_id", e.target.value || undefined)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">No header</option>
                            {headers.map((h) => (
                              <option key={h.component_id} value={h.component_id}>
                                {h.name} {h.is_default ? "(Default)" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          HTML Body (Content)
                        </label>
                        <MonacoHtmlEditor
                          value={emailChannel.html_body || ""}
                          onChange={(value) => updateChannel("email", "html_body", value)}
                          height="350px"
                        />
                        <p className="mt-2 text-xs text-slate-500">
                          This is the main content between header and footer. Use {"{{variable}}"} for dynamic values.
                        </p>
                      </div>

                      {/* Footer Selection */}
                      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-medium text-slate-700">Email Footer</h3>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={template.use_default_footer !== false}
                              onChange={(e) => updateTemplate("use_default_footer", e.target.checked)}
                              className="w-4 h-4 text-primary rounded"
                            />
                            <span className="text-sm text-slate-600">Use default footer</span>
                          </label>
                        </div>
                        {template.use_default_footer === false && (
                          <select
                            value={template.footer_id || ""}
                            onChange={(e) => updateTemplate("footer_id", e.target.value || undefined)}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">No footer</option>
                            {footers.map((f) => (
                              <option key={f.component_id} value={f.component_id}>
                                {f.name} {f.is_default ? "(Default)" : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Plain Text (optional)
                        </label>
                        <textarea
                          value={emailChannel.text_body || ""}
                          onChange={(e) => updateChannel("email", "text_body", e.target.value)}
                          rows={4}
                          placeholder="Plain text version for email clients that don't support HTML"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Web Push Channel */}
              {activeTab === "web_push" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="web_push_enabled"
                      checked={template.channels?.web_push?.enabled || false}
                      onChange={(e) => updateChannel("web_push", "enabled", e.target.checked)}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <label htmlFor="web_push_enabled" className="text-sm text-slate-700">
                      Enable web push notifications
                    </label>
                  </div>

                  {template.channels?.web_push?.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={template.channels.web_push.title || ""}
                          onChange={(e) => updateChannel("web_push", "title", e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                        <textarea
                          value={template.channels.web_push.body || ""}
                          onChange={(e) => updateChannel("web_push", "body", e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Action URL</label>
                        <input
                          type="url"
                          value={template.channels.web_push.action_url || ""}
                          onChange={(e) => updateChannel("web_push", "action_url", e.target.value)}
                          placeholder="https://example.com/path"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Mobile Push Channel */}
              {activeTab === "mobile_push" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="mobile_push_enabled"
                      checked={template.channels?.mobile_push?.enabled || false}
                      onChange={(e) => updateChannel("mobile_push", "enabled", e.target.checked)}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <label htmlFor="mobile_push_enabled" className="text-sm text-slate-700">
                      Enable mobile push notifications
                    </label>
                  </div>

                  {template.channels?.mobile_push?.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={template.channels.mobile_push.title || ""}
                          onChange={(e) => updateChannel("mobile_push", "title", e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                        <textarea
                          value={template.channels.mobile_push.body || ""}
                          onChange={(e) => updateChannel("mobile_push", "body", e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* SMS Channel */}
              {activeTab === "sms" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sms_enabled"
                      checked={template.channels?.sms?.enabled || false}
                      onChange={(e) => updateChannel("sms", "enabled", e.target.checked)}
                      className="w-4 h-4 text-primary rounded"
                    />
                    <label htmlFor="sms_enabled" className="text-sm text-slate-700">
                      Enable SMS notifications
                    </label>
                  </div>

                  {template.channels?.sms?.enabled && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Message (max 160 chars)
                      </label>
                      <textarea
                        value={template.channels.sms.body || ""}
                        onChange={(e) => updateChannel("sms", "body", e.target.value)}
                        rows={3}
                        maxLength={160}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        {(template.channels.sms.body || "").length}/160 characters
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Send Test */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Send Test Email</h2>
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@example.com"
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <Button
                onClick={handleSendTest}
                disabled={!testEmail || !emailChannel?.enabled || isSendingTest}
                className="gap-2"
              >
                {isSendingTest ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Test
              </Button>
            </div>
          </div>
        </div>

        {/* Preview */}
        {showPreview && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Email Preview</h2>
              {isLoadingPreview && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </div>
            <div className="p-4">
              {emailChannel?.enabled && emailChannel.html_body ? (
                <div className="space-y-3">
                  {/* Subject Preview */}
                  {previewData?.subject && (
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                      <div className="text-xs text-slate-500 mb-1">Subject:</div>
                      <div className="text-sm font-medium text-slate-900">{previewData.subject}</div>
                    </div>
                  )}
                  {/* HTML Preview */}
                  <iframe
                    srcDoc={previewData?.html || emailChannel.html_body}
                    title="Email preview"
                    className="w-full h-[550px] border border-slate-200 rounded-lg bg-white"
                    sandbox="allow-same-origin"
                  />
                  <p className="text-xs text-slate-500 text-center">
                    Variables are replaced with sample data
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] text-slate-400">
                  <div className="text-center">
                    <Mail className="w-12 h-12 mx-auto mb-2" />
                    <p>Enable email channel to see preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
