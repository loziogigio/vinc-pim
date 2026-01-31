/**
 * Recipient Import API
 *
 * POST /api/b2b/notifications/recipients/import - Import usernames and match to portal users
 *
 * Accepts either:
 * - JSON array of usernames
 * - CSV text with usernames (one per line or comma-separated)
 *
 * Returns matched users with their details, plus lists of not found and duplicates.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

interface ImportPayload {
  usernames?: string[];
  csv?: string;
}

interface MatchedUser {
  portal_user_id: string;
  username: string;
  email: string;
  is_active: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const payload: ImportPayload = await req.json();
    const { PortalUser } = await connectWithModels(tenantDb);

    // Parse usernames from either array or CSV
    let usernames: string[] = [];

    if (payload.usernames && Array.isArray(payload.usernames)) {
      usernames = payload.usernames;
    } else if (payload.csv && typeof payload.csv === "string") {
      // Parse CSV - handle both newline and comma separators
      usernames = payload.csv
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
    }

    if (usernames.length === 0) {
      return NextResponse.json(
        { error: "No usernames provided. Send either 'usernames' array or 'csv' string." },
        { status: 400 }
      );
    }

    // Deduplicate and normalize usernames (case-insensitive matching)
    const normalizedMap = new Map<string, string>(); // lowercase -> original
    const duplicates: string[] = [];

    for (const username of usernames) {
      const lower = username.toLowerCase();
      if (normalizedMap.has(lower)) {
        duplicates.push(username);
      } else {
        normalizedMap.set(lower, username);
      }
    }

    const uniqueUsernames = Array.from(normalizedMap.values());

    // Find matching portal users (case-insensitive)
    const users = await PortalUser.find({
      tenant_id: auth.tenantId,
      username: { $in: uniqueUsernames.map((u) => new RegExp(`^${escapeRegex(u)}$`, "i")) },
    })
      .select("portal_user_id username email is_active")
      .lean();

    // Build matched list and find not found
    const matched: MatchedUser[] = [];
    const matchedUsernames = new Set<string>();

    for (const user of users) {
      matched.push({
        portal_user_id: user.portal_user_id,
        username: user.username,
        email: user.email,
        is_active: user.is_active,
      });
      matchedUsernames.add(user.username.toLowerCase());
    }

    // Find usernames that weren't matched
    const notFound: string[] = [];
    for (const username of uniqueUsernames) {
      if (!matchedUsernames.has(username.toLowerCase())) {
        notFound.push(username);
      }
    }

    return NextResponse.json({
      success: true,
      matched,
      not_found: notFound,
      duplicates,
      summary: {
        total_input: usernames.length,
        unique: uniqueUsernames.length,
        matched: matched.length,
        not_found: notFound.length,
        duplicates: duplicates.length,
      },
    });
  } catch (error) {
    console.error("Error importing recipients:", error);
    return NextResponse.json(
      { error: "Failed to import recipients" },
      { status: 500 }
    );
  }
}

// Helper to escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
