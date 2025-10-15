"use client";

import { useState } from "react";
import { History, Clock, User, X, Edit, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { PageVersion } from "@/lib/types/blocks";
import { cn } from "@/components/ui/utils";

interface VersionHistoryProps {
  versions: PageVersion[];
  currentVersion: number;
  currentPublishedVersion?: number;
  isDirty: boolean;
  onLoadVersion: (version: number) => Promise<void>;
  onDelete: (version: number) => Promise<void>;
  onDuplicate: (version: number) => Promise<void>;
  onClose: () => void;
}

export const VersionHistory = ({
  versions,
  currentVersion,
  currentPublishedVersion,
  isDirty,
  onLoadVersion,
  onDelete,
  onDuplicate,
  onClose
}: VersionHistoryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "warning" | "danger" | "info";
    onConfirm: () => void;
  } | null>(null);

  const handleLoadVersion = async (version: number) => {
    // Only show warning if there are unsaved changes
    if (isDirty) {
      setConfirmDialog({
        open: true,
        title: "Unsaved Changes",
        message: `Loading version ${version} will discard your current unsaved changes. Are you sure you want to continue?`,
        variant: "danger",
        onConfirm: async () => {
          setConfirmDialog(null);
          setIsLoading(true);
          setSelectedVersion(version);
          try {
            await onLoadVersion(version);
          } finally {
            setIsLoading(false);
            setSelectedVersion(null);
          }
        }
      });
    } else {
      // No unsaved changes, load directly
      setIsLoading(true);
      setSelectedVersion(version);
      try {
        await onLoadVersion(version);
      } finally {
        setIsLoading(false);
        setSelectedVersion(null);
      }
    }
  };

  const handleDelete = async (version: number) => {
    setConfirmDialog({
      open: true,
      title: "Delete Version",
      message: `Are you sure you want to permanently delete version ${version}? This action cannot be undone.`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsDeleting(true);
        setSelectedVersion(version);
        try {
          await onDelete(version);
        } finally {
          setIsDeleting(false);
          setSelectedVersion(null);
        }
      }
    });
  };

  const handleDuplicate = async (version: number) => {
    setConfirmDialog({
      open: true,
      title: "Duplicate Version",
      message: `Create a new draft version with the same content as version ${version}?`,
      variant: "info",
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsDuplicating(true);
        setSelectedVersion(version);
        try {
          await onDuplicate(version);
        } finally {
          setIsDuplicating(false);
          setSelectedVersion(null);
        }
      }
    });
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    } catch {
      return dateString;
    }
  };

  // Sort versions by version number (newest first)
  const sortedVersions = [...versions].sort((a, b) => b.version - a.version);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <History className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Version History</h2>
              <p className="text-sm text-slate-500">{versions.length} version{versions.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Version List */}
        <div className="max-h-[600px] overflow-y-auto p-6">
          {sortedVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <History className="h-12 w-12 opacity-50" />
              <p className="mt-4 text-sm">No versions yet</p>
              <p className="mt-1 text-xs">Save your first version to see it here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedVersions.map((version) => {
                const isCurrentVersion = version.version === currentVersion;
                const isCurrentlyPublished = version.version === currentPublishedVersion;
                const wasPublished = version.status === "published";
                const isLoadingVersion = selectedVersion === version.version && isLoading;
                const isDeletingVersion = selectedVersion === version.version && isDeleting;
                const isDuplicatingVersion = selectedVersion === version.version && isDuplicating;

                return (
                  <div
                    key={version.version}
                    className={cn(
                      "group rounded-xl border p-4 transition",
                      isCurrentVersion
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            Version {version.version}
                          </h3>
                          {isCurrentlyPublished && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                              Published
                            </span>
                          )}
                          {wasPublished && !isCurrentlyPublished && (
                            <span className="rounded-full bg-slate-400 px-2 py-0.5 text-xs font-medium text-white">
                              Unpublished
                            </span>
                          )}
                          {!wasPublished && (
                            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                              Draft
                            </span>
                          )}
                          {isCurrentVersion && (
                            <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
                              Current
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{wasPublished && version.publishedAt ? formatDate(version.publishedAt) : formatDate(version.lastSavedAt)}</span>
                          </div>
                          {version.createdBy && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              <span>{version.createdBy}</span>
                            </div>
                          )}
                        </div>

                        {version.comment && (
                          <p className="mt-2 text-sm text-slate-600">{version.comment}</p>
                        )}

                        <div className="mt-2 text-xs text-slate-500">
                          {version.blocks.length} block{version.blocks.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="ml-4 flex gap-2 opacity-0 transition group-hover:opacity-100">
                        {!isCurrentVersion && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLoadVersion(version.version)}
                            disabled={isLoading || isDeleting || isDuplicating}
                            title="Switch to editing this version"
                          >
                            {isLoadingVersion ? (
                              <>
                                <Edit className="mr-2 h-4 w-4 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Edit className="mr-2 h-4 w-4" />
                                Load
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicate(version.version)}
                          disabled={isDeleting || isLoading || isDuplicating}
                          title="Create a new version with this content"
                          className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {isDuplicatingVersion ? (
                            <>
                              <Copy className="mr-2 h-4 w-4 animate-spin" />
                              Duplicating...
                            </>
                          ) : (
                            <>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </>
                          )}
                        </Button>
                        {!isCurrentlyPublished && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(version.version)}
                            disabled={isDeleting || isLoading || isDuplicating}
                            title="Delete this version permanently"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            {isDeletingVersion ? (
                              <>
                                <Trash2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-4">
          <div className="mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            <strong>Actions:</strong>
            <ul className="mt-2 space-y-1 text-xs">
              <li><strong>Load:</strong> Switch to editing that version</li>
              <li><strong>Duplicate:</strong> Create a new draft with the same content</li>
              <li><strong>Delete:</strong> Permanently remove the version (published versions cannot be deleted)</li>
            </ul>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          confirmText="Confirm"
          cancelText="Cancel"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};
