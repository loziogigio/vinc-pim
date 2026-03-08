"use client";

import { useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useEffect } from "react";
import {
  RefreshCw,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Play,
  Eye,
  Database,
  Server,
  AlertOctagon,
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

interface CheckResult {
  entity_code: string;
  sku: string;
  name: string;
  status: string;
  completeness_score: number;
  stored_score: number | null;
  critical_issues: string[];
  in_solr: boolean;
  solr_score: number | null;
  last_synced_at: string | null;
  score_drift: number | null;
}

interface SyncStats {
  mongo_published: number;
  mongo_total: number;
  solr_indexed: number;
  solr_available: boolean;
  stale_estimate: number;
  missing_from_solr: number;
  in_sync: boolean;
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
// COMPONENT
// ============================================

export default function BatchSyncPage() {
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

  // Fast check state
  const [checkQuery, setCheckQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");

  // Stats state
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

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
      setExecuteResult(data);
      loadHistory();
      loadStats();
    } catch (err: any) {
      alert(`Batch sync failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  }

  async function handleCheck() {
    if (!checkQuery.trim()) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError("");
    try {
      const res = await fetch(
        `/api/b2b/pim/products/batch-sync/check?q=${encodeURIComponent(checkQuery.trim())}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCheckResult(data.product);
    } catch (err: any) {
      setCheckError(err.message);
    } finally {
      setIsChecking(false);
    }
  }

  async function loadHistory() {
    setIsHistoryLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync?limit=10");
      const data = await res.json();
      if (res.ok) {
        setHistory(data.items);
      }
    } catch {
      // silent
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function loadStats() {
    setIsStatsLoading(true);
    try {
      const res = await fetch("/api/b2b/pim/products/batch-sync/stats");
      const data = await res.json();
      if (res.ok) setStats(data.stats);
    } catch {
      // silent
    } finally {
      setIsStatsLoading(false);
    }
  }

  // Load stats and history on mount
  useEffect(() => {
    loadStats();
    loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "PIM", href: "/b2b/pim" },
          { label: "Batch Sync" },
        ]}
      />

      {/* Sync Status Overview */}
      {stats && (
        <div className={`rounded-[0.428rem] border p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] ${
          stats.in_sync
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-[#6e6b7b]" />
                <span className="text-sm text-[#6e6b7b]">MongoDB Published:</span>
                <span className="text-sm font-semibold text-[#5e5873]">{stats.mongo_published}</span>
              </div>
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-[#6e6b7b]" />
                <span className="text-sm text-[#6e6b7b]">Solr Indexed:</span>
                <span className="text-sm font-semibold text-[#5e5873]">{stats.solr_indexed}</span>
              </div>
              {stats.stale_estimate > 0 && (
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">
                    ~{stats.stale_estimate} stale in Solr
                  </span>
                </div>
              )}
              {stats.missing_from_solr > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">
                    {stats.missing_from_solr} not indexed in Solr
                  </span>
                </div>
              )}
              {stats.in_sync && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-700">In sync</span>
                </div>
              )}
            </div>
            <button
              onClick={loadStats}
              disabled={isStatsLoading}
              className="text-[#6e6b7b] hover:text-[#5e5873]"
            >
              <RefreshCw className={`h-4 w-4 ${isStatsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ======================== */}
        {/* Section A: Run Batch Sync */}
        {/* ======================== */}
        <div className="space-y-6">
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h2 className="text-lg font-semibold text-[#5e5873] mb-4 flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Run Batch Sync
            </h2>

            {/* Cleanup Mode */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#5e5873] mb-2">
                Cleanup Mode
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
                        ? "border-[#009688] bg-[rgba(0,150,136,0.04)]"
                        : "border-[#ebe9f1] hover:border-[#d4d2dc]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cleanup_mode"
                      value={opt.value}
                      checked={cleanupMode === opt.value}
                      onChange={() => setCleanupMode(opt.value)}
                      className="mt-0.5 accent-[#009688]"
                    />
                    <div>
                      <div className="text-sm font-medium text-[#5e5873]">{opt.label}</div>
                      <div className="text-xs text-[#b9b9c3]">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Score input for by_score mode */}
              {cleanupMode === "by_score" && (
                <div className="mt-3 ml-8">
                  <label className="text-sm text-[#6e6b7b]">
                    Remove items with score below:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={cleanupMinScore}
                    onChange={(e) => setCleanupMinScore(Number(e.target.value))}
                    className="ml-2 w-20 rounded border border-[#d8d6de] px-2 py-1 text-sm"
                  />
                </div>
              )}

              {/* Checkboxes for by_missing_fields mode */}
              {cleanupMode === "by_missing_fields" && (
                <div className="mt-3 ml-8 space-y-1">
                  <label className="text-sm text-[#6e6b7b] mb-1 block">
                    Remove if missing any of:
                  </label>
                  {REQUIRED_FIELD_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 text-sm text-[#5e5873] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={cleanupFields.includes(opt.value)}
                        onChange={() => toggleField(opt.value)}
                        className="accent-[#009688]"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Resync Toggle */}
            <div className="mb-5 border-t border-[#ebe9f1] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-[#5e5873]">Resync to Solr</label>
                  <p className="text-xs text-[#b9b9c3]">Re-index published products meeting minimum score</p>
                </div>
                <button
                  onClick={() => setResyncEnabled(!resyncEnabled)}
                  className={`relative w-10 h-5 rounded-full transition ${
                    resyncEnabled ? "bg-[#009688]" : "bg-[#d8d6de]"
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
                    <label className="text-sm text-[#6e6b7b]">Min score:</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={resyncMinScore}
                      onChange={(e) => setResyncMinScore(Number(e.target.value))}
                      className="w-20 rounded border border-[#d8d6de] px-2 py-1 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[#5e5873] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={recalcScores}
                      onChange={(e) => setRecalcScores(e.target.checked)}
                      className="accent-[#009688]"
                    />
                    Recalculate scores before syncing
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#5e5873] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rebuildEmbeddings}
                      onChange={(e) => setRebuildEmbeddings(e.target.checked)}
                      className="accent-[#009688]"
                    />
                    Rebuild embedded data (categories, brands)
                  </label>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 border-t border-[#ebe9f1] pt-4">
              <button
                onClick={handlePreview}
                disabled={!isFormValid || isPreviewLoading || isExecuting}
                className="flex items-center gap-2 rounded-md border border-[#009688] px-4 py-2 text-sm font-medium text-[#009688] hover:bg-[rgba(0,150,136,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPreviewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                Preview
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!isFormValid || isPreviewLoading || isExecuting}
                className="flex items-center gap-2 rounded-md bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Run Batch Sync
              </button>
            </div>
          </div>

          {/* Preview Results */}
          {previewResult && (
            <div className="rounded-[0.428rem] border border-blue-200 bg-blue-50 p-5">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview Results
                <span className="text-xs font-normal text-blue-600">
                  ({previewResult.duration_ms}ms)
                </span>
              </h3>

              {previewResult.cleanup && (
                <div className="mb-3">
                  <div className="text-sm text-blue-800">
                    <strong>Cleanup ({previewResult.cleanup.mode}):</strong>{" "}
                    {previewResult.cleanup.would_remove ?? 0} items would be removed
                  </div>
                  {previewResult.cleanup.affected_products &&
                    previewResult.cleanup.affected_products.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-blue-600">
                              <th className="pb-1">Entity Code</th>
                              <th className="pb-1">Missing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewResult.cleanup.affected_products.map((p) => (
                              <tr key={p.entity_code} className="border-t border-blue-100">
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
                  <div className="text-sm text-blue-800">
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
                            <tr className="text-left text-blue-600">
                              <th className="pb-1">Entity Code</th>
                              <th className="pb-1">SKU</th>
                              <th className="pb-1">Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewResult.resync.eligible_products.map((p) => (
                              <tr key={p.entity_code} className="border-t border-blue-100">
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
            <div className="rounded-[0.428rem] border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Batch Sync Complete
                <span className="text-xs font-normal text-emerald-600">
                  ({(executeResult.duration_ms / 1000).toFixed(1)}s)
                </span>
              </h3>

              {executeResult.cleanup && (
                <div className="text-sm text-emerald-800 mb-2">
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
                <div className="text-sm text-emerald-800 space-y-1">
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
                    <div className="mt-2 text-red-700 text-xs">
                      Errors: {executeResult.resync.errors.slice(0, 5).join("; ")}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ======================== */}
        {/* Section B: Fast Check */}
        {/* ======================== */}
        <div className="space-y-6">
          <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
            <h3 className="text-sm font-semibold text-[#5e5873] mb-3 flex items-center gap-2">
              <Search className="h-4 w-4" />
              Fast Check
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Entity code or SKU"
                value={checkQuery}
                onChange={(e) => setCheckQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                className="flex-1 rounded border border-[#d8d6de] px-3 py-2 text-sm placeholder:text-[#b9b9c3]"
              />
              <button
                onClick={handleCheck}
                disabled={isChecking || !checkQuery.trim()}
                className="rounded bg-[#009688] px-3 py-2 text-sm text-white hover:bg-[#00796b] disabled:opacity-50"
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </button>
            </div>

            {checkError && (
              <div className="mt-3 text-sm text-red-600 flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                {checkError}
              </div>
            )}

            {checkResult && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-[#5e5873]">
                      {checkResult.name}
                    </div>
                    <div className="text-xs text-[#b9b9c3]">
                      {checkResult.entity_code} / {checkResult.sku}
                    </div>
                  </div>
                  <StatusBadge status={checkResult.status} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded bg-[#fafafc] p-2">
                    <div className="text-xs text-[#b9b9c3]">Score (live)</div>
                    <ScoreBadge score={checkResult.completeness_score} />
                  </div>
                  <div className="rounded bg-[#fafafc] p-2">
                    <div className="text-xs text-[#b9b9c3]">In Solr</div>
                    <div className="flex items-center gap-1">
                      {checkResult.in_solr ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-700">Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-500" />
                          <span className="text-red-700">No</span>
                        </>
                      )}
                    </div>
                  </div>
                  {checkResult.solr_score !== null && (
                    <div className="rounded bg-[#fafafc] p-2">
                      <div className="text-xs text-[#b9b9c3]">Solr Score</div>
                      <ScoreBadge score={checkResult.solr_score} />
                    </div>
                  )}
                  {checkResult.score_drift !== null && checkResult.score_drift !== 0 && (
                    <div className="rounded bg-[#fafafc] p-2">
                      <div className="text-xs text-[#b9b9c3]">Score Drift</div>
                      <span
                        className={`text-sm font-medium ${
                          checkResult.score_drift > 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {checkResult.score_drift > 0 ? "+" : ""}
                        {checkResult.score_drift}
                      </span>
                    </div>
                  )}
                </div>

                {checkResult.last_synced_at && (
                  <div className="text-xs text-[#b9b9c3] flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last synced: {new Date(checkResult.last_synced_at).toLocaleString()}
                  </div>
                )}

                {checkResult.critical_issues.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-amber-700">
                      Critical Issues:
                    </div>
                    {checkResult.critical_issues.map((issue, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-1 text-xs text-amber-600"
                      >
                        <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======================== */}
      {/* Section C: Activity History */}
      {/* ======================== */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#5e5873] flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity History
          </h2>
          <button
            onClick={loadHistory}
            disabled={isHistoryLoading}
            className="text-sm text-[#009688] hover:underline flex items-center gap-1"
          >
            {isHistoryLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-[#b9b9c3] text-sm">
            No batch sync runs yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#b9b9c3] border-b border-[#ebe9f1]">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Started By</th>
                  <th className="pb-2 font-medium">Cleanup</th>
                  <th className="pb-2 font-medium">Removed</th>
                  <th className="pb-2 font-medium">Indexed</th>
                  <th className="pb-2 font-medium">Failed</th>
                  <th className="pb-2 font-medium">Duration</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item._id} className="border-b border-[#ebe9f1] last:border-0">
                    <td className="py-2.5 text-[#5e5873]">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-[#6e6b7b]">{item.started_by}</td>
                    <td className="py-2.5 text-[#6e6b7b] capitalize">
                      {item.params.cleanup_mode.replace("_", " ")}
                    </td>
                    <td className="py-2.5 text-[#6e6b7b]">
                      {item.cleanup_result?.removed_count === -1
                        ? "All"
                        : item.cleanup_result?.removed_count ?? "-"}
                    </td>
                    <td className="py-2.5 text-[#6e6b7b]">
                      {item.resync_result?.indexed ?? "-"}
                    </td>
                    <td className="py-2.5">
                      {item.resync_result?.failed ? (
                        <span className="text-red-600">{item.resync_result.failed}</span>
                      ) : (
                        <span className="text-[#6e6b7b]">-</span>
                      )}
                    </td>
                    <td className="py-2.5 text-[#6e6b7b]">
                      {item.duration_ms
                        ? `${(item.duration_ms / 1000).toFixed(1)}s`
                        : "-"}
                    </td>
                    <td className="py-2.5">
                      <JobStatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-700 bg-emerald-100"
      : score >= 50
        ? "text-amber-700 bg-amber-100"
        : "text-red-700 bg-red-100";

  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "text-emerald-700 bg-emerald-100",
    draft: "text-amber-700 bg-amber-100",
    archived: "text-[#6e6b7b] bg-[#f0f0f3]",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${
        styles[status] ?? styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    completed: { icon: CheckCircle2, color: "text-emerald-600" },
    failed: { icon: XCircle, color: "text-red-600" },
    running: { icon: Loader2, color: "text-blue-600" },
  };

  const { icon: Icon, color } = config[status] ?? config.running;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium capitalize ${color}`}>
      <Icon className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : ""}`} />
      {status}
    </span>
  );
}
