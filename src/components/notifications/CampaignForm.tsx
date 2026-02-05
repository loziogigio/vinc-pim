"use client";

import { useState } from "react";
import {
  Mail,
  Smartphone,
  Bell,
  Users,
  UserCheck,
  Check,
  Package,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Upload,
  Trash2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { ProductPicker } from "@/components/notifications/ProductPicker";
import { UserSelector, type SelectedUser } from "@/components/notifications/UserSelector";
import { SearchUrlInput } from "@/components/notifications/SearchUrlInput";
import {
  CHANNEL_UI_CONFIG,
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
  type TemplateType,
  type ITemplateProduct,
} from "@/lib/constants/notification";
import type { ChannelAvailability } from "@/hooks/useCampaignForm";

// Icon mapping for channels
const CHANNEL_ICONS: Record<NotificationChannel, React.ElementType> = {
  email: Mail,
  mobile: Smartphone,
  web_in_app: Bell,
};

const TEMPLATE_TYPES: { id: TemplateType; label: string; description: string; icon: React.ElementType }[] = [
  { id: "product", label: "Prodotti", description: "Seleziona prodotti dal PIM con anteprima", icon: Package },
  { id: "generic", label: "Comunicazione Generica", description: "Testo personalizzato con link opzionale", icon: FileText },
];

interface CampaignFormProps {
  // Form state
  campaignName: string;
  campaignType: TemplateType;
  title: string;
  body: string;
  pushImage: string;
  emailSubject: string;
  emailHtml: string;
  emailLink: string; // Separate link for email "Vedi tutti" button
  productsUrl: string; // Push notification action URL
  products: ITemplateProduct[];
  openInNewTab: boolean;
  enabledChannels: Set<NotificationChannel>;
  availableChannels: ChannelAvailability | null;
  recipientType: "all" | "selected";
  selectedUsers: SelectedUser[];

  // Handlers
  onCampaignNameChange: (name: string) => void;
  onCampaignTypeChange: (type: TemplateType) => void;
  onTitleChange: (title: string) => void;
  onBodyChange: (body: string) => void;
  onPushImageChange: (image: string) => void;
  onEmailSubjectChange: (subject: string) => void;
  onEmailHtmlChange: (html: string) => void;
  onEmailLinkChange: (link: string) => void;
  onProductsUrlChange: (url: string) => void;
  onProductsChange: (products: ITemplateProduct[]) => void;
  onOpenInNewTabChange: (open: boolean) => void;
  onToggleChannel: (channel: NotificationChannel) => void;
  onRecipientTypeChange: (type: "all" | "selected") => void;
  onSelectedUsersChange: (users: SelectedUser[]) => void;
  onToast: (toast: { type: "success" | "error"; message: string }) => void;
}

export function CampaignForm({
  campaignName,
  campaignType,
  title,
  body,
  pushImage,
  emailSubject,
  emailHtml,
  emailLink,
  productsUrl,
  products,
  openInNewTab,
  enabledChannels,
  availableChannels,
  recipientType,
  selectedUsers,
  onCampaignNameChange,
  onCampaignTypeChange,
  onTitleChange,
  onBodyChange,
  onPushImageChange,
  onEmailSubjectChange,
  onEmailHtmlChange,
  onEmailLinkChange,
  onProductsUrlChange,
  onProductsChange,
  onOpenInNewTabChange,
  onToggleChannel,
  onRecipientTypeChange,
  onSelectedUsersChange,
  onToast,
}: CampaignFormProps) {
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      onToast({ type: "error", message: "Seleziona un file immagine valido" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onToast({ type: "error", message: "L'immagine deve essere inferiore a 5MB" });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/uploads", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await res.json();
      onPushImageChange(data.url);
      onToast({ type: "success", message: "Immagine caricata con successo" });
    } catch (error) {
      onToast({ type: "error", message: error instanceof Error ? error.message : "Errore nel caricamento" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const hasPush = enabledChannels.has("mobile") || enabledChannels.has("web_in_app");

  return (
    <div className="space-y-8">
      {/* Campaign Name */}
      <div className="max-w-xl">
        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Campagna</label>
        <input
          type="text"
          value={campaignName}
          onChange={(e) => onCampaignNameChange(e.target.value)}
          placeholder="es. Promozione Inverno 2026, Lancio Nuovi Prodotti..."
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <p className="text-xs text-slate-500 mt-1">Un nome descrittivo per identificare questa campagna</p>
      </div>

      {/* Campaign Type Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">Tipo di Campagna</label>
        <div className="grid grid-cols-2 gap-4 max-w-xl">
          {TEMPLATE_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = campaignType === type.id;

            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onCampaignTypeChange(type.id)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-slate-200 hover:border-slate-300"
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
                  <p className={cn("font-medium", isSelected ? "text-primary" : "text-slate-700")}>{type.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Channel Selector */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">Canali di Invio</label>
        <div className="flex flex-wrap gap-3">
          {NOTIFICATION_CHANNELS.map((channelId) => {
            const isEnabled = enabledChannels.has(channelId);
            const isAvailable = availableChannels?.[channelId] ?? true;
            const config = CHANNEL_UI_CONFIG[channelId];
            const Icon = CHANNEL_ICONS[channelId];

            return (
              <button
                key={channelId}
                type="button"
                onClick={() => isAvailable && onToggleChannel(channelId)}
                disabled={!isAvailable}
                className={cn(
                  "relative flex flex-col items-center justify-center w-28 h-28 rounded-xl border-2 transition-all",
                  !isAvailable && "opacity-50 cursor-not-allowed",
                  isEnabled && isAvailable ? config.bgColor : "border-slate-200 bg-white",
                  isAvailable && !isEnabled && "hover:border-slate-300"
                )}
                style={{ borderColor: isEnabled && isAvailable ? config.borderColor : undefined }}
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-2", isEnabled && isAvailable ? config.bgColor : "bg-slate-100")}>
                  <Icon className={cn("w-5 h-5", isEnabled && isAvailable ? config.textColor : "text-slate-400")} />
                </div>
                <span className={cn("text-xs font-medium", isEnabled && isAvailable ? "text-slate-700" : "text-slate-400")}>{config.label}</span>
                {isEnabled && isAvailable && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                {!isAvailable && (
                  <span className="absolute top-2 right-2 text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                    Non configurato
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Push Notification Fields */}
      {hasPush && (
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
              <label className="block text-sm font-medium text-emerald-700 mb-1">Titolo</label>
              <input
                type="text"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Titolo della notifica..."
                className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-700 mb-1">Descrizione</label>
              <textarea
                value={body}
                onChange={(e) => onBodyChange(e.target.value)}
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
              {pushImage && (
                <div className="mb-3 relative inline-block">
                  <img src={pushImage} alt="Push preview" className="w-24 h-24 object-cover rounded-lg border-2 border-emerald-300" />
                  <button
                    type="button"
                    onClick={() => onPushImageChange("")}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <label className="flex-shrink-0">
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={isUploadingImage} />
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 px-3 py-2 border border-emerald-300 rounded-lg text-sm font-medium cursor-pointer transition",
                      isUploadingImage ? "bg-emerald-100 text-emerald-400 cursor-not-allowed" : "bg-white text-emerald-700 hover:bg-emerald-100"
                    )}
                  >
                    {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {isUploadingImage ? "Caricamento..." : "Carica"}
                  </span>
                </label>
                <input
                  type="url"
                  value={pushImage}
                  onChange={(e) => onPushImageChange(e.target.value)}
                  placeholder="oppure inserisci URL..."
                  className="flex-1 px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                />
              </div>
            </div>
            {/* URL Action - different input based on campaign type */}
            <div className="pt-2 border-t border-emerald-200">
              {campaignType === "product" ? (
                <>
                  <SearchUrlInput
                    value={productsUrl}
                    onChange={onProductsUrlChange}
                    label="URL Azione / Vedi Tutti"
                    placeholder="shop?text=prodotto&filters-brand_id=004"
                  />
                  <p className="text-xs text-emerald-600 mt-1">
                    URL per il pulsante &quot;Vedi tutti&quot; o azione della notifica. Incolla una keyword o una query avanzata (es.{" "}
                    <code className="rounded bg-emerald-100 px-1 py-0.5 text-[10px]">shop?text=moon&amp;filters-brand_id=004</code> o{" "}
                    <code className="rounded bg-emerald-100 px-1 py-0.5 text-[10px]">search?text=moon&amp;filters-brand_id=004</code>).
                  </p>
                </>
              ) : (
                <>
                  <label className="block text-sm font-medium text-emerald-700 mb-1">
                    <LinkIcon className="w-4 h-4 inline mr-1" />
                    URL Azione (opzionale)
                  </label>
                  <input
                    type="text"
                    value={productsUrl}
                    onChange={(e) => onProductsUrlChange(e.target.value)}
                    placeholder="https://esempio.com/pagina o /percorso-interno"
                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                  />
                  <p className="text-xs text-emerald-600 mt-1">
                    URL esterno (https://...) o percorso interno (/pagina). Cliccando la notifica si aprirà questo link.
                  </p>
                </>
              )}
              {productsUrl && (
                <label className="flex items-center gap-2 mt-2">
                  <input type="checkbox" checked={openInNewTab} onChange={(e) => onOpenInNewTabChange(e.target.checked)} className="w-4 h-4 rounded text-emerald-500" />
                  <span className="text-xs text-emerald-700">Apri in una nuova scheda</span>
                </label>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Fields */}
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
              <label className="block text-sm font-medium text-blue-700 mb-1">Oggetto Email</label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => onEmailSubjectChange(e.target.value)}
                placeholder="Oggetto della email..."
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">Contenuto HTML</label>
              <textarea
                value={emailHtml}
                onChange={(e) => onEmailHtmlChange(e.target.value)}
                placeholder="<h1>Titolo</h1>&#10;<p>Il tuo messaggio qui...</p>"
                rows={6}
                className="w-full px-3 py-2 border border-blue-200 rounded-lg text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              />
              <p className="text-xs text-blue-600 mt-1">Inserisci il contenuto HTML. Header e footer verranno aggiunti automaticamente.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                <LinkIcon className="w-4 h-4 inline mr-1" />
                Link &quot;Vedi tutti&quot; (opzionale)
              </label>
              <input
                type="url"
                value={emailLink}
                onChange={(e) => onEmailLinkChange(e.target.value)}
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
          <ProductPicker value={products} onChange={onProductsChange} maxProducts={10} />
        </div>
      )}


      {/* Recipients */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-3">Destinatari</label>
        <div className="space-y-2 max-w-xl">
          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input type="radio" name="recipients" value="all" checked={recipientType === "all"} onChange={() => onRecipientTypeChange("all")} className="w-4 h-4 text-primary" />
            <Users className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Tutti i Clienti</p>
              <p className="text-xs text-slate-500">Invia a tutti i clienti attivi</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input type="radio" name="recipients" value="selected" checked={recipientType === "selected"} onChange={() => onRecipientTypeChange("selected")} className="w-4 h-4 text-primary" />
            <UserCheck className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-700">Destinatari Selezionati</p>
              <p className="text-xs text-slate-500">Scegli utenti B2B o clienti Portal</p>
            </div>
          </label>
        </div>

        {recipientType === "selected" && (
          <div className="mt-4">
            <UserSelector value={selectedUsers} onChange={onSelectedUsersChange} />
          </div>
        )}
      </div>

      {/* Validation Errors */}
      <ValidationErrors
        campaignName={campaignName}
        title={title}
        body={body}
        emailSubject={emailSubject}
        emailHtml={emailHtml}
        enabledChannels={enabledChannels}
        recipientType={recipientType}
        selectedUsers={selectedUsers}
        campaignType={campaignType}
        products={products}
      />
    </div>
  );
}

// Validation Errors Component
function ValidationErrors({
  campaignName,
  title,
  body,
  emailSubject,
  emailHtml,
  enabledChannels,
  recipientType,
  selectedUsers,
  campaignType,
  products,
}: {
  campaignName: string;
  title: string;
  body: string;
  emailSubject: string;
  emailHtml: string;
  enabledChannels: Set<NotificationChannel>;
  recipientType: "all" | "selected";
  selectedUsers: SelectedUser[];
  campaignType: TemplateType;
  products: ITemplateProduct[];
}) {
  const errors: string[] = [];

  // Check campaign name
  if (!campaignName.trim()) {
    errors.push("Nome campagna richiesto");
  }

  // Check channels
  if (enabledChannels.size === 0) {
    errors.push("Seleziona almeno un canale di invio");
  }

  const hasPush = enabledChannels.has("mobile") || enabledChannels.has("web_in_app");

  // Check push notification content
  if (hasPush) {
    if (!title.trim()) {
      errors.push("Titolo notifica push richiesto");
    }
    if (!body.trim()) {
      errors.push("Descrizione notifica push richiesta");
    }
  }

  // Check email content
  if (enabledChannels.has("email")) {
    if (!emailSubject.trim()) {
      errors.push("Oggetto email richiesto");
    }
    if (!emailHtml.trim()) {
      errors.push("Contenuto HTML email richiesto");
    }
  }

  // Check products for product campaigns
  if (campaignType === "product" && hasPush && products.length === 0) {
    errors.push("Seleziona almeno un prodotto");
  }

  // Check recipients
  if (recipientType === "selected" && selectedUsers.length === 0) {
    errors.push("Seleziona almeno un destinatario");
  }

  if (errors.length === 0) return null;

  return (
    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 max-w-xl">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-800 mb-2">Informazioni mancanti</p>
          <ul className="space-y-1">
            {errors.map((error, idx) => (
              <li key={idx} className="text-sm text-amber-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {error}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
