"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Search,
  Loader2,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    published: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15",
    draft: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15",
    archived: "text-muted-foreground bg-muted",
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

// ============================================
// COMPONENT
// ============================================

export function FindProduct() {
  const { t } = useTranslation();

  const [checkQuery, setCheckQuery] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState("");

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

  return (
    <div className="rounded-[0.428rem] border border-border bg-card p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Search className="h-4 w-4" />
        {t("pages.pim.batchSync.fastCheck")}
      </h3>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Entity code or SKU"
          value={checkQuery}
          onChange={(e) => setCheckQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCheck()}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
        />
        <button
          onClick={handleCheck}
          disabled={isChecking || !checkQuery.trim()}
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </button>
      </div>

      {checkError && (
        <div className="mt-3 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
          <XCircle className="h-4 w-4" />
          {checkError}
        </div>
      )}

      {checkResult && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-foreground">
                {checkResult.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {checkResult.entity_code} / {checkResult.sku}
              </div>
            </div>
            <StatusBadge status={checkResult.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded bg-muted p-2">
              <div className="text-xs text-muted-foreground">Score (live)</div>
              <ScoreBadge score={checkResult.completeness_score} />
            </div>
            <div className="rounded bg-muted p-2">
              <div className="text-xs text-muted-foreground">In Solr</div>
              <div className="flex items-center gap-1">
                {checkResult.in_solr ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="text-emerald-700 dark:text-emerald-300">Yes</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    <span className="text-red-700 dark:text-red-300">No</span>
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
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {checkResult.score_drift > 0 ? "+" : ""}
                  {checkResult.score_drift}
                </span>
              </div>
            )}
          </div>

          {checkResult.last_synced_at && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last synced: {new Date(checkResult.last_synced_at).toLocaleString()}
            </div>
          )}

          {checkResult.critical_issues.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Critical Issues:
              </div>
              {checkResult.critical_issues.map((issue, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400"
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
  );
}
