"use client";

import { useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { getFieldDisplayName } from "@/lib/pim/conflict-resolver";

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
  const [resolutions, setResolutions] = useState<Record<string, "manual" | "api">>({});
  const [resolving, setResolving] = useState(false);

  const handleResolve = async () => {
    setResolving(true);
    try {
      await onResolve(resolutions);
    } catch (error) {
      console.error("Failed to resolve conflicts:", error);
      alert("Failed to resolve conflicts. Please try again.");
    } finally {
      setResolving(false);
    }
  };

  const allResolved = conflicts.every((c) => c.field in resolutions);

  return (
    <div className="bg-white border-2 border-orange-300 rounded-lg p-6 shadow-lg">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Update Conflicts Detected
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            This product has manual changes that conflict with incoming API updates.
            Choose which values to keep for each field.
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <p className="text-sm text-blue-800">
          <strong>Tip:</strong> Your manual edits are protected. Select which value to keep for each field below.
        </p>
      </div>

      {/* Conflicts List */}
      <div className="space-y-4">
        {conflicts.map((conflict) => (
          <div
            key={conflict.field}
            className="border rounded-lg p-4 bg-gray-50"
          >
            {/* Field Name */}
            <div className="mb-3">
              <h4 className="text-sm font-semibold text-gray-900">
                {getFieldDisplayName(conflict.field)}
              </h4>
              <p className="text-xs text-gray-500">
                Conflict detected on {new Date(conflict.detected_at).toLocaleString()}
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
                      : "border-gray-300 hover:border-green-300 bg-white"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">
                    Your Manual Edit
                  </span>
                  {resolutions[conflict.field] === "manual" && (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div className="text-sm text-gray-900 break-words">
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
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-blue-300 bg-white"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-700">
                    API Update
                  </span>
                  {resolutions[conflict.field] === "api" && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="text-sm text-gray-900 break-words">
                  {formatValue(conflict.api_value)}
                </div>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <p className="text-sm text-gray-600">
          {allResolved ? (
            <span className="text-green-600 font-medium">
              All conflicts resolved! Click save to apply changes.
            </span>
          ) : (
            <span>
              Please select a value for all {conflicts.length} conflicting fields
            </span>
          )}
        </p>
        <div className="flex gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              disabled={resolving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={handleResolve}
            disabled={!allResolved || resolving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resolving ? "Saving..." : "Save Resolutions"}
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
