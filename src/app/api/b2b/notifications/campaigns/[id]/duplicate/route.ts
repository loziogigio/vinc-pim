/**
 * Campaign Duplicate API
 *
 * POST /api/b2b/notifications/campaigns/[id]/duplicate - Duplicate a campaign
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

/**
 * POST - Duplicate a campaign
 */
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
    const { Campaign } = await connectWithModels(tenantDb);

    // Get original campaign
    const original = await Campaign.findOne({ campaign_id: id }).lean();

    if (!original) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Create copy (exclude _id, campaign_id, slug, status, dates, results)
    const copy = new Campaign({
      name: `${original.name} (Copia)`,
      type: original.type,
      title: original.title,
      body: original.body,
      push_image: original.push_image,
      email_subject: original.email_subject,
      email_html: original.email_html,
      products_url: original.products_url,
      products: original.products,
      url: original.url,
      image: original.image,
      open_in_new_tab: original.open_in_new_tab,
      channels: original.channels,
      recipient_type: original.recipient_type,
      selected_user_ids: original.selected_user_ids,
      selected_users: original.selected_users,
      tag_ids: original.tag_ids,
      status: "draft", // Always draft
      created_by: auth.userId || auth.email,
    });

    await copy.save();

    return NextResponse.json({
      success: true,
      campaign: {
        campaign_id: copy.campaign_id,
        name: copy.name,
        slug: copy.slug,
        status: copy.status,
        type: copy.type,
        title: copy.title,
        created_at: copy.created_at,
      },
      message: `Campagna duplicata come "${copy.name}"`,
    });
  } catch (error) {
    console.error("Error duplicating campaign:", error);
    return NextResponse.json(
      { error: "Failed to duplicate campaign" },
      { status: 500 }
    );
  }
}
