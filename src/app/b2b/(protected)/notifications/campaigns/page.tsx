"use client";

import { useEffect, useState } from "react";
import { Send, TestTube, Clock, Loader2, Check, AlertCircle, Eye, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { useCampaignForm } from "@/hooks/useCampaignForm";
import { CampaignForm } from "@/components/notifications/CampaignForm";
import { CampaignPreviewModal } from "@/components/notifications/CampaignPreviewModal";
import { CampaignTestModal } from "@/components/notifications/CampaignTestModal";
import { CampaignScheduleModal } from "@/components/notifications/CampaignScheduleModal";
import { CampaignSuccessModal } from "@/components/notifications/CampaignSuccessModal";
import { CampaignList } from "@/components/notifications/CampaignList";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/b2b/Breadcrumbs";

type PageTab = "create" | "history";

export default function CampaignsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("create");

  // Form state from custom hook
  const form = useCampaignForm();

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    type: "sent" | "scheduled";
    campaignName?: string;
    recipientCount?: number;
    scheduledAt?: Date;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Build breadcrumbs
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: "Notifiche", href: "/b2b/notifications" },
    ];

    if (form.editingDraftId) {
      items.push({ label: "Campagne", href: "/b2b/notifications/campaigns" });
      items.push({ label: form.campaignName || "Modifica Bozza" });
    } else {
      items.push({ label: "Campagne" });
    }

    return items;
  };

  const handleSendTest = async (testEmail: string) => {
    if (!form.isValid() || !testEmail) return;

    setIsSending(true);
    try {
      const payload = { ...form.getPayload(), test_email: testEmail };

      const res = await fetch("/api/b2b/notifications/campaigns/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send test");
      }

      setToast({ type: "success", message: "Test inviato con successo!" });
      setShowTestModal(false);
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nell'invio del test" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!form.isValid()) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/b2b/notifications/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.getPayload()),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send campaign");
      }

      const data = await res.json();
      setSuccessModal({
        type: "sent",
        campaignName: form.campaignName || data.campaign?.name,
        recipientCount: data.recipients_count,
      });
      form.resetForm();
    } catch (error) {
      setErrorModal({
        title: "Errore nell'invio della campagna",
        message: error instanceof Error ? error.message : "Si è verificato un errore durante l'invio",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!form.campaignName.trim()) {
      setToast({ type: "error", message: "Inserisci un nome per la campagna" });
      return;
    }

    if (!form.title.trim() && !form.body.trim() && !form.emailHtml.trim()) {
      setToast({ type: "error", message: "Inserisci almeno un titolo, descrizione o contenuto email" });
      return;
    }

    setIsSavingDraft(true);
    try {
      // getPayload() already includes selected_users with full objects
      const payload = form.getPayload();

      // Use PUT if editing existing draft, POST for new
      const isUpdate = !!form.editingDraftId;
      const url = isUpdate
        ? `/api/b2b/notifications/campaigns/${form.editingDraftId}`
        : "/api/b2b/notifications/campaigns";

      const res = await fetch(url, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save draft");
      }

      const data = await res.json();
      const action = isUpdate ? "aggiornata" : "salvata";
      setToast({ type: "success", message: `Bozza "${data.campaign.name}" ${action}!` });

      if (!isUpdate) {
        form.resetForm();
      }
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nel salvataggio della bozza" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleScheduleCampaign = async (scheduledAt: Date) => {
    if (!form.campaignName.trim()) {
      setToast({ type: "error", message: "Inserisci un nome per la campagna" });
      return;
    }

    if (!form.isValid()) {
      setToast({ type: "error", message: "Compila tutti i campi obbligatori" });
      return;
    }

    setIsScheduling(true);
    try {
      // First save the campaign as draft
      // getPayload() already includes selected_users with full objects
      const payload = form.getPayload();

      const createRes = await fetch("/api/b2b/notifications/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!createRes.ok) {
        const data = await createRes.json();
        throw new Error(data.error || "Failed to create campaign");
      }

      const createData = await createRes.json();
      const campaignId = createData.campaign.campaign_id;

      // Then schedule it
      const scheduleRes = await fetch(`/api/b2b/notifications/campaigns/${campaignId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: scheduledAt.toISOString() }),
      });

      if (!scheduleRes.ok) {
        const data = await scheduleRes.json();
        throw new Error(data.error || "Failed to schedule campaign");
      }

      setShowScheduleModal(false);
      setSuccessModal({
        type: "scheduled",
        campaignName: form.campaignName || createData.campaign?.name,
        scheduledAt,
      });
      form.resetForm();
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nella programmazione" });
    } finally {
      setIsScheduling(false);
    }
  };

  const loadDraft = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/b2b/notifications/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        const campaign = data.campaign;

        // Map selected_users from API to form format (include type)
        const selectedUsers = campaign.selected_users?.map((u: { id: string; email: string; name: string; type?: "b2b" | "portal" }) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          type: u.type || "portal",
        })) || [];

        form.loadDraft({
          campaignName: campaign.name || "",
          campaignType: campaign.type || "product",
          title: campaign.title || "",
          body: campaign.body || "",
          pushImage: campaign.push_image || "",
          emailSubject: campaign.email_subject || "",
          emailHtml: campaign.email_html || "",
          emailLink: campaign.email_link || "",
          productsUrl: campaign.products_url || "",
          products: campaign.products || [],
          openInNewTab: campaign.open_in_new_tab ?? true,
          channels: campaign.channels || ["email", "mobile", "web_in_app"],
          recipientType: campaign.recipient_type || "all",
          selectedUsers,
          editingDraftId: campaignId,
        });

        setActiveTab("create");
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      setToast({ type: "error", message: "Errore nel caricamento della bozza" });
    }
  };

  return (
    <div className="p-6">
      {/* Breadcrumbs */}
      <div className="mb-4">
        <Breadcrumbs items={buildBreadcrumbs()} />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campagne</h1>
            <p className="text-sm text-slate-500 mt-1">Crea e gestisci campagne di notifica</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("create")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition",
              activeTab === "create" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Send className="w-4 h-4" />
            {form.editingDraftId ? "Modifica Bozza" : "Crea Campagna"}
          </button>
          <button
            onClick={() => { setActiveTab("history"); form.setEditingDraftId(null); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition",
              activeTab === "history" ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Clock className="w-4 h-4" />
            Storico
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-4 py-3 text-sm flex items-center gap-2",
            toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {toast.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* History Tab - Navigates to detail page for results */}
      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <CampaignList onEditDraft={loadDraft} />
        </div>
      )}

      {/* Create Tab */}
      {activeTab === "create" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <CampaignForm
            {...form}
            onCampaignNameChange={form.setCampaignName}
            onCampaignTypeChange={form.setCampaignType}
            onTitleChange={form.setTitle}
            onBodyChange={form.setBody}
            onPushImageChange={form.setPushImage}
            onEmailSubjectChange={form.setEmailSubject}
            onEmailHtmlChange={form.setEmailHtml}
            onEmailLinkChange={form.setEmailLink}
            onProductsUrlChange={form.setProductsUrl}
            onProductsChange={form.setProducts}
            onOpenInNewTabChange={form.setOpenInNewTab}
            onToggleChannel={form.toggleChannel}
            onRecipientTypeChange={form.setRecipientType}
            onSelectedUsersChange={form.setSelectedUsers}
            onToast={setToast}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 mt-8 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowPreview(true)} disabled={!form.title && !form.body} className="gap-2">
              <Eye className="w-4 h-4" />
              Anteprima
            </Button>
            <Button variant="outline" onClick={() => setShowTestModal(true)} disabled={!form.isValid()} className="gap-2">
              <TestTube className="w-4 h-4" />
              Invia Test
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowScheduleModal(true)}
              disabled={!form.isValid() || !form.campaignName.trim()}
              className="gap-2"
            >
              <Clock className="w-4 h-4" />
              Pianifica
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || !form.campaignName.trim() || (!form.title.trim() && !form.body.trim() && !form.emailHtml.trim())}
              className="gap-2"
            >
              {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salva Bozza
            </Button>
            <Button onClick={handleSendCampaign} disabled={!form.isValid() || isSending} className="gap-2">
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Invia Ora
            </Button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <CampaignPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        enabledChannels={form.enabledChannels}
        campaignType={form.campaignType}
        title={form.title}
        body={form.body}
        pushImage={form.pushImage}
        emailSubject={form.emailSubject}
        emailHtml={form.emailHtml}
        emailLink={form.emailLink}
        productsUrl={form.productsUrl}
        products={form.products}
        openInNewTab={form.openInNewTab}
      />

      {/* Test Modal */}
      <CampaignTestModal
        isOpen={showTestModal}
        onClose={() => setShowTestModal(false)}
        onSend={handleSendTest}
        enabledChannels={form.enabledChannels}
        isSending={isSending}
      />

      {/* Schedule Modal */}
      <CampaignScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSchedule={handleScheduleCampaign}
        isScheduling={isScheduling}
      />

      {/* Success Modal */}
      <CampaignSuccessModal
        isOpen={successModal !== null}
        onClose={() => setSuccessModal(null)}
        type={successModal?.type || "sent"}
        campaignName={successModal?.campaignName}
        recipientCount={successModal?.recipientCount}
        scheduledAt={successModal?.scheduledAt}
      />

      {/* Error Modal */}
      {errorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-rose-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{errorModal.title}</h3>
            </div>
            <p className="text-slate-600 mb-6">{errorModal.message}</p>
            <div className="flex justify-end">
              <Button onClick={() => setErrorModal(null)}>Chiudi</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
