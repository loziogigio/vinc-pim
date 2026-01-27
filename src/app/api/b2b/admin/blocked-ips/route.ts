/**
 * Admin Blocked IPs API
 *
 * List and manage blocked IP addresses.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getBlockedIPModel, BLOCK_REASONS, type BlockReason } from "@/lib/db/models/sso-blocked-ip";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const BlockedIP = await getBlockedIPModel();

    const now = new Date();
    const query = {
      is_active: true,
      $or: [{ tenant_id: session.tenantId }, { is_global: true }],
      $and: [
        {
          $or: [
            { expires_at: { $exists: false } },
            { expires_at: null },
            { expires_at: { $gt: now } },
          ],
        },
      ],
    };

    const [blockedIPs, total] = await Promise.all([
      BlockedIP.find(query).sort({ blocked_at: -1 }).skip(skip).limit(limit).lean(),
      BlockedIP.countDocuments(query),
    ]);

    const items = blockedIPs.map((ip) => ({
      _id: ip._id.toString(),
      ip_address: ip.ip_address,
      is_global: ip.is_global,
      reason: ip.reason,
      description: ip.description,
      attempt_count: ip.attempt_count,
      blocked_at: ip.blocked_at,
      blocked_by: ip.blocked_by,
      expires_at: ip.expires_at,
    }));

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Blocked IPs list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch blocked IPs" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();

    if (!session.isLoggedIn || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { ip_address, reason, description, expires_hours } = body;

    // Validate IP address
    if (!ip_address || typeof ip_address !== "string") {
      return NextResponse.json(
        { error: "IP address is required" },
        { status: 400 }
      );
    }

    // Basic IP validation (IPv4 or IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    const ipv6ShortRegex = /^(([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{1,4})|::1$/;

    if (!ipv4Regex.test(ip_address) && !ipv6Regex.test(ip_address) && !ipv6ShortRegex.test(ip_address)) {
      return NextResponse.json(
        { error: "Invalid IP address format" },
        { status: 400 }
      );
    }

    // Validate reason
    const blockReason: BlockReason = BLOCK_REASONS.includes(reason)
      ? reason
      : "manual_block";

    // Calculate expiration
    let expires_at: Date | undefined;
    if (expires_hours && expires_hours > 0) {
      expires_at = new Date(Date.now() + expires_hours * 60 * 60 * 1000);
    }

    const BlockedIP = await getBlockedIPModel();

    const blockedIP = await BlockedIP.blockIP({
      ip_address,
      tenant_id: session.tenantId,
      is_global: false,
      reason: blockReason,
      description: description || undefined,
      blocked_by: session.email,
      expires_at,
    });

    return NextResponse.json({
      success: true,
      blocked_ip: {
        _id: blockedIP._id.toString(),
        ip_address: blockedIP.ip_address,
        reason: blockedIP.reason,
        description: blockedIP.description,
        blocked_at: blockedIP.blocked_at,
        expires_at: blockedIP.expires_at,
      },
    });
  } catch (error) {
    console.error("Block IP error:", error);
    return NextResponse.json(
      { error: "Failed to block IP" },
      { status: 500 }
    );
  }
}
