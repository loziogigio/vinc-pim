"use client";

/**
 * Language Management Dashboard
 * Simple version using native HTML and existing UI components
 */

import React, { useState, useEffect } from "react";
import { Globe, Check, X, RefreshCw, Loader2, AlertTriangle, Power, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Language {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  isEnabled: boolean;
  searchEnabled: boolean;
  solrAnalyzer: string;
  direction: "ltr" | "rtl";
  order: number;
}

interface LanguageStats {
  total: number;
  enabled: number;
  disabled: number;
}

export default function LanguageManagement() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [stats, setStats] = useState<LanguageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [togglingLang, setTogglingLang] = useState<string | null>(null);
  const [togglingSearch, setTogglingSearch] = useState<string | null>(null);

  // Fetch languages
  const fetchLanguages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchText) params.append("search", searchText);
      params.append("limit", "100");

      const response = await fetch(`/api/admin/languages?${params}`);
      const data = await response.json();

      if (data.success) {
        setLanguages(data.data);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Failed to load languages:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLanguages();
  }, [statusFilter, searchText]);

  // Toggle language enable/disable
  const toggleLanguage = async (language: Language) => {
    if (language.code === "it") {
      toast.error(t("components.languageManagement.cannotDisableDefault"), {
        description: t("components.languageManagement.cannotDisableDefaultDesc"),
        duration: 4000,
      });
      return;
    }

    const action = language.isEnabled ? "disable" : "enable";

    try {
      setTogglingLang(language.code);

      toast.loading(
        action === "enable"
          ? t("components.languageManagement.enablingLanguage", { name: language.name, code: language.code.toUpperCase() })
          : t("components.languageManagement.disablingLanguage", { name: language.name, code: language.code.toUpperCase() }),
        { id: `toggle-${language.code}` }
      );

      const response = await fetch(`/api/admin/languages/${language.code}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncSolr: true })
      });

      const data = await response.json();

      if (data.success) {
        const successMsg = action === "enable"
          ? t("components.languageManagement.enabledForDataEntry", { name: language.name })
          : t("components.languageManagement.languageDisabled", { name: language.name });

        const description = action === "enable"
          ? t("components.languageManagement.enabledDesc", { code: language.code.toUpperCase() })
          : t("components.languageManagement.disabledDesc", { code: language.code.toUpperCase() });

        toast.success(successMsg, {
          id: `toggle-${language.code}`,
          description,
          duration: 6000,
        });
        await fetchLanguages();
      } else {
        toast.error(
          action === "enable"
            ? t("components.languageManagement.failedToEnable")
            : t("components.languageManagement.failedToDisable"),
          {
            id: `toggle-${language.code}`,
            description: data.error || t("common.error"),
            duration: 5000,
          }
        );
      }
    } catch (error) {
      toast.error(t("components.languageManagement.toggleFailed"), {
        id: `toggle-${language.code}`,
        description: t("components.languageManagement.toggleFailedDesc"),
        duration: 5000,
      });
      console.error(error);
    } finally {
      setTogglingLang(null);
    }
  };

  // Toggle search engine enable/disable
  const toggleSearchEngine = async (language: Language) => {
    if (!language.isEnabled) {
      toast.error(t("components.languageManagement.cannotEnableSearch"), {
        description: t("components.languageManagement.cannotEnableSearchDesc", { name: language.name, code: language.code.toUpperCase() }),
        duration: 5000,
      });
      return;
    }

    const action = language.searchEnabled ? "disable" : "enable";

    try {
      setTogglingSearch(language.code);

      toast.loading(
        action === "enable"
          ? t("components.languageManagement.activatingSearch", { name: language.name, code: language.code.toUpperCase() })
          : t("components.languageManagement.deactivatingSearch", { name: language.name, code: language.code.toUpperCase() }),
        { id: `toggle-search-${language.code}` }
      );

      const response = await fetch(
        `/api/admin/languages/${language.code}/${action}-search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (data.success) {
        const successMsg = action === "enable"
          ? t("components.languageManagement.searchActivated", { name: language.name })
          : t("components.languageManagement.searchDeactivated", { name: language.name });

        let description = "";
        if (action === "enable" && data.jobQueued) {
          description = `✓ Solr schema updated with ${language.code.toUpperCase()} analyzers\n✓ ${data.jobMessage}\n\n${data.jobId ? `Job ID: ${data.jobId}` : ''}`;
        } else if (action === "enable" && data.solrSync?.success) {
          description = `✓ Solr schema updated with ${language.code.toUpperCase()} analyzers\n\n${data.jobMessage || 'No products with content in this language to index'}`;
        } else if (action === "enable") {
          description = data.jobMessage || "Schema update completed";
        } else {
          description = `Search for ${language.code.toUpperCase()} products has been disabled. Existing indexed content remains searchable until next full reindex.`;
        }

        toast.success(successMsg, {
          id: `toggle-search-${language.code}`,
          description,
          duration: 7000,
        });
        await fetchLanguages();
      } else {
        toast.error(
          action === "enable"
            ? t("components.languageManagement.failedToActivateSearch")
            : t("components.languageManagement.failedToDeactivateSearch"),
          {
            id: `toggle-search-${language.code}`,
            description: data.error || t("common.error"),
            duration: 6000,
          }
        );
      }
    } catch (error) {
      toast.error(t("components.languageManagement.searchToggleFailed"), {
        id: `toggle-search-${language.code}`,
        description: t("components.languageManagement.toggleFailedDesc"),
        duration: 5000,
      });
      console.error(error);
    } finally {
      setTogglingSearch(null);
    }
  };

  const filteredLanguages = languages.filter(lang => {
    if (statusFilter === "enabled" && !lang.isEnabled) return false;
    if (statusFilter === "disabled" && lang.isEnabled) return false;
    if (searchText) {
      const search = searchText.toLowerCase();
      return (
        lang.code.toLowerCase().includes(search) ||
        lang.name.toLowerCase().includes(search) ||
        lang.nativeName.toLowerCase().includes(search)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Globe className="h-6 w-6" />
          {t("components.languageManagement.title")}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {t("components.languageManagement.subtitle")}
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">{t("components.languageManagement.totalLanguages")}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">{t("components.languageManagement.enabled")}</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.enabled}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">{t("components.languageManagement.disabled")}</div>
            <div className="text-2xl font-bold text-gray-400 mt-1">{stats.disabled}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">{t("components.languageManagement.coverage")}</div>
            <div className="text-2xl font-bold text-blue-600 mt-1">
              {Math.round((stats.enabled / stats.total) * 100)}%
            </div>
          </Card>
        </div>
      )}

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-wrap">
            <Input
              type="text"
              placeholder={t("components.languageManagement.searchPlaceholder")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">{t("components.languageManagement.allLanguages")}</option>
              <option value="enabled">{t("components.languageManagement.enabledOnly")}</option>
              <option value="disabled">{t("components.languageManagement.disabledOnly")}</option>
            </select>
          </div>
          <Button
            type="button"
            onClick={fetchLanguages}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("components.languageManagement.reload")}
          </Button>
        </div>
      </Card>

      {/* Languages Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.statusCol")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.codeCol")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.languageCol")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.directionCol")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.searchEngineCol")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  {t("components.languageManagement.actionsCol")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <div className="text-sm text-gray-500 mt-2">{t("components.languageManagement.loadingLanguages")}</div>
                  </td>
                </tr>
              ) : filteredLanguages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {t("components.languageManagement.noLanguagesFound")}
                  </td>
                </tr>
              ) : (
                filteredLanguages.map((lang) => (
                  <tr key={lang._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lang.isEnabled ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Check className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.enabled")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <X className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.disabled")}
                          </span>
                        )}
                        {lang.isDefault && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {t("components.languageManagement.defaultBadge")}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono font-semibold text-gray-900">
                        {lang.code.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-gray-900">{lang.name}</div>
                        <div className="text-sm text-gray-500">{lang.nativeName}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {lang.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {lang.searchEnabled ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                            <Check className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.active")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            <Circle className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.inactive")}
                          </span>
                        )}
                        <Button
                          type="button"
                          onClick={() => toggleSearchEngine(lang)}
                          disabled={
                            togglingSearch === lang.code ||
                            !lang.isEnabled
                          }
                          size="sm"
                          variant="ghost"
                          title={
                            !lang.isEnabled
                              ? t("components.languageManagement.enableDataEntryFirst")
                              : lang.searchEnabled
                              ? t("components.languageManagement.disableSearchIndexing")
                              : t("components.languageManagement.enableSearchIndexing")
                          }
                        >
                          {togglingSearch === lang.code ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : lang.searchEnabled ? (
                            <Power className="h-3 w-3 text-red-600" />
                          ) : (
                            <Power className="h-3 w-3 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        disabled={togglingLang === lang.code || lang.code === "it"}
                        size="sm"
                        variant={lang.isEnabled ? "outline" : "default"}
                      >
                        {togglingLang === lang.code ? (
                          <>
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            {t("components.languageManagement.working")}
                          </>
                        ) : lang.isEnabled ? (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.disable")}
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            {t("components.languageManagement.enable")}
                          </>
                        )}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Globe className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900">{t("components.languageManagement.zeroDowntimeTitle")}</h3>
            <p className="text-sm text-blue-700 mt-1">
              {t("components.languageManagement.zeroDowntimeDesc")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
