"use client";

import { useState } from "react";
import { X, MapPin, Loader2, Edit } from "lucide-react";
import type { Address } from "@/lib/types/customer";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Props {
  customerId: string;
  customerName?: string;
  /** When provided, the modal opens in edit mode */
  address?: Address;
  onCreated: () => void;
  onClose: () => void;
}

export function AddAddressModal({ customerId, customerName, address, onCreated, onClose }: Props) {
  const { t } = useTranslation();
  const isEditMode = !!address;

  const [addressType, setAddressType] = useState<"both" | "delivery" | "billing">(address?.address_type || "both");
  const [externalCode, setExternalCode] = useState(address?.external_code || "");
  const [label, setLabel] = useState(address?.label || "");
  const [recipientName, setRecipientName] = useState(address?.recipient_name || customerName || "");
  const [streetAddress, setStreetAddress] = useState(address?.street_address || "");
  const [streetAddress2, setStreetAddress2] = useState(address?.street_address_2 || "");
  const [city, setCity] = useState(address?.city || "");
  const [province, setProvince] = useState(address?.province || "");
  const [postalCode, setPostalCode] = useState(address?.postal_code || "");
  const [country, setCountry] = useState(address?.country || "IT");
  const [phone, setPhone] = useState(address?.phone || "");
  const [deliveryNotes, setDeliveryNotes] = useState(address?.delivery_notes || "");
  const [isDefault, setIsDefault] = useState(address?.is_default || false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    recipientName.trim() &&
    streetAddress.trim() &&
    city.trim() &&
    province.trim() &&
    postalCode.trim() &&
    country.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      const payload = {
        external_code: externalCode.trim() || undefined,
        address_type: addressType,
        label: label.trim() || undefined,
        is_default: isDefault,
        recipient_name: recipientName.trim(),
        street_address: streetAddress.trim(),
        street_address_2: streetAddress2.trim() || undefined,
        city: city.trim(),
        province: province.trim(),
        postal_code: postalCode.trim(),
        country: country.trim(),
        phone: phone.trim() || undefined,
        delivery_notes: deliveryNotes.trim() || undefined,
      };

      const url = isEditMode
        ? `/api/b2b/customers/${customerId}/addresses/${address.address_id}`
        : `/api/b2b/customers/${customerId}/addresses`;

      const res = await fetch(url, {
        method: isEditMode ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || (isEditMode ? t("pages.store.addAddressModal.errorSaving") : t("pages.store.addAddressModal.errorCreating")));
        return;
      }

      onCreated();
    } catch {
      setError(t("pages.store.addAddressModal.networkError"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 p-6 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#009688]/10">
            {isEditMode ? <Edit className="h-5 w-5 text-[#009688]" /> : <MapPin className="h-5 w-5 text-[#009688]" />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {isEditMode ? t("pages.store.addAddressModal.titleEdit") : t("pages.store.addAddressModal.titleAdd")}
            </h3>
            <p className="text-sm text-slate-500">
              {isEditMode ? t("pages.store.addAddressModal.subtitleEdit") : t("pages.store.addAddressModal.subtitleAdd")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Address Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("pages.store.addAddressModal.addressType")}</label>
            <div className="flex gap-3">
              {(["both", "delivery", "billing"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAddressType(type)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                    addressType === type
                      ? "border-[#009688] bg-[#009688]/5 text-[#009688]"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {type === "both" ? t("pages.store.addAddressModal.typesBoth") : type === "delivery" ? t("pages.store.addAddressModal.typesDelivery") : t("pages.store.addAddressModal.typesBilling")}
                </button>
              ))}
            </div>
          </div>

          {/* Label, Code & Recipient */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              {t("pages.store.addAddressModal.sectionInfo")}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.store.addAddressModal.externalCode")}</label>
                <input
                  value={externalCode}
                  onChange={(e) => setExternalCode(e.target.value.toUpperCase())}
                  placeholder={t("pages.store.addAddressModal.externalCodePlaceholder")}
                  className={`${inputClass} uppercase font-mono`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.store.addAddressModal.label")}</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.labelPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.store.addAddressModal.recipient")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.recipientPlaceholder")}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              {t("pages.store.addAddressModal.sectionAddress")}
            </h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {t("pages.store.addAddressModal.streetAddress")} <span className="text-red-500">*</span>
              </label>
              <input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder={t("pages.store.addAddressModal.streetAddressPlaceholder")}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.store.addAddressModal.streetAddress2")}</label>
              <input
                value={streetAddress2}
                onChange={(e) => setStreetAddress2(e.target.value)}
                placeholder={t("pages.store.addAddressModal.streetAddress2Placeholder")}
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.store.addAddressModal.city")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.cityPlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.store.addAddressModal.province")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.provincePlaceholder")}
                  maxLength={2}
                  className={`${inputClass} uppercase`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.store.addAddressModal.postalCode")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.postalCodePlaceholder")}
                  maxLength={5}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.store.addAddressModal.country")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder={t("pages.store.addAddressModal.countryPlaceholder")}
                  className={`${inputClass} uppercase`}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("common.phone")}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 ..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Delivery Notes */}
          {(addressType === "delivery" || addressType === "both") && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.store.addAddressModal.deliveryNotes")}</label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder={t("pages.store.addAddressModal.deliveryNotesPlaceholder")}
                rows={2}
                className={inputClass}
              />
            </div>
          )}

          {/* Default toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#009688] focus:ring-[#009688]"
            />
            <span className="text-sm text-slate-700">{t("pages.store.addAddressModal.setDefault")}</span>
          </label>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-[#009688] text-white hover:bg-[#00796b] transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? t("pages.store.addAddressModal.saving") : isEditMode ? t("pages.store.addAddressModal.saveChanges") : t("pages.store.addAddressModal.addAddress")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
