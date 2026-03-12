"use client";

import { AlertCircle } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function AIEnhancementPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-amber-100 p-4">
            <AlertCircle className="h-12 w-12 text-amber-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-3">
          {t("pages.pim.aiEnhancement.notActive")}
        </h1>
        <p className="text-muted-foreground">
          {t("pages.pim.aiEnhancement.contactCommercial")}
        </p>
      </div>
    </div>
  );
}
