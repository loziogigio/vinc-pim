"use client";

import { useState } from "react";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import { CustomerAccessSelector } from "@/components/shared/CustomerAccessSelector";
import { FullScreenModal } from "@/components/shared/FullScreenModal";
import type { ICustomerAccess } from "@/lib/types/portal-user";
import { UserCog, Users, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreatePortalUserModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    channel: "default",
    sendAccess: false,
  });

  const [selectedAccess, setSelectedAccess] = useState<ICustomerAccess[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  function resetForm() {
    setFormData({
      username: "",
      email: "",
      password: "",
      channel: "default",
      sendAccess: false,
    });
    setSelectedAccess([]);
    setError(null);
  }

  function handleClose() {
    if (isSubmitting) return;
    onClose();
    resetForm();
  }

  async function handleSubmit() {
    if (
      !formData.username ||
      !formData.email ||
      !formData.password ||
      formData.password.length < 8
    ) {
      toast.error(t("pages.store.portalUsers.fillRequiredFields"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const wantEmail = formData.sendAccess && !!formData.email;
      const res = await fetch("/api/b2b/portal-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          channel: formData.channel,
          customer_access: selectedAccess,
          send_access_email: wantEmail,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const baseMsg = t("pages.store.portalUsers.userCreated");
        if (wantEmail && data.email_sent === true) {
          toast.success(baseMsg, {
            description: t("pages.store.portalUsers.accessEmailSent"),
          });
        } else if (wantEmail && data.email_sent === false) {
          toast.warning(baseMsg, {
            description: t("pages.store.portalUsers.accessEmailFailed"),
          });
        } else {
          toast.success(baseMsg);
        }
        onCreated();
        onClose();
        resetForm();
      } else {
        const data = await res.json();
        const msg = data.error || t("pages.store.portalUsers.failedToCreate");
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      const msg = t("pages.store.portalUsers.failedToCreate");
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  const counterText =
    selectedAccess.length === 0
      ? t("pages.store.portalUsers.noCustomersSelected")
      : selectedAccess.length === 1
        ? t("pages.store.portalUsers.oneCustomerSelected")
        : t("pages.store.portalUsers.nCustomersSelected").replace(
            "{n}",
            String(selectedAccess.length)
          );

  const submitLabel = isSubmitting
    ? formData.sendAccess && formData.email
      ? t("common.sending")
      : t("pages.store.portalUsers.creating")
    : t("pages.store.portalUsers.createUser");

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={t("pages.store.portalUsers.createTitle")}
      maxWidth="max-w-5xl"
      actions={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}
      <div className="space-y-10">
        {/* User Info */}
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            {t("pages.store.portalUsers.userInfoSection")}
          </h3>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("pages.store.portalUsers.username")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder={t("pages.store.portalUsers.usernamePlaceholder")}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("pages.store.portalUsers.usernameHint")}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("pages.store.portalUsers.emailLabel")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder={t("pages.store.portalUsers.emailPlaceholder")}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("pages.store.portalUsers.password")}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="w-full rounded border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none"
                placeholder={t("pages.store.portalUsers.passwordPlaceholder")}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? t("common.hidePassword") : t("common.showPassword")}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <ChannelSelect
            value={formData.channel}
            onChange={(code) => setFormData({ ...formData, channel: code })}
            label={t("pages.store.portalUsers.channelLabel")}
          />
          <div className="pt-1">
            <label
              className={`flex items-start gap-2 text-sm select-none ${
                formData.email ? "cursor-pointer" : "cursor-not-allowed"
              }`}
            >
              <input
                type="checkbox"
                checked={formData.sendAccess}
                onChange={(e) =>
                  setFormData({ ...formData, sendAccess: e.target.checked })
                }
                disabled={!formData.email}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary disabled:opacity-50"
              />
              <span>
                <span
                  className={!formData.email ? "text-muted-foreground" : "text-slate-600"}
                >
                  {t("pages.store.portalUsers.sendAccessEmail")}
                </span>
                {!formData.email && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {t("pages.store.portalUsers.sendAccessNoEmail")}
                  </span>
                )}
              </span>
            </label>
          </div>
        </div>

        {/* Customer Access */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t("pages.store.portalUsers.customerAccessSection")}
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {counterText}
            </span>
          </h3>
          <CustomerAccessSelector
            value={selectedAccess}
            onChange={setSelectedAccess}
            disabled={isSubmitting}
          />
        </div>
      </div>
    </FullScreenModal>
  );
}
