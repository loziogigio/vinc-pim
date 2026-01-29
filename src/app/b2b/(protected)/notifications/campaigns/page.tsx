"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Mail,
  Bell,
  Smartphone,
  Users,
  UserCheck,
  Send,
  TestTube,
  Clock,
  Loader2,
  Check,
  AlertCircle,
  Package,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Eye,
  X,
  Upload,
  Trash2,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { ProductPicker } from "@/components/notifications/ProductPicker";
import { UserSelector, type SelectedUser } from "@/components/notifications/UserSelector";
import { CampaignList } from "@/components/notifications/CampaignList";
import { CampaignResults } from "@/components/notifications/CampaignResults";
import type { ITemplateProduct, TemplateType } from "@/lib/constants/notification";

type PageTab = "create" | "history";

type RecipientType = "all" | "selected";
type CampaignChannel = "email" | "mobile" | "web_in_app";

interface ChannelConfig {
  id: CampaignChannel;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  textColor: string;
}

const CHANNELS: ChannelConfig[] = [
  { id: "email", label: "Email", icon: Mail, color: "blue", bgColor: "bg-blue-50", textColor: "text-blue-600" },
  { id: "mobile", label: "Mobile App", icon: Smartphone, color: "emerald", bgColor: "bg-emerald-50", textColor: "text-emerald-600" },
  { id: "web_in_app", label: "Web / In-App", icon: Bell, color: "amber", bgColor: "bg-amber-50", textColor: "text-amber-600" },
];

const TEMPLATE_TYPES: { id: TemplateType; label: string; description: string; icon: React.ElementType }[] = [
  {
    id: "product",
    label: "Prodotti",
    description: "Seleziona prodotti dal PIM con anteprima",
    icon: Package,
  },
  {
    id: "generic",
    label: "Comunicazione Generica",
    description: "URL, immagine e testo personalizzato",
    icon: FileText,
  },
];

export default function CampaignsPage() {
  // Page tab state
  const [activeTab, setActiveTab] = useState<PageTab>("create");
  const [viewingResultsId, setViewingResultsId] = useState<string | null>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

  // Campaign identification
  const [campaignName, setCampaignName] = useState("");

  // Campaign type and content
  const [campaignType, setCampaignType] = useState<TemplateType>("product");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  // Push notification fields (for mobile/web_in_app)
  const [pushImage, setPushImage] = useState(""); // Image for push notifications

  // Email fields
  const [emailSubject, setEmailSubject] = useState(""); // Email subject line
  const [emailHtml, setEmailHtml] = useState(""); // Custom HTML for email
  const [productsUrl, setProductsUrl] = useState(""); // "Vedi tutti" link for email

  // Product type fields
  const [products, setProducts] = useState<ITemplateProduct[]>([]);

  // Generic type fields (for email)
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(true);

  // Channels
  const [enabledChannels, setEnabledChannels] = useState<Set<CampaignChannel>>(
    new Set<CampaignChannel>(["email", "mobile", "web_in_app"])
  );

  // Recipients
  const [recipientType, setRecipientType] = useState<RecipientType>("all");
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);

  // UI state
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewChannel, setPreviewChannel] = useState<CampaignChannel>("email");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string>("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "Seleziona un file immagine valido" });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setToast({ type: "error", message: "L'immagine deve essere inferiore a 5MB" });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      setPushImage(data.url);
      setToast({ type: "success", message: "Immagine caricata con successo" });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nel caricamento" });
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch email preview when modal opens
  const fetchEmailPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    try {
      const payload = {
        type: campaignType,
        title,
        body,
        email_subject: emailSubject,
        email_html: emailHtml,
        products_url: productsUrl,
        push_image: pushImage,
        ...(campaignType === "product" && { products }),
        ...(campaignType === "generic" && { url, image, open_in_new_tab: openInNewTab }),
      };

      const res = await fetch("/api/b2b/notifications/campaigns/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setEmailPreviewHtml(data.html || "");
      }
    } catch (error) {
      console.error("Error fetching preview:", error);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [campaignType, title, body, emailHtml, products, productsUrl, pushImage, url, image, openInNewTab]);

  useEffect(() => {
    if (showPreview && previewChannel === "email") {
      fetchEmailPreview();
    }
  }, [showPreview, previewChannel, fetchEmailPreview]);

  const toggleChannel = (channel: CampaignChannel) => {
    setEnabledChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) {
        // Don't allow disabling all channels
        if (next.size > 1) {
          next.delete(channel);
        }
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  const isValid = () => {
    if (enabledChannels.size === 0) return false;
    if (recipientType === "selected" && selectedUsers.length === 0) return false;

    // Push notification validation (mobile or web_in_app)
    const hasPush = enabledChannels.has("mobile") || enabledChannels.has("web_in_app");
    if (hasPush) {
      if (!title.trim()) return false;
      if (!body.trim()) return false;
    }

    // Email validation
    if (enabledChannels.has("email")) {
      if (!emailSubject.trim()) return false;
      if (!emailHtml.trim()) return false;
    }

    // Product campaign requires products for push notifications
    if (campaignType === "product" && hasPush && products.length === 0) return false;

    return true;
  };

  const handleSendTest = async () => {
    if (!isValid() || !testEmail) return;

    setIsSending(true);
    try {
      const payload = {
        type: campaignType,
        title,
        body,
        channels: Array.from(enabledChannels),
        test_email: testEmail,
        email_subject: emailSubject,
        email_html: emailHtml,
        products_url: productsUrl,
        push_image: pushImage,
        ...(campaignType === "product" && { products }),
        ...(campaignType === "generic" && { url, image, open_in_new_tab: openInNewTab }),
      };

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
      setTestEmail("");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nell'invio del test" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!isValid()) return;

    setIsSending(true);
    try {
      const payload = {
        type: campaignType,
        title,
        body,
        channels: Array.from(enabledChannels),
        recipient_type: recipientType,
        email_subject: emailSubject,
        email_html: emailHtml,
        products_url: productsUrl,
        push_image: pushImage,
        ...(recipientType === "selected" && { selected_users: selectedUsers.map(u => ({ id: u.id, email: u.email, name: u.name })) }),
        ...(campaignType === "product" && { products }),
        ...(campaignType === "generic" && { url, image, open_in_new_tab: openInNewTab }),
      };

      const res = await fetch("/api/b2b/notifications/campaigns/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to send campaign");
      }

      const data = await res.json();
      setToast({
        type: "success",
        message: `Campagna inviata a ${data.recipients_count} destinatari!`,
      });

      // Reset form
      setTitle("");
      setBody("");
      setEmailSubject("");
      setEmailHtml("");
      setPushImage("");
      setProducts([]);
      setProductsUrl("");
      setUrl("");
      setImage("");
      setSelectedUsers([]);
      setRecipientType("all");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nell'invio della campagna" });
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveDraft = async () => {
    // Validate campaign name
    if (!campaignName.trim()) {
      setToast({ type: "error", message: "Inserisci un nome per la campagna" });
      return;
    }

    // Minimal validation for draft content
    if (!title.trim() && !body.trim() && !emailHtml.trim()) {
      setToast({ type: "error", message: "Inserisci almeno un titolo, descrizione o contenuto email" });
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = {
        name: campaignName.trim(),
        type: campaignType,
        title: title || "Bozza senza titolo",
        body: body || "",
        channels: Array.from(enabledChannels),
        recipient_type: recipientType,
        email_subject: emailSubject,
        email_html: emailHtml,
        products_url: productsUrl,
        push_image: pushImage,
        ...(recipientType === "selected" && selectedUsers.length > 0 && {
          selected_user_ids: selectedUsers.map(u => u.id)
        }),
        ...(campaignType === "product" && products.length > 0 && { products }),
        ...(campaignType === "generic" && { url, image, open_in_new_tab: openInNewTab }),
      };

      const res = await fetch("/api/b2b/notifications/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save draft");
      }

      const data = await res.json();
      setToast({
        type: "success",
        message: `Bozza "${data.campaign.name}" salvata! (${data.campaign.slug})`,
      });

      // Reset form after successful save
      setCampaignName("");
      setTitle("");
      setBody("");
      setEmailSubject("");
      setEmailHtml("");
      setPushImage("");
      setProducts([]);
      setProductsUrl("");
      setUrl("");
      setImage("");
      setSelectedUsers([]);
      setRecipientType("all");
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Errore nel salvataggio della bozza" });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Load draft for editing
  const loadDraft = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/b2b/notifications/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        const campaign = data.campaign;

        // Populate form with draft data
        setCampaignName(campaign.name || "");
        setCampaignType(campaign.type || "product");
        setTitle(campaign.title || "");
        setBody(campaign.body || "");
        setPushImage(campaign.push_image || "");
        setEmailSubject(campaign.email_subject || "");
        setEmailHtml(campaign.email_html || "");
        setProductsUrl(campaign.products_url || "");
        setProducts(campaign.products || []);
        setUrl(campaign.url || "");
        setImage(campaign.image || "");
        setOpenInNewTab(campaign.open_in_new_tab ?? true);
        setEnabledChannels(new Set(campaign.channels || ["email", "mobile", "web_in_app"]));
        setRecipientType(campaign.recipient_type || "all");

        // Note: selected_user_ids would need to be loaded separately
        setEditingDraftId(campaignId);
        setActiveTab("create");
      }
    } catch (error) {
      console.error("Error loading draft:", error);
      setToast({ type: "error", message: "Errore nel caricamento della bozza" });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Campagne</h1>
            <p className="text-sm text-slate-500 mt-1">
              Crea e gestisci campagne di notifica
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mt-4 border-b border-slate-200">
          <button
            onClick={() => {
              setActiveTab("create");
              setViewingResultsId(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition",
              activeTab === "create"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Send className="w-4 h-4" />
            {editingDraftId ? "Modifica Bozza" : "Crea Campagna"}
          </button>
          <button
            onClick={() => {
              setActiveTab("history");
              setViewingResultsId(null);
              setEditingDraftId(null);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-[1px] transition",
              activeTab === "history"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
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
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          )}
        >
          {toast.type === "success" ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && !viewingResultsId && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <CampaignList
            onEditDraft={(id) => loadDraft(id)}
            onViewResults={(id) => setViewingResultsId(id)}
          />
        </div>
      )}

      {/* Results View */}
      {activeTab === "history" && viewingResultsId && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <CampaignResults
            campaignId={viewingResultsId}
            onBack={() => setViewingResultsId(null)}
          />
        </div>
      )}

      {/* Create Tab */}
      {activeTab === "create" && (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="space-y-8">
          {/* Campaign Name */}
          <div className="max-w-xl">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome Campagna
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="es. Promozione Inverno 2026, Lancio Nuovi Prodotti..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-slate-500 mt-1">
              Un nome descrittivo per identificare questa campagna
            </p>
          </div>

          {/* Campaign Type Selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Tipo di Campagna
            </label>
            <div className="grid grid-cols-2 gap-4 max-w-xl">
              {TEMPLATE_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = campaignType === type.id;

                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setCampaignType(type.id)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                      )}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className={cn("font-medium", isSelected ? "text-primary" : "text-slate-700")}>
                        {type.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Channel Selector - Moved here after Campaign Type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Canali di Invio
            </label>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map((channel) => {
                const isEnabled = enabledChannels.has(channel.id);
                const Icon = channel.icon;

                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => toggleChannel(channel.id)}
                    className={cn(
                      "relative flex flex-col items-center justify-center w-28 h-28 rounded-xl border-2 transition-all",
                      isEnabled
                        ? `border-${channel.color}-500 ${channel.bgColor}`
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                    style={{
                      borderColor: isEnabled
                        ? channel.color === "blue"
                          ? "#3b82f6"
                          : channel.color === "emerald"
                          ? "#10b981"
                          : "#f59e0b"
                        : undefined,
                    }}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center mb-2",
                        isEnabled ? channel.bgColor : "bg-slate-100"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-5 h-5",
                          isEnabled ? channel.textColor : "text-slate-400"
                        )}
                      />
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        isEnabled ? "text-slate-700" : "text-slate-400"
                      )}
                    >
                      {channel.label}
                    </span>
                    {isEnabled && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Push Notification Fields (when mobile or web_in_app is enabled) */}
          {(enabledChannels.has("mobile") || enabledChannels.has("web_in_app")) && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-emerald-800">Contenuto Push Notification</h3>
                  <p className="text-xs text-emerald-600">Per notifiche mobile e web</p>
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-1">
                    Titolo
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Titolo della notifica..."
                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Descrizione della notifica..."
                    rows={2}
                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-emerald-700 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    Immagine
                  </label>

                  {/* Image Preview */}
                  {pushImage ? (
                    <div className="mb-3 relative inline-block">
                      <img
                        src={pushImage}
                        alt="Push preview"
                        className="w-24 h-24 object-cover rounded-lg border-2 border-emerald-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/placeholder-image.png";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setPushImage("")}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    {/* Upload Button */}
                    <label className="flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                      <span className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 border border-emerald-300 rounded-lg text-sm font-medium cursor-pointer transition",
                        isUploadingImage
                          ? "bg-emerald-100 text-emerald-400 cursor-not-allowed"
                          : "bg-white text-emerald-700 hover:bg-emerald-100"
                      )}>
                        {isUploadingImage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {isUploadingImage ? "Caricamento..." : "Carica"}
                      </span>
                    </label>

                    {/* URL Input */}
                    <input
                      type="url"
                      value={pushImage}
                      onChange={(e) => setPushImage(e.target.value)}
                      placeholder="oppure inserisci URL..."
                      className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Fields (when email is enabled) */}
          {enabledChannels.has("email") && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Mail className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-medium text-blue-800">Contenuto Email</h3>
                  <p className="text-xs text-blue-600">HTML personalizzato per email</p>
                </div>
              </div>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Oggetto Email
                  </label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Oggetto della email..."
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    Contenuto HTML
                  </label>
                  <textarea
                    value={emailHtml}
                    onChange={(e) => setEmailHtml(e.target.value)}
                    placeholder="<h1>Titolo</h1>&#10;<p>Il tuo messaggio qui...</p>"
                    rows={6}
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Inserisci il contenuto HTML. Header e footer verranno aggiunti automaticamente.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-blue-700 mb-1">
                    <LinkIcon className="w-4 h-4 inline mr-1" />
                    Link &quot;Vedi tutti&quot; (opzionale)
                  </label>
                  <input
                    type="url"
                    value={productsUrl}
                    onChange={(e) => setProductsUrl(e.target.value)}
                    placeholder="https://shop.esempio.com/prodotti"
                    className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product Type: Product Picker */}
          {campaignType === "product" && (
            <div className="max-w-xl">
              <ProductPicker
                value={products}
                onChange={setProducts}
                maxProducts={10}
              />
            </div>
          )}

          {/* Generic Type: URL & Image */}
          {campaignType === "generic" && (
            <div className="grid gap-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  URL (opzionale)
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://esempio.com/pagina"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {url && (
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={openInNewTab}
                      onChange={(e) => setOpenInNewTab(e.target.checked)}
                      className="w-4 h-4 rounded text-primary"
                    />
                    <span className="text-xs text-slate-500">Apri in una nuova scheda</span>
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <ImageIcon className="w-4 h-4 inline mr-1" />
                  Immagine URL (opzionale)
                </label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://esempio.com/immagine.jpg"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {image && (
                  <div className="mt-2 relative">
                    <img
                      src={image}
                      alt="Preview"
                      className="w-full max-h-40 object-cover rounded-lg border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Destinatari
            </label>
            <div className="space-y-2 max-w-xl">
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="recipients"
                  value="all"
                  checked={recipientType === "all"}
                  onChange={() => setRecipientType("all")}
                  className="w-4 h-4 text-primary"
                />
                <Users className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Tutti i Clienti</p>
                  <p className="text-xs text-slate-500">Invia a tutti i clienti attivi</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="recipients"
                  value="selected"
                  checked={recipientType === "selected"}
                  onChange={() => setRecipientType("selected")}
                  className="w-4 h-4 text-primary"
                />
                <UserCheck className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-700">Destinatari Selezionati</p>
                  <p className="text-xs text-slate-500">Scegli utenti B2B o clienti Portal</p>
                </div>
              </label>
            </div>

            {/* User Selector (when selected is chosen) */}
            {recipientType === "selected" && (
              <div className="mt-4">
                <UserSelector
                  value={selectedUsers}
                  onChange={setSelectedUsers}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!title && !body}
              className="gap-2"
            >
              <Eye className="w-4 h-4" />
              Anteprima
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowTestModal(true)}
              disabled={!isValid()}
              className="gap-2"
            >
              <TestTube className="w-4 h-4" />
              Invia Test
            </Button>
            <Button
              variant="outline"
              disabled
              className="gap-2"
            >
              <Clock className="w-4 h-4" />
              Pianifica
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSavingDraft || !campaignName.trim() || (!title.trim() && !body.trim() && !emailHtml.trim())}
              className="gap-2"
            >
              {isSavingDraft ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salva Bozza
            </Button>
            <Button
              onClick={handleSendCampaign}
              disabled={!isValid() || isSending}
              className="gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Invia Ora
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPreview(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-slate-900">Anteprima Campagna</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 rounded hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Channel tabs */}
            <div className="flex gap-2 px-6 py-3 border-b bg-slate-50">
              {CHANNELS.filter(c => enabledChannels.has(c.id)).map((channel) => {
                const Icon = channel.icon;
                return (
                  <button
                    key={channel.id}
                    onClick={() => setPreviewChannel(channel.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                      previewChannel === channel.id
                        ? "bg-white shadow text-slate-900"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {channel.label}
                  </button>
                );
              })}
            </div>

            {/* Preview content */}
            <div className="flex-1 overflow-auto p-6">
              {previewChannel === "email" && (
                <div className="max-w-2xl mx-auto">
                  <div className="bg-slate-100 rounded-t-lg px-4 py-2 text-xs text-slate-500">
                    Email Preview
                  </div>
                  {isLoadingPreview ? (
                    <div className="bg-white border rounded-b-lg p-8 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                      <span className="text-sm text-slate-500">Caricamento anteprima...</span>
                    </div>
                  ) : (
                    <div
                      className="bg-white border rounded-b-lg"
                      dangerouslySetInnerHTML={{ __html: emailPreviewHtml }}
                    />
                  )}
                </div>
              )}

              {previewChannel === "mobile" && (
                <div className="flex justify-center">
                  <div className="w-80">
                    <div className="bg-slate-800 rounded-3xl p-3">
                      <div className="bg-white rounded-2xl overflow-hidden">
                        {/* Phone status bar */}
                        <div className="bg-slate-100 px-4 py-2 flex justify-between text-xs text-slate-500">
                          <span>9:41</span>
                          <span>100%</span>
                        </div>
                        {/* Notification */}
                        <div className="p-4">
                          <div className="bg-slate-50 rounded-xl p-3 shadow-sm">
                            <div className="flex items-start gap-3">
                              {pushImage ? (
                                <img
                                  src={pushImage}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : image ? (
                                <img
                                  src={image}
                                  alt=""
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                  <Bell className="w-5 h-5 text-white" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-900 truncate">
                                  {title || "Titolo notifica"}
                                </p>
                                <p className="text-xs text-slate-500 line-clamp-2">
                                  {body || "Contenuto della notifica..."}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewChannel === "web_in_app" && (
                <div className="flex justify-center">
                  <div className="w-96">
                    <div className="bg-slate-100 rounded-lg p-2 text-xs text-slate-500 mb-2">
                      Browser Notification
                    </div>
                    <div className="bg-white border rounded-lg shadow-lg p-4">
                      <div className="flex items-start gap-3">
                        {pushImage ? (
                          <img
                            src={pushImage}
                            alt=""
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : image ? (
                          <img
                            src={image}
                            alt=""
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-primary rounded flex items-center justify-center">
                            <Bell className="w-6 h-6 text-white" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">
                            {title || "Titolo notifica"}
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            {body || "Contenuto della notifica..."}
                          </p>
                        </div>
                        <button className="text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {showTestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowTestModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md m-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Invia Test</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Indirizzo Email di Test
              </label>
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="test@esempio.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Canali selezionati: {Array.from(enabledChannels).map(c =>
                CHANNELS.find(ch => ch.id === c)?.label
              ).join(", ")}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTestModal(false)}>
                Annulla
              </Button>
              <Button onClick={handleSendTest} disabled={!testEmail || isSending}>
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Invia Test
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
