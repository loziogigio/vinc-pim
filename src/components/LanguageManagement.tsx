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
      toast.error("Cannot Disable Italian", {
        description: "Italian (IT) is the required default language and cannot be disabled.",
        duration: 4000,
      });
      return;
    }

    const action = language.isEnabled ? "disable" : "enable";

    try {
      setTogglingLang(language.code);

      toast.loading(
        `${action === "enable" ? "Enabling" : "Disabling"} ${language.name} (${language.code.toUpperCase()})...`,
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
          ? `${language.name} Enabled for Data Entry`
          : `${language.name} Disabled`;

        const description = action === "enable"
          ? `✓ Solr schema fields created for ${language.code.toUpperCase()}\n✓ Language available in product forms\n\nNote: Search indexing is not yet active. Use the Search Engine toggle to enable it.`
          : `Products with ${language.code.toUpperCase()} content remain accessible but new content cannot be added.`;

        toast.success(successMsg, {
          id: `toggle-${language.code}`,
          description,
          duration: 6000,
        });
        await fetchLanguages();
      } else {
        toast.error(`Failed to ${action === "enable" ? "Enable" : "Disable"} Language`, {
          id: `toggle-${language.code}`,
          description: data.error || "An unknown error occurred. Please try again.",
          duration: 5000,
        });
      }
    } catch (error) {
      toast.error("Language Toggle Failed", {
        id: `toggle-${language.code}`,
        description: "Unable to connect to the server. Please check your internet connection and try again.",
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
      toast.error("Cannot Enable Search Indexing", {
        description: `${language.name} (${language.code.toUpperCase()}) must be enabled for data entry first. Please enable the language before activating search.`,
        duration: 5000,
      });
      return;
    }

    const action = language.searchEnabled ? "disable" : "enable";

    try {
      setTogglingSearch(language.code);

      toast.loading(
        `${action === "enable" ? "Activating" : "Deactivating"} search engine for ${language.name} (${language.code.toUpperCase()})...`,
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
          ? `Search Engine Activated for ${language.name}`
          : `Search Engine Deactivated for ${language.name}`;

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
        toast.error(`Failed to ${action === "enable" ? "Activate" : "Deactivate"} Search Engine`, {
          id: `toggle-search-${language.code}`,
          description: data.error || "An unknown error occurred. Please check the console for details.",
          duration: 6000,
        });
      }
    } catch (error) {
      toast.error("Search Engine Toggle Failed", {
        id: `toggle-search-${language.code}`,
        description: "Unable to connect to the server. Please check your internet connection and try again.",
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
          Language Management
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Enable or disable languages without restarting the application. Solr schema updates happen automatically.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Languages</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Enabled</div>
            <div className="text-2xl font-bold text-green-600 mt-1">{stats.enabled}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Disabled</div>
            <div className="text-2xl font-bold text-gray-400 mt-1">{stats.disabled}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Coverage</div>
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
              placeholder="Search languages..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All Languages</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
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
            Reload
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
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Search Engine
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <div className="text-sm text-gray-500 mt-2">Loading languages...</div>
                  </td>
                </tr>
              ) : filteredLanguages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    No languages found
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
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            <X className="h-3 w-3 mr-1" />
                            Disabled
                          </span>
                        )}
                        {lang.isDefault && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Default
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
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            <Circle className="h-3 w-3 mr-1" />
                            Inactive
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
                              ? "Enable language for data entry first"
                              : lang.searchEnabled
                              ? "Disable search indexing"
                              : "Enable search indexing"
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
                            Working...
                          </>
                        ) : lang.isEnabled ? (
                          <>
                            <X className="h-3 w-3 mr-1" />
                            Disable
                          </>
                        ) : (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Enable
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
            <h3 className="text-sm font-medium text-blue-900">Zero-Downtime Language Management</h3>
            <p className="text-sm text-blue-700 mt-1">
              Enable or disable languages without restarting. Solr schema updates automatically.
              Italian (IT) is the default language and cannot be disabled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
