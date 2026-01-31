/**
 * Campaign Form Hook
 *
 * Manages all form state and handlers for campaign creation.
 * Extracted from campaigns page for separation of concerns.
 */

import { useState, useCallback } from "react";
import type { ITemplateProduct, TemplateType, NotificationChannel } from "@/lib/constants/notification";
import type { SelectedUser } from "@/components/notifications/UserSelector";

export type RecipientType = "all" | "selected";

export interface CampaignFormState {
  // Campaign identification
  campaignName: string;
  editingDraftId: string | null;

  // Campaign type and content
  campaignType: TemplateType;
  title: string;
  body: string;

  // Push notification fields
  pushImage: string;

  // Email fields
  emailSubject: string;
  emailHtml: string;
  productsUrl: string;

  // Product type fields
  products: ITemplateProduct[];

  // Generic type fields
  url: string;
  image: string;
  openInNewTab: boolean;

  // Channels
  enabledChannels: Set<NotificationChannel>;

  // Recipients
  recipientType: RecipientType;
  selectedUsers: SelectedUser[];
}

export interface CampaignFormActions {
  setCampaignName: (name: string) => void;
  setEditingDraftId: (id: string | null) => void;
  setCampaignType: (type: TemplateType) => void;
  setTitle: (title: string) => void;
  setBody: (body: string) => void;
  setPushImage: (image: string) => void;
  setEmailSubject: (subject: string) => void;
  setEmailHtml: (html: string) => void;
  setProductsUrl: (url: string) => void;
  setProducts: (products: ITemplateProduct[]) => void;
  setUrl: (url: string) => void;
  setImage: (image: string) => void;
  setOpenInNewTab: (open: boolean) => void;
  toggleChannel: (channel: NotificationChannel) => void;
  setRecipientType: (type: RecipientType) => void;
  setSelectedUsers: (users: SelectedUser[]) => void;
  resetForm: () => void;
  loadDraft: (draft: Partial<CampaignFormState> & { channels?: NotificationChannel[] }) => void;
  isValid: () => boolean;
  getPayload: () => CampaignPayload;
}

export interface CampaignPayload {
  name?: string;
  type: TemplateType;
  title: string;
  body: string;
  push_image?: string;
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  products?: ITemplateProduct[];
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
  channels: NotificationChannel[];
  recipient_type: RecipientType;
  selected_users?: { id: string; email: string; name: string }[];
}

const initialState: CampaignFormState = {
  campaignName: "",
  editingDraftId: null,
  campaignType: "product",
  title: "",
  body: "",
  pushImage: "",
  emailSubject: "",
  emailHtml: "",
  productsUrl: "",
  products: [],
  url: "",
  image: "",
  openInNewTab: true,
  enabledChannels: new Set<NotificationChannel>(["email", "mobile", "web_in_app"]),
  recipientType: "all",
  selectedUsers: [],
};

export function useCampaignForm(): CampaignFormState & CampaignFormActions {
  const [state, setState] = useState<CampaignFormState>(initialState);

  const setCampaignName = useCallback((campaignName: string) => {
    setState((prev) => ({ ...prev, campaignName }));
  }, []);

  const setEditingDraftId = useCallback((editingDraftId: string | null) => {
    setState((prev) => ({ ...prev, editingDraftId }));
  }, []);

  const setCampaignType = useCallback((campaignType: TemplateType) => {
    setState((prev) => ({ ...prev, campaignType }));
  }, []);

  const setTitle = useCallback((title: string) => {
    setState((prev) => ({ ...prev, title }));
  }, []);

  const setBody = useCallback((body: string) => {
    setState((prev) => ({ ...prev, body }));
  }, []);

  const setPushImage = useCallback((pushImage: string) => {
    setState((prev) => ({ ...prev, pushImage }));
  }, []);

  const setEmailSubject = useCallback((emailSubject: string) => {
    setState((prev) => ({ ...prev, emailSubject }));
  }, []);

  const setEmailHtml = useCallback((emailHtml: string) => {
    setState((prev) => ({ ...prev, emailHtml }));
  }, []);

  const setProductsUrl = useCallback((productsUrl: string) => {
    setState((prev) => ({ ...prev, productsUrl }));
  }, []);

  const setProducts = useCallback((products: ITemplateProduct[]) => {
    setState((prev) => ({ ...prev, products }));
  }, []);

  const setUrl = useCallback((url: string) => {
    setState((prev) => ({ ...prev, url }));
  }, []);

  const setImage = useCallback((image: string) => {
    setState((prev) => ({ ...prev, image }));
  }, []);

  const setOpenInNewTab = useCallback((openInNewTab: boolean) => {
    setState((prev) => ({ ...prev, openInNewTab }));
  }, []);

  const toggleChannel = useCallback((channel: NotificationChannel) => {
    setState((prev) => {
      const next = new Set(prev.enabledChannels);
      if (next.has(channel)) {
        if (next.size > 1) {
          next.delete(channel);
        }
      } else {
        next.add(channel);
      }
      return { ...prev, enabledChannels: next };
    });
  }, []);

  const setRecipientType = useCallback((recipientType: RecipientType) => {
    setState((prev) => ({ ...prev, recipientType }));
  }, []);

  const setSelectedUsers = useCallback((selectedUsers: SelectedUser[]) => {
    setState((prev) => ({ ...prev, selectedUsers }));
  }, []);

  const resetForm = useCallback(() => {
    setState(initialState);
  }, []);

  const loadDraft = useCallback((draft: Partial<CampaignFormState> & { channels?: NotificationChannel[] }) => {
    setState((prev) => ({
      ...prev,
      campaignName: draft.campaignName ?? prev.campaignName,
      campaignType: draft.campaignType ?? prev.campaignType,
      title: draft.title ?? prev.title,
      body: draft.body ?? prev.body,
      pushImage: draft.pushImage ?? prev.pushImage,
      emailSubject: draft.emailSubject ?? prev.emailSubject,
      emailHtml: draft.emailHtml ?? prev.emailHtml,
      productsUrl: draft.productsUrl ?? prev.productsUrl,
      products: draft.products ?? prev.products,
      url: draft.url ?? prev.url,
      image: draft.image ?? prev.image,
      openInNewTab: draft.openInNewTab ?? prev.openInNewTab,
      enabledChannels: draft.channels ? new Set(draft.channels) : prev.enabledChannels,
      recipientType: draft.recipientType ?? prev.recipientType,
      selectedUsers: draft.selectedUsers ?? prev.selectedUsers,
      editingDraftId: draft.editingDraftId ?? prev.editingDraftId,
    }));
  }, []);

  const isValid = useCallback((): boolean => {
    if (state.enabledChannels.size === 0) return false;
    if (state.recipientType === "selected" && state.selectedUsers.length === 0) return false;

    const hasPush = state.enabledChannels.has("mobile") || state.enabledChannels.has("web_in_app");
    if (hasPush) {
      if (!state.title.trim()) return false;
      if (!state.body.trim()) return false;
    }

    if (state.enabledChannels.has("email")) {
      if (!state.emailSubject.trim()) return false;
      if (!state.emailHtml.trim()) return false;
    }

    if (state.campaignType === "product" && hasPush && state.products.length === 0) return false;

    return true;
  }, [state]);

  const getPayload = useCallback((): CampaignPayload => {
    return {
      name: state.campaignName.trim() || undefined,
      type: state.campaignType,
      title: state.title,
      body: state.body,
      push_image: state.pushImage || undefined,
      email_subject: state.emailSubject || undefined,
      email_html: state.emailHtml || undefined,
      products_url: state.productsUrl || undefined,
      channels: Array.from(state.enabledChannels),
      recipient_type: state.recipientType,
      ...(state.campaignType === "product" && state.products.length > 0 && { products: state.products }),
      ...(state.campaignType === "generic" && { url: state.url, image: state.image, open_in_new_tab: state.openInNewTab }),
      ...(state.recipientType === "selected" && {
        selected_users: state.selectedUsers.map((u) => ({ id: u.id, email: u.email, name: u.name })),
      }),
    };
  }, [state]);

  return {
    ...state,
    setCampaignName,
    setEditingDraftId,
    setCampaignType,
    setTitle,
    setBody,
    setPushImage,
    setEmailSubject,
    setEmailHtml,
    setProductsUrl,
    setProducts,
    setUrl,
    setImage,
    setOpenInNewTab,
    toggleChannel,
    setRecipientType,
    setSelectedUsers,
    resetForm,
    loadDraft,
    isValid,
    getPayload,
  };
}
