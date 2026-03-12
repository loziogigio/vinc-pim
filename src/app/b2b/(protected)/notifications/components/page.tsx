"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Puzzle,
  Loader2,
  FileCode,
  Check,
  Pencil,
  Trash2,
  Star,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { MonacoHtmlEditor } from "@/components/shared/MonacoHtmlEditor";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface EmailComponent {
  _id: string;
  component_id: string;
  type: "header" | "footer";
  name: string;
  description?: string;
  html_content: string;
  variables?: string[];
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type TabType = "header" | "footer";

const DEFAULT_PRIMARY_COLOR = "#009f7f";

/** Client-side template variable replacement (mirrors email-builder.ts logic) */
function replaceTemplateVariables(
  html: string,
  data: Record<string, string>
): string {
  let result = html;

  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, value);
  }

  // Process conditionals from innermost outward (handles nesting)
  const ifElseRe = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{else\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;
  const ifOnlyRe = /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if)[\s\S])*?)\{\{\/if\}\}/g;

  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result.replace(ifElseRe, (_, varName, ifContent, elseContent) => {
      const hasValue = data[varName] && data[varName].trim() !== "";
      return hasValue ? ifContent : elseContent;
    });
    result = result.replace(ifOnlyRe, (_, varName, content) => {
      const hasValue = data[varName] && data[varName].trim() !== "";
      return hasValue ? content : "";
    });
  }

  return result;
}

export default function ComponentsPage() {
  const { t } = useTranslation();
  const [components, setComponents] = useState<EmailComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("header");
  const [selectedComponent, setSelectedComponent] = useState<EmailComponent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [templateVars, setTemplateVars] = useState<Record<string, string>>({});

  // Fetch company info for preview variable replacement
  useEffect(() => {
    async function loadCompanyInfo() {
      try {
        const res = await fetch("/api/b2b/home-settings");
        if (!res.ok) return;
        const settings = await res.json();
        const ci = settings.company_info || {};
        const br = settings.branding || {};
        setTemplateVars({
          company_name: ci.legal_name || br.title || "Your Company",
          logo: br.logo || "",
          address: [ci.address_line1, ci.address_line2].filter(Boolean).join(", "),
          phone: ci.phone || "",
          email: ci.email || "",
          primary_color: br.primaryColor || DEFAULT_PRIMARY_COLOR,
          shop_name: br.title || "Shop",
          shop_url: br.shopUrl || "",
          current_year: new Date().getFullYear().toString(),
          vat_number: ci.vat_number || "",
        });
      } catch {
        // Fallback to defaults
        setTemplateVars({
          company_name: "Your Company",
          logo: "",
          primary_color: DEFAULT_PRIMARY_COLOR,
          current_year: new Date().getFullYear().toString(),
        });
      }
    }
    loadCompanyInfo();
  }, []);

  const loadComponents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/notifications/components?active=all");
      if (res.ok) {
        const data = await res.json();
        setComponents(data.components || []);
      }
    } catch (error) {
      console.error("Error loading components:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  const filteredComponents = components.filter((c) => c.type === activeTab);

  const handleSeedDefaults = async () => {
    if (!confirm(t("pages.notifications.components.seedConfirm"))) {
      return;
    }

    setIsSeeding(true);
    try {
      const res = await fetch("/api/b2b/notifications/components/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (data.success) {
        await loadComponents();
        alert(t("pages.notifications.components.seedSuccess").replace("{count}", String(data.components?.length || 0)));
      } else {
        alert(data.message || t("pages.notifications.components.seedError"));
      }
    } catch (error) {
      console.error("Error seeding:", error);
      alert(t("pages.notifications.components.seedError"));
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSetDefault = async (component: EmailComponent) => {
    try {
      const res = await fetch(`/api/b2b/notifications/components/${component.component_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      if (res.ok) {
        await loadComponents();
      }
    } catch (error) {
      console.error("Error setting default:", error);
    }
  };

  const handleDelete = async (component: EmailComponent) => {
    if (!confirm(t("pages.notifications.components.deleteConfirm").replace("{name}", component.name))) {
      return;
    }

    try {
      const res = await fetch(`/api/b2b/notifications/components/${component.component_id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        await loadComponents();
        if (selectedComponent?.component_id === component.component_id) {
          setSelectedComponent(null);
        }
      } else {
        alert(data.error || t("pages.notifications.components.deleteError"));
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert(t("pages.notifications.components.deleteComponentError"));
    }
  };

  const handleSave = async () => {
    if (!selectedComponent) return;

    setIsSaving(true);
    try {
      const isNew = !selectedComponent._id;
      const url = isNew
        ? "/api/b2b/notifications/components"
        : `/api/b2b/notifications/components/${selectedComponent.component_id}`;

      const res = await fetch(url, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedComponent.type,
          name: selectedComponent.name,
          description: selectedComponent.description,
          html_content: selectedComponent.html_content,
          variables: selectedComponent.variables,
          is_default: selectedComponent.is_default,
          is_active: selectedComponent.is_active,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        await loadComponents();
        setIsEditing(false);
        if (data.component) {
          setSelectedComponent(data.component);
        }
      } else {
        alert(data.error || t("pages.notifications.components.saveError"));
      }
    } catch (error) {
      console.error("Error saving:", error);
      alert(t("pages.notifications.components.saveComponentError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedComponent({
      _id: "",
      component_id: "",
      type: activeTab,
      name: "",
      description: "",
      html_content: "",
      variables: [],
      is_default: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsEditing(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={[
          { label: t("pages.notifications.dashboard.breadcrumb"), href: "/b2b/notifications" },
          { label: t("pages.notifications.components.title") },
        ]} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Puzzle className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t("pages.notifications.components.title")}</h1>
            <p className="text-sm text-slate-500">{t("pages.notifications.components.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSeedDefaults}
            disabled={isSeeding}
            className="gap-2"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {t("pages.notifications.components.seedDefaults")}
          </Button>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="w-4 h-4" />
            {activeTab === "header" ? t("pages.notifications.components.newHeader") : t("pages.notifications.components.newFooter")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - List */}
        <div className="col-span-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg mb-4">
            <button
              onClick={() => setActiveTab("header")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "header"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t("pages.notifications.components.headers")}
            </button>
            <button
              onClick={() => setActiveTab("footer")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                activeTab === "footer"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {t("pages.notifications.components.footers")}
            </button>
          </div>

          {/* Component List */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : filteredComponents.length === 0 ? (
              <div className="text-center py-12 px-4">
                <FileCode className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="text-slate-500 mb-4">
                  {t("pages.notifications.components.noComponents").replace("{type}", activeTab)}
                </p>
                <Button variant="outline" size="sm" onClick={handleSeedDefaults}>
                  {t("pages.notifications.components.seedDefaults")}
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredComponents.map((component) => (
                  <li
                    key={component.component_id}
                    onClick={() => {
                      setSelectedComponent(component);
                      setIsEditing(false);
                    }}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors",
                      selectedComponent?.component_id === component.component_id
                        ? "bg-violet-50 border-l-2 border-violet-500"
                        : "hover:bg-slate-50 border-l-2 border-transparent"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900 truncate">
                            {component.name}
                          </span>
                          {component.is_default && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                              <Star className="w-3 h-3" />
                              {t("pages.notifications.components.defaultBadge")}
                            </span>
                          )}
                        </div>
                        {component.description && (
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            {component.description}
                          </p>
                        )}
                      </div>
                      {!component.is_active && (
                        <span className="text-xs text-slate-400">{t("common.inactive")}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right Panel - Editor/Preview */}
        <div className="col-span-8">
          {selectedComponent ? (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {/* Editor Header */}
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {isEditing
                      ? selectedComponent._id
                        ? t("pages.notifications.components.editComponent")
                        : t("pages.notifications.components.newComponent")
                      : selectedComponent.name}
                  </h2>
                  {!isEditing && selectedComponent.description && (
                    <p className="text-sm text-slate-500">{selectedComponent.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <>
                      {!selectedComponent.is_default && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(selectedComponent)}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          {t("pages.notifications.components.setAsDefault")}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        {t("common.edit")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => handleDelete(selectedComponent)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!selectedComponent._id) {
                            setSelectedComponent(null);
                          }
                          setIsEditing(false);
                        }}
                      >
                        {t("common.cancel")}
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 mr-1" />
                        )}
                        {t("common.save")}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Editor/Preview Content */}
              <div className="p-6">
                {isEditing ? (
                  <div className="space-y-4">
                    {/* Name */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("pages.notifications.components.nameLabel")}
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.name}
                        onChange={(e) =>
                          setSelectedComponent({ ...selectedComponent, name: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        placeholder={t("pages.notifications.components.namePlaceholder")}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("pages.notifications.components.descriptionLabel")}
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.description || ""}
                        onChange={(e) =>
                          setSelectedComponent({
                            ...selectedComponent,
                            description: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        placeholder={t("pages.notifications.components.descriptionPlaceholder")}
                      />
                    </div>

                    {/* HTML Content */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("pages.notifications.components.htmlContentLabel")}
                      </label>
                      <MonacoHtmlEditor
                        value={selectedComponent.html_content}
                        onChange={(value) =>
                          setSelectedComponent({
                            ...selectedComponent,
                            html_content: value,
                          })
                        }
                        height="350px"
                      />
                      <p className="text-xs text-slate-500 mt-2">
                        {t("pages.notifications.components.variableHint")}
                      </p>
                    </div>

                    {/* Variables */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        {t("pages.notifications.components.variablesLabel")}
                      </label>
                      <input
                        type="text"
                        value={selectedComponent.variables?.join(", ") || ""}
                        onChange={(e) =>
                          setSelectedComponent({
                            ...selectedComponent,
                            variables: e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                        placeholder={t("pages.notifications.components.variablesPlaceholder")}
                      />
                    </div>

                    {/* Settings */}
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedComponent.is_default}
                          onChange={(e) =>
                            setSelectedComponent({
                              ...selectedComponent,
                              is_default: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-slate-700">{t("pages.notifications.components.setAsDefaultCheckbox")}</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedComponent.is_active}
                          onChange={(e) =>
                            setSelectedComponent({
                              ...selectedComponent,
                              is_active: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="text-sm text-slate-700">{t("pages.notifications.components.activeCheckbox")}</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Info */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">{t("pages.notifications.components.id")}</span>{" "}
                        <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">
                          {selectedComponent.component_id}
                        </code>
                      </div>
                      <div>
                        <span className="text-slate-500">{t("pages.notifications.components.type")}</span>{" "}
                        <span className="capitalize">{selectedComponent.type}</span>
                      </div>
                      {selectedComponent.variables && selectedComponent.variables.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-slate-500">{t("pages.notifications.components.variablesInfo")}</span>{" "}
                          {selectedComponent.variables.map((v) => (
                            <code
                              key={v}
                              className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded text-xs mr-1"
                            >
                              {`{{${v}}}`}
                            </code>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Preview */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2">{t("pages.notifications.components.preview")}</h3>
                      <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <iframe
                          srcDoc={`
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <style>body { margin: 0; padding: 0; }</style>
                            </head>
                            <body>${replaceTemplateVariables(selectedComponent.html_content, templateVars)}</body>
                            </html>
                          `}
                          title="Component preview"
                          className="w-full h-[300px] bg-white"
                          sandbox="allow-same-origin"
                        />
                      </div>
                    </div>

                    {/* HTML Code */}
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 mb-2">{t("pages.notifications.components.htmlCode")}</h3>
                      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-xs max-h-[300px]">
                        <code>{selectedComponent.html_content}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 flex items-center justify-center h-[600px]">
              <div className="text-center">
                <FileCode className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                <p className="text-slate-500">{t("pages.notifications.components.selectComponent")}</p>
                <Button variant="outline" className="mt-4" onClick={handleCreateNew}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t("pages.notifications.components.createNew")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
