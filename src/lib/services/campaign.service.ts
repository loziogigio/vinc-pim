/**
 * Campaign Service
 *
 * Business logic for campaign management. API routes should be thin
 * orchestrators that call these functions.
 */

import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
} from "@/lib/notifications/email-builder";
import { createInAppNotification } from "@/lib/notifications/in-app.service";
import { sendFCM, isFCMEnabled, getActiveTokens } from "@/lib/fcm";
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

    // Track results
    const results: CampaignResults = {
      email: { sent: 0, failed: 0, opened: 0, clicked: 0 },
      mobile: { sent: 0, failed: 0, clicked: 0 },
      web_in_app: { sent: 0, failed: 0, read: 0 },
    };

    // Generate email HTML if needed
    let fullEmailHtml: string | undefined;
    if (campaign.channels.includes("email") && campaign.email_html) {
      const emailContent = generateCustomEmailHtml(
        campaign.email_html,
        campaign.products_url,
        campaign.products
      );
      fullEmailHtml = await buildCampaignEmail(tenantDb, emailContent);
    }

    const notificationIcon = campaign.push_image || campaign.image;

    const notificationPayload =
      campaign.type === "product"
        ? {
            category: "product" as const,
            products: campaign.products?.map((p: ITemplateProduct) => ({
              sku: p.sku,
              name: p.name,
              image: p.image,
              item_ref: p.item_ref,
            })),
            campaign_id: campaign.campaign_id,
          }
        : {
            category: "generic" as const,
            url: campaign.url,
            open_in_new_tab: campaign.open_in_new_tab,
            campaign_id: campaign.campaign_id,
          };

    // Process each recipient
    for (const recipient of recipients) {
      // Email
      if (campaign.channels.includes("email") && fullEmailHtml && recipient.email) {
        try {
          const subject = campaign.email_subject || campaign.title || "Nuova comunicazione";
          const result = await sendEmail({
            to: recipient.email,
            subject,
            html: fullEmailHtml,
            text: campaign.body || "Visualizza questa email nel tuo browser.",
            tags: ["campaign", campaign.type, campaign.campaign_id],
          });

          if (result.success) {
            results.email.sent++;
          } else {
            results.email.failed++;
          }
        } catch {
          results.email.failed++;
        }
      }

      // Web In-App
      if (campaign.channels.includes("web_in_app")) {
        try {
          await createInAppNotification(tenantDb, {
            user_id: recipient.portal_user_id,
            type: campaign.type === "product" ? "campaign_product" : "campaign_generic",
            title: campaign.title,
            body: campaign.body,
            icon: notificationIcon,
            action_url: campaign.url,
            data: { ...notificationPayload, campaign_id: campaign.campaign_id },
          });
          results.web_in_app.sent++;
        } catch {
          results.web_in_app.failed++;
        }
      }

      // Mobile (FCM)
      if (campaign.channels.includes("mobile") && recipient.portal_user_id) {
        try {
          const tokens = await getActiveTokens(tenantDb, { userIds: [recipient.portal_user_id] });

          if (tokens.length > 0) {
            const fcmResult = await sendFCM({
              tenantDb,
              title: campaign.title || "Nuova comunicazione",
              body: campaign.body || "",
              icon: notificationIcon,
              image: campaign.push_image || campaign.image,
              action_url: campaign.url,
              userIds: [recipient.portal_user_id],
              queue: true,
              priority: "normal",
              trigger: "campaign",
              data: {
                campaign_type: campaign.type,
                campaign_id: campaign.campaign_id,
                ...(campaign.type === "product" && campaign.products?.[0]?.sku
                  ? { sku: campaign.products[0].sku }
                  : {}),
              },
            });

            if (fcmResult.success) {
              results.mobile.sent += fcmResult.queued || fcmResult.sent || 1;
            } else {
              results.mobile.failed++;
            }
          }
        } catch {
          results.mobile.failed++;
        }
      }
    }

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

  const results = campaign.results || {
    email: { sent: 0, failed: 0, opened: 0, clicked: 0 },
    mobile: { sent: 0, failed: 0, clicked: 0 },
    web_in_app: { sent: 0, failed: 0, read: 0 },
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
