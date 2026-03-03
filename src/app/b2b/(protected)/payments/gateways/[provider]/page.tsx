"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Loader2,
  Save,
  Eye,
  EyeOff,
  Copy,
  Check,
  Globe,
} from "lucide-react";
import {
  PAYMENT_PROVIDER_LABELS,
  PROVIDER_CAPABILITIES,
} from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";
import { PROVIDER_FIELDS } from "@/lib/constants/provider-fields";
import type { ProviderFieldDef } from "@/lib/constants/provider-fields";

export default function ProviderConfigPage() {
  const { provider } = useParams<{ provider: string }>();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const fields = PROVIDER_FIELDS[provider as PaymentProvider] ?? [];
  const label = PAYMENT_PROVIDER_LABELS[provider as PaymentProvider] ?? provider;
  const caps = PROVIDER_CAPABILITIES[provider as PaymentProvider];

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/payments/config/providers/${provider}`);
      const data = await res.json();
      if (data.success && data.config) {
        setFormData(data.config);
      } else {
        // Initialize with defaults for toggle fields
        const defaults: Record<string, unknown> = {};
        for (const field of fields) {
          if (field.type === "toggle") defaults[field.key] = false;
          if (field.type === "environment") defaults[field.key] = field.options?.[0] ?? "sandbox";
        }
        setFormData(defaults);
      }
    } catch {
      setError("Errore nel caricamento della configurazione");
    } finally {
      setIsLoading(false);
    }
  }, [provider, fields]);

  useEffect(() => {
    if (provider && fields.length > 0) loadConfig();
  }, [provider, fields.length, loadConfig]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/payments/config/providers/${provider}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        setFormData(data.config);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(data.error || "Errore nel salvataggio");
      }
    } catch {
      setError("Errore di rete");
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSecretVisibility = (key: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Unknown provider
  if (!fields.length) {
    return (
      <div className="p-6">
        <Link
          href={`${tenantPrefix}/b2b/payments/gateways`}
          className="inline-flex items-center gap-1.5 text-sm text-[#009688] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai Gateway
        </Link>
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-8 text-center">
          <p className="text-muted-foreground">
            Provider &quot;{provider}&quot; non configurabile.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back link */}
      <Link
        href={`${tenantPrefix}/b2b/payments/gateways`}
        className="inline-flex items-center gap-1.5 text-sm text-[#009688] hover:underline"
      >
        <ArrowLeft className="w-4 h-4" />
        Torna ai Gateway
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">
            Configura {label}
          </h1>
          {caps && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {caps.supportsOnClick && (
                <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-600">OnClick</span>
              )}
              {caps.supportsMoto && (
                <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-600">MOTO</span>
              )}
              {caps.supportsRecurring && (
                <span className="px-2 py-0.5 rounded text-xs bg-cyan-50 text-cyan-600">Ricorrente</span>
              )}
              {caps.supportsAutomaticSplit && (
                <span className="px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-600">Split</span>
              )}
            </div>
          )}
        </div>
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
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saveSuccess ? "Salvato!" : "Salva"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-5 space-y-5">
          {fields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={formData[field.key]}
              onChange={(val) => updateField(field.key, val)}
              secretVisible={visibleSecrets.has(field.key)}
              onToggleSecret={() => toggleSecretVisibility(field.key)}
              provider={provider}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// FIELD RENDERER
// ============================================

function FieldRenderer({
  field,
  value,
  onChange,
  secretVisible,
  onToggleSecret,
  provider,
}: {
  field: ProviderFieldDef;
  value: unknown;
  onChange: (val: unknown) => void;
  secretVisible: boolean;
  onToggleSecret: () => void;
  provider: string;
}) {
  const inputClass =
    "w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20";

  switch (field.type) {
    case "text":
      return (
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
        </div>
      );

    case "secret":
      return (
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <div className="relative">
            <input
              type={secretVisible ? "text" : "password"}
              value={(value as string) ?? ""}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={onToggleSecret}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {secretVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      );

    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <label className="text-sm font-medium text-[#5e5873]">
            {field.label}
          </label>
          <button
            type="button"
            onClick={() => onChange(!value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? "bg-[#009688]" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );

    case "select":
      return (
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
            {field.label}
          </label>
          <select
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          >
            <option value="">— Seleziona —</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {field.optionLabels?.[opt] ?? opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "environment": {
      const testValue = field.options?.[0] ?? "sandbox";
      const liveValue = field.options?.[1] ?? "production";
      const testLabel = field.optionLabels?.[testValue] ?? "Sandbox";
      const liveLabel = field.optionLabels?.[liveValue] ?? "Production";
      return (
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
            {field.label}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange(testValue)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                value === testValue || !value
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-[#ebe9f1] text-gray-400 hover:border-amber-200"
              }`}
            >
              {testLabel}
            </button>
            <button
              type="button"
              onClick={() => onChange(liveValue)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-all ${
                value === liveValue
                  ? "border-green-300 bg-green-50 text-green-700"
                  : "border-[#ebe9f1] text-gray-400 hover:border-green-200"
              }`}
            >
              {liveLabel}
            </button>
          </div>
        </div>
      );
    }

    case "textarea":
      return (
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={inputClass}
          />
        </div>
      );

    case "webhook_url":
      return (
        <WebhookUrlField
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
          provider={provider}
        />
      );

    default:
      return null;
  }
}

// ============================================
// WEBHOOK URL BUILDER
// ============================================

interface TenantDomainOption {
  hostname: string;
  protocol: string;
  is_primary: boolean;
}

function WebhookUrlField({
  value,
  onChange,
  provider,
}: {
  value: string;
  onChange: (val: string) => void;
  provider: string;
}) {
  const [domains, setDomains] = useState<TenantDomainOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [selectedDomain, setSelectedDomain] = useState("custom");
  const [customDomain, setCustomDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Fetch tenant domains on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/b2b/payments/config/domains");
        const data = await res.json();
        if (data.success) {
          setDomains(data.domains || []);
          setTenantId(data.tenant_id || "");
        }
      } catch {
        // Silently fail — user can still paste custom
      } finally {
        setLoadingDomains(false);
      }
    })();
  }, []);

  // When value is already set (loaded from DB), try to match a domain
  useEffect(() => {
    if (!value || domains.length === 0) return;
    const matched = domains.find((d) =>
      value.includes(d.hostname)
    );
    if (matched) {
      setSelectedDomain(matched.hostname);
    } else {
      setSelectedDomain("custom");
      // Extract domain from full URL
      try {
        const url = new URL(value);
        setCustomDomain(`${url.protocol}//${url.host}`);
      } catch {
        setCustomDomain(value);
      }
    }
    // Only run when domains load, not on every value change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domains]);

  // Build webhook URL from selected domain
  const buildUrl = useCallback(
    (domainHostname: string, protocol = "https") => {
      const base = `${protocol}://${domainHostname}`;
      return `${base}/api/public/payments/webhooks/${provider}?tenant=${tenantId}`;
    },
    [provider, tenantId]
  );

  const handleDomainSelect = (hostname: string) => {
    setSelectedDomain(hostname);
    if (hostname === "custom") {
      if (customDomain) {
        // Try to build from custom domain
        const clean = customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
        onChange(buildUrl(clean));
      } else {
        onChange("");
      }
    } else {
      const domain = domains.find((d) => d.hostname === hostname);
      onChange(buildUrl(hostname, domain?.protocol || "https"));
    }
  };

  const handleCustomDomainChange = (raw: string) => {
    setCustomDomain(raw);
    const clean = raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (clean) {
      onChange(buildUrl(clean));
    } else {
      onChange("");
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#5e5873]">
        Webhook URL
      </label>

      {/* Domain selector */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={selectedDomain}
            onChange={(e) => handleDomainSelect(e.target.value)}
            disabled={loadingDomains}
            className="w-full pl-9 pr-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20 appearance-none bg-white"
          >
            {domains.map((d) => (
              <option key={d.hostname} value={d.hostname}>
                {d.protocol}://{d.hostname}
                {d.is_primary ? " (principale)" : ""}
              </option>
            ))}
            <option value="custom">Dominio personalizzato...</option>
          </select>
        </div>
      </div>

      {/* Custom domain input */}
      {selectedDomain === "custom" && (
        <input
          type="text"
          value={customDomain}
          onChange={(e) => handleCustomDomainChange(e.target.value)}
          placeholder="es. https://abc123.ngrok.io"
          className="w-full px-3 py-2.5 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
        />
      )}

      {/* Generated URL (read-only + copy) */}
      {value && (
        <div className="flex items-center gap-2 bg-gray-50 border border-[#ebe9f1] rounded-lg p-3">
          <code className="flex-1 text-xs text-[#5e5873] break-all select-all">
            {value}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-1.5 rounded hover:bg-gray-200 transition-colors"
            title="Copia URL"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Copia questo URL e registralo come webhook nel pannello del provider.
        Dopo la registrazione, incolla il Webhook ID nel campo sotto.
      </p>
    </div>
  );
}
