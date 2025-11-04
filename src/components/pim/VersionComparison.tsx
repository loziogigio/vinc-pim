"use client";

import { useState, useEffect } from "react";
import { X, ArrowLeftRight, Plus, Minus, Edit3, Clock, User, Package } from "lucide-react";
import { formatValueForDisplay, getChangeSummary } from "@/lib/pim/version-comparison";

interface FieldChange {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  changeType: "added" | "removed" | "modified";
}

interface VersionInfo {
  version: number;
  created_at: string;
  manually_edited?: boolean;
  edited_by?: string;
  source?: {
    source_name: string;
  };
}

interface VersionComparisonProps {
  entityCode: string;
  v1: number;
  v2: number;
  onClose?: () => void;
}

export function VersionComparison({ entityCode, v1, v2, onClose }: VersionComparisonProps) {
  const [comparison, setComparison] = useState<any>(null);
  const [version1Info, setVersion1Info] = useState<VersionInfo | null>(null);
  const [version2Info, setVersion2Info] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchComparison();
  }, [entityCode, v1, v2]);

  async function fetchComparison() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/pim/products/${entityCode}/compare?v1=${v1}&v2=${v2}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to compare versions");
      }
      const data = await res.json();
      setComparison(data.comparison);
      setVersion1Info(data.version1);
      setVersion2Info(data.version2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comparison");
    } finally {
      setLoading(false);
    }
  }

  function getChangeIcon(changeType: string) {
    switch (changeType) {
      case "added":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "removed":
        return <Minus className="h-4 w-4 text-red-600" />;
      case "modified":
        return <Edit3 className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  }

  function getChangeBadgeColor(changeType: string) {
    switch (changeType) {
      case "added":
        return "bg-green-100 text-green-700 border-green-300";
      case "removed":
        return "bg-red-100 text-red-700 border-red-300";
      case "modified":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-xl max-w-4xl w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg p-8 shadow-xl max-w-4xl w-full">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-red-600">Error</h2>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          <p className="text-gray-700 mb-4">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!comparison || !version1Info || !version2Info) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full my-8">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
              <ArrowLeftRight className="h-6 w-6 text-blue-600" />
              Version Comparison
            </h2>
            <p className="text-sm text-gray-600">
              Comparing version {v1} with version {v2} • {comparison.totalChanges} change
              {comparison.totalChanges !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {getChangeSummary(comparison.changes)}
            </p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Version Info Header */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 border-b">
          {/* Version 1 Info */}
          <div className="bg-white rounded-lg p-4 border-2 border-red-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-red-100 text-red-700 text-sm font-semibold rounded">
                Version {v1}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(version1Info.created_at).toLocaleString()}</span>
              </div>
              {version1Info.manually_edited && version1Info.edited_by && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Edited by {version1Info.edited_by}</span>
                </div>
              )}
              {version1Info.source && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{version1Info.source.source_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Version 2 Info */}
          <div className="bg-white rounded-lg p-4 border-2 border-green-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-semibold rounded">
                Version {v2}
              </span>
            </div>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{new Date(version2Info.created_at).toLocaleString()}</span>
              </div>
              {version2Info.manually_edited && version2Info.edited_by && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Edited by {version2Info.edited_by}</span>
                </div>
              )}
              {version2Info.source && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{version2Info.source.source_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Changes List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {comparison.changes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No differences found</p>
              <p className="text-sm mt-2">These versions are identical</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comparison.changes.map((change: FieldChange, index: number) => (
                <div
                  key={index}
                  className="border rounded-lg overflow-hidden hover:shadow-md transition"
                >
                  {/* Field Header */}
                  <div className="bg-gray-50 px-4 py-2 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getChangeIcon(change.changeType)}
                      <h4 className="font-semibold text-gray-900">{change.fieldLabel}</h4>
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getChangeBadgeColor(
                        change.changeType
                      )}`}
                    >
                      {change.changeType}
                    </span>
                  </div>

                  {/* Value Comparison */}
                  <div className="grid grid-cols-2 divide-x">
                    {/* Old Value */}
                    <div className="p-4 bg-red-50">
                      <div className="text-xs text-gray-600 mb-1 font-medium">
                        Version {v1} {change.changeType === "removed" && "(removed)"}
                      </div>
                      <div className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
                        {formatValueForDisplay(change.oldValue)}
                      </div>
                    </div>

                    {/* New Value */}
                    <div className="p-4 bg-green-50">
                      <div className="text-xs text-gray-600 mb-1 font-medium">
                        Version {v2} {change.changeType === "added" && "(added)"}
                      </div>
                      <div className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
                        {formatValueForDisplay(change.newValue)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
