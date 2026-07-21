"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormDefinitionsTab = FormDefinitionsTab;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
const adapter_js_1 = require("../adapter.js");
const full_screen_modal_js_1 = require("../ui/full-screen-modal.js");
const FormBlockSettings_js_1 = require("../components/FormBlockSettings.js");
const toSlug = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const DEFAULT_CONFIG = {
    variant: "form",
    fields: [],
    title: "",
    description: "",
    submit_button_text: "",
    success_message: "",
};
function FormDefinitionsTab({ storefrontSlug }) {
    const { client, t } = (0, adapter_js_1.useCmsAdmin)();
    const [definitions, setDefinitions] = (0, react_1.useState)([]);
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    // Modal state
    const [modalOpen, setModalOpen] = (0, react_1.useState)(false);
    const [editingDef, setEditingDef] = (0, react_1.useState)(null);
    const [isSaving, setIsSaving] = (0, react_1.useState)(false);
    // Form state
    const [formName, setFormName] = (0, react_1.useState)("");
    const [formSlug, setFormSlug] = (0, react_1.useState)("");
    const [formEnabled, setFormEnabled] = (0, react_1.useState)(true);
    const [formConfig, setFormConfig] = (0, react_1.useState)(DEFAULT_CONFIG);
    const [formEmails, setFormEmails] = (0, react_1.useState)([]);
    const [formSenderCopy, setFormSenderCopy] = (0, react_1.useState)(false);
    const fetchDefinitions = (0, react_1.useCallback)(async () => {
        try {
            setIsLoading(true);
            const { items } = await client.listFormDefinitions({ limit: 50 });
            setDefinitions(items || []);
        }
        catch {
            setError(t("pages.b2c.formDefinitions.failedToLoad"));
        }
        finally {
            setIsLoading(false);
        }
    }, [client, t]);
    (0, react_1.useEffect)(() => {
        fetchDefinitions();
    }, [fetchDefinitions]);
    const openCreateModal = () => {
        setEditingDef(null);
        setFormName("");
        setFormSlug("");
        setFormEnabled(true);
        setFormConfig(DEFAULT_CONFIG);
        setFormEmails([]);
        setFormSenderCopy(false);
        setModalOpen(true);
    };
    const openEditModal = (def) => {
        setEditingDef(def);
        setFormName(def.name);
        setFormSlug(def.slug);
        setFormEnabled(def.enabled);
        setFormConfig(def.config || DEFAULT_CONFIG);
        setFormEmails(def.notification_emails || []);
        setFormSenderCopy(def.send_submitter_copy);
        setModalOpen(true);
    };
    const handleSave = async () => {
        if (!formName.trim())
            return;
        setIsSaving(true);
        setError(null);
        try {
            const payload = {
                name: formName,
                slug: formSlug || toSlug(formName),
                config: formConfig,
                notification_emails: formEmails.filter((e) => e.trim()),
                send_submitter_copy: formSenderCopy,
                enabled: formEnabled,
            };
            if (editingDef) {
                await client.updateFormDefinition(editingDef.slug, payload);
            }
            else {
                await client.createFormDefinition(payload);
            }
            setModalOpen(false);
            await fetchDefinitions();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t("pages.b2c.formDefinitions.failedToSave"));
        }
        finally {
            setIsSaving(false);
        }
    };
    const handleDelete = async (def) => {
        if (def.is_system)
            return;
        if (!confirm(t("pages.b2c.formDefinitions.deleteConfirm")))
            return;
        try {
            await client.deleteFormDefinition(def.slug);
            await fetchDefinitions();
        }
        catch {
            setError(t("pages.b2c.formDefinitions.failedToDelete"));
        }
    };
    const addEmail = () => setFormEmails([...formEmails, ""]);
    const removeEmail = (idx) => setFormEmails(formEmails.filter((_, i) => i !== idx));
    const updateEmail = (idx, value) => setFormEmails(formEmails.map((e, i) => (i === idx ? value : e)));
    if (isLoading) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center py-12", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "h-8 w-8 animate-spin text-primary" }) }));
    }
    const isSystemForm = editingDef?.is_system ?? false;
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [error && ((0, jsx_runtime_1.jsx)("div", { className: "mb-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-600 dark:text-red-400", children: error })), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formDefinitions.subtitle").replace("{slug}", storefrontSlug) }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: openCreateModal, size: "sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-3.5 w-3.5" }), t("pages.b2c.formDefinitions.create")] })] }), definitions.length === 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-[0.428rem] border border-dashed border-border bg-muted px-6 py-12 text-center", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.FileText, { className: "mx-auto h-10 w-10 text-muted-foreground mb-3" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground", children: t("pages.b2c.formDefinitions.noDefinitions") })] })), definitions.length > 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-[0.428rem] border border-border bg-card shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] dark:shadow-none overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "bg-muted", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formDefinitions.name") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formDefinitions.slug") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-left font-medium text-foreground", children: t("pages.b2c.formDefinitions.recipients") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-center font-medium text-foreground", children: t("pages.b2c.formDefinitions.enabled") }), (0, jsx_runtime_1.jsx)("th", { className: "px-4 py-3 text-right font-medium text-foreground", children: t("common.actions") })] }) }), (0, jsx_runtime_1.jsx)("tbody", { className: "divide-y divide-border", children: definitions.map((def) => ((0, jsx_runtime_1.jsxs)("tr", { className: "hover:bg-muted/50", children: [(0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-foreground font-medium", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [def.name, def.is_system && ((0, jsx_runtime_1.jsxs)("span", { className: "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Lock, { className: "h-2.5 w-2.5" }), t("pages.b2c.formDefinitions.system")] }))] }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-muted-foreground font-mono text-xs", children: def.slug }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-muted-foreground", children: def.notification_emails.length || "—" }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-center", children: (0, jsx_runtime_1.jsx)("span", { className: `inline-block h-2.5 w-2.5 rounded-full ${def.enabled ? "bg-green-500 dark:bg-green-400" : "bg-muted-foreground/40"}` }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-4 py-3 text-right", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-end gap-2", children: [(0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => openEditModal(def), className: "inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Pencil, { className: "h-3.5 w-3.5" }), t("common.edit")] }), !def.is_system && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleDelete(def), className: "rounded-md p-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) }))] }) })] }, def._id))) })] }) })), (0, jsx_runtime_1.jsx)(full_screen_modal_js_1.FullScreenModal, { open: modalOpen, onClose: () => setModalOpen(false), title: editingDef ? t("pages.b2c.formDefinitions.edit") : t("pages.b2c.formDefinitions.create"), actions: (0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { variant: "ghost", onClick: () => setModalOpen(false), children: t("common.cancel") }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { onClick: handleSave, disabled: isSaving || !formName.trim(), children: [isSaving ? (0, jsx_runtime_1.jsx)(lucide_react_1.Loader2, { className: "mr-2 h-4 w-4 animate-spin" }) : null, t("common.save")] })] }), children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-8", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.formDefinitions.name") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: formName, onChange: (e) => {
                                                setFormName(e.target.value);
                                                if (!editingDef)
                                                    setFormSlug(toSlug(e.target.value));
                                            }, placeholder: "Order Note", className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.formDefinitions.slug") }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: formSlug, onChange: (e) => setFormSlug(e.target.value), placeholder: "order-note", className: "mt-2", disabled: isSystemForm })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-3 cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: formEnabled, onChange: (e) => setFormEnabled(e.target.checked), className: "h-4 w-4 rounded border-border text-primary focus:ring-primary" }), (0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.formDefinitions.enabled") })] }), !isSystemForm && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-border bg-card p-4", children: (0, jsx_runtime_1.jsx)(FormBlockSettings_js_1.FormBlockSettings, { config: formConfig, onChange: setFormConfig }) })), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.formDefinitions.recipients") }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground mt-0.5", children: t("pages.b2c.formDefinitions.recipientsDesc") })] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "outline", size: "sm", onClick: addEmail, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-3.5 w-3.5" }), t("pages.b2c.formDefinitions.addEmail")] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-2", children: [formEmails.map((email, idx) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "email", value: email, onChange: (e) => updateEmail(idx, e.target.value), placeholder: "admin@example.com", className: "flex-1" }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeEmail(idx), className: "h-9 w-9 p-0 text-muted-foreground hover:text-red-500 dark:hover:text-red-400", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }, idx))), formEmails.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-muted-foreground italic", children: t("pages.b2c.formDefinitions.addEmail") }))] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-start gap-3 cursor-pointer", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: formSenderCopy, onChange: (e) => setFormSenderCopy(e.target.checked), className: "mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary" }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium text-foreground", children: t("pages.b2c.formDefinitions.senderCopy") }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-muted-foreground mt-0.5", children: t("pages.b2c.formDefinitions.senderCopyDesc") })] })] })] }) })] }));
}
//# sourceMappingURL=FormDefinitionsTab.js.map