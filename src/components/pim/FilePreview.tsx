"use client";

import { CheckCircle, FileText, AlertCircle } from "lucide-react";

type FileAnalysis = {
  fileName: string;
  fileSize: number;
  totalRows: number;
  columns: Array<{
    name: string;
    type: string;
    sampleValues: any[];
    totalValues: number;
    uniqueCount: number;
    emptyCount: number;
  }>;
  previewRows: any[];
};

type FilePreviewProps = {
  analysis: FileAnalysis;
  onConfirm: () => void;
  onCancel: () => void;
  isUploading: boolean;
};

export function FilePreview({ analysis, onConfirm, onCancel, isUploading }: FilePreviewProps) {
  return (
    <div className="space-y-4">
      {/* File Info */}
      <div className="rounded-lg bg-card p-4 border border-border">
        <div className="flex items-center gap-3 mb-3">
          <FileText className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">{analysis.fileName}</h3>
            <p className="text-xs text-muted-foreground">
              {(analysis.fileSize / 1024 / 1024).toFixed(2)} MB · {analysis.totalRows} rows · {analysis.columns.length} columns
            </p>
          </div>
        </div>
      </div>

      {/* Column Summary */}
      <div className="rounded-lg bg-card p-4 border border-border">
        <h3 className="font-semibold text-sm mb-3">Detected Columns</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {analysis.columns.map((col) => (
            <div
              key={col.name}
              className="flex items-center gap-2 rounded border border-border bg-muted/30 px-3 py-2"
            >
              <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{col.name}</div>
                <div className="text-[10px] text-muted-foreground">{col.type}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Preview */}
      <div className="rounded-lg bg-card border border-border overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Data Preview (First 10 Rows)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                {analysis.columns.map((col) => (
                  <th key={col.name} className="px-3 py-2 text-left font-semibold">
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analysis.previewRows.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  {analysis.columns.map((col) => (
                    <td key={col.name} className="px-3 py-2 max-w-[200px] truncate">
                      {row[col.name] ?? <span className="text-muted-foreground italic">empty</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Quality Warnings */}
      {analysis.columns.some((col) => col.emptyCount > 0) && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-amber-900 mb-1">Data Quality Notice</h4>
              <ul className="text-xs text-amber-800 space-y-1">
                {analysis.columns
                  .filter((col) => col.emptyCount > 0)
                  .map((col) => (
                    <li key={col.name}>
                      Column &quot;{col.name}&quot; has {col.emptyCount} empty value{col.emptyCount > 1 ? "s" : ""}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isUploading}
          className="px-4 py-2 rounded border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isUploading}
          className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : "Confirm & Start Import"}
        </button>
      </div>
    </div>
  );
}
