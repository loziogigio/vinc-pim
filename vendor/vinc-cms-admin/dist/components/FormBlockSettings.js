"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormBlockSettings = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const lucide_react_1 = require("lucide-react");
const button_js_1 = require("../ui/button.js");
const input_js_1 = require("../ui/input.js");
const nanoid_1 = require("nanoid");
const toSlug = (text) => text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
const FIELD_TYPES = [
    { value: "text", label: "Text" },
    { value: "email", label: "Email" },
    { value: "textarea", label: "Textarea" },
    { value: "select", label: "Dropdown" },
    { value: "checkbox", label: "Checkbox" },
];
const FormBlockSettings = ({ config, onChange }) => {
    const [fields, setFields] = (0, react_1.useState)(config.fields || []);
    const updateConfig = (partial) => {
        onChange({ ...config, ...partial });
    };
    const updateFields = (newFields) => {
        setFields(newFields);
        onChange({ ...config, fields: newFields });
    };
    const addField = () => {
        const newField = {
            id: (0, nanoid_1.nanoid)(8),
            type: "text",
            label: "",
            placeholder: "",
            required: false,
        };
        updateFields([...fields, newField]);
    };
    const removeField = (fieldId) => {
        updateFields(fields.filter((f) => f.id !== fieldId));
    };
    const moveField = (index, direction) => {
        const newIndex = direction === "up" ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= fields.length)
            return;
        const newFields = [...fields];
        [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
        updateFields(newFields);
    };
    const updateField = (fieldId, updates) => {
        updateFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
    };
    const addOption = (fieldId) => {
        updateFields(fields.map((f) => f.id === fieldId
            ? { ...f, options: [...(f.options || []), { label: "", value: "" }] }
            : f));
    };
    const removeOption = (fieldId, optIndex) => {
        updateFields(fields.map((f) => f.id === fieldId
            ? { ...f, options: (f.options || []).filter((_, i) => i !== optIndex) }
            : f));
    };
    const updateOption = (fieldId, optIndex, updates) => {
        updateFields(fields.map((f) => f.id === fieldId
            ? {
                ...f,
                options: (f.options || []).map((opt, i) => i === optIndex ? { ...opt, ...updates } : opt),
            }
            : f));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Form Title" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: config.title || "", onChange: (e) => updateConfig({ title: e.target.value }), placeholder: "Contact Us", className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Description" }), (0, jsx_runtime_1.jsx)("textarea", { value: config.description || "", onChange: (e) => updateConfig({ description: e.target.value }), rows: 2, placeholder: "Fill out the form below...", className: "mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-sm font-medium text-slate-700", children: ["Form Fields (", fields.length, ")"] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "outline", size: "sm", onClick: addField, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-3.5 w-3.5" }), "Add Field"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-3", children: [fields.map((field, index) => ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col items-center gap-0.5 pt-1", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => moveField(index, "up"), disabled: index === 0, className: "rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent", title: "Move up", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronUp, { className: "h-3.5 w-3.5" }) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => moveField(index, "down"), disabled: index === fields.length - 1, className: "rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent", title: "Move down", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ChevronDown, { className: "h-3.5 w-3.5" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 space-y-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid grid-cols-[1fr_120px_80px] gap-2", children: [(0, jsx_runtime_1.jsx)(input_js_1.Input, { value: field.label, onChange: (e) => updateField(field.id, { label: e.target.value }), placeholder: "Field label" }), (0, jsx_runtime_1.jsx)("select", { value: field.type, onChange: (e) => updateField(field.id, {
                                                                type: e.target.value,
                                                            }), className: "rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", children: FIELD_TYPES.map((ft) => ((0, jsx_runtime_1.jsx)("option", { value: ft.value, children: ft.label }, ft.value))) }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-1.5 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: field.required || false, onChange: (e) => updateField(field.id, { required: e.target.checked }), className: "rounded" }), "Req."] })] }), field.type !== "checkbox" && ((0, jsx_runtime_1.jsx)(input_js_1.Input, { value: field.placeholder || "", onChange: (e) => updateField(field.id, { placeholder: e.target.value }), placeholder: "Placeholder text", className: "text-sm" })), field.type === "select" && ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium text-slate-500", children: "Options" }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "ghost", size: "sm", onClick: () => addOption(field.id), className: "h-6 px-2 text-xs", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Plus, { className: "mr-1 h-3 w-3" }), "Add"] })] }), (field.options || []).map((opt, optIdx) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)(input_js_1.Input, { value: opt.label, onChange: (e) => {
                                                                        const label = e.target.value;
                                                                        const autoValue = toSlug(label);
                                                                        const wasAutoGenerated = !opt.value || opt.value === toSlug(opt.label);
                                                                        updateOption(field.id, optIdx, {
                                                                            label,
                                                                            value: wasAutoGenerated ? autoValue : opt.value,
                                                                        });
                                                                    }, placeholder: "Label", className: "text-sm" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: opt.value, onChange: (e) => updateOption(field.id, optIdx, {
                                                                        value: e.target.value,
                                                                    }), placeholder: "Value", className: "w-32 text-sm" }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeOption(field.id, optIdx), className: "h-9 w-9 p-0 text-slate-400 hover:text-red-500", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-3.5 w-3.5" }) })] }, optIdx)))] }))] }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "sm", onClick: () => removeField(field.id), className: "mt-0.5 h-8 w-8 p-0 text-slate-400 hover:text-red-500", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] }) }, field.id))), fields.length === 0 && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500", children: "No fields yet. Click \"Add Field\" to start building your form." }))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Submit Button Text" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: config.submit_button_text || "", onChange: (e) => updateConfig({ submit_button_text: e.target.value }), placeholder: "Send Message", className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Success Message" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: config.success_message || "", onChange: (e) => updateConfig({ success_message: e.target.value }), placeholder: "Thank you! We'll get back to you soon.", className: "mt-2" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-sm font-medium text-slate-700", children: "Notification Email" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "email", value: config.notification_email || "", onChange: (e) => updateConfig({ notification_email: e.target.value }), placeholder: "admin@example.com", className: "mt-2" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-1 text-xs text-slate-500", children: "Submissions will be emailed to this address." })] })] }));
};
exports.FormBlockSettings = FormBlockSettings;
//# sourceMappingURL=FormBlockSettings.js.map