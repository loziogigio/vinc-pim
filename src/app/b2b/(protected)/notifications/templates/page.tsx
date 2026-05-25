"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Search, RefreshCcw, Loader2, Check, X, Mail, Pencil, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { TRIGGER_LABELS } from "@/lib/constants/notification";
import type { INotificationTemplate, NotificationTrigger } from "@/lib/constants/notification";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface TemplatesResponse {
  templates: INotificationTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function TemplatesPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<INotificationTemplate[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isSeeding, setIsSeeding] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [copiedTrigger, setCopiedTrigger] = useState<string | null>(null);

  // Copy trigger to clipboard
  const copyTrigger = async (trigger: string) => {
    try {
      await navigator.clipboard.writeText(trigger);
      setCopiedTrigger(trigger);
      setTimeout(() => setCopiedTrigger(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/b2b/notifications/templates?${params}`);
      if (!res.ok) throw new Error("Failed to load templates");

      const data: TemplatesResponse = await res.json();
      setTemplates(data.templates);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error loading templates:", error);
      setToast({ type: "error", message: t("pages.notifications.templates.loadError") });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search, t]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSeedTemplates = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/b2b/notifications/templates/seed", { method: "POST" });
      if (!res.ok) throw new Error("Failed to seed templates");

      const data = await res.json();
      setToast({
        type: "success",
        message: t("pages.notifications.templates.seedSuccess").replace("{created}", String(data.created)).replace("{skipped}", String(data.skipped)),
      });
      loadTemplates();
    } catch (error) {
      console.error("Error seeding templates:", error);
      setToast({ type: "error", message: t("pages.notifications.templates.seedError") });
    } finally {
      setIsSeeding(false);
    }
  };

  const toggleActive = async (templateId: string) => {
    try {
      const res = await fetch(`/api/b2b/notifications/templates/${templateId}/toggle`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to toggle template");

      loadTemplates();
    } catch (error) {
      console.error("Error toggling template:", error);
      setToast({ type: "error", message: t("pages.notifications.templates.toggleError") });
    }
  };

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb"), href: "/b2b/notifications" },
          { label: t("pages.notifications.templates.breadcrumb") },
        ]} />
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("pages.notifications.templates.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.notifications.templates.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedTemplates}
            disabled={isSeeding}
            className="gap-2"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            {t("pages.notifications.templates.seedDefaults")}
          </Button>
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            {t("pages.notifications.templates.newTemplate")}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm",
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pages.notifications.templates.searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("pages.notifications.templates.noTemplates")}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {t("pages.notifications.templates.noTemplatesSub")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.templates.name")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.templates.trigger")}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.templates.channels")}
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.templates.status")}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t("pages.notifications.templates.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((template) => (
                <tr key={template.template_id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">{template.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {template.description?.slice(0, 60)}
                        {(template.description?.length || 0) > 60 ? "..." : ""}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-foreground">
                        {TRIGGER_LABELS[template.trigger as NotificationTrigger] || template.trigger}
                      </span>
                      <button
                        onClick={() => copyTrigger(template.trigger)}
                        className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-xs font-mono text-muted-foreground transition"
                        title={t("pages.notifications.templates.copyTrigger")}
                      >
                        {copiedTrigger === template.trigger ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {template.trigger}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {template.channels?.email?.enabled && (
                        <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center" title="Email">
                          <Mail className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(template.template_id)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors",
                        template.is_active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/60"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {template.is_active ? (
                        <>
                          <Check className="w-3 h-3" /> {t("pages.notifications.templates.active")}
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" /> {t("pages.notifications.templates.inactive")}
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        window.location.href = `/b2b/notifications/templates/${template.template_id}`;
                      }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {t("pages.notifications.templates.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2 mt-4">
          <p className="text-sm text-muted-foreground">
            {t("pages.notifications.templates.showing")
              .replace("{from}", String((pagination.page - 1) * pagination.limit + 1))
              .replace("{to}", String(Math.min(pagination.page * pagination.limit, pagination.total)))
              .replace("{total}", String(pagination.total))}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
            >
              {t("pages.notifications.templates.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
            >
              {t("pages.notifications.templates.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
