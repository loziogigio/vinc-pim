"use client";

import type { Document } from "@/lib/types/document";

interface Props {
  doc: Document;
  isDraft: boolean;
  editNotes: string;
  editInternalNotes: string;
  onNotesChange: (value: string) => void;
  onInternalNotesChange: (value: string) => void;
}

export function DocumentNotes({
  doc,
  isDraft,
  editNotes,
  editInternalNotes,
  onNotesChange,
  onInternalNotesChange,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Note
        </label>
        {isDraft ? (
          <textarea
            value={editNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none resize-none bg-background text-foreground"
          />
        ) : (
          <div className="bg-card rounded-lg border border-border p-3 text-sm min-h-[60px] text-muted-foreground">
            {doc.notes || "—"}
          </div>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          Note Interne
        </label>
        {isDraft ? (
          <textarea
            value={editInternalNotes}
            onChange={(e) => onInternalNotesChange(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none resize-none bg-background text-foreground"
          />
        ) : (
          <div className="bg-card rounded-lg border border-border p-3 text-sm min-h-[60px] text-muted-foreground">
            {doc.internal_notes || "—"}
          </div>
        )}
      </div>
    </div>
  );
}
