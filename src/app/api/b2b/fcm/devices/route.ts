/**
 * FCM Devices API
 *
 * GET - List registered FCM tokens/devices with pagination
 * DELETE - Remove a specific device token
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { connectWithModels } from "@/lib/db/connection";

interface UserLookupResult {
  _id?: { toString(): string };
  portal_user_id?: string;
  user_id?: string;
  username?: string;
  email?: string;
}

// ============================================
// GET - List FCM devices with pagination
// ============================================

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbName = `vinc-${session.tenantId}`;
    const { FCMToken } = await connectWithModels(dbName);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const platform = searchParams.get("platform"); // ios, android
    const status = searchParams.get("status"); // active, inactive
    const search = searchParams.get("search") || "";

    // Build query
    const query: Record<string, unknown> = {};

    if (platform && ["ios", "android"].includes(platform)) {
      query.platform = platform;
    }

    if (status === "active") {
      query.is_active = true;
    } else if (status === "inactive") {
      query.is_active = false;
    }

    if (search) {
      query.$or = [
        { user_id: { $regex: search, $options: "i" } },
        { device_model: { $regex: search, $options: "i" } },
        { device_id: { $regex: search, $options: "i" } },
      ];
    }

    // Get total count
    const total = await FCMToken.countDocuments(query);

    // Get paginated devices
    const devices = await FCMToken.find(query)
      .select("-fcm_token") // Don't expose actual token
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Lookup user info for each device
    const { PortalUser, B2BUser } = await connectWithModels(dbName);
    const devicesWithUsers = await Promise.all(
      devices.map(async (device) => {
        let userInfo = null;
        try {
          if (device.user_id) {
            if (device.user_type === "portal_user" || !device.user_type) {
              // Try portal_user_id first
              let user = await PortalUser.findOne(
                { portal_user_id: device.user_id },
                { portal_user_id: 1, username: 1, email: 1 }
              ).lean() as UserLookupResult | null;

              // Fallback: try by _id
              if (!user) {
                user = await PortalUser.findById(device.user_id)
                  .select("portal_user_id username email")
                  .lean() as UserLookupResult | null;
              }

              if (user) {
                userInfo = {
                  id: user.portal_user_id || user._id?.toString(),
                  username: user.username,
                  email: user.email,
                };
              }
            } else if (device.user_type === "b2b_user") {
              const user = await B2BUser.findOne(
                { user_id: device.user_id },
                { user_id: 1, username: 1, email: 1 }
              ).lean() as UserLookupResult | null;
              if (user) {
                userInfo = {
                  id: user.user_id || user._id?.toString(),
                  username: user.username,
                  email: user.email,
                };
              }
            }
          }
        } catch {
          // User lookup failed, continue without user info
        }
        return { ...device, user_info: userInfo };
      })
    );

    // Get stats
    const stats = await FCMToken.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: ["$is_active", 1, 0] } },
          android: { $sum: { $cond: [{ $eq: ["$platform", "android"] }, 1, 0] } },
          ios: { $sum: { $cond: [{ $eq: ["$platform", "ios"] }, 1, 0] } },
        },
      },
    ]);

    return NextResponse.json({
      devices: devicesWithUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: stats[0] || { total: 0, active: 0, android: 0, ios: 0 },
    });
  } catch (error) {
    console.error("[FCM Devices] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch devices" },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Remove a device token
// ============================================

export async function DELETE(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tokenId = searchParams.get("token_id");

    if (!tokenId) {
      return NextResponse.json(
        { error: "token_id is required" },
        { status: 400 }
      );
    }

    const dbName = `vinc-${session.tenantId}`;
    const { FCMToken } = await connectWithModels(dbName);

    const result = await FCMToken.deleteOne({ token_id: tokenId });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Device removed successfully",
    });
  } catch (error) {
    console.error("[FCM Devices] DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to remove device" },
      { status: 500 }
    );
  }
}
