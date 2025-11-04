"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { nanoid } from "nanoid";
import { Trash2, ArrowUp, ArrowDown, PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type {
  ProductDataTableAppearance,
  ProductDataTableBlockConfig,
  ProductDataTableRowConfig,
  ProductDataTableRowLinkConfig,
  ProductDataTableValueType
} from "@/lib/types/blocks";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ProductDataTableSettingsProps {
  config: ProductDataTableBlockConfig;
  onChange: (config: ProductDataTableBlockConfig) => void;
}

const clampColumnWidth = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 220;
  return Math.min(Math.max(Math.round(value), 120), 420);
};

const ensureRows = (rows?: ProductDataTableRowConfig[]): ProductDataTableRowConfig[] => {
  if (Array.isArray(rows) && rows.length > 0) {
    return rows.map((row) => {
      const valueType: ProductDataTableValueType = row.valueType ?? "text";
      const leftValueType: ProductDataTableValueType = row.leftValueType
        ? row.leftValueType
        : valueType === "image"
        ? "text"
        : row.imageUrl
        ? "image"
        : "text";

      return {
        id: row.id ?? nanoid(8),
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
      id: nanoid(8),
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

const trimOrUndefined = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeLink = (link?: ProductDataTableRowLinkConfig): ProductDataTableRowLinkConfig | undefined => {
  if (!link?.url) return undefined;
  const url = link.url.trim();
  if (!url) return undefined;
  return {
    url,
    openInNewTab: link.openInNewTab,
    rel: link.rel?.trim() || undefined
  };
};

export function ProductDataTableSettings({ config, onChange }: ProductDataTableSettingsProps) {
  const initialConfig: ProductDataTableBlockConfig = useMemo(
    () => ({
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
    }),
    [config]
  );

  const [localConfig, setLocalConfig] = useState<ProductDataTableBlockConfig>(initialConfig);
  const leftUpload = useImageUpload();
  const rightUpload = useImageUpload();

  useEffect(() => {
    setLocalConfig(initialConfig);
  }, [initialConfig]);

  useEffect(() => {
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
            id: row.id ?? nanoid(8),
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

  const updateAppearance = (field: keyof ProductDataTableAppearance, value: boolean) => {
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

  const updateRow = (index: number, updates: Partial<ProductDataTableRowConfig>) => {
    setLocalConfig((prev) => {
      const nextRows = [...prev.rows];
      nextRows[index] = {
        ...nextRows[index],
        ...updates,
        id: nextRows[index]?.id ?? nanoid(8),
        valueType: updates.valueType ?? nextRows[index]?.valueType ?? "text"
      };
      return { ...prev, rows: nextRows };
    });
  };

  const removeRow = (index: number) => {
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
          id: nanoid(8),
          label: "Nuova voce",
          valueType: "text",
          value: ""
        }
      ]
    }));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    setLocalConfig((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.rows.length) return prev;
      const nextRows = [...prev.rows];
      const [target] = nextRows.splice(index, 1);
      nextRows.splice(nextIndex, 0, target);
      return { ...prev, rows: nextRows };
    });
  };

  const handleImageUpload = async (
    index: number,
    file: File | undefined | null,
    target: "left" | "right"
  ) => {
    if (!file) return;
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
      } else {
        updateRow(index, {
          valueImageUrl: url,
          valueImageAlt: localConfig.rows[index]?.valueImageAlt || localConfig.rows[index]?.label || "",
          valueType: "image"
        });
      }
    }
  };

  const handleImageInputChange = (
    event: ChangeEvent<HTMLInputElement>,
    index: number,
    target: "left" | "right"
  ) => {
    const file = event.target.files?.[0];
    void handleImageUpload(index, file, target);
    event.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Descrizione introduttiva</Label>
        <textarea
          value={localConfig.description ?? ""}
          onChange={(event) =>
            setLocalConfig((prev) => ({ ...prev, description: event.target.value }))
          }
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          rows={3}
          placeholder="Messaggio opzionale mostrato sopra la tabella."
        />
      </div>

      <div className="grid gap-6 rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Larghezza colonna etichette</Label>
          <Input
            type="number"
            min={120}
            max={420}
            value={localConfig.labelColumnWidth ?? 220}
            onChange={(event) =>
              setLocalConfig((prev) => ({
                ...prev,
                labelColumnWidth: clampColumnWidth(Number(event.target.value))
              }))
            }
          />
          <p className="text-xs text-slate-500">Valori consigliati tra 180 e 280 px.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Aspetto</Label>
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={localConfig.appearance?.bordered !== false}
                onChange={(event) => updateAppearance("bordered", event.target.checked)}
              />
              Bordo tabella
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={localConfig.appearance?.rounded !== false}
                onChange={(event) => updateAppearance("rounded", event.target.checked)}
              />
              Angoli arrotondati
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={localConfig.appearance?.zebraStripes === true}
                onChange={(event) => updateAppearance("zebraStripes", event.target.checked)}
              />
              Righe alternate
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">Voci tabella</h3>
            <p className="text-xs text-slate-500">Gestisci righe con testo, HTML oppure immagini collegate.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addRow}
            className="flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            Aggiungi riga
          </Button>
        </div>

        <div className="space-y-4">
          {localConfig.rows.map((row, index) => {
            const leftValueType: ProductDataTableValueType = row.leftValueType ?? "text";
            const valueType: ProductDataTableValueType = row.valueType ?? "text";
            return (
              <div key={row.id ?? index} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-dashed border-slate-200 pb-3">
                  <span className="text-xs font-semibold uppercase text-slate-400">Riga {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      className="h-8 w-8 text-slate-500 hover:text-orange-600"
                      title="Sposta su"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === localConfig.rows.length - 1}
                      className="h-8 w-8 text-slate-500 hover:text-orange-600"
                      title="Sposta giù"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(index)}
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      title="Rimuovi riga"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colonna sinistra</p>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 uppercase">Tipo contenuto</Label>
                      <select
                        value={leftValueType}
                        onChange={(event) =>
                          updateRow(index, {
                            leftValueType: event.target.value as ProductDataTableValueType
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="text">Testo semplice</option>
                        <option value="html">HTML avanzato</option>
                        <option value="image">Immagine</option>
                      </select>
                    </div>

                    {leftValueType === "text" ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Testo da mostrare</Label>
                        <textarea
                          value={row.label ?? ""}
                          onChange={(event) => updateRow(index, { label: event.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Es. Scheda Tecnica PDF"
                        />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Titolo riga</Label>
                        <Input
                          value={row.label ?? ""}
                          onChange={(event) => updateRow(index, { label: event.target.value })}
                          placeholder="Es. Documentazione"
                        />
                      </div>
                    )}

                    {leftValueType === "html" ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Markup HTML</Label>
                        <textarea
                          value={row.leftHtml ?? ""}
                          onChange={(event) => updateRow(index, { leftHtml: event.target.value })}
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder='<p><strong>Scarica</strong> il documento</p>'
                        />
                        <p className="text-xs text-slate-500">L&apos;HTML viene sanificato automaticamente sul sito cliente.</p>
                      </div>
                    ) : null}

                    {leftValueType === "image" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600 uppercase">URL immagine</Label>
                          <Input
                            value={row.imageUrl ?? ""}
                            onChange={(event) => updateRow(index, { imageUrl: event.target.value })}
                            placeholder="https://cdn..."
                          />
                          <p className="text-[11px] text-slate-400">
                            Mostrata accanto al contenuto di destra. Usa PNG/SVG trasparenti per icone documento.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600 uppercase">Testo alternativo</Label>
                          <Input
                            value={row.imageAlt ?? ""}
                            onChange={(event) => updateRow(index, { imageAlt: event.target.value })}
                            placeholder="Descrizione icona"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
                          <input
                            id={`product-data-table-left-upload-${row.id ?? index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleImageInputChange(event, index, "left")}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                            onClick={() =>
                              document
                                .getElementById(`product-data-table-left-upload-${row.id ?? index}`)
                                ?.click()
                            }
                            disabled={leftUpload.uploadState.isUploading}
                          >
                            {leftUpload.uploadState.isUploading ? "Caricamento…" : "Carica immagine"}
                          </Button>
                          <span className="text-xs text-slate-500">JPG, PNG o WebP fino a 20 MB.</span>
                          {leftUpload.uploadState.error ? (
                            <span className="text-xs font-medium text-red-500">{leftUpload.uploadState.error}</span>
                          ) : null}
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-500">Anteprima immagine</p>
                          <div className="relative mt-2 flex min-h-[140px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50">
                            {row.imageUrl ? (
                              <img
                                src={row.imageUrl}
                                alt={row.imageAlt || row.label}
                                className="max-h-28 w-auto object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">Nessuna immagine caricata</span>
                            )}
                            <div className="absolute inset-x-3 bottom-3 rounded-md bg-white/90 p-2 shadow-sm">
                              <Label className="text-[10px] font-semibold uppercase text-slate-500">Aspect ratio (opzionale)</Label>
                              <Input
                                value={row.imageAspectRatio ?? ""}
                                onChange={(event) => updateRow(index, { imageAspectRatio: event.target.value })}
                                placeholder="Esempio: 1/1"
                                className="mt-1 h-8 border-slate-300 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Link (opzionale)</Label>
                        <Input
                          value={row.leftLink?.url ?? ""}
                          onChange={(event) =>
                            updateRow(index, {
                              leftLink: event.target.value
                                ? {
                                    ...(row.leftLink ?? {}),
                                    url: event.target.value,
                                    openInNewTab: row.leftLink?.openInNewTab ?? true
                                  }
                                : undefined
                            })
                          }
                          placeholder="https://..."
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={row.leftLink?.openInNewTab ?? true}
                            disabled={!row.leftLink?.url}
                            onChange={(event) =>
                              updateRow(index, {
                                leftLink: row.leftLink
                                  ? {
                                      ...row.leftLink,
                                      openInNewTab: event.target.checked
                                    }
                                  : undefined
                              })
                            }
                          />
                          Apri in nuova scheda
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Nota aggiuntiva</Label>
                        <Input
                          value={row.leftHelperText ?? ""}
                          onChange={(event) => updateRow(index, { leftHelperText: event.target.value })}
                          placeholder="Es. PDF ufficiale"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colonna destra</p>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-slate-600 uppercase">Tipo contenuto</Label>
                      <select
                        value={valueType}
                        onChange={(event) =>
                          updateRow(index, {
                            valueType: event.target.value as ProductDataTableValueType
                          })
                        }
                        className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="text">Testo semplice</option>
                        <option value="html">HTML avanzato</option>
                        <option value="image">Immagine</option>
                      </select>
                    </div>

                    {valueType === "text" ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Testo da mostrare</Label>
                        <textarea
                          value={row.value ?? ""}
                          onChange={(event) => updateRow(index, { value: event.target.value })}
                          rows={3}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder="Es. Scarica documento"
                        />
                      </div>
                    ) : null}

                    {valueType === "html" ? (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Markup HTML</Label>
                        <textarea
                          value={row.html ?? ""}
                          onChange={(event) => updateRow(index, { html: event.target.value })}
                          rows={4}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                          placeholder='<p><strong>Scarica</strong> il documento</p>'
                        />
                        <p className="text-xs text-slate-500">
                          L&apos;HTML viene sanificato automaticamente sul sito cliente.
                        </p>
                      </div>
                    ) : null}

                    {valueType === "image" ? (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600 uppercase">URL immagine</Label>
                          <Input
                            value={row.valueImageUrl ?? ""}
                            onChange={(event) => updateRow(index, { valueImageUrl: event.target.value })}
                            placeholder="https://cdn..."
                          />
                          <p className="text-[11px] text-slate-400">
                            Viene mostrata nel contenuto a destra. Puoi incollare un URL o caricare un file.
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-medium text-slate-600 uppercase">Testo alternativo</Label>
                          <Input
                            value={row.valueImageAlt ?? ""}
                            onChange={(event) => updateRow(index, { valueImageAlt: event.target.value })}
                            placeholder="Descrizione immagine"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3">
                          <input
                            id={`product-data-table-right-upload-${row.id ?? index}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => handleImageInputChange(event, index, "right")}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-slate-300 text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                            onClick={() =>
                              document
                                .getElementById(`product-data-table-right-upload-${row.id ?? index}`)
                                ?.click()
                            }
                            disabled={rightUpload.uploadState.isUploading}
                          >
                            {rightUpload.uploadState.isUploading ? "Caricamento…" : "Carica immagine"}
                          </Button>
                          <span className="text-xs text-slate-500">JPG, PNG o WebP fino a 20 MB.</span>
                          {rightUpload.uploadState.error ? (
                            <span className="text-xs font-medium text-red-500">{rightUpload.uploadState.error}</span>
                          ) : null}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-500">Anteprima immagine</p>
                          <div className="relative mt-2 flex min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white">
                            {row.valueImageUrl ? (
                              <img
                                src={row.valueImageUrl}
                                alt={row.valueImageAlt || row.label}
                                className="max-h-32 w-auto object-contain"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-xs text-slate-400">Nessuna immagine caricata</span>
                            )}
                            <div className="absolute inset-x-3 bottom-3 rounded-md bg-white/90 p-2 shadow-sm">
                              <Label className="text-[10px] font-semibold uppercase text-slate-500">Aspect ratio (opzionale)</Label>
                              <Input
                                value={row.valueImageAspectRatio ?? ""}
                                onChange={(event) => updateRow(index, { valueImageAspectRatio: event.target.value })}
                                placeholder="Esempio: 16/9"
                                className="mt-1 h-8 border-slate-300 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Link (opzionale)</Label>
                        <Input
                          value={row.link?.url ?? ""}
                          onChange={(event) =>
                            updateRow(index, {
                              link: event.target.value
                                ? {
                                    ...(row.link ?? {}),
                                    url: event.target.value,
                                    openInNewTab: row.link?.openInNewTab ?? true
                                  }
                                : undefined
                            })
                          }
                          placeholder="https://..."
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                          <input
                            type="checkbox"
                            checked={row.link?.openInNewTab ?? true}
                            disabled={!row.link?.url}
                            onChange={(event) =>
                              updateRow(index, {
                                link: row.link
                                  ? {
                                      ...row.link,
                                      openInNewTab: event.target.checked
                                    }
                                  : undefined
                              })
                            }
                          />
                          Apri in nuova scheda
                        </label>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600 uppercase">Nota aggiuntiva</Label>
                        <Input
                          value={row.helperText ?? ""}
                          onChange={(event) => updateRow(index, { helperText: event.target.value })}
                          placeholder="Es. Aggiornato il 10/2024"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-600">
                      <input
                        type="checkbox"
                        checked={row.highlight ?? false}
                        onChange={(event) => updateRow(index, { highlight: event.target.checked })}
                      />
                      Evidenzia la riga
                    </label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
