"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type ImportJob = {
  _id: string;
  job_id: string;
  source_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  file_name: string;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  auto_published_count: number;
  created_at: string;
};

export function RecentImportsPanel() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRecentImports() {
      try {
        const res = await fetch("/api/b2b/pim/jobs?limit=5");
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        }
      } catch (error) {
        console.error("Error fetching recent imports:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecentImports();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-card p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Recent Imports</h2>
      </div>

      {jobs.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-center text-muted-foreground">
          <p className="text-sm">No recent imports</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => (
            <div
              key={job._id}
              className="flex items-center justify-between p-2.5 rounded border border-border"
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                {job.status === "completed" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                )}
                {job.status === "failed" && (
                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                )}
                {job.status === "processing" && (
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                )}
                {job.status === "pending" && (
                  <Clock className="h-4 w-4 text-amber-600 flex-shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{job.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {job.status === "completed" && (
                      <>
                        {job.successful_rows} imported
                        {job.auto_published_count > 0 &&
                          `, ${job.auto_published_count} auto-published`}
                      </>
                    )}
                    {job.status === "failed" && "Import failed"}
                    {job.status === "processing" && `Processing ${job.processed_rows} rows...`}
                    {job.status === "pending" && "Pending..."}
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex-shrink-0">
                {new Date(job.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/b2b/pim/jobs"
        className="mt-3 text-xs text-primary hover:underline block text-center"
      >
        View all imports →
      </Link>
    </div>
  );
}
