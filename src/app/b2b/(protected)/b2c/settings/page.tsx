"use client";

import { Settings } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function B2CSettingsPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#5e5873]">{t("pages.b2c.settings.title")}</h1>
        <p className="text-sm text-[#b9b9c3]">
          {t("pages.b2c.settings.subtitle")}
        </p>
      </div>

      <div className="rounded-lg border border-[#ebe9f1] bg-white p-8 text-center max-w-2xl">
        <Settings className="mx-auto h-12 w-12 text-[#b9b9c3] mb-4" />
        <h2 className="text-lg font-medium text-[#5e5873] mb-2">
          {t("pages.b2c.settings.comingSoon")}
        </h2>
        <p className="text-sm text-[#b9b9c3]">
          {t("pages.b2c.settings.comingSoonDesc")}
        </p>
      </div>
    </div>
  );
}
