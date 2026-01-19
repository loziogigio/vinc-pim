"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { FilePreview } from "@/components/pim/FilePreview";

type BreadcrumbItem = {
  label: string;
  href?: string;
};

type ImportSource = {
  _id: string;
  source_id: string;
  source_name: string;
  source_type: string;
  auto_publish_enabled: boolean;
  min_score_threshold: number;
};

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

type ImportProductsViewProps = {
  finalBreadcrumbs?: BreadcrumbItem[];
  finalRedirectPath?: string;
  finalSourcesHref?: string;
};

export function ImportProductsView({
  finalBreadcrumbs: propBreadcrumbs,
  finalRedirectPath: propRedirectPath,
  finalSourcesHref: propSourcesHref
}: ImportProductsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  // Default values with tenant prefix
  const defaultBreadcrumbs: BreadcrumbItem[] = [
    { label: "Product Information Management", href: `${tenantPrefix}/b2b/pim` },
    { label: "Import Products" }
  ];
  const finalBreadcrumbs = propBreadcrumbs || defaultBreadcrumbs;
  const finalRedirectPath = propRedirectPath || `${tenantPrefix}/b2b/pim/jobs`;
  const finalSourcesHref = propSourcesHref || `${tenantPrefix}/b2b/pim/sources`;
  const [sources, setSources] = useState<ImportSource[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "success" | "error";
    message?: string;
    jobId?: string;
  }>({ status: "idle" });

  useEffect(() => {
    void fetchSources();
  }, []);

  async function fetchSources() {
    try {
      const res = await fetch("/api/b2b/pim/sources");
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
        if (data.sources?.length > 0) {
          setSelectedSource(data.sources[0].source_id);
        }
      }
    } catch (error) {
      console.error("Error fetching sources:", error);
    }
  }

  async function analyzeFile(file: File) {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/b2b/pim/import/analyze", {
        method: "POST",
        body: formData,
      });

      console.log("Analysis response status:", res.status, res.statusText);
      console.log("Analysis response headers:", Object.fromEntries(res.headers.entries()));

      if (res.ok) {
        const analysis = await res.json();
        console.log("Analysis successful:", {
          fileName: analysis.fileName,
          totalRows: analysis.totalRows,
          columnCount: analysis.columns?.length
        });
        setFileAnalysis(analysis);
      } else {
        // Try to parse error response, fallback to status text if parsing fails
        let errorMessage = `Failed to analyze file (${res.status})`;
        let errorDetails: { error?: string; details?: string; hint?: string } = {};

        try {
          const text = await res.text();
          console.error("Error response text:", text);

          if (text) {
            try {
              errorDetails = JSON.parse(text);
              console.error("Parsed error:", errorDetails);

              // Build comprehensive error message
              const parts: string[] = [];
              if (errorDetails.error) parts.push(errorDetails.error);
              if (errorDetails.details) parts.push(errorDetails.details);
              if (errorDetails.hint) parts.push(`💡 ${errorDetails.hint}`);

              errorMessage = parts.length > 0 ? parts.join("\n\n") : errorMessage;
            } catch {
              errorMessage = `${errorMessage}: ${text.substring(0, 200)}`;
            }
          }
        } catch (parseError) {
          console.error("Failed to read error response:", parseError);
          errorMessage = `${errorMessage}: ${res.statusText}`;
        }

        setUploadStatus({
          status: "error",
          message: errorMessage,
        });
      }
    } catch (error) {
      console.error("Analysis error:", error);
      setUploadStatus({
        status: "error",
        message: error instanceof Error ? error.message : "Failed to analyze file",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setFile(droppedFile);
      setUploadStatus({ status: "idle" });
      setFileAnalysis(null);
      void analyzeFile(droppedFile);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setFile(selectedFile);
      setUploadStatus({ status: "idle" });
      setFileAnalysis(null);
      void analyzeFile(selectedFile);
    }
  }

  function isValidFile(file: File): boolean {
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    return validExtensions.includes(extension);
  }

  async function handleUpload() {
    if (!file || !selectedSource) return;

    setIsUploading(true);
    setUploadStatus({ status: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("source_id", selectedSource);

      const res = await fetch("/api/b2b/pim/import", {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setUploadStatus({
          status: "success",
          message: `Import started successfully! Job ID: ${data.job.job_id}`,
          jobId: data.job.job_id
        });
        setFile(null);
        setFileAnalysis(null);

        setTimeout(() => {
          router.push(finalRedirectPath);
        }, 2000);
      } else {
        const error = await res.json();
        setUploadStatus({
          status: "error",
          message: error.error || "Upload failed"
        });
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus({
        status: "error",
        message: "Network error occurred"
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleCancelPreview() {
    setFile(null);
    setFileAnalysis(null);
    setUploadStatus({ status: "idle" });
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={finalBreadcrumbs} />

      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Import Products</h1>
          <p className="text-muted-foreground">
            Upload a CSV or Excel file to import products into the PIM system
          </p>
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm mb-6 border border-border">
          <label className="block text-sm font-medium mb-2">Import Source</label>
          {sources.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No import sources configured.{" "}
              <a href={finalSourcesHref} className="text-primary hover:underline">
                Create one first
              </a>
            </div>
          ) : (
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              disabled={!!file}
            >
              {sources.map((source) => (
                <option key={source._id} value={source.source_id}>
                  {source.source_name} ({source.source_type})
                  {source.auto_publish_enabled &&
                    ` - Auto-publish at ${source.min_score_threshold}%`}
                </option>
              ))}
            </select>
          )}
        </div>

        {!file && (
          <div className="rounded-lg bg-card p-6 shadow-sm border border-border">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
                isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
            >
              <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Drop your file here</h3>
              <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Select File
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Supported formats: CSV, XLSX, XLS (Max 50MB)
              </p>
            </div>
          </div>
        )}

        {file && isAnalyzing && (
          <div className="rounded-lg bg-card p-12 shadow-sm border border-border text-center">
            <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin mb-4" />
            <h3 className="text-lg font-semibold mb-2">Analyzing file...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we analyze the columns and data
            </p>
          </div>
        )}

        {file && !isAnalyzing && fileAnalysis && (
          <div className="rounded-lg bg-card p-6 shadow-sm border border-border">
            <FilePreview
              analysis={fileAnalysis}
              onConfirm={handleUpload}
              onCancel={handleCancelPreview}
              isUploading={isUploading}
            />
          </div>
        )}

        {uploadStatus.status === "success" && (
          <div className="mt-4 flex items-start gap-3 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold">Import started successfully</p>
              <p>{uploadStatus.message}</p>
            </div>
          </div>
        )}

        {uploadStatus.status === "error" && (
          <div className="mt-4 flex items-start gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-1">Analysis failed</p>
              <div className="whitespace-pre-wrap leading-relaxed">
                {uploadStatus.message}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
