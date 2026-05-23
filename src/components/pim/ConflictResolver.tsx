"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { getFieldDisplayName } from "@/lib/pim/conflict-resolver";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ConflictData {
  field: string;
  manual_value: any;
  api_value: any;
  detected_at: Date;
}

interface ConflictResolverProps {
  conflicts: ConflictData[];
  entityCode: string;
  onResolve: (resolutions: Record<string, "manual" | "api">) => Promise<void>;
  onDismiss?: () => void;
}

export function ConflictResolver({
  conflicts,
  entityCode,
  onResolve,
  onDismiss,
}: ConflictResolverProps) {
  const { t } = useTranslation();
  const [resolutions, setResolutions] = useState<Record<string, "manual" | "api">>({});
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(resolutions);
    } catch (error) {
      console.error("Failed to resolve conflicts:", error);
      alert(t("pages.pim.conflictResolver.resolveError"));
    } finally {
      setResolving(false);
    }
  };

  const allResolved = conflicts.every((c) => c.field in resolutions);

  return (
    <div className="bg-card border-2 border-orange-300 dark:border-orange-500/40 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {t("pages.pim.conflictResolver.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t("pages.pim.conflictResolver.description")}
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 dark:bg-blue-500/15 dark:border-blue-500/40">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Tip:</strong> {t("pages.pim.conflictResolver.tip")}
        </p>
      </div>

      {/* Conflicts List */}
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.field}
            className="border rounded-lg p-4 bg-muted"
          >
            {/* Field Name */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-foreground">
                {getFieldDisplayName(conflict.field)}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("pages.pim.conflictResolver.detectedOn", { date: new Date(conflict.detected_at).toLocaleString() })}
              </p>
            </div>

            {/* Value Comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Manual Value */}
              <button
                type="button"
                onClick={() =>
                  setResolutions({ ...resolutions, [conflict.field]: "manual" })
                }
                className={`
                  p-3 rounded-lg border-2 text-left transition
                  ${
                    resolutions[conflict.field] === "manual"
                      ? "border-green-500 bg-green-50"
                      : "border-border hover:border-green-300 dark:hover:border-green-500/40 bg-card"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("pages.pim.conflictResolver.yourEdit")}
                  </span>
                  {resolutions[conflict.field] === "manual" && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="text-sm text-foreground break-words">
                  {formatValue(conflict.manual_value)}
                </div>
              </button>

              {/* API Value */}
              <button
                type="button"
                onClick={() =>
                  setResolutions({ ...resolutions, [conflict.field]: "api" })
                }
                className={`
                  p-3 rounded-lg border-2 text-left transition
                  ${
                    resolutions[conflict.field] === "api"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
                      : "border-border hover:border-blue-300 dark:hover:border-blue-500/40 bg-card"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("pages.pim.conflictResolver.apiUpdate")}
                  </span>
                  {resolutions[conflict.field] === "api" && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="text-sm text-foreground break-words">
                  {formatValue(conflict.api_value)}
                </div>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <p className="text-sm text-muted-foreground">
          {allResolved ? (
            <span className="text-green-600 font-medium">
              {t("pages.pim.conflictResolver.allResolved")}
            </span>
          ) : (
            <span>
              {t("pages.pim.conflictResolver.selectValues", { count: String(conflicts.length) })}
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={resolving}
              className="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
          )}
          <button
            type="button"
            onClick={handleResolve}
            disabled={!allResolved || resolving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolving ? t("pages.pim.conflictResolver.saving") : t("pages.pim.conflictResolver.saveResolutions")}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Format value for display
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return "(empty)";
  }

  if (typeof value === "object") {
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "(empty array)";
    }
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toString();
  }

  return String(value);
}
