"use client";

import { Clock } from "lucide-react";
import { DOCUMENT_STATUS_LABELS } from "@/lib/constants/document";
import type { DocumentStatus } from "@/lib/constants/document";
import type { DocumentHistoryEntry } from "@/lib/types/document";

interface Props {
  history: DocumentHistoryEntry[];
}

export function DocumentHistory({ history }: Props) {
  if (!history || history.length === 0) return null;

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-foreground">Cronologia</h2>
      </div>
      <div className="divide-y divide-border">
        {[...history].reverse().map((entry, idx) => (
          <div key={idx} className="px-4 py-3 flex items-start gap-3">
            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-foreground">
                <span className="font-medium capitalize">
                  {DOCUMENT_STATUS_LABELS[
                    entry.action as DocumentStatus
                  ] || entry.action}
                </span>
                {entry.performed_by_name && (
                  <span className="text-muted-foreground">
                    {" "}
                    da {entry.performed_by_name}
                  </span>
                )}
              </div>
              {entry.details && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {entry.details}
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              {new Date(entry.performed_at).toLocaleDateString("it-IT", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
