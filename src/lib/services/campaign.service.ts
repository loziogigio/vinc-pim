/**
 * Campaign Service
 *
 * Business logic for campaign management. API routes should be thin
 * orchestrators that call these functions.
 */

import { connectWithModels } from "@/lib/db/connection";
import { buildCampaignEmail, generateCustomEmailHtml } from "@/lib/notifications/email-builder";
import { sendCampaignDirect } from "@/lib/notifications/send.service";
import { getCampaignStats } from "@/lib/notifications/notification-log.service";
import { isFCMEnabled } from "@/lib/fcm";
import type {
  CampaignStatus,
  TemplateType,
  NotificationChannel,
  RecipientType,
  ITemplateProduct,
} from "@/lib/constants/notification";

// ============================================
// TYPES
// ============================================

export interface CampaignResults {
  email: { sent: number; failed: number; opened: number; clicked: number };
  mobile: { sent: number; failed: number; clicked: number };
  web_in_app: { sent: number; failed: number; read: number };
}

export interface CreateCampaignData {
  name: string;
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
  selected_user_ids?: string[];
  tag_ids?: string[];
  created_by?: string;
}

export interface UpdateCampaignData {
  name?: string;
  type?: TemplateType;
  title?: string;
  body?: string;
  push_image?: string;
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  products?: ITemplateProduct[];
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
  channels?: NotificationChannel[];
  recipient_type?: RecipientType;
  selected_user_ids?: string[];
  tag_ids?: string[];
  updated_by?: string;
}

export interface ListCampaignsOptions {
  status?: CampaignStatus;
  page?: number;
  limit?: number;
}

export interface SendCampaignResult {
  success: boolean;
  campaign_id: string;
  recipients_count: number;
  results: CampaignResults;
}

// ============================================
// LIST CAMPAIGNS
// ============================================

export async function listCampaigns(
  tenantDb: string,
  options: ListCampaignsOptions = {}
) {
  const { status, page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (status) {
    query.status = status;
  }

  const { Campaign } = await connectWithModels(tenantDb);

  const [campaigns, total] = await Promise.all([
    Campaign.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Campaign.countDocuments(query),
  ]);

  return {
    campaigns,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// ============================================
// GET CAMPAIGN
// ============================================

export async function getCampaign(tenantDb: string, campaignId: string) {
  const { Campaign } = await connectWithModels(tenantDb);
  const campaign = await Campaign.findOne({ campaign_id: campaignId }).lean();
  return campaign;
}

// ============================================
// CREATE CAMPAIGN
// ============================================

export async function createCampaign(tenantDb: string, data: CreateCampaignData) {
  const { Campaign } = await connectWithModels(tenantDb);

  const campaign = new Campaign({
    name: data.name.trim(),
    status: "draft" as CampaignStatus,
    type: data.type,
    title: data.title.trim(),
    body: data.body.trim(),
    push_image: data.push_image?.trim(),
    email_subject: data.email_subject?.trim(),
    email_html: data.email_html,
    products_url: data.products_url?.trim(),
    products: data.products,
    url: data.url?.trim(),
    image: data.image?.trim(),
    open_in_new_tab: data.open_in_new_tab,
    channels: data.channels,
    recipient_type: data.recipient_type,
    selected_user_ids: data.selected_user_ids,
    tag_ids: data.tag_ids,
    created_by: data.created_by,
  });

  await campaign.save();

  return {
    campaign_id: campaign.campaign_id,
    name: campaign.name,
    slug: campaign.slug,
    status: campaign.status,
    type: campaign.type,
    title: campaign.title,
    created_at: campaign.created_at,
  };
}

// ============================================
// UPDATE CAMPAIGN
// ============================================

export async function updateCampaign(
  tenantDb: string,
  campaignId: string,
  data: UpdateCampaignData
) {
  const { Campaign } = await connectWithModels(tenantDb);

  const campaign = await Campaign.findOne({ campaign_id: campaignId });

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }

  if (campaign.status !== "draft") {
    return { error: "Only draft campaigns can be updated", status: 400 };
  }

  // Update fields
  if (data.name !== undefined) campaign.name = data.name.trim();
  if (data.type !== undefined) campaign.type = data.type;
  if (data.title !== undefined) campaign.title = data.title.trim();
  if (data.body !== undefined) campaign.body = data.body.trim();
  if (data.push_image !== undefined) campaign.push_image = data.push_image?.trim();
  if (data.email_subject !== undefined) campaign.email_subject = data.email_subject?.trim();
  if (data.email_html !== undefined) campaign.email_html = data.email_html;
  if (data.products_url !== undefined) campaign.products_url = data.products_url?.trim();
  if (data.products !== undefined) campaign.products = data.products;
  if (data.url !== undefined) campaign.url = data.url?.trim();
  if (data.image !== undefined) campaign.image = data.image?.trim();
  if (data.open_in_new_tab !== undefined) campaign.open_in_new_tab = data.open_in_new_tab;
  if (data.channels !== undefined) campaign.channels = data.channels;
  if (data.recipient_type !== undefined) campaign.recipient_type = data.recipient_type;
  if (data.selected_user_ids !== undefined) campaign.selected_user_ids = data.selected_user_ids;
  if (data.tag_ids !== undefined) campaign.tag_ids = data.tag_ids;
  if (data.updated_by) campaign.updated_by = data.updated_by;

  await campaign.save();

  return {
    campaign_id: campaign.campaign_id,
    name: campaign.name,
    slug: campaign.slug,
    status: campaign.status,
    updated_at: campaign.updated_at,
  };
}

// ============================================
// DELETE CAMPAIGN
// ============================================

export async function deleteCampaign(tenantDb: string, campaignId: string) {
  const { Campaign } = await connectWithModels(tenantDb);

  const campaign = await Campaign.findOne({ campaign_id: campaignId });

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }

  if (!["draft", "failed"].includes(campaign.status)) {
    return { error: "Only draft or failed campaigns can be deleted", status: 400 };
  }

  await Campaign.deleteOne({ campaign_id: campaignId });

  return { success: true };
}

// ============================================
// SEND CAMPAIGN
// ============================================

export async function sendCampaign(
  tenantDb: string,
  campaignId: string
): Promise<SendCampaignResult | { error: string; status: number }> {
  const { Campaign, PortalUser } = await connectWithModels(tenantDb);

  const campaign = await Campaign.findOne({ campaign_id: campaignId });

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }

  if (campaign.status !== "draft") {
    return { error: `Campaign cannot be sent (status: ${campaign.status})`, status: 400 };
  }

  // Check FCM if mobile channel enabled
  if (campaign.channels.includes("mobile")) {
    const fcmEnabled = await isFCMEnabled(tenantDb);
    if (!fcmEnabled) {
      return { error: "FCM push notifications not enabled", status: 400 };
    }
  }

  // Update status to sending
  campaign.status = "sending";
  await campaign.save();

  // Get recipients
  let recipients: { _id: string; portal_user_id: string; email: string; username?: string }[] = [];

  try {
    switch (campaign.recipient_type) {
      case "all":
        recipients = await PortalUser.find({ is_active: true })
          .select("_id portal_user_id email username")
          .lean();
        break;
      case "selected":
        if (campaign.selected_user_ids?.length) {
          recipients = await PortalUser.find({
            portal_user_id: { $in: campaign.selected_user_ids },
            is_active: true,
          })
            .select("_id portal_user_id email username")
            .lean();
        }
        break;
      case "tagged":
        if (campaign.tag_ids?.length) {
          recipients = await PortalUser.find({
            "tags.tag_id": { $in: campaign.tag_ids },
            is_active: true,
          })
            .select("_id portal_user_id email username")
            .lean();
        }
        break;
    }

    if (recipients.length === 0) {
      campaign.status = "failed";
      await campaign.save();
      return { error: "No recipients found", status: 400 };
    }

    // Generate email HTML if needed (pre-render once for all recipients)
    let fullEmailHtml: string | undefined;
    if (campaign.channels.includes("email") && campaign.email_html) {
      const emailContent = generateCustomEmailHtml(
        campaign.email_html,
        campaign.products_url,
        campaign.products
      );
      fullEmailHtml = await buildCampaignEmail(tenantDb, emailContent);
    }

    // Pre-filter: get user IDs with active FCM tokens to avoid unnecessary mobile send attempts
    let mobileEligibleUserIds: Set<string> | undefined;
    if (campaign.channels.includes("mobile")) {
      const { FCMToken } = await connectWithModels(tenantDb);
      const recipientUserIds = recipients.map((r) => r.portal_user_id);
      const usersWithTokens = await FCMToken.distinct("user_id", {
        is_active: true,
        user_id: { $in: recipientUserIds },
      });
      mobileEligibleUserIds = new Set(usersWithTokens as string[]);
    }

    // Use unified send service (DRY - removes ~80 lines of duplicated code)
    const sendResult = await sendCampaignDirect({
      tenantDb,
      content: {
        type: campaign.type,
        title: campaign.title,
        body: campaign.body,
        push_image: campaign.push_image,
        email_subject: campaign.email_subject,
        email_html: fullEmailHtml,
        products_url: campaign.products_url,
        products: campaign.products?.map((p: ITemplateProduct) => ({
          sku: p.sku,
          name: p.name,
          image: p.image,
          item_ref: p.item_ref,
        })),
        url: campaign.url,
        image: campaign.image,
        open_in_new_tab: campaign.open_in_new_tab,
        campaign_id: campaign.campaign_id,
      },
      recipients: recipients.map((r) => ({
        user_id: r.portal_user_id,
        email: r.email,
        name: r.username,
      })),
      channels: {
        email: campaign.channels.includes("email"),
        mobile: campaign.channels.includes("mobile"),
        web_in_app: campaign.channels.includes("web_in_app"),
      },
      queue: true,
      mobileEligibleUserIds,
    });

    // Map send result to campaign result format
    const results: CampaignResults = {
      email: { sent: sendResult.email.sent, failed: sendResult.email.failed, opened: 0, clicked: 0 },
      mobile: { sent: sendResult.mobile.sent, failed: sendResult.mobile.failed, clicked: 0 },
      web_in_app: { sent: sendResult.web_in_app.sent, failed: sendResult.web_in_app.failed, read: 0 },
    };

    // Update campaign with results
    campaign.status = "sent";
    campaign.sent_at = new Date();
    campaign.recipient_count = recipients.length;
    campaign.results = results;
    await campaign.save();

    return {
      success: true,
      campaign_id: campaign.campaign_id,
      recipients_count: recipients.length,
      results,
    };
  } catch (sendError) {
    campaign.status = "failed";
    await campaign.save();
    throw sendError;
  }
}

// ============================================
// GET CAMPAIGN RESULTS
// ============================================

export async function getCampaignResults(tenantDb: string, campaignId: string) {
  const { Campaign } = await connectWithModels(tenantDb);

  const campaign = await Campaign.findOne({ campaign_id: campaignId })
    .select("campaign_id name status type title channels recipient_type recipient_count sent_at results")
    .lean();

  if (!campaign) {
    return { error: "Campaign not found", status: 404 };
  }

  if (!["sent", "sending"].includes(campaign.status)) {
    return { error: "Campaign has not been sent yet", status: 400 };
  }

  // Get live stats from unified notification log
  const liveStats = await getCampaignStats(campaignId);

  // Use live stats, fallback to stored results for backward compatibility
  const results = {
    email: {
      sent: liveStats.email.sent || campaign.results?.email?.sent || 0,
      failed: liveStats.email.failed || campaign.results?.email?.failed || 0,
      opened: liveStats.email.opened || campaign.results?.email?.opened || 0,
      clicked: liveStats.email.clicked || campaign.results?.email?.clicked || 0,
    },
    mobile: {
      sent: liveStats.mobile.sent || campaign.results?.mobile?.sent || 0,
      failed: liveStats.mobile.failed || campaign.results?.mobile?.failed || 0,
      opened: liveStats.mobile.opened || campaign.results?.mobile?.opened || 0,
      clicked: liveStats.mobile.clicked || campaign.results?.mobile?.clicked || 0,
    },
    web_in_app: {
      sent: liveStats.web_in_app.sent || campaign.results?.web_in_app?.sent || 0,
      failed: liveStats.web_in_app.failed || campaign.results?.web_in_app?.failed || 0,
      opened: liveStats.web_in_app.opened || campaign.results?.web_in_app?.opened || 0,
      clicked: liveStats.web_in_app.clicked || campaign.results?.web_in_app?.clicked || 0,
      read: liveStats.web_in_app.read || campaign.results?.web_in_app?.read || 0,
    },
  };

  // Calculate totals
  const totalSent = results.email.sent + results.mobile.sent + results.web_in_app.sent;
  const totalFailed = results.email.failed + results.mobile.failed + results.web_in_app.failed;
  const total = totalSent + totalFailed;

  return {
    campaign_id: campaign.campaign_id,
    name: campaign.name,
    status: campaign.status,
    sent_at: campaign.sent_at,
    recipient_count: campaign.recipient_count || 0,
    channels: campaign.channels,
    results: {
      email: campaign.channels.includes("email") ? results.email : undefined,
      mobile: campaign.channels.includes("mobile") ? results.mobile : undefined,
      web_in_app: campaign.channels.includes("web_in_app") ? results.web_in_app : undefined,
    },
    totals: {
      sent: totalSent,
      failed: totalFailed,
      delivery_rate: total > 0 ? totalSent / total : 0,
      open_rate: results.email.sent > 0 ? results.email.opened / results.email.sent : undefined,
    },
  };
}
