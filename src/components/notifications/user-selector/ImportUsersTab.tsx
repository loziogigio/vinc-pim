"use client";

import { useState } from "react";
import { Search, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { SelectedUser, UserType } from "./BrowseUsersTab";

interface ImportResult {
  matched: SelectedUser[];
  not_found: string[];
  duplicates: string[];
}

interface ImportUsersTabProps {
  onAddUsers: (users: SelectedUser[]) => void;
}

export function ImportUsersTab({ onAddUsers }: ImportUsersTabProps) {
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await fetch("/api/b2b/notifications/recipients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: importText }),
      });

      if (res.ok) {
        const data = await res.json();
        setImportResult({
          matched: data.matched.map(
            (u: { portal_user_id: string; username: string; email: string }) => ({
              id: u.portal_user_id,
              name: u.username,
              email: u.email,
              type: "portal" as UserType,
            })
          ),
          not_found: data.not_found,
          duplicates: data.duplicates,
        });
      }
    } catch (error) {
      console.error("Error importing:", error);
    } finally {
      setIsImporting(false);
    }
  };

  const addImportedUsers = () => {
    if (!importResult) return;
    onAddUsers(importResult.matched);
    setImportText("");
    setImportResult(null);
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Incolla i nomi utente (uno per riga o separati da virgola)
        </label>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="utente1&#10;utente2&#10;utente3"
          rows={8}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary focus:outline-none resize-none font-mono text-sm"
        />
      </div>

      <button
        onClick={handleImport}
        disabled={!importText.trim() || isImporting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        Cerca utenti
      </button>

      {/* Import Results */}
      {importResult && (
        <div className="space-y-3">
          {/* Matched */}
          {importResult.matched.length > 0 && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">
                  {importResult.matched.length} utenti trovati
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {importResult.matched.slice(0, 10).map((u) => (
                  <span key={u.id} className="px-2 py-1 rounded bg-white text-xs">
                    {u.name}
                  </span>
                ))}
                {importResult.matched.length > 10 && (
                  <span className="px-2 py-1 text-xs text-emerald-600">
                    +{importResult.matched.length - 10} altri
                  </span>
                )}
              </div>
              <button
                onClick={addImportedUsers}
                className="mt-3 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700"
              >
                Aggiungi {importResult.matched.length} utenti
              </button>
            </div>
          )}

          {/* Not Found */}
          {importResult.not_found.length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {importResult.not_found.length} non trovati
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {importResult.not_found.slice(0, 10).map((name, i) => (
                  <span key={i} className="px-2 py-1 rounded bg-white text-xs text-amber-700">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
