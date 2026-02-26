/**
 * Sales Channels API
 *
 * GET  /api/b2b/channels - List all sales channels
 * POST /api/b2b/channels - Create a new sales channel
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";
import { isValidChannelCode } from "@/lib/constants/channel";

/** Default channels seeded on first access */
const DEFAULT_CHANNELS = [
  { code: "DEFAULT", name: "DEFAULT", description: "Default channel", is_default: true, is_active: true },
  { code: "B2B", name: "B2B", description: "Business-to-business", is_default: false, is_active: true },
  { code: "B2C", name: "B2C", description: "Business-to-consumer", is_default: false, is_active: true },
];

/**
 * Seed default channels if none exist, and ensure one channel is marked as default.
 */
async function seedDefaultChannels(SalesChannel: ReturnType<typeof Object>) {
  const model = SalesChannel as any;
  const count = await model.countDocuments();
  if (count === 0) {
    await model.insertMany(DEFAULT_CHANNELS);
    return;
  }

  // Ensure all default channels exist and have correct flags
  for (const ch of DEFAULT_CHANNELS) {
    await model.updateOne(
      { code: ch.code },
      { $set: { name: ch.name, description: ch.description, is_default: ch.is_default, is_active: true } },
      { upsert: true }
    );
  }
}

// ============================================
// GET - List all channels
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const { SalesChannel } = await connectWithModels(tenantDb);

    // Seed default b2b/b2c channels on first access
    await seedDefaultChannels(SalesChannel);

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("include_inactive") === "true";

    const query = includeInactive ? {} : { is_active: true };
    const channels = await SalesChannel.find(query).sort({ is_default: -1, code: 1 }).lean();

    return NextResponse.json({ success: true, channels });
  } catch (error) {
    console.error("Error fetching channels:", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}

// ============================================
// POST - Create a new channel
// ============================================

interface CreateChannelPayload {
  code: string;
  name: string;
  description?: string;
  color?: string;
  is_default?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;
    const body: CreateChannelPayload = await req.json();
    const { SalesChannel } = await connectWithModels(tenantDb);

    // Validate required fields
    if (!body.code?.trim()) {
      return NextResponse.json({ error: "Channel code is required" }, { status: 400 });
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "Channel name is required" }, { status: 400 });
    }

    const code = body.code.trim().toUpperCase();

    if (!isValidChannelCode(code)) {
      return NextResponse.json(
        { error: "Channel code must be alphanumeric (e.g. B2C, EBAY, SLOVAKIA)" },
        { status: 400 }
      );
    }

    // Check for duplicate code
    const existing = await SalesChannel.findOne({ code });
    if (existing) {
      return NextResponse.json({ error: "A channel with this code already exists" }, { status: 400 });
    }

    // If this is marked as default, unset the previous default
    if (body.is_default) {
      await SalesChannel.updateMany({ is_default: true }, { $set: { is_default: false } });
    }

    const channel = await SalesChannel.create({
      code,
      name: body.name.trim(),
      description: body.description?.trim(),
      color: body.color?.trim(),
      is_default: body.is_default ?? false,
      is_active: true,
    });

    return NextResponse.json({
      success: true,
      channel,
      message: "Channel created",
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "A channel with this code already exists" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create channel" }, { status: 500 });
  }
}
