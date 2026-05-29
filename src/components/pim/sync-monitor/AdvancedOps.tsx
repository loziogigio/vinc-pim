"use client";

import { useState, useRef, useEffect } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Play,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

type CleanupMode = "none" | "clear_all" | "by_score" | "by_missing_fields" | "stale";
type RequiredField = "image" | "brand" | "category" | "product_type" | "specs";

interface PreviewResult {
  dry_run: boolean;
  cleanup?: {
    mode: string;
    would_remove?: number;
    affected_products?: { entity_code: string; missing_fields?: string[] }[];
  };
  resync?: {
    total: number;
    eligible: number;
    score_updates: number;
    eligible_products?: {
      entity_code: string;
      sku: string;
      name: string;
      completeness_score: number;
    }[];
  };
  duration_ms: number;
}

interface ExecuteResult {
  dry_run: boolean;
  job_id: string;
  cleanup?: {
    mode: string;
    removed_count?: number;
    unpublished_count?: number;
  };
  resync?: {
    total: number;
    eligible: number;
    indexed: number;
    failed: number;
    batches_processed: number;
    score_updates: number;
    errors: string[];
  };
  duration_ms: number;
}

interface HistoryItem {
  _id: string;
  job_id: string;
  status: "running" | "completed" | "failed";
  params: {
    cleanup_mode: string;
    resync_min_score?: number;
  };
  cleanup_result?: { mode: string; removed_count?: number };
  resync_result?: {
    total: number;
    indexed: number;
    failed: number;
    score_updates: number;
  };
  started_by: string;
  duration_ms?: number;
  error_message?: string;
  created_at: string;
}

// ============================================
// CONSTANTS
// ============================================

const REQUIRED_FIELD_OPTIONS: { value: RequiredField; label: string }[] = [
  { value: "image", label: "Primary Image" },
  { value: "brand", label: "Brand" },
  { value: "category", label: "Category" },
  { value: "product_type", label: "Product Type" },
  { value: "specs", label: "Technical Specs" },
];

// ============================================
// HELPER COMPONENTS
// ============================================

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15"
      : score >= 50
        ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15"
        : "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15";

  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

// ============================================
// PROPS
// ============================================

interface AdvancedOpsProps {
  onChanged?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export function AdvancedOps({ onChanged }: AdvancedOpsProps) {
  const { t } = useTranslation();

  // Form state
  const [cleanupMode, setCleanupMode] = useState<CleanupMode>("none");
  const [cleanupMinScore, setCleanupMinScore] = useState(50);
  const [cleanupFields, setCleanupFields] = useState<RequiredField[]>([]);
  const [resyncEnabled, setResyncEnabled] = useState(true);
  const [resyncMinScore, setResyncMinScore] = useState(70);
  const [recalcScores, setRecalcScores] = useState(true);
  const [rebuildEmbeddings, setRebuildEmbeddings] = useState(false);

  // UI state
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Running-job state (async POST path)
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [runningElapsedSec, setRunningElapsedSec] = useState(0);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }

  useEffect(() => {
    return stopPolling;
  }, []);

  // ============================================
  // HANDLERS
  // ============================================

  function buildRequestBody(dryRun: boolean) {
    return {
      cleanup_mode: cleanupMode,
      cleanup_min_score: cleanupMinScore,
      cleanup_required_fields: cleanupFields,
      resync: resyncEnabled,
      resync_min_score: resyncMinScore,
      recalculate_scores: recalcScores,
      rebuild_embeddings: rebuildEmbeddings,
      batch_size: 100,
      dry_run: dryRun,
    };
  }

  async function handlePreview() {
    setIsPreviewLoading(true);
    setPreviewResult(null);
    setExecuteResult(null);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(true)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreviewResult(data);
    } catch (err: any) {
      alert(`Preview failed: ${err.message}`);
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleExecute() {
    setShowConfirm(false);
    setIsExecuting(true);
    setExecuteResult(null);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody(false)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Async path: server returned 202 with a job_id. Start polling the
      // history endpoint until the matching row flips off "running".
      if (data.status === "running" && data.job_id) {
        startPollingJob(data.job_id);
        return;
      }

      // Legacy synchronous path (shouldn't happen for real runs now, but
      // kept as a fallback).
      setExecuteResult(data);
      onChanged?.();
    } catch (err: any) {
      alert(`Batch sync failed: ${err.message}`);
      setIsExecuting(false);
    }
  }

  function startPollingJob(jobId: string) {
    setRunningJobId(jobId);
    const startedAt = Date.now();
    setRunningElapsedSec(0);

    stopPolling();

    elapsedTimerRef.current = setInterval(() => {
      setRunningElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/b2b/pim/products/batch-sync?limit=10");
        if (!res.ok) return;
        const data = await res.json();
        const items: HistoryItem[] = data.items ?? [];
        const row = items.find((it) => it.job_id === jobId);
        if (row && row.status !== "running") {
          stopPolling();
          setRunningJobId(null);
          setIsExecuting(false);
          setExecuteResult({
            dry_run: false,
            job_id: row.job_id,
            cleanup: row.cleanup_result,
            resync: row.resync_result
              ? {
                  total: row.resync_result.total,
                  eligible: row.resync_result.total,
                  indexed: row.resync_result.indexed,
                  failed: row.resync_result.failed,
                  batches_processed: 0,
                  score_updates: row.resync_result.score_updates,
                  errors: [],
                }
              : undefined,
            duration_ms: row.duration_ms ?? 0,
          });
          if (row.status === "failed") {
            alert(`Batch sync failed: ${row.error_message || "Unknown error"}`);
          }
          onChanged?.();
        }
      } catch {
        // silent; keep polling
      }
    }, 3000);
  }

  function toggleField(field: RequiredField) {
    setCleanupFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  const isFormValid = cleanupMode !== "none" || resyncEnabled;

  // ============================================
  // RENDER
  // ============================================

  return (
    <details className="rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <summary className="flex cursor-pointer select-none items-start justify-between gap-3 p-6 marker:content-['']">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-foreground" />
          <div>
            <div className="text-lg font-semibold text-foreground">
              {t("pages.pim.batchSync.advancedMaintenance")}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t("pages.pim.batchSync.advancedMaintenanceDesc")}
            </div>
          </div>
        </div>
        <svg
          className="h-4 w-4 mt-1 flex-shrink-0 text-muted-foreground transition-transform details-chevron"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <div className="px-6 pb-6 space-y-6">
        {/* Form card */}
        <div className="rounded-[0.428rem] border border-border bg-background p-5">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("pages.pim.batchSync.runBatchSync")}
          </h2>

          {/* Cleanup Mode */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("pages.pim.batchSync.cleanupMode")}
            </label>
            <div className="space-y-2">
              {[
                { value: "none" as const, label: "No cleanup", desc: "Skip cleanup phase" },
                { value: "clear_all" as const, label: "Clear all", desc: "Remove everything from Solr" },
                { value: "by_score" as const, label: "By min score", desc: "Remove items below a score threshold" },
                { value: "by_missing_fields" as const, label: "By missing fields", desc: "Remove items missing specific data" },
                { value: "stale" as const, label: "Remove stale", desc: "Remove Solr docs not matching published products" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition ${
                    cleanupMode === opt.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80"
                  }`}
                >
                  <input
                    type="radio"
                    name="cleanup_mode"
                    value={opt.value}
                    checked={cleanupMode === opt.value}
                    onChange={() => setCleanupMode(opt.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{opt.label}</div>
                    <div className="text-xs text-muted-foreground">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Score input for by_score mode */}
            {cleanupMode === "by_score" && (
              <div className="mt-3 ml-8">
                <label className="text-sm text-muted-foreground">
                  Remove items with score below:
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={cleanupMinScore}
                  onChange={(e) => setCleanupMinScore(Number(e.target.value))}
                  className="ml-2 w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                />
              </div>
            )}

            {/* Checkboxes for by_missing_fields mode */}
            {cleanupMode === "by_missing_fields" && (
              <div className="mt-3 ml-8 space-y-1">
                <label className="text-sm text-muted-foreground mb-1 block">
                  Remove if missing any of:
                </label>
                {REQUIRED_FIELD_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 text-sm text-foreground cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={cleanupFields.includes(opt.value)}
                      onChange={() => toggleField(opt.value)}
                      className="accent-primary"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Resync Toggle */}
          <div className="mb-5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground">{t("pages.pim.batchSync.resyncToSolr")}</label>
                <p className="text-xs text-muted-foreground">{t("pages.pim.batchSync.resyncDescription")}</p>
              </div>
              <button
                onClick={() => setResyncEnabled(!resyncEnabled)}
                className={`relative w-10 h-5 rounded-full transition ${
                  resyncEnabled ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    resyncEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {resyncEnabled && (
              <div className="mt-3 ml-2 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-muted-foreground">Min score:</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={resyncMinScore}
                    onChange={(e) => setResyncMinScore(Number(e.target.value))}
                    className="w-20 rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recalcScores}
                    onChange={(e) => setRecalcScores(e.target.checked)}
                    className="accent-primary"
                  />
                  {t("pages.pim.batchSync.recalculateScores")}
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rebuildEmbeddings}
                    onChange={(e) => setRebuildEmbeddings(e.target.checked)}
                    className="accent-primary"
                  />
                  {t("pages.pim.batchSync.rebuildEmbeddings")}
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 border-t border-border pt-4">
            <button
              onClick={handlePreview}
              disabled={!isFormValid || isPreviewLoading || isExecuting}
              className="flex items-center gap-2 rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPreviewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              {t("common.preview")}
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!isFormValid || isPreviewLoading || isExecuting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {t("pages.pim.batchSync.runBatchSync")}
            </button>
          </div>
          {runningJobId && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-mono text-xs">{runningJobId}</span>
              <span>· running {runningElapsedSec}s</span>
            </div>
          )}
        </div>

        {/* Preview Results */}
        {previewResult && (
          <div className="rounded-[0.428rem] border border-blue-200 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 p-5">
            <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {t("pages.pim.batchSync.previewResults")}
              <span className="text-xs font-normal text-blue-600 dark:text-blue-400">
                ({previewResult.duration_ms}ms)
              </span>
            </h3>

            {previewResult.cleanup && (
              <div className="mb-3">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Cleanup ({previewResult.cleanup.mode}):</strong>{" "}
                  {previewResult.cleanup.would_remove ?? 0} items would be removed
                </div>
                {previewResult.cleanup.affected_products &&
                  previewResult.cleanup.affected_products.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-blue-600 dark:text-blue-400">
                            <th className="pb-1">Entity Code</th>
                            <th className="pb-1">Missing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewResult.cleanup.affected_products.map((p) => (
                            <tr key={p.entity_code} className="border-t border-blue-100 dark:border-blue-500/20">
                              <td className="py-1 font-mono">{p.entity_code}</td>
                              <td className="py-1">{p.missing_fields?.join(", ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}

            {previewResult.resync && (
              <div>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Resync:</strong> {previewResult.resync.eligible} eligible
                  out of {previewResult.resync.total} published
                  {previewResult.resync.score_updates > 0 && (
                    <span> ({previewResult.resync.score_updates} scores changed)</span>
                  )}
                  {(previewResult.resync as any).embedding_updates > 0 && (
                    <span> ({(previewResult.resync as any).embedding_updates} embeddings to rebuild)</span>
                  )}
                </div>
                {previewResult.resync.eligible_products &&
                  previewResult.resync.eligible_products.length > 0 && (
                    <div className="mt-2 max-h-40 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-blue-600 dark:text-blue-400">
                            <th className="pb-1">Entity Code</th>
                            <th className="pb-1">SKU</th>
                            <th className="pb-1">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {previewResult.resync.eligible_products.map((p) => (
                            <tr key={p.entity_code} className="border-t border-blue-100 dark:border-blue-500/20">
                              <td className="py-1 font-mono">{p.entity_code}</td>
                              <td className="py-1">{p.sku}</td>
                              <td className="py-1">
                                <ScoreBadge score={p.completeness_score} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </div>
        )}

        {/* Execute Results */}
        {executeResult && (
          <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-5">
            <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {t("pages.pim.batchSync.batchSyncComplete")}
              <span className="text-xs font-normal text-emerald-600 dark:text-emerald-400">
                ({(executeResult.duration_ms / 1000).toFixed(1)}s)
              </span>
            </h3>

            {executeResult.cleanup && (
              <div className="text-sm text-emerald-800 dark:text-emerald-200 mb-2">
                <strong>Cleanup ({executeResult.cleanup.mode}):</strong>{" "}
                {executeResult.cleanup.removed_count === -1
                  ? "All items cleared"
                  : `${executeResult.cleanup.removed_count} removed from Solr`}
                {executeResult.cleanup.unpublished_count != null && executeResult.cleanup.unpublished_count > 0 && (
                  <span>, {executeResult.cleanup.unpublished_count} unpublished in MongoDB</span>
                )}
              </div>
            )}

            {executeResult.resync && (
              <div className="text-sm text-emerald-800 dark:text-emerald-200 space-y-1">
                <div>
                  <strong>Resync:</strong> {executeResult.resync.indexed} indexed,{" "}
                  {executeResult.resync.failed} failed ({executeResult.resync.batches_processed} batches)
                </div>
                {executeResult.resync.score_updates > 0 && (
                  <div>{executeResult.resync.score_updates} scores updated in DB</div>
                )}
                {(executeResult.resync as any).embedding_updates > 0 && (
                  <div>{(executeResult.resync as any).embedding_updates} embeddings rebuilt in DB</div>
                )}
                {executeResult.resync.errors.length > 0 && (
                  <div className="mt-2 text-red-700 dark:text-red-400 text-xs">
                    Errors: {executeResult.resync.errors.slice(0, 5).join("; ")}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={showConfirm}
        title="Run Batch Sync?"
        message={`This will ${
          cleanupMode !== "none"
            ? `cleanup Solr (${cleanupMode.replace("_", " ")}) and `
            : ""
        }${resyncEnabled ? `resync products with score >= ${resyncMinScore}` : "skip resync"}. This operation cannot be undone.`}
        confirmText="Run Batch Sync"
        variant={cleanupMode === "clear_all" ? "danger" : "warning"}
        onConfirm={handleExecute}
        onCancel={() => setShowConfirm(false)}
      />
    </details>
  );
}
