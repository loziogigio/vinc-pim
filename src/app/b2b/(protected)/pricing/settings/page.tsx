"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2,
  Save,
  Settings2,
  Wifi,
  Shield,
  Database,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  PRICING_PROVIDERS,
  PRICING_PROVIDER_LABELS,
  PRICING_AUTH_METHODS,
  PRICING_DEFAULTS,
} from "@/lib/constants/pricing-provider";
import type { PricingProvider, PricingAuthMethod } from "@/lib/constants/pricing-provider";
import {
  normalizeDecimalInput,
  parseDecimalValue,
  toDecimalInputValue,
} from "@/lib/utils/decimal-input";

interface TenantPricingConfig {
  tenant_id: string;
  active_provider: string;
  providers: {
    legacy_erp?: {
      api_base_url: string;
      auth_method: string;
      api_key?: string;
      bearer_token?: string;
      timeout_ms: number;
      enabled: boolean;
    };
    generic_http?: {
      api_base_url: string;
      auth_method: string;
      api_key?: string;
      api_secret?: string;
      bearer_token?: string;
      custom_headers?: Record<string, string>;
      endpoint: string;
      timeout_ms: number;
      response_mapping: {
        entity_code_field: string;
        net_price_field: string;
        gross_price_field: string;
        price_field: string;
        vat_percent_field?: string;
        availability_field?: string;
        discount_field?: string;
      };
      enabled: boolean;
    };
  };
  cache: { enabled: boolean; ttl_seconds: number };
  fallback: { log_errors: boolean; max_retries: number };
  circuit_breaker: {
    failure_threshold: number;
    recovery_timeout_ms: number;
    success_threshold: number;
  };
}

const DEFAULT_CONFIG: TenantPricingConfig = {
  tenant_id: "",
  active_provider: "legacy_erp",
  providers: {
    legacy_erp: {
      api_base_url: "",
      auth_method: "none",
      timeout_ms: PRICING_DEFAULTS.TIMEOUT_MS,
      enabled: false,
    },
    generic_http: {
      api_base_url: "",
      auth_method: "none",
      endpoint: "/prices",
      timeout_ms: PRICING_DEFAULTS.TIMEOUT_MS,
      response_mapping: {
        entity_code_field: "entity_code",
        net_price_field: "net_price",
        gross_price_field: "gross_price",
        price_field: "price",
      },
      enabled: false,
    },
  },
  cache: { enabled: false, ttl_seconds: PRICING_DEFAULTS.CACHE_TTL_SECONDS },
  fallback: { log_errors: true, max_retries: PRICING_DEFAULTS.MAX_RETRIES },
  circuit_breaker: {
    failure_threshold: PRICING_DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
    recovery_timeout_ms: PRICING_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
    success_threshold: PRICING_DEFAULTS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
  },
};

export default function PricingSettingsPage() {
  const { t } = useTranslation();
  const [config, setConfig] = useState<TenantPricingConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/pricing/config");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setConfig({ ...DEFAULT_CONFIG, ...json.data });
        }
      }
    } catch (err) {
      console.error("Error loading pricing config:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/b2b/pricing/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_provider: config.active_provider,
          providers: config.providers,
          cache: config.cache,
          fallback: config.fallback,
          circuit_breaker: config.circuit_breaker,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setConfig({ ...DEFAULT_CONFIG, ...json.data });
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(json.error || t("pages.pricing.settings.saveError"));
      }
    } catch {
      alert(t("pages.pricing.settings.networkError"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const startTime = Date.now();
      const res = await fetch("/api/b2b/pricing/config");
      const latency = Date.now() - startTime;
      if (res.ok) {
        setTestResult({
          ok: true,
          message: t("pages.pricing.settings.testSuccess").replace(
            "{{latency}}",
            String(latency)
          ),
        });
      } else {
        setTestResult({
          ok: false,
          message: t("pages.pricing.settings.testFailed"),
        });
      }
    } catch {
      setTestResult({
        ok: false,
        message: t("pages.pricing.settings.testFailed"),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const updateProvider = (
    provider: "legacy_erp" | "generic_http",
    field: string,
    value: unknown
  ) => {
    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...(prev.providers[provider] || {}),
          [field]: value,
        },
      },
    }));
  };

  const updateResponseMapping = (field: string, value: string) => {
    setConfig((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        generic_http: {
          ...prev.providers.generic_http!,
          response_mapping: {
            ...prev.providers.generic_http!.response_mapping,
            [field]: value,
          },
        },
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const legacyErp = config.providers.legacy_erp!;
  const genericHttp = config.providers.generic_http!;

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            {t("pages.pricing.settings.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.pricing.settings.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border border-[#ebe9f1] bg-white hover:bg-[#f8f8f8] transition-all disabled:opacity-50 text-[#5e5873]"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            {t("pages.pricing.settings.testConnection")}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all disabled:opacity-50 ${
              saveSuccess
                ? "bg-green-500 text-white"
                : "bg-[#009688] text-white hover:bg-[#00796b]"
            }`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess
              ? t("pages.pricing.settings.saved")
              : t("pages.pricing.settings.saveSettings")}
          </button>
        </div>
      </div>

      {/* Test Connection Result */}
      {testResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            testResult.ok
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {testResult.message}
        </div>
      )}

      {/* Active Provider */}
      <Section
        title={t("pages.pricing.settings.activeProvider")}
        icon={Settings2}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#5e5873] mb-1">
              {t("pages.pricing.settings.provider")}
            </label>
            <select
              value={config.active_provider}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  active_provider: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
            >
              {PRICING_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {PRICING_PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {/* Legacy ERP Config */}
      <Section
        title={t("pages.pricing.settings.legacyErpConfig")}
        icon={Database}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={legacyErp.enabled}
              onChange={(e) =>
                updateProvider("legacy_erp", "enabled", e.target.checked)
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm text-[#5e5873]">
              {t("pages.pricing.settings.enabled")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={t("pages.pricing.settings.apiBaseUrl")}
              value={legacyErp.api_base_url}
              onChange={(v) => updateProvider("legacy_erp", "api_base_url", v)}
              placeholder="https://erp.example.com/api"
            />
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                {t("pages.pricing.settings.authMethod")}
              </label>
              <select
                value={legacyErp.auth_method}
                onChange={(e) =>
                  updateProvider("legacy_erp", "auth_method", e.target.value)
                }
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
              >
                {(["bearer", "api_key", "none"] as const).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {legacyErp.auth_method === "api_key" && (
              <InputField
                label={t("pages.pricing.settings.apiKey")}
                value={legacyErp.api_key || ""}
                onChange={(v) => updateProvider("legacy_erp", "api_key", v)}
                type="password"
              />
            )}
            {legacyErp.auth_method === "bearer" && (
              <InputField
                label={t("pages.pricing.settings.bearerToken")}
                value={legacyErp.bearer_token || ""}
                onChange={(v) =>
                  updateProvider("legacy_erp", "bearer_token", v)
                }
                type="password"
              />
            )}
            <InputField
              label={t("pages.pricing.settings.timeoutMs")}
              value={String(legacyErp.timeout_ms)}
              onChange={(v) =>
                updateProvider("legacy_erp", "timeout_ms", parseInt(v, 10) || PRICING_DEFAULTS.TIMEOUT_MS)
              }
              type="number"
            />
          </div>
        </div>
      </Section>

      {/* Generic HTTP Config */}
      <Section
        title={t("pages.pricing.settings.genericHttpConfig")}
        icon={Wifi}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={genericHttp.enabled}
              onChange={(e) =>
                updateProvider("generic_http", "enabled", e.target.checked)
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm text-[#5e5873]">
              {t("pages.pricing.settings.enabled")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={t("pages.pricing.settings.apiBaseUrl")}
              value={genericHttp.api_base_url}
              onChange={(v) =>
                updateProvider("generic_http", "api_base_url", v)
              }
              placeholder="https://api.example.com"
            />
            <InputField
              label={t("pages.pricing.settings.endpoint")}
              value={genericHttp.endpoint}
              onChange={(v) => updateProvider("generic_http", "endpoint", v)}
              placeholder="/prices"
            />
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                {t("pages.pricing.settings.authMethod")}
              </label>
              <select
                value={genericHttp.auth_method}
                onChange={(e) =>
                  updateProvider("generic_http", "auth_method", e.target.value)
                }
                className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm bg-white"
              >
                {PRICING_AUTH_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            {genericHttp.auth_method === "api_key" && (
              <>
                <InputField
                  label={t("pages.pricing.settings.apiKey")}
                  value={genericHttp.api_key || ""}
                  onChange={(v) =>
                    updateProvider("generic_http", "api_key", v)
                  }
                  type="password"
                />
                <InputField
                  label={t("pages.pricing.settings.apiSecret")}
                  value={genericHttp.api_secret || ""}
                  onChange={(v) =>
                    updateProvider("generic_http", "api_secret", v)
                  }
                  type="password"
                />
              </>
            )}
            {genericHttp.auth_method === "bearer" && (
              <InputField
                label={t("pages.pricing.settings.bearerToken")}
                value={genericHttp.bearer_token || ""}
                onChange={(v) =>
                  updateProvider("generic_http", "bearer_token", v)
                }
                type="password"
              />
            )}
            <InputField
              label={t("pages.pricing.settings.timeoutMs")}
              value={String(genericHttp.timeout_ms)}
              onChange={(v) =>
                updateProvider("generic_http", "timeout_ms", parseInt(v, 10) || PRICING_DEFAULTS.TIMEOUT_MS)
              }
              type="number"
            />
          </div>

          {/* Response Mapping */}
          <div className="mt-4 pt-4 border-t border-[#ebe9f1]">
            <h3 className="text-sm font-semibold text-[#5e5873] mb-3">
              {t("pages.pricing.settings.responseMapping")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InputField
                label={t("pages.pricing.settings.entityCodeField")}
                value={genericHttp.response_mapping.entity_code_field}
                onChange={(v) => updateResponseMapping("entity_code_field", v)}
              />
              <InputField
                label={t("pages.pricing.settings.netPriceField")}
                value={genericHttp.response_mapping.net_price_field}
                onChange={(v) => updateResponseMapping("net_price_field", v)}
              />
              <InputField
                label={t("pages.pricing.settings.grossPriceField")}
                value={genericHttp.response_mapping.gross_price_field}
                onChange={(v) => updateResponseMapping("gross_price_field", v)}
              />
              <InputField
                label={t("pages.pricing.settings.priceField")}
                value={genericHttp.response_mapping.price_field}
                onChange={(v) => updateResponseMapping("price_field", v)}
              />
              <InputField
                label={t("pages.pricing.settings.vatPercentField")}
                value={genericHttp.response_mapping.vat_percent_field || ""}
                onChange={(v) => updateResponseMapping("vat_percent_field", v)}
              />
              <InputField
                label={t("pages.pricing.settings.availabilityField")}
                value={genericHttp.response_mapping.availability_field || ""}
                onChange={(v) =>
                  updateResponseMapping("availability_field", v)
                }
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Cache Settings */}
      <Section
        title={t("pages.pricing.settings.cacheSettings")}
        icon={RefreshCw}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.cache.enabled}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  cache: { ...prev.cache, enabled: e.target.checked },
                }))
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm text-[#5e5873]">
              {t("pages.pricing.settings.cacheEnabled")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={t("pages.pricing.settings.cacheTtl")}
              value={String(config.cache.ttl_seconds)}
              onChange={(v) =>
                setConfig((prev) => ({
                  ...prev,
                  cache: {
                    ...prev.cache,
                    ttl_seconds: parseInt(v, 10) || PRICING_DEFAULTS.CACHE_TTL_SECONDS,
                  },
                }))
              }
              type="number"
            />
          </div>
        </div>
      </Section>

      {/* Fallback Settings */}
      <Section
        title={t("pages.pricing.settings.fallbackSettings")}
        icon={RefreshCw}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.fallback.log_errors}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  fallback: {
                    ...prev.fallback,
                    log_errors: e.target.checked,
                  },
                }))
              }
              className="rounded border-gray-300"
            />
            <span className="text-sm text-[#5e5873]">
              {t("pages.pricing.settings.logErrors")}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label={t("pages.pricing.settings.maxRetries")}
              value={String(config.fallback.max_retries)}
              onChange={(v) =>
                setConfig((prev) => ({
                  ...prev,
                  fallback: {
                    ...prev.fallback,
                    max_retries: parseInt(v, 10) || PRICING_DEFAULTS.MAX_RETRIES,
                  },
                }))
              }
              type="number"
            />
          </div>
        </div>
      </Section>

      {/* Circuit Breaker Settings */}
      <Section
        title={t("pages.pricing.settings.circuitBreakerSettings")}
        icon={Shield}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label={t("pages.pricing.settings.failureThreshold")}
            value={String(config.circuit_breaker.failure_threshold)}
            onChange={(v) =>
              setConfig((prev) => ({
                ...prev,
                circuit_breaker: {
                  ...prev.circuit_breaker,
                  failure_threshold:
                    parseInt(v, 10) ||
                    PRICING_DEFAULTS.CIRCUIT_BREAKER_FAILURE_THRESHOLD,
                },
              }))
            }
            type="number"
          />
          <InputField
            label={t("pages.pricing.settings.recoveryTimeoutMs")}
            value={String(config.circuit_breaker.recovery_timeout_ms)}
            onChange={(v) =>
              setConfig((prev) => ({
                ...prev,
                circuit_breaker: {
                  ...prev.circuit_breaker,
                  recovery_timeout_ms:
                    parseInt(v, 10) ||
                    PRICING_DEFAULTS.CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS,
                },
              }))
            }
            type="number"
          />
          <InputField
            label={t("pages.pricing.settings.successThreshold")}
            value={String(config.circuit_breaker.success_threshold)}
            onChange={(v) =>
              setConfig((prev) => ({
                ...prev,
                circuit_breaker: {
                  ...prev.circuit_breaker,
                  success_threshold:
                    parseInt(v, 10) ||
                    PRICING_DEFAULTS.CIRCUIT_BREAKER_SUCCESS_THRESHOLD,
                },
              }))
            }
            type="number"
          />
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-[#5e5873]" />
        <h2 className="text-lg font-semibold text-[#5e5873]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#5e5873] mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm"
      />
    </div>
  );
}
