/**
 * Send Draft Campaign API
 *
 * POST /api/b2b/notifications/campaigns/[id]/send - Send a draft campaign
 *
 * This sends a previously saved draft campaign to recipients.
 * Updates campaign status and stores results.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
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
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const tenantDb = auth.tenantDb;
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
    // B2B users use customer_id, Portal users use portal_user_id
    type RecipientUserType = "b2b_user" | "portal_user";
    let recipients: { _id: string; user_id: string; email: string; username?: string; user_type: RecipientUserType }[] = [];

    try {
      switch (campaign.recipient_type) {
        case "all":
          // "all" only sends to Portal users (they have active accounts)
          const allPortalUsers = await PortalUser.find({ is_active: true })
            .select("_id portal_user_id email username")
            .lean();
          recipients = allPortalUsers.map((p) => ({
            _id: p._id.toString(),
            user_id: p.portal_user_id,
            email: p.email,
            username: p.username,
            user_type: "portal_user" as RecipientUserType,
          }));
          break;
        case "selected":
          // Separate B2B and Portal users based on type field
          const b2bUsers = campaign.selected_users?.filter(
            (u: { type?: string }) => u.type === "b2b"
          ) || [];
          const portalUserSelections = campaign.selected_users?.filter(
            (u: { type?: string }) => u.type === "portal" || !u.type // Default to portal for backward compatibility
          ) || [];

          // 1. Portal users: lookup by portal_user_id to verify they exist and are active
          if (portalUserSelections.length > 0) {
            const portalIds = portalUserSelections.map((u: { id: string }) => u.id);
            const foundPortal = await PortalUser.find({
              portal_user_id: { $in: portalIds },
              is_active: true,
            })
              .select("_id portal_user_id email username")
              .lean();

            recipients.push(
              ...foundPortal.map((p) => ({
                _id: p._id.toString(),
                user_id: p.portal_user_id,
                email: p.email,
                username: p.username,
                user_type: "portal_user" as RecipientUserType,
              }))
            );
          }

          // 2. B2B users: add directly (no Portal lookup needed - they use customer_id)
          for (const b2b of b2bUsers) {
            recipients.push({
              _id: b2b.id,
              user_id: b2b.id, // customer_id
              email: b2b.email,
              username: b2b.name,
              user_type: "b2b_user" as RecipientUserType,
            });
          }
          break;
        case "tagged":
          // Tagged recipients are Portal users only
          if (campaign.tag_ids?.length) {
            const taggedUsers = await PortalUser.find({
              "tags.tag_id": { $in: campaign.tag_ids },
              is_active: true,
            })
              .select("_id portal_user_id email username")
              .lean();
            recipients = taggedUsers.map((p) => ({
              _id: p._id.toString(),
              user_id: p.portal_user_id,
              email: p.email,
              username: p.username,
              user_type: "portal_user" as RecipientUserType,
            }));
          }
          break;
      }

      if (recipients.length === 0) {
        campaign.status = "failed";
        await campaign.save();
        return NextResponse.json({ error: "Nessun destinatario trovato" }, { status: 400 });
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
        // Use email_link for email CTA button (separate from products_url for push)
        const emailContent = generateCustomEmailHtml(
          campaign.email_html,
          campaign.email_link,
          campaign.products,
          campaign.type as "product" | "generic"
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

        // Web In-App - create for both B2B and Portal users
        if (campaign.channels.includes("web_in_app")) {
          try {
            await createInAppNotification({
              tenantDb,
              user_id: recipient.user_id,
              user_type: recipient.user_type,
              trigger: campaign.type === "product" ? "campaign_product" : "campaign_generic",
              title: campaign.title,
              body: campaign.body,
              icon: notificationIcon,
              action_url: campaign.url,
              payload: notificationPayload,
              campaign_id: campaign.campaign_id,
            });
            results.web_in_app.sent++;
          } catch {
            results.web_in_app.failed++;
          }
        }

        // Mobile (FCM) - send to users with active tokens
        if (campaign.channels.includes("mobile") && recipient.user_id) {
          try {
            // Get active tokens based on user type
            const tokenQuery = recipient.user_type === "portal_user"
              ? { userIds: [recipient.user_id] }
              : { customerIds: [recipient.user_id] };
            const tokens = await getActiveTokens(tenantDb, tokenQuery);

            if (tokens.length > 0) {
              const fcmResult = await sendFCM({
                tenantDb,
                title: campaign.title || "Nuova comunicazione",
                body: campaign.body || "",
                icon: notificationIcon,
                image: campaign.push_image || campaign.image,
                action_url: campaign.url,
                userIds: [recipient.user_id],
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
