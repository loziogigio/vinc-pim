/**
 * Recipient Export API
 *
 * POST /api/b2b/notifications/recipients/export - Export users to CSV
 *
 * Accepts:
 * - user_ids: Array of portal_user_ids to export
 * - tag_ids: Array of tag_ids to export all users with those tags
 * - all: boolean - export all active users
 *
 * Returns CSV text with username, email, is_active columns.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { connectWithModels } from "@/lib/db/connection";

interface ExportPayload {
  user_ids?: string[];
  tag_ids?: string[];
  all?: boolean;
  format?: "csv" | "json";
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;
    const payload: ExportPayload = await req.json();
    const { PortalUser } = await connectWithModels(tenantDb);
    const format = payload.format || "csv";

    // Build query based on payload
    type QueryType = {
      tenant_id: string;
      portal_user_id?: { $in: string[] };
      "tags.tag_id"?: { $in: string[] };
      is_active?: boolean;
    };

    const query: QueryType = { tenant_id: auth.tenantId };

    if (payload.user_ids && payload.user_ids.length > 0) {
      query.portal_user_id = { $in: payload.user_ids };
    } else if (payload.tag_ids && payload.tag_ids.length > 0) {
      query["tags.tag_id"] = { $in: payload.tag_ids };
    } else if (payload.all) {
      query.is_active = true;
    } else {
      return NextResponse.json(
        { error: "Provide user_ids, tag_ids, or set all=true" },
        { status: 400 }
      );
    }

    // Fetch users
    const users = await PortalUser.find(query)
      .select("portal_user_id username email is_active tags created_at")
      .sort({ username: 1 })
      .lean();

    if (format === "json") {
      return NextResponse.json({
        success: true,
        users: users.map((u) => ({
          portal_user_id: u.portal_user_id,
          username: u.username,
          email: u.email,
          is_active: u.is_active,
          tags: u.tags?.map((t: { name: string }) => t.name) || [],
        })),
        count: users.length,
      });
    }

    // Generate CSV
    const csvLines: string[] = [];

    // Header
    csvLines.push("username,email,is_active,tags");

    // Data rows
    for (const user of users) {
      const tags = user.tags?.map((t: { name: string }) => t.name).join(";") || "";
      csvLines.push(
        `"${escapeCSV(user.username)}","${escapeCSV(user.email)}",${user.is_active},"${escapeCSV(tags)}"`
      );
    }

    const csvContent = csvLines.join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="recipients_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting recipients:", error);
    return NextResponse.json(
      { error: "Failed to export recipients" },
      { status: 500 }
    );
  }
}

// Helper to escape CSV values
function escapeCSV(value: string): string {
  if (!value) return "";
  return value.replace(/"/g, '""');
}
