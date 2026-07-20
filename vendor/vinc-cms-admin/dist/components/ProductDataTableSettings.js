"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductDataTableSettings = ProductDataTableSettings;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const nanoid_1 = require("nanoid");
const lucide_react_1 = require("lucide-react");
const input_js_1 = require("../ui/input.js");
const label_js_1 = require("../ui/label.js");
const button_js_1 = require("../ui/button.js");
const useImageUpload_js_1 = require("../hooks/useImageUpload.js");
const clampColumnWidth = (value) => {
    if (typeof value !== "number" || Number.isNaN(value))
        return 220;
    return Math.min(Math.max(Math.round(value), 120), 420);
};
const ensureRows = (rows) => {
    if (Array.isArray(rows) && rows.length > 0) {
        return rows.map((row) => {
            const valueType = row.valueType ?? "text";
            const leftValueType = row.leftValueType
                ? row.leftValueType
                : valueType === "image"
                    ? "text"
                    : row.imageUrl
                        ? "image"
                        : "text";
            return {
                id: row.id ?? (0, nanoid_1.nanoid)(8),
                label: row.label ?? "",
                leftValueType,
                valueType,
                value: row.value ?? "",
                html: row.html ?? "",
                imageUrl: row.imageUrl ?? "",
                imageAlt: row.imageAlt ?? "",
                imageAspectRatio: row.imageAspectRatio ?? "",
                leftHtml: row.leftHtml ?? "",
                leftLink: row.leftLink,
                leftHelperText: row.leftHelperText ?? "",
                valueImageUrl: row.valueImageUrl ?? (valueType === "image" ? row.imageUrl ?? "" : ""),
                valueImageAlt: row.valueImageAlt ?? "",
                valueImageAspectRatio: row.valueImageAspectRatio ?? "",
                link: row.link,
                helperText: row.helperText ?? "",
                highlight: row.highlight ?? false
            };
        });
    }
    return [
        {
            id: (0, nanoid_1.nanoid)(8),
            label: "Scheda Tecnica PDF",
            leftValueType: "image",
            valueType: "image",
            imageUrl: "https://cdn.example.com/icons/pdf.png",
            imageAlt: "PDF",
            imageAspectRatio: "1/1",
            valueImageUrl: "https://cdn.example.com/images/demo-product.png",
            valueImageAlt: "Anteprima prodotto",
            helperText: "Aggiornato 10/2024",
            link: {
                url: "https://cdn.example.com/docs/manual.pdf",
                openInNewTab: true
            }
        }
    ];
};
const trimOrUndefined = (value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
};
const sanitizeLink = (link) => {
    if (!link?.url)
        return undefined;
    const url = link.url.trim();
    if (!url)
        return undefined;
    return {
        url,
        openInNewTab: link.openInNewTab,
        rel: link.rel?.trim() || undefined
    };
};
function ProductDataTableSettings({ config, onChange }) {
    const initialConfig = (0, react_1.useMemo)(() => ({
        variant: "productDataTable",
        title: config.title ?? "",
        description: config.description ?? "",
        labelColumnWidth: clampColumnWidth(config.labelColumnWidth),
        appearance: {
            bordered: config.appearance?.bordered !== false,
            rounded: config.appearance?.rounded !== false,
            zebraStripes: config.appearance?.zebraStripes ?? false
        },
        rows: ensureRows(config.rows)
    }), [config]);
    const [localConfig, setLocalConfig] = (0, react_1.useState)(initialConfig);
    const leftUpload = (0, useImageUpload_js_1.useImageUpload)();
    const rightUpload = (0, useImageUpload_js_1.useImageUpload)();
    (0, react_1.useEffect)(() => {
        setLocalConfig(initialConfig);
    }, [initialConfig]);
    (0, react_1.useEffect)(() => {
        const timeout = setTimeout(() => {
            onChange({
                ...localConfig,
                labelColumnWidth: clampColumnWidth(localConfig.labelColumnWidth),
                rows: localConfig.rows.map((row) => {
                    const sanitizedImageUrl = trimOrUndefined(row.imageUrl);
                    const sanitizedValueImageUrl = trimOrUndefined(row.valueImageUrl);
                    const valueType = row.valueType ?? "text";
                    const leftValueType = row.leftValueType ?? (valueType === "image" ? "text" : sanitizedImageUrl ? "image" : "text");
                    return {
                        id: row.id ?? (0, nanoid_1.nanoid)(8),
                        label: row.label?.trim() || "",
                        valueType,
                        leftValueType,
                        value: trimOrUndefined(row.value),
                        html: trimOrUndefined(row.html),
                        leftHtml: trimOrUndefined(row.leftHtml),
                        imageUrl: sanitizedImageUrl,
                        imageAlt: trimOrUndefined(row.imageAlt),
                        imageAspectRatio: trimOrUndefined(row.imageAspectRatio),
                        valueImageUrl: sanitizedValueImageUrl ?? (valueType === "image" ? sanitizedImageUrl : undefined),
                        valueImageAlt: trimOrUndefined(row.valueImageAlt),
                        valueImageAspectRatio: trimOrUndefined(row.valueImageAspectRatio),
                        leftLink: sanitizeLink(row.leftLink),
                        link: sanitizeLink(row.link),
                        helperText: trimOrUndefined(row.helperText),
                        leftHelperText: trimOrUndefined(row.leftHelperText),
                        highlight: row.highlight ?? false
                    };
                })
            });
        }, 150);
        return () => clearTimeout(timeout);
    }, [localConfig, onChange]);
    const updateAppearance = (field, value) => {
        setLocalConfig((prev) => ({
            ...prev,
            appearance: {
                bordered: prev.appearance?.bordered !== false,
                rounded: prev.appearance?.rounded !== false,
                zebraStripes: prev.appearance?.zebraStripes ?? false,
                ...prev.appearance,
                [field]: value
            }
        }));
    };
    const updateRow = (index, updates) => {
        setLocalConfig((prev) => {
            const nextRows = [...prev.rows];
            nextRows[index] = {
                ...nextRows[index],
                ...updates,
                id: nextRows[index]?.id ?? (0, nanoid_1.nanoid)(8),
                valueType: updates.valueType ?? nextRows[index]?.valueType ?? "text"
            };
            return { ...prev, rows: nextRows };
        });
    };
    const removeRow = (index) => {
        setLocalConfig((prev) => {
            const nextRows = prev.rows.filter((_, idx) => idx !== index);
            return { ...prev, rows: nextRows.length ? nextRows : ensureRows([]) };
        });
    };
    const addRow = () => {
        setLocalConfig((prev) => ({
            ...prev,
            rows: [
                ...prev.rows,
                {
                    id: (0, nanoid_1.nanoid)(8),
                    label: "Nuova voce",
                    valueType: "text",
                    value: ""
                }
            ]
        }));
    };
    const moveRow = (index, direction) => {
        setLocalConfig((prev) => {
            const nextIndex = index + direction;
            if (nextIndex < 0 || nextIndex >= prev.rows.length)
                return prev;
            const nextRows = [...prev.rows];
            const [target] = nextRows.splice(index, 1);
            nextRows.splice(nextIndex, 0, target);
            return { ...prev, rows: nextRows };
        });
    };
    const handleImageUpload = async (index, file, target) => {
        if (!file)
            return;
        const uploadCtx = target === "left" ? leftUpload : rightUpload;
        uploadCtx.resetError();
        const url = await uploadCtx.uploadImage(file);
        if (url) {
            if (target === "left") {
                updateRow(index, {
                    imageUrl: url,
                    imageAlt: localConfig.rows[index]?.imageAlt || localConfig.rows[index]?.label || "",
                    leftValueType: "image"
                });
            }
            else {
                updateRow(index, {
                    valueImageUrl: url,
                    valueImageAlt: localConfig.rows[index]?.valueImageAlt || localConfig.rows[index]?.label || "",
                    valueType: "image"
                });
            }
        }
    };
    const handleImageInputChange = (event, index, target) => {
        const file = event.target.files?.[0];
        void handleImageUpload(index, file, target);
        event.target.value = "";
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-slate-700", children: "Descrizione introduttiva" }), (0, jsx_runtime_1.jsx)("textarea", { value: localConfig.description ?? "", onChange: (event) => setLocalConfig((prev) => ({ ...prev, description: event.target.value })), className: "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", rows: 3, placeholder: "Messaggio opzionale mostrato sopra la tabella." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-slate-700", children: "Larghezza colonna etichette" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { type: "number", min: 120, max: 420, value: localConfig.labelColumnWidth ?? 220, onChange: (event) => setLocalConfig((prev) => ({
                                    ...prev,
                                    labelColumnWidth: clampColumnWidth(Number(event.target.value))
                                })) }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Valori consigliati tra 180 e 280 px." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-sm font-medium text-slate-700", children: "Aspetto" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 rounded-lg border border-slate-200 bg-white p-3", children: [(0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: localConfig.appearance?.bordered !== false, onChange: (event) => updateAppearance("bordered", event.target.checked) }), "Bordo tabella"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: localConfig.appearance?.rounded !== false, onChange: (event) => updateAppearance("rounded", event.target.checked) }), "Angoli arrotondati"] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-sm text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: localConfig.appearance?.zebraStripes === true, onChange: (event) => updateAppearance("zebraStripes", event.target.checked) }), "Righe alternate"] })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-sm font-semibold text-slate-700", children: "Voci tabella" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Gestisci righe con testo, HTML oppure immagini collegate." })] }), (0, jsx_runtime_1.jsxs)(button_js_1.Button, { type: "button", variant: "outline", size: "sm", onClick: addRow, className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.PlusCircle, { className: "h-4 w-4" }), "Aggiungi riga"] })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-4", children: localConfig.rows.map((row, index) => {
                            const leftValueType = row.leftValueType ?? "text";
                            const valueType = row.valueType ?? "text";
                            return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-3", children: [(0, jsx_runtime_1.jsxs)("span", { className: "text-xs font-semibold uppercase text-slate-400", children: ["Riga ", index + 1] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-1", children: [(0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "icon", onClick: () => moveRow(index, -1), disabled: index === 0, className: "h-8 w-8 text-slate-500 hover:text-orange-600", title: "Sposta su", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowUp, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "icon", onClick: () => moveRow(index, 1), disabled: index === localConfig.rows.length - 1, className: "h-8 w-8 text-slate-500 hover:text-orange-600", title: "Sposta gi\u00F9", children: (0, jsx_runtime_1.jsx)(lucide_react_1.ArrowDown, { className: "h-4 w-4" }) }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", variant: "ghost", size: "icon", onClick: () => removeRow(index), className: "h-8 w-8 text-red-500 hover:text-red-600", title: "Rimuovi riga", children: (0, jsx_runtime_1.jsx)(lucide_react_1.Trash2, { className: "h-4 w-4" }) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Colonna sinistra" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Tipo contenuto" }), (0, jsx_runtime_1.jsxs)("select", { value: leftValueType, onChange: (event) => updateRow(index, {
                                                                    leftValueType: event.target.value
                                                                }), className: "w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", children: [(0, jsx_runtime_1.jsx)("option", { value: "text", children: "Testo semplice" }), (0, jsx_runtime_1.jsx)("option", { value: "html", children: "HTML avanzato" }), (0, jsx_runtime_1.jsx)("option", { value: "image", children: "Immagine" })] })] }), leftValueType === "text" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Testo da mostrare" }), (0, jsx_runtime_1.jsx)("textarea", { value: row.label ?? "", onChange: (event) => updateRow(index, { label: event.target.value }), rows: 3, className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", placeholder: "Es. Scheda Tecnica PDF" })] })) : ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Titolo riga" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.label ?? "", onChange: (event) => updateRow(index, { label: event.target.value }), placeholder: "Es. Documentazione" })] })), leftValueType === "html" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Markup HTML" }), (0, jsx_runtime_1.jsx)("textarea", { value: row.leftHtml ?? "", onChange: (event) => updateRow(index, { leftHtml: event.target.value }), rows: 4, className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500", placeholder: '<p><strong>Scarica</strong> il documento</p>' }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "L'HTML viene sanificato automaticamente sul sito cliente." })] })) : null, leftValueType === "image" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "URL immagine" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.imageUrl ?? "", onChange: (event) => updateRow(index, { imageUrl: event.target.value }), placeholder: "https://cdn..." }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-400", children: "Mostrata accanto al contenuto di destra. Usa PNG/SVG trasparenti per icone documento." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Testo alternativo" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.imageAlt ?? "", onChange: (event) => updateRow(index, { imageAlt: event.target.value }), placeholder: "Descrizione icona" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3", children: [(0, jsx_runtime_1.jsx)("input", { id: `product-data-table-left-upload-${row.id ?? index}`, type: "file", accept: "image/*", className: "hidden", onChange: (event) => handleImageInputChange(event, index, "left") }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "outline", className: "border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600", onClick: () => document
                                                                            .getElementById(`product-data-table-left-upload-${row.id ?? index}`)
                                                                            ?.click(), disabled: leftUpload.uploadState.isUploading, children: leftUpload.uploadState.isUploading ? "Caricamento…" : "Carica immagine" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "JPG, PNG o WebP fino a 20 MB." }), leftUpload.uploadState.error ? ((0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium text-red-500", children: leftUpload.uploadState.error })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 bg-white p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold text-slate-500", children: "Anteprima immagine" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative mt-2 flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50", children: [row.imageUrl ? ((0, jsx_runtime_1.jsx)("img", { src: row.imageUrl, alt: row.imageAlt || row.label, className: "max-h-28 w-auto object-contain", loading: "lazy" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: "Nessuna immagine caricata" })), (0, jsx_runtime_1.jsxs)("div", { className: "absolute inset-x-3 bottom-3 rounded-md bg-white/90 p-2 shadow-sm", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-[10px] font-semibold uppercase text-slate-500", children: "Aspect ratio (opzionale)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.imageAspectRatio ?? "", onChange: (event) => updateRow(index, { imageAspectRatio: event.target.value }), placeholder: "Esempio: 1/1", className: "mt-1 h-8 border-slate-300 text-xs" })] })] })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Link (opzionale)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.leftLink?.url ?? "", onChange: (event) => updateRow(index, {
                                                                            leftLink: event.target.value
                                                                                ? {
                                                                                    ...(row.leftLink ?? {}),
                                                                                    url: event.target.value,
                                                                                    openInNewTab: row.leftLink?.openInNewTab ?? true
                                                                                }
                                                                                : undefined
                                                                        }), placeholder: "https://..." }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-xs text-slate-500", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: row.leftLink?.openInNewTab ?? true, disabled: !row.leftLink?.url, onChange: (event) => updateRow(index, {
                                                                                    leftLink: row.leftLink
                                                                                        ? {
                                                                                            ...row.leftLink,
                                                                                            openInNewTab: event.target.checked
                                                                                        }
                                                                                        : undefined
                                                                                }) }), "Apri in nuova scheda"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Nota aggiuntiva" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.leftHelperText ?? "", onChange: (event) => updateRow(index, { leftHelperText: event.target.value }), placeholder: "Es. PDF ufficiale" })] })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Colonna destra" }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Tipo contenuto" }), (0, jsx_runtime_1.jsxs)("select", { value: valueType, onChange: (event) => updateRow(index, {
                                                                    valueType: event.target.value
                                                                }), className: "w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", children: [(0, jsx_runtime_1.jsx)("option", { value: "text", children: "Testo semplice" }), (0, jsx_runtime_1.jsx)("option", { value: "html", children: "HTML avanzato" }), (0, jsx_runtime_1.jsx)("option", { value: "image", children: "Immagine" })] })] }), valueType === "text" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Testo da mostrare" }), (0, jsx_runtime_1.jsx)("textarea", { value: row.value ?? "", onChange: (event) => updateRow(index, { value: event.target.value }), rows: 3, className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500", placeholder: "Es. Scarica documento" })] })) : null, valueType === "html" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Markup HTML" }), (0, jsx_runtime_1.jsx)("textarea", { value: row.html ?? "", onChange: (event) => updateRow(index, { html: event.target.value }), rows: 4, className: "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500", placeholder: '<p><strong>Scarica</strong> il documento</p>' }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "L'HTML viene sanificato automaticamente sul sito cliente." })] })) : null, valueType === "image" ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "URL immagine" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.valueImageUrl ?? "", onChange: (event) => updateRow(index, { valueImageUrl: event.target.value }), placeholder: "https://cdn..." }), (0, jsx_runtime_1.jsx)("p", { className: "text-[11px] text-slate-400", children: "Viene mostrata nel contenuto a destra. Puoi incollare un URL o caricare un file." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Testo alternativo" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.valueImageAlt ?? "", onChange: (event) => updateRow(index, { valueImageAlt: event.target.value }), placeholder: "Descrizione immagine" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3", children: [(0, jsx_runtime_1.jsx)("input", { id: `product-data-table-right-upload-${row.id ?? index}`, type: "file", accept: "image/*", className: "hidden", onChange: (event) => handleImageInputChange(event, index, "right") }), (0, jsx_runtime_1.jsx)(button_js_1.Button, { type: "button", size: "sm", variant: "outline", className: "border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600", onClick: () => document
                                                                            .getElementById(`product-data-table-right-upload-${row.id ?? index}`)
                                                                            ?.click(), disabled: rightUpload.uploadState.isUploading, children: rightUpload.uploadState.isUploading ? "Caricamento…" : "Carica immagine" }), (0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-500", children: "JPG, PNG o WebP fino a 20 MB." }), rightUpload.uploadState.error ? ((0, jsx_runtime_1.jsx)("span", { className: "text-xs font-medium text-red-500", children: rightUpload.uploadState.error })) : null] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs font-semibold text-slate-500", children: "Anteprima immagine" }), (0, jsx_runtime_1.jsxs)("div", { className: "relative mt-2 flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white", children: [row.valueImageUrl ? ((0, jsx_runtime_1.jsx)("img", { src: row.valueImageUrl, alt: row.valueImageAlt || row.label, className: "max-h-32 w-auto object-contain", loading: "lazy" })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-slate-400", children: "Nessuna immagine caricata" })), (0, jsx_runtime_1.jsxs)("div", { className: "absolute inset-x-3 bottom-3 rounded-md bg-white/90 p-2 shadow-sm", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-[10px] font-semibold uppercase text-slate-500", children: "Aspect ratio (opzionale)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.valueImageAspectRatio ?? "", onChange: (event) => updateRow(index, { valueImageAspectRatio: event.target.value }), placeholder: "Esempio: 16/9", className: "mt-1 h-8 border-slate-300 text-xs" })] })] })] })] })) : null, (0, jsx_runtime_1.jsxs)("div", { className: "grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Link (opzionale)" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.link?.url ?? "", onChange: (event) => updateRow(index, {
                                                                            link: event.target.value
                                                                                ? {
                                                                                    ...(row.link ?? {}),
                                                                                    url: event.target.value,
                                                                                    openInNewTab: row.link?.openInNewTab ?? true
                                                                                }
                                                                                : undefined
                                                                        }), placeholder: "https://..." }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-xs text-slate-500", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: row.link?.openInNewTab ?? true, disabled: !row.link?.url, onChange: (event) => updateRow(index, {
                                                                                    link: row.link
                                                                                        ? {
                                                                                            ...row.link,
                                                                                            openInNewTab: event.target.checked
                                                                                        }
                                                                                        : undefined
                                                                                }) }), "Apri in nuova scheda"] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2", children: [(0, jsx_runtime_1.jsx)(label_js_1.Label, { className: "text-xs font-medium text-slate-600 uppercase", children: "Nota aggiuntiva" }), (0, jsx_runtime_1.jsx)(input_js_1.Input, { value: row.helperText ?? "", onChange: (event) => updateRow(index, { helperText: event.target.value }), placeholder: "Es. Aggiornato il 10/2024" })] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: row.highlight ?? false, onChange: (event) => updateRow(index, { highlight: event.target.checked }) }), "Evidenzia la riga"] })] })] })] }, row.id ?? index));
                        }) })] })] }));
}
//# sourceMappingURL=ProductDataTableSettings.js.map