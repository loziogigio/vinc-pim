/**
 * Send Draft Campaign API
 *
 * POST /api/b2b/notifications/campaigns/[id]/send - Send a draft campaign
 *
 * This sends a previously saved draft campaign to recipients.
 * Updates campaign status and stores results.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { sendEmail } from "@/lib/email";
import {
  buildCampaignEmail,
  generateCustomEmailHtml,
} from "@/lib/notifications/email-builder";
import { createInAppNotification } from "@/lib/notifications/in-app.service";
import { sendFCM, isFCMEnabled, getActiveTokens } from "@/lib/fcm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = `vinc-${session.tenantId}`;
    const { Campaign, PortalUser } = await connectWithModels(tenantDb);

    // Get campaign
    const campaign = await Campaign.findOne({ campaign_id: id });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Only drafts can be sent
    if (campaign.status !== "draft") {
      return NextResponse.json(
        { error: `Campaign cannot be sent (status: ${campaign.status})` },
        { status: 400 }
      );
    }

    // Check FCM if mobile channel enabled
    if (campaign.channels.includes("mobile")) {
      const fcmEnabled = await isFCMEnabled(tenantDb);
      if (!fcmEnabled) {
        return NextResponse.json(
          { error: "FCM push notifications not enabled. Configure FCM in settings first." },
          { status: 400 }
        );
      }
    }

    // Update status to sending
    campaign.status = "sending";
    await campaign.save();

    // Get recipients based on recipient_type
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
          // TODO: Implement tagged recipients when UserTag model is ready
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
        return NextResponse.json({ error: "No recipients found" }, { status: 400 });
      }

      // Track results
      const results = {
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

      // Notification icon
      const notificationIcon = campaign.push_image || campaign.image;

      // Notification payload
      const notificationPayload =
        campaign.type === "product"
          ? {
              category: "product" as const,
              products: campaign.products?.map((p: { sku: string; name: string; image: string; item_ref: string }) => ({
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

      return NextResponse.json({
        success: true,
        campaign_id: campaign.campaign_id,
        type: campaign.type,
        channels: campaign.channels,
        recipient_type: campaign.recipient_type,
        recipients_count: recipients.length,
        results,
        message: `Campaign sent to ${recipients.length} recipients`,
      });
    } catch (sendError) {
      // Mark as failed if sending errors occur
      campaign.status = "failed";
      await campaign.save();
      throw sendError;
    }
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json(
      { error: "Failed to send campaign" },
      { status: 500 }
    );
  }
}
