/**
 * Campaign Send API
 *
 * POST /api/b2b/notifications/campaigns/send - Send campaign to recipients
 *
 * Creates a campaign record and sends via the campaign service.
 * Supports both B2B Session and API Key authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantAuth } from "@/lib/auth/tenant-auth";
import { createCampaign, sendCampaign } from "@/lib/services/campaign.service";
import { validateCampaignPayload, type CampaignPayload } from "@/lib/notifications/campaign.utils";
import type { RecipientType } from "@/lib/constants/notification";

interface SelectedUserInput {
  id: string;
  email: string;
  name: string;
  type: "b2b" | "portal";
}

interface CampaignSendPayload extends CampaignPayload {
  recipient_type: RecipientType;
  selected_users?: SelectedUserInput[];
  email_link?: string; // Separate link for email "Vedi tutti"
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireTenantAuth(req);
    if (!auth.success) return auth.response;

    const { tenantDb, userId } = auth;
    const payload: CampaignSendPayload = await req.json();

    // Validate payload
    const validation = validateCampaignPayload(payload);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const {
      name,
      type,
      title,
      body: messageBody,
      push_image,
      email_subject,
      email_html,
      email_link,
      products_url,
      channels,
      recipient_type = "all",
      selected_users,
      products,
      url,
      image,
      open_in_new_tab,
    } = payload;

    // Validate selected users for "selected" recipient type
    if (recipient_type === "selected" && (!selected_users || selected_users.length === 0)) {
      return NextResponse.json({ error: "No users selected" }, { status: 400 });
    }

    // Use provided name or generate one as fallback
    const campaignName = name?.trim() || `${type === "product" ? "Prodotto" : "Generica"} - ${new Date().toLocaleDateString("it-IT")}`;

    const campaign = await createCampaign(tenantDb, {
      name: campaignName,
      type,
      title: title || "Nuova comunicazione",
      body: messageBody || "",
      push_image,
      email_subject,
      email_html,
      email_link,
      products_url,
      products,
      url,
      image,
      open_in_new_tab,
      channels,
      recipient_type,
      selected_user_ids: selected_users?.map((u) => u.id),
      selected_users, // Store full user info for email lookup
      created_by: userId,
    });

    // Send campaign using the unified service
    const result = await sendCampaign(tenantDb, campaign.campaign_id);

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaign.campaign_id,
      name: campaign.name,
      slug: campaign.slug,
      type,
      channels,
      recipient_type,
      recipients_count: result.recipients_count,
      results: result.results,
      message: `Campaign sent to ${result.recipients_count} recipients`,
    });
  } catch (error) {
    console.error("Error sending campaign:", error);
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 });
  }
}
