"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionHistory = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const confirm_dialog_js_1 = require("../ui/confirm-dialog.js");
const utils_js_1 = require("../ui/utils.js");
const VersionHistory = ({ versions, currentVersion, currentPublishedVersion, isDirty, onLoadVersion, onDelete, onDuplicate, onRenameVersion, onPublishVersion, onRequestPublishVersion, onUnpublishVersion, onClose }) => {
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [isDeleting, setIsDeleting] = (0, react_1.useState)(false);
    const [isDuplicating, setIsDuplicating] = (0, react_1.useState)(false);
    const [selectedVersion, setSelectedVersion] = (0, react_1.useState)(null);
    const [labelEditor, setLabelEditor] = (0, react_1.useState)(null);
    const [isRenaming, setIsRenaming] = (0, react_1.useState)(false);
    const [publishingVersion, setPublishingVersion] = (0, react_1.useState)(null);
    const [unpublishingVersion, setUnpublishingVersion] = (0, react_1.useState)(null);
    const [confirmDialog, setConfirmDialog] = (0, react_1.useState)(null);
    const supportsRename = typeof onRenameVersion === "function";
    const supportsPublish = typeof onPublishVersion === "function" || typeof onRequestPublishVersion === "function";
    const supportsUnpublish = typeof onUnpublishVersion === "function";
    const handleLoadVersion = async (version) => {
        const load = async () => {
            setIsLoading(true);
            setSelectedVersion(version);
            try {
                await onLoadVersion(version);
            }
            finally {
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
        }
        else {
            await load();
        }
    };
    const handleDelete = async (version) => {
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
                }
                finally {
                    setIsDeleting(false);
                    setSelectedVersion(null);
                }
            }
        });
    };
    const handleDuplicate = async (version) => {
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
                }
                finally {
                    setIsDuplicating(false);
                    setSelectedVersion(null);
                }
            }
        });
    };
    const handleStartRename = (version, currentLabel) => {
        if (!supportsRename)
            return;
        setLabelEditor({ version, value: currentLabel });
    };
    const handleSaveRename = async () => {
        if (!supportsRename || !labelEditor)
            return;
        setIsRenaming(true);
        try {
            await onRenameVersion?.(labelEditor.version, labelEditor.value);
            setLabelEditor(null);
        }
        finally {
            setIsRenaming(false);
        }
    };
    const handlePublish = (version, label) => {
        if (!supportsPublish)
            return;
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
                }
                finally {
                    setPublishingVersion(null);
                }
            }
        });
    };
    const handleUnpublish = (version, label) => {
        if (!supportsUnpublish)
            return;
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
                }
                finally {
                    setUnpublishingVersion(null);
                }
            }
        });
    };
    const formatDate = (dateString) => {
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }).format(date);
        }
        catch {
            return dateString;
        }
    };
    const sortedVersions = [...versions].sort((a, b) => b.version - a.version);
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-b border-slate-200 p-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex h-10 w-10 items-center justify-center rounded-full bg-orange-100", children: (0, jsx_runtime_1.jsx)(lucide_react_1.History, { className: "h-5 w-5 text-orange-600" }) }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-slate-900", children: "Version History" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-slate-500", children: [versions.length, " version", versions.length !== 1 ? "s" : ""] })] })] }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600", children: (0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "h-5 w-5" }) })] }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-[600px] overflow-y-auto p-6", children: sortedVersions.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center justify-center py-12 text-slate-400", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.History, { className: "h-12 w-12 opacity-50" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-4 text-sm", children: "No versions yet" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs", children: "Save your first version to see it here" })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: sortedVersions.map((version) => {
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
                                return ((0, jsx_runtime_1.jsx)("div", { className: (0, utils_js_1.cn)("group rounded-xl border p-4 transition", isCurrentVersion
                                        ? "border-blue-200 bg-blue-50"
                                        : "border-slate-200 bg-white hover:border-slate-300"), children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start justify-between gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "font-semibold text-slate-900", children: ["Version ", version.version] }), isPublished && ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-medium text-white", children: "Published" })), !isPublished && ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white", children: "Draft" })), isPublished && !isDefaultPublishedVersion && ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-slate-600 px-2 py-0.5 text-xs font-medium text-white", children: "Conditional" })), isDefaultPublishedVersion && ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white", children: "Default" })), isCurrentVersion && ((0, jsx_runtime_1.jsx)("span", { className: "rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white", children: "Current" }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-3.5 w-3.5" }), (0, jsx_runtime_1.jsx)("span", { children: isPublished && version.publishedAt
                                                                            ? formatDate(version.publishedAt)
                                                                            : formatDate(version.lastSavedAt) })] }), version.createdBy && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1.5", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.User, { className: "h-3.5 w-3.5" }), (0, jsx_runtime_1.jsx)("span", { children: version.createdBy })] }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 flex flex-col gap-2 text-sm text-slate-600", children: [supportsRename ? ((0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Tag, { className: "h-4 w-4 text-slate-400" }), isEditingThisLabel ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("input", { className: "w-full max-w-xs rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none", value: labelEditor?.value ?? "", onChange: (event) => setLabelEditor((prev) => prev?.version === version.version
                                                                                    ? { version: prev.version, value: event.target.value }
                                                                                    : prev) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { size: "sm", onClick: handleSaveRename, disabled: isRenaming, children: isRenaming ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "mr-2 h-4 w-4 animate-spin" }), "Saving..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Check, { className: "mr-2 h-4 w-4" }), "Save"] })) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { variant: "ghost", size: "sm", onClick: () => setLabelEditor(null), disabled: isRenaming, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.X, { className: "mr-1 h-4 w-4" }), "Cancel"] })] })] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("span", { className: "font-medium text-slate-700", children: label }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { variant: "ghost", size: "sm", className: "text-blue-600 hover:bg-blue-50 hover:text-blue-700", onClick: () => handleStartRename(version.version, label), children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "mr-1 h-4 w-4" }), "Rename"] })] }))] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Tag, { className: "h-4 w-4 text-slate-400" }), (0, jsx_runtime_1.jsx)("span", { className: "font-medium text-slate-700", children: label })] })), version.comment && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: version.comment }))] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 text-xs text-slate-500", children: [version.blocks.length, " block", version.blocks.length !== 1 ? "s" : ""] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2 opacity-100 transition group-hover:opacity-100", children: [supportsPublish && ((0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", className: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700", onClick: () => handlePublish(version.version, label), disabled: isPublishing || isUnpublishing, children: isPublishing ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "mr-2 h-4 w-4 animate-spin" }), "Publishing..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Upload, { className: "mr-2 h-4 w-4" }), isPublished ? "Update" : "Publish"] })) })), supportsUnpublish && isPublished && ((0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", className: "text-amber-600 hover:bg-amber-50 hover:text-amber-700", onClick: () => handleUnpublish(version.version, label), disabled: isUnpublishing || isPublishing, children: isUnpublishing ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Undo2, { className: "mr-2 h-4 w-4 animate-spin" }), "Unpublishing..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Undo2, { className: "mr-2 h-4 w-4" }), "Unpublish"] })) })), !isCurrentVersion && ((0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", onClick: () => handleLoadVersion(version.version), disabled: isLoading || isDeleting || isDuplicating, title: "Switch to editing this version", children: isLoadingVersion ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "mr-2 h-4 w-4 animate-spin" }), "Loading..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Edit, { className: "mr-2 h-4 w-4" }), "Load"] })) })), (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", onClick: () => handleDuplicate(version.version), disabled: isDeleting || isLoading || isDuplicating, title: "Create a new version with this content", className: "text-blue-600 hover:bg-blue-50 hover:text-blue-700", children: isDuplicatingVersion ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "mr-2 h-4 w-4 animate-spin" }), "Duplicating..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Copy, { className: "mr-2 h-4 w-4" }), "Duplicate"] })) }), !isPublished && ((0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", size: "sm", onClick: () => handleDelete(version.version), disabled: isDeleting || isLoading || isDuplicating, title: "Delete this version permanently", className: "text-red-600 hover:bg-red-50 hover:text-red-700", children: isDeletingVersion ? ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "mr-2 h-4 w-4 animate-spin" }), "Deleting..."] })) : ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })) }))] })] }) }, version.version));
                            }) })) }), (0, jsx_runtime_1.jsxs)("div", { className: "border-t border-slate-200 px-6 py-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Actions:" }), (0, jsx_runtime_1.jsxs)("ul", { className: "mt-2 space-y-1 text-xs", children: [(0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Load:" }), " Switch to editing that version"] }), (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Duplicate:" }), " Create a new draft with the same content"] }), supportsRename && (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Rename:" }), " Add a descriptive label for quick reference"] }), supportsPublish && (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Publish:" }), " Make that version live on the storefront"] }), supportsUnpublish && (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Unpublish:" }), " Revert a published version back to draft"] }), (0, jsx_runtime_1.jsxs)("li", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Delete:" }), " Permanently remove the version (published versions cannot be deleted)"] })] })] }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: onClose, className: "w-full", children: "Close" })] })] }), confirmDialog && ((0, jsx_runtime_1.jsx)(confirm_dialog_js_1.ConfirmDialog, { open: confirmDialog.open, title: confirmDialog.title, message: confirmDialog.message, variant: confirmDialog.variant, confirmText: "Confirm", cancelText: "Cancel", onConfirm: confirmDialog.onConfirm, onCancel: () => setConfirmDialog(null) }))] }));
};
exports.VersionHistory = VersionHistory;
//# sourceMappingURL=VersionHistory.js.map