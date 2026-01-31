/**
 * Campaign CRUD API
 *
 * GET /api/b2b/notifications/campaigns - List campaigns
 * POST /api/b2b/notifications/campaigns - Create campaign (draft)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";
import {
  CAMPAIGN_STATUSES,
  TEMPLATE_TYPES,
  NOTIFICATION_CHANNELS,
  RECIPIENT_TYPES,
  type CampaignStatus,
} from "@/lib/constants/notification";

// ============================================
// GET - List campaigns
// ============================================

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const { searchParams } = new URL(req.url);

    // Parse query params
    const status = searchParams.get("status") as CampaignStatus | null;
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Build query
    const query: Record<string, unknown> = {};
    if (status && CAMPAIGN_STATUSES.includes(status)) {
      query.status = status;
    }

    // Add search filter
    if (search && search.trim()) {
      const searchTerm = search.trim();
      query.$or = [
        { name: { $regex: searchTerm, $options: "i" } },
        { title: { $regex: searchTerm, $options: "i" } },
        { campaign_id: { $regex: searchTerm, $options: "i" } },
        { slug: { $regex: searchTerm, $options: "i" } },
      ];
    }

    const { Campaign } = await connectWithModels(tenantDb);

    const [campaigns, total] = await Promise.all([
      Campaign.find(query)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Campaign.countDocuments(query),
    ]);

    return NextResponse.json({
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing campaigns:", error);
    return NextResponse.json(
      { error: "Failed to list campaigns" },
      { status: 500 }
    );
  }
}

// ============================================
// POST - Create campaign (draft)
// ============================================

interface CreateCampaignPayload {
  name: string;
  type: "product" | "generic";
  title: string;
  body: string;
  push_image?: string;
  email_subject?: string;
  email_html?: string;
  products_url?: string;
  products?: { sku: string; name: string; image: string; item_ref: string }[];
  url?: string;
  image?: string;
  open_in_new_tab?: boolean;
  channels: ("email" | "mobile" | "web_in_app")[];
  recipient_type: "all" | "selected" | "tagged";
  selected_user_ids?: string[];
  selected_users?: { id: string; email: string; name: string }[];
  tag_ids?: string[];
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const payload: CreateCampaignPayload = await req.json();

    // Validate required fields
    if (!payload.name?.trim()) {
      return NextResponse.json({ error: "Campaign name is required" }, { status: 400 });
    }

    if (!payload.type || !TEMPLATE_TYPES.includes(payload.type)) {
      return NextResponse.json({ error: "Invalid campaign type" }, { status: 400 });
    }

    if (!payload.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!payload.body?.trim()) {
      return NextResponse.json({ error: "Body is required" }, { status: 400 });
    }

    if (!payload.channels || !Array.isArray(payload.channels) || payload.channels.length === 0) {
      return NextResponse.json({ error: "At least one channel is required" }, { status: 400 });
    }

    // Validate channels
    for (const channel of payload.channels) {
      if (!NOTIFICATION_CHANNELS.includes(channel)) {
        return NextResponse.json({ error: `Invalid channel: ${channel}` }, { status: 400 });
      }
    }

    if (!payload.recipient_type || !RECIPIENT_TYPES.includes(payload.recipient_type)) {
      return NextResponse.json({ error: "Invalid recipient type" }, { status: 400 });
    }

    const { Campaign } = await connectWithModels(tenantDb);

    // Extract user IDs from selected_users if provided
    const selectedUserIds = payload.selected_users?.map((u) => u.id) || payload.selected_user_ids;

    // Create campaign as draft
    const campaign = new Campaign({
      name: payload.name.trim(),
      status: "draft",
      type: payload.type,
      title: payload.title.trim(),
      body: payload.body.trim(),
      push_image: payload.push_image?.trim(),
      email_subject: payload.email_subject?.trim(),
      email_html: payload.email_html,
      products_url: payload.products_url?.trim(),
      products: payload.products,
      url: payload.url?.trim(),
      image: payload.image?.trim(),
      open_in_new_tab: payload.open_in_new_tab,
      channels: payload.channels,
      recipient_type: payload.recipient_type,
      selected_user_ids: selectedUserIds,
      selected_users: payload.selected_users,
      tag_ids: payload.tag_ids,
      created_by: auth.userId || auth.email,
    });

    await campaign.save();

    return NextResponse.json({
      success: true,
      campaign: {
        campaign_id: campaign.campaign_id,
        name: campaign.name,
        slug: campaign.slug,
        status: campaign.status,
        type: campaign.type,
        title: campaign.title,
        created_at: campaign.created_at,
      },
      message: "Campaign saved as draft",
    });
  } catch (error) {
    console.error("Error creating campaign:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
