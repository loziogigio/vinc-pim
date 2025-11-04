"use client";

import { useState } from "react";
import {
  History,
  Clock,
  User,
  X,
  Edit,
  Trash2,
  Copy,
  Tag,
  Upload,
  Undo2,
  Check,
  X as XIcon
} from "lucide-react";
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
  onRenameVersion?: (version: number, label: string) => Promise<void>;
  onPublishVersion?: (version: number) => Promise<void>;
  onRequestPublishVersion?: (version: number) => void;
  onUnpublishVersion?: (version: number) => Promise<void>;
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
  onRenameVersion,
  onPublishVersion,
  onRequestPublishVersion,
  onUnpublishVersion,
  onClose
}: VersionHistoryProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [labelEditor, setLabelEditor] = useState<{ version: number; value: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [publishingVersion, setPublishingVersion] = useState<number | null>(null);
  const [unpublishingVersion, setUnpublishingVersion] = useState<number | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant: "warning" | "danger" | "info";
    onConfirm: () => void;
  } | null>(null);

  const supportsRename = typeof onRenameVersion === "function";
  const supportsPublish =
    typeof onPublishVersion === "function" || typeof onRequestPublishVersion === "function";
  const supportsUnpublish = typeof onUnpublishVersion === "function";

  const handleLoadVersion = async (version: number) => {
    const load = async () => {
      setIsLoading(true);
      setSelectedVersion(version);
      try {
        await onLoadVersion(version);
      } finally {
        setIsLoading(false);
        setSelectedVersion(null);
      }
    };

    if (isDirty) {
      setConfirmDialog({
        open: true,
        title: "Unsaved Changes",
        message: `Loading version ${version} will discard your current unsaved changes. Are you sure you want to continue?`,
        variant: "danger",
        onConfirm: async () => {
          setConfirmDialog(null);
          await load();
        }
      });
    } else {
      await load();
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

  const handleStartRename = (version: number, currentLabel: string) => {
    if (!supportsRename) return;
    setLabelEditor({ version, value: currentLabel });
  };

  const handleSaveRename = async () => {
    if (!supportsRename || !labelEditor) return;
    setIsRenaming(true);
    try {
      await onRenameVersion?.(labelEditor.version, labelEditor.value);
      setLabelEditor(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const handlePublish = (version: number, label: string) => {
    if (!supportsPublish) return;
    if (onRequestPublishVersion) {
      onRequestPublishVersion(version);
      return;
    }
    setConfirmDialog({
      open: true,
      title: "Publish Version",
      message: `Publish version ${version}${label ? ` (${label})` : ""}? This will become the live home page.`,
      variant: "info",
      onConfirm: async () => {
        setConfirmDialog(null);
        setPublishingVersion(version);
        try {
          await onPublishVersion?.(version);
        } finally {
          setPublishingVersion(null);
        }
      }
    });
  };

  const handleUnpublish = (version: number, label: string) => {
    if (!supportsUnpublish) return;
    setConfirmDialog({
      open: true,
      title: "Unpublish Version",
      message: `Unpublish version ${version}${label ? ` (${label})` : ""}? It will return to draft.`,
      variant: "warning",
      onConfirm: async () => {
        setConfirmDialog(null);
        setUnpublishingVersion(version);
        try {
          await onUnpublishVersion?.(version);
        } finally {
          setUnpublishingVersion(null);
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
              <p className="text-sm text-slate-500">{versions.length} version{versions.length !== 1 ? "s" : ""}</p>
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
                const isDefaultPublishedVersion = version.version === currentPublishedVersion;
                const isPublished = version.status === "published";
                const isLoadingVersion = selectedVersion === version.version && isLoading;
                const isDeletingVersion = selectedVersion === version.version && isDeleting;
                const isDuplicatingVersion = selectedVersion === version.version && isDuplicating;
                const isPublishing = publishingVersion === version.version;
                const isUnpublishing = unpublishingVersion === version.version;
                const label = version.label ?? version.comment ?? `Version ${version.version}`;
                const isEditingThisLabel = labelEditor?.version === version.version;

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
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">Version {version.version}</h3>
                          {isPublished && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white">
                              Published
                            </span>
                          )}
                          {!isPublished && (
                            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
                              Draft
                            </span>
                          )}
                          {isPublished && !isDefaultPublishedVersion && (
                            <span className="rounded-full bg-slate-600 px-2 py-0.5 text-xs font-medium text-white">
                              Conditional
                            </span>
                          )}
                          {isDefaultPublishedVersion && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                              Default
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
                            <span>
                              {isPublished && version.publishedAt
                                ? formatDate(version.publishedAt)
                                : formatDate(version.lastSavedAt)}
                            </span>
                          </div>
                          {version.createdBy && (
                            <div className="flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              <span>{version.createdBy}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-col gap-2 text-sm text-slate-600">
                          {supportsRename ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <Tag className="h-4 w-4 text-slate-400" />
                              {isEditingThisLabel ? (
                                <>
                                  <input
                                    className="w-full max-w-xs rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
                                    value={labelEditor?.value ?? ""}
                                    onChange={(event) =>
                                      setLabelEditor((prev) =>
                                        prev?.version === version.version
                                          ? { version: prev.version, value: event.target.value }
                                          : prev
                                      )
                                    }
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={handleSaveRename} disabled={isRenaming}>
                                      {isRenaming ? (
                                        <>
                                          <Check className="mr-2 h-4 w-4 animate-spin" />
                                          Saving...
                                        </>
                                      ) : (
                                        <>
                                          <Check className="mr-2 h-4 w-4" />
                                          Save
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setLabelEditor(null)}
                                      disabled={isRenaming}
                                    >
                                      <XIcon className="mr-1 h-4 w-4" />
                                      Cancel
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="font-medium text-slate-700">{label}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                    onClick={() => handleStartRename(version.version, label)}
                                  >
                                    <Edit className="mr-1 h-4 w-4" />
                                    Rename
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Tag className="h-4 w-4 text-slate-400" />
                              <span className="font-medium text-slate-700">{label}</span>
                            </div>
                          )}
                          {version.comment && (
                            <p className="text-xs text-slate-500">{version.comment}</p>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-slate-500">
                          {version.blocks.length} block{version.blocks.length !== 1 ? "s" : ""}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 opacity-100 transition group-hover:opacity-100">
                        {supportsPublish && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => handlePublish(version.version, label)}
                            disabled={isPublishing || isUnpublishing}
                          >
                            {isPublishing ? (
                              <>
                                <Upload className="mr-2 h-4 w-4 animate-spin" />
                                Publishing...
                              </>
                            ) : (
                              <>
                                <Upload className="mr-2 h-4 w-4" />
                                {isPublished ? "Update" : "Publish"}
                              </>
                            )}
                          </Button>
                        )}
                        {supportsUnpublish && isPublished && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                            onClick={() => handleUnpublish(version.version, label)}
                            disabled={isUnpublishing || isPublishing}
                          >
                            {isUnpublishing ? (
                              <>
                                <Undo2 className="mr-2 h-4 w-4 animate-spin" />
                                Unpublishing...
                              </>
                            ) : (
                              <>
                                <Undo2 className="mr-2 h-4 w-4" />
                                Unpublish
                              </>
                            )}
                          </Button>
                        )}
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
                        {!isPublished && (
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
              {supportsRename && <li><strong>Rename:</strong> Add a descriptive label for quick reference</li>}
              {supportsPublish && <li><strong>Publish:</strong> Make that version live on the storefront</li>}
              {supportsUnpublish && <li><strong>Unpublish:</strong> Revert a published version back to draft</li>}
              <li><strong>Delete:</strong> Permanently remove the version (published versions cannot be deleted)</li>
            </ul>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </div>
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
