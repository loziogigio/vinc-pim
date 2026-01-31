"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Loader2, Bell } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { CHANNEL_UI_CONFIG, type NotificationChannel, type TemplateType, type ITemplateProduct } from "@/lib/constants/notification";

interface CampaignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  enabledChannels: Set<NotificationChannel>;
  campaignType: TemplateType;
  title: string;
  body: string;
  pushImage?: string;
  image?: string;
  emailSubject?: string;
  emailHtml?: string;
  productsUrl?: string;
  products?: ITemplateProduct[];
  url?: string;
  openInNewTab?: boolean;
}

export function CampaignPreviewModal({
  isOpen,
  onClose,
  enabledChannels,
  campaignType,
  title,
  body,
  pushImage,
  image,
  emailSubject,
  emailHtml,
  productsUrl,
  products,
  url,
  openInNewTab,
}: CampaignPreviewModalProps) {
  const [previewChannel, setPreviewChannel] = useState<NotificationChannel>("email");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

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
  }, [campaignType, title, body, emailSubject, emailHtml, products, productsUrl, pushImage, url, image, openInNewTab]);

  useEffect(() => {
    if (isOpen && previewChannel === "email") {
      fetchEmailPreview();
    }
  }, [isOpen, previewChannel, fetchEmailPreview]);

  // Reset to first enabled channel when opening
  useEffect(() => {
    if (isOpen) {
      const firstEnabled = Array.from(enabledChannels)[0];
      if (firstEnabled) setPreviewChannel(firstEnabled);
    }
  }, [isOpen, enabledChannels]);

  if (!isOpen) return null;

  const notificationImage = pushImage || image;
  const channels = Array.from(enabledChannels);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-slate-900">Anteprima Campagna</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Channel tabs */}
        <div className="flex gap-2 px-6 py-3 border-b bg-slate-50">
          {channels.map((channelId) => {
            const config = CHANNEL_UI_CONFIG[channelId];
            return (
              <button
                key={channelId}
                onClick={() => setPreviewChannel(channelId)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition",
                  previewChannel === channelId
                    ? "bg-white shadow text-slate-900"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {config.label}
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
                    <div className="bg-slate-100 px-4 py-2 flex justify-between text-xs text-slate-500">
                      <span>9:41</span>
                      <span>100%</span>
                    </div>
                    <div className="p-4">
                      <div className="bg-slate-50 rounded-xl p-3 shadow-sm">
                        <div className="flex items-start gap-3">
                          {notificationImage ? (
                            <img src={notificationImage} alt="" className="w-10 h-10 rounded-lg object-cover" />
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
                    {notificationImage ? (
                      <img src={notificationImage} alt="" className="w-12 h-12 rounded object-cover" />
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
  );
}
