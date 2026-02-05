/**
 * Campaign Form Hook
 *
 * Manages all form state and handlers for campaign creation.
 * Extracted from campaigns page for separation of concerns.
 */

import { useState, useCallback, useEffect } from "react";
import type { ITemplateProduct, TemplateType, NotificationChannel, NOTIFICATION_CHANNELS } from "@/lib/constants/notification";
import type { SelectedUser } from "@/components/notifications/UserSelector";

export interface ChannelAvailability {
  email: boolean;
  mobile: boolean;
  web_in_app: boolean;
}

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
  emailLink: string; // Separate link for email "Vedi tutti" button

  // Push notification URL (for in-app navigation)
  productsUrl: string;
  openInNewTab: boolean;

  // Product type fields
  products: ITemplateProduct[];

  // Channels
  enabledChannels: Set<NotificationChannel>;
  availableChannels: ChannelAvailability | null;
  isLoadingChannels: boolean;

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
  setEmailLink: (link: string) => void;
  setProductsUrl: (url: string) => void;
  setProducts: (products: ITemplateProduct[]) => void;
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
  email_link?: string;
  products_url?: string;
  products?: ITemplateProduct[];
  open_in_new_tab?: boolean;
  channels: NotificationChannel[];
  recipient_type: RecipientType;
  selected_users?: { id: string; email: string; name: string; type: "b2b" | "portal" }[];
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
  emailLink: "",
  productsUrl: "",
  openInNewTab: true,
  products: [],
  enabledChannels: new Set<NotificationChannel>(["email", "mobile", "web_in_app"]),
  availableChannels: null,
  isLoadingChannels: true,
  recipientType: "all",
  selectedUsers: [],
};

export function useCampaignForm(): CampaignFormState & CampaignFormActions {
  const [state, setState] = useState<CampaignFormState>(initialState);

  // Fetch available channels on mount
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch("/api/b2b/notifications/channels");
        if (res.ok) {
          const data = await res.json();
          const channels = data.channels as ChannelAvailability;
          setState((prev) => ({
            ...prev,
            availableChannels: channels,
            // Filter enabled channels to only include available ones
            enabledChannels: new Set(
              Array.from(prev.enabledChannels).filter(
                (ch) => channels[ch as keyof ChannelAvailability]
              )
            ),
            isLoadingChannels: false,
          }));
        } else {
          setState((prev) => ({ ...prev, isLoadingChannels: false }));
        }
      } catch {
        setState((prev) => ({ ...prev, isLoadingChannels: false }));
      }
    }
    fetchChannels();
  }, []);

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

  const setEmailLink = useCallback((emailLink: string) => {
    setState((prev) => ({ ...prev, emailLink }));
  }, []);

  const setProductsUrl = useCallback((productsUrl: string) => {
    setState((prev) => ({ ...prev, productsUrl }));
  }, []);

  const setProducts = useCallback((products: ITemplateProduct[]) => {
    setState((prev) => ({ ...prev, products }));
  }, []);

  const setOpenInNewTab = useCallback((openInNewTab: boolean) => {
    setState((prev) => ({ ...prev, openInNewTab }));
  }, []);

  const toggleChannel = useCallback((channel: NotificationChannel) => {
    setState((prev) => {
      // Don't allow toggling unavailable channels
      if (prev.availableChannels && !prev.availableChannels[channel as keyof ChannelAvailability]) {
        return prev;
      }
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
    setState((prev) => ({
      ...initialState,
      // Preserve channel availability state
      availableChannels: prev.availableChannels,
      isLoadingChannels: prev.isLoadingChannels,
      // Filter enabled channels to only include available ones
      enabledChannels: prev.availableChannels
        ? new Set(
            Array.from(initialState.enabledChannels).filter(
              (ch) => prev.availableChannels![ch as keyof ChannelAvailability]
            )
          )
        : initialState.enabledChannels,
    }));
  }, []);

  const loadDraft = useCallback((draft: Partial<CampaignFormState> & { channels?: NotificationChannel[] }) => {
    setState((prev) => {
      // Filter draft channels to only include available ones
      let channels = draft.channels ? new Set(draft.channels) : prev.enabledChannels;
      if (prev.availableChannels) {
        channels = new Set(
          Array.from(channels).filter(
            (ch) => prev.availableChannels![ch as keyof ChannelAvailability]
          )
        );
      }
      return {
        ...prev,
        campaignName: draft.campaignName ?? prev.campaignName,
        campaignType: draft.campaignType ?? prev.campaignType,
        title: draft.title ?? prev.title,
        body: draft.body ?? prev.body,
        pushImage: draft.pushImage ?? prev.pushImage,
        emailSubject: draft.emailSubject ?? prev.emailSubject,
        emailHtml: draft.emailHtml ?? prev.emailHtml,
        emailLink: draft.emailLink ?? prev.emailLink,
        productsUrl: draft.productsUrl ?? prev.productsUrl,
        products: draft.products ?? prev.products,
        openInNewTab: draft.openInNewTab ?? prev.openInNewTab,
        enabledChannels: channels,
        recipientType: draft.recipientType ?? prev.recipientType,
        selectedUsers: draft.selectedUsers ?? prev.selectedUsers,
        editingDraftId: draft.editingDraftId ?? prev.editingDraftId,
      };
    });
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
      email_link: state.emailLink || undefined,
      products_url: state.productsUrl || undefined,
      // Include open_in_new_tab when there's an action URL
      ...(state.productsUrl && { open_in_new_tab: state.openInNewTab }),
      channels: Array.from(state.enabledChannels),
      recipient_type: state.recipientType,
      ...(state.campaignType === "product" && state.products.length > 0 && { products: state.products }),
      ...(state.recipientType === "selected" && {
        selected_users: state.selectedUsers.map((u) => ({ id: u.id, email: u.email, name: u.name, type: u.type })),
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
    setEmailLink,
    setProductsUrl,
    setProducts,
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
