"use client";

import { useState } from "react";
import { X, Building2, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface CreatedCustomer {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  legal_info?: { vat_number?: string };
}

interface Props {
  onCreated: (customer: CreatedCustomer) => void;
  onClose: () => void;
  subtitle?: string;
}

export function CreateCustomerModal({ onCreated, onClose, subtitle }: Props) {
  const { t } = useTranslation();

  // Customer type
  const [customerType, setCustomerType] = useState<"business" | "private">("business");

  // Basic info
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Legal info
  const [vatNumber, setVatNumber] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [pecEmail, setPecEmail] = useState("");
  const [sdiCode, setSdiCode] = useState("");

  // Legal seat address
  const [recipientName, setRecipientName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("IT");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusiness = customerType === "business";

  const canSubmit = isBusiness
    ? companyName.trim() && email.trim()
    : (firstName.trim() || lastName.trim()) && email.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSaving(true);
    setError(null);

    // Build legal info
    const legal_info: Record<string, string> = {};
    if (vatNumber.trim()) legal_info.vat_number = vatNumber.trim();
    if (fiscalCode.trim()) {
      // Strip IT prefix if user entered VAT-style format for company fiscal code
      const fc = fiscalCode.trim().replace(/^IT/i, "");
      legal_info.fiscal_code = fc;
    }
    if (pecEmail.trim()) legal_info.pec_email = pecEmail.trim();
    if (sdiCode.trim()) legal_info.sdi_code = sdiCode.trim();

    // Build address if at least street + city are provided
    const addresses: Record<string, unknown>[] = [];
    if (streetAddress.trim() && city.trim()) {
      addresses.push({
        address_type: "both",
        is_default: true,
        label: "Sede legale",
        recipient_name: (isBusiness ? companyName : [firstName, lastName].filter(Boolean).join(" ")).trim(),
        street_address: streetAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        postal_code: postalCode.trim(),
        country: country.trim() || "IT",
      });
    }

    try {
      const res = await fetch("/api/b2b/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_type: customerType,
          email: email.trim(),
          phone: phone.trim() || undefined,
          company_name: isBusiness ? companyName.trim() : undefined,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          legal_info: Object.keys(legal_info).length > 0 ? legal_info : undefined,
          addresses,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const details = data.details as string[] | undefined;
        setError(details?.length ? details.join(", ") : data.error || t("pages.documents.detail.customer.creationError"));
        return;
      }

      onCreated(data.customer);
    } catch {
      setError(t("pages.documents.detail.customer.networkError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 p-6 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#009688]/10">
            <Building2 className="h-5 w-5 text-[#009688]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{t("pages.documents.detail.customer.title")}</h3>
            <p className="text-sm text-slate-500">{subtitle || t("pages.documents.detail.customer.subtitle")}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Customer Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">{t("pages.documents.detail.customer.type")}</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCustomerType("business")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                  isBusiness
                    ? "border-[#009688] bg-[#009688]/5 text-[#009688]"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {t("pages.documents.detail.customer.business")}
              </button>
              <button
                type="button"
                onClick={() => setCustomerType("private")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition ${
                  !isBusiness
                    ? "border-[#009688] bg-[#009688]/5 text-[#009688]"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {t("pages.documents.detail.customer.private")}
              </button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              {t("pages.documents.detail.customer.basicInfo")}
            </h4>
            {isBusiness && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.documents.detail.customer.companyName")} <span className="text-red-500">*</span>
                </label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("pages.documents.detail.customer.companyNamePlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {t("pages.documents.detail.customer.firstName")} {!isBusiness && <span className="text-red-500">*</span>}
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t("pages.documents.detail.customer.firstNamePlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.lastName")}</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t("pages.documents.detail.customer.lastNamePlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@esempio.it"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.phone")}</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+39 ..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            </div>
          </div>

          {/* Legal Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              {t("pages.documents.detail.customer.fiscalData")}
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.vatNumber")}</label>
                <input
                  value={vatNumber}
                  onChange={(e) => setVatNumber(e.target.value)}
                  placeholder="IT12345678901"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.fiscalCode")}</label>
                <input
                  value={fiscalCode}
                  onChange={(e) => setFiscalCode(e.target.value)}
                  placeholder={isBusiness ? t("pages.documents.detail.customer.fiscalCodePlaceholderBusiness") : t("pages.documents.detail.customer.fiscalCodePlaceholderPrivate")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {isBusiness ? t("pages.documents.detail.customer.fiscalCodeHintBusiness") : t("pages.documents.detail.customer.fiscalCodeHintPrivate")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.pec")}</label>
                <input
                  type="email"
                  value={pecEmail}
                  onChange={(e) => setPecEmail(e.target.value)}
                  placeholder="azienda@pec.it"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.sdiCode")}</label>
                <input
                  value={sdiCode}
                  onChange={(e) => setSdiCode(e.target.value)}
                  placeholder="ABCDEFG"
                  maxLength={7}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            </div>
          </div>

          {/* Legal Seat Address */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">
              {t("pages.documents.detail.customer.legalSeat")}
            </h4>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.recipient")}</label>
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={isBusiness ? companyName || t("pages.documents.detail.customer.recipientPlaceholderBusiness") : [firstName, lastName].filter(Boolean).join(" ") || t("pages.documents.detail.customer.recipientPlaceholderPrivate")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.address")}</label>
              <input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder={t("pages.documents.detail.customer.addressPlaceholder")}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
              />
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.city")}</label>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("pages.documents.detail.customer.cityPlaceholder")}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.province")}</label>
                <input
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="MI"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20 uppercase"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.postalCode")}</label>
                <input
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="20100"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
              </div>
            </div>
            <div className="w-1/2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t("pages.documents.detail.customer.country")}</label>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="IT"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20 uppercase"
              />
            </div>
          </div>

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
              {saving ? t("pages.documents.detail.customer.creating") : t("pages.documents.detail.customer.createButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
