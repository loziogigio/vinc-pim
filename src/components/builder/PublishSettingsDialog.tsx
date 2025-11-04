"use client";

import { Dialog } from "@headlessui/react";

export interface PublishFormValues {
  campaign?: string;
  segment?: string;
  region?: string;
  language?: string;
  device?: string;
  priority: number;
  isDefault: boolean;
  activeFrom?: string;
  activeTo?: string;
  comment?: string;
}

interface PublishSettingsDialogProps {
  open: boolean;
  version?: number | null;
  isSubmitting: boolean;
  values: PublishFormValues;
  onChange: (field: keyof PublishFormValues, value: string | number | boolean) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-1 text-sm text-slate-600">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    {children}
  </label>
);

export function PublishSettingsDialog({
  open,
  version,
  isSubmitting,
  values,
  onChange,
  onClose,
  onSubmit
}: PublishSettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold text-slate-900">
            Publish Version {version ?? ""}
          </Dialog.Title>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-700">Example flow</p>
            <p className="mt-1">
              Campaign <code>google-ads-summer</code>, Segment <code>vip</code>, Region
              <code>us-east</code>, Active 09:00 → 21:00. Any visitor who lands via that campaign
              between 9am and 9pm Eastern will see this version. Outside that window they fall back
              to the default layout.
            </p>
          </div>

          <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Campaign">
                <input
                  type="text"
                  value={values.campaign ?? ""}
                  onChange={(event) => onChange("campaign", event.target.value)}
                  placeholder="e.g. google-ads-winter"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
              <Field label="Segment">
                <input
                  type="text"
                  value={values.segment ?? ""}
                  onChange={(event) => onChange("segment", event.target.value)}
                  placeholder="vip, new-customer, etc."
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
            </div>

            <p className="text-xs text-slate-500">
              Match tags to the query params you append in marketing links (e.g.
              <code>?campaign=google-ads-summer&amp;segment=vip</code>). Region / language / device
              let you narrow the experience further; they behave just like additional tags.
            </p>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Region">
                <input
                  type="text"
                  value={values.region ?? ""}
                  onChange={(event) => onChange("region", event.target.value)}
                  placeholder="us-east"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
              <Field label="Language">
                <input
                  type="text"
                  value={values.language ?? ""}
                  onChange={(event) => onChange("language", event.target.value)}
                  placeholder="en, it"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
              <Field label="Device">
                <input
                  type="text"
                  value={values.device ?? ""}
                  onChange={(event) => onChange("device", event.target.value)}
                  placeholder="mobile or desktop"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Priority">
                <input
                  type="number"
                  value={Number.isFinite(values.priority) ? values.priority : 0}
                  onChange={(event) => onChange("priority", Number(event.target.value))}
                  min={0}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
              <Field label="Active from (your timezone)">
                <input
                  type="datetime-local"
                  value={values.activeFrom ?? ""}
                  onChange={(event) => onChange("activeFrom", event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Active to (your timezone)">
                <input
                  type="datetime-local"
                  value={values.activeTo ?? ""}
                  onChange={(event) => onChange("activeTo", event.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </Field>
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="publish-default-version"
                  type="checkbox"
                  checked={values.isDefault}
                  onChange={(event) => onChange("isDefault", event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <label htmlFor="publish-default-version" className="text-sm text-slate-600">
                  Set as default experience (fallback for unmatched visitors)
                </label>
              </div>
            </div>

            <Field label="Comment">
              <textarea
                value={values.comment ?? ""}
                onChange={(event) => onChange("comment", event.target.value)}
                rows={3}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Optional note for this publish action"
              />
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center rounded-md bg-[#009688] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00796b] disabled:opacity-60 disabled:hover:bg-[#009688]"
              >
                {isSubmitting ? "Publishing…" : "Publish Version"}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
