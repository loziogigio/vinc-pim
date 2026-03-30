"use client";

import { BackButton } from "@/components/b2b/BackButton";
import { WindmillProxySettings } from "@/components/settings/WindmillProxySettings";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function WindmillPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {t("pages.settings.windmill.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("pages.settings.windmill.subtitle")}
          </p>
        </div>
        <BackButton />
      </div>

      <WindmillProxySettings />
    </div>
  );
}
