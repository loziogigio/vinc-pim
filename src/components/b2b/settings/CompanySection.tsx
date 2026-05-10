"use client";

/**
 * Company contact info section of the global B2B settings page.
 * Lifted from the legacy /b2b/home-settings page (`CompanyInfoForm`).
 * Purely presentational — the host page owns load/save.
 */

import { SectionCard } from "@/components/b2c/storefront-settings/section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { CompanyContactInfo } from "@/lib/types/home-settings";

export const DEFAULT_COMPANY_INFO: CompanyContactInfo = {
  legal_name: "",
  address_line1: "",
  address_line2: "",
  phone: "",
  email: "",
  support_email: "",
  business_hours: "",
  vat_number: "",
};

interface CompanySectionProps {
  companyInfo: CompanyContactInfo;
  onChange: <K extends keyof CompanyContactInfo>(key: K, value: CompanyContactInfo[K]) => void;
}

const inputClass =
  "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function CompanySection({ companyInfo, onChange }: CompanySectionProps) {
  const { t } = useTranslation();
  return (
    <SectionCard title={t("pages.homeSettings.company.title")} description={t("pages.homeSettings.company.description")}>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="company-legal-name" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.legalName")}
          </label>
          <input
            id="company-legal-name"
            type="text"
            value={companyInfo.legal_name || ""}
            onChange={(e) => onChange("legal_name", e.target.value)}
            placeholder="My Company Srl"
            className={inputClass}
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.company.legalNameHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-vat" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.vatNumber")}
          </label>
          <input
            id="company-vat"
            type="text"
            value={companyInfo.vat_number || ""}
            onChange={(e) => onChange("vat_number", e.target.value)}
            placeholder="IT12345678901"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-address1" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.addressLine1")}
          </label>
          <input
            id="company-address1"
            type="text"
            value={companyInfo.address_line1 || ""}
            onChange={(e) => onChange("address_line1", e.target.value)}
            placeholder="Via Roma, 123"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-address2" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.addressLine2")}
          </label>
          <input
            id="company-address2"
            type="text"
            value={companyInfo.address_line2 || ""}
            onChange={(e) => onChange("address_line2", e.target.value)}
            placeholder="00100 Roma (RM)"
            className={inputClass}
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.company.addressLine2Helper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-phone" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.phone")}
          </label>
          <input
            id="company-phone"
            type="tel"
            value={companyInfo.phone || ""}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+39 06 1234567"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-email" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.generalEmail")}
          </label>
          <input
            id="company-email"
            type="email"
            value={companyInfo.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="info@company.com"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-support-email" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.supportEmail")}
          </label>
          <input
            id="company-support-email"
            type="email"
            value={companyInfo.support_email || ""}
            onChange={(e) => onChange("support_email", e.target.value)}
            placeholder="support@company.com"
            className={inputClass}
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.company.supportEmailHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-hours" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.businessHours")}
          </label>
          <input
            id="company-hours"
            type="text"
            value={companyInfo.business_hours || ""}
            onChange={(e) => onChange("business_hours", e.target.value)}
            placeholder="Lun-Ven 9:00-18:00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.company.footerPreview")}</h4>
        <p className="text-xs text-slate-500 mb-3">{t("pages.homeSettings.company.footerPreviewHelper")}</p>
        <div className="bg-white rounded border border-slate-200 p-4 text-center">
          <p className="font-semibold text-slate-900 text-sm">{companyInfo.legal_name || "Company Name"}</p>
          {(companyInfo.address_line1 || companyInfo.address_line2) && (
            <p className="text-xs text-slate-600 mt-1">
              {[companyInfo.address_line1, companyInfo.address_line2].filter(Boolean).join(" - ")}
            </p>
          )}
          {(companyInfo.phone || companyInfo.email) && (
            <p className="text-xs text-slate-600 mt-1">
              {[companyInfo.phone ? `📞 ${companyInfo.phone}` : "", companyInfo.email ? `✉️ ${companyInfo.email}` : ""]
                .filter(Boolean)
                .join(" | ")}
            </p>
          )}
          {companyInfo.business_hours && <p className="text-xs text-slate-600 mt-1">🕐 {companyInfo.business_hours}</p>}
        </div>
      </div>
    </SectionCard>
  );
}
