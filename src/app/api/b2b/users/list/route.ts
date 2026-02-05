/**
 * B2B Users List API
 *
 * GET /api/b2b/users/list - List B2B users for notification recipients
 *
 * Fetches users from VINC API (PostgreSQL) instead of local MongoDB.
 * This ensures we get the correct VINC API user_id (UUID) for notifications.
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getVincApiForTenant, VincApiError } from "@/lib/vinc-api/client";

export async function GET(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Fetch users from VINC API (PostgreSQL)
    const vincApi = getVincApiForTenant(session.tenantId);
    const users = await vincApi.users.list({
      status: "active",
      limit,
      offset,
    });

    // Filter by search if provided (client-side filtering since VINC API
    // doesn't support text search - only exact email match)
    let filteredUsers = users;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredUsers = users.filter(
        (u) =>
          u.email.toLowerCase().includes(searchLower) ||
          (u.name && u.name.toLowerCase().includes(searchLower))
      );
    }

    // Format for UserSelector component
    // id is now the correct VINC API UUID
    const formattedUsers = filteredUsers.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name || u.email,
      role: u.role,
      type: "b2b" as const,
    }));

    // Sort by name
    formattedUsers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total: filteredUsers.length,
        pages: Math.ceil(filteredUsers.length / limit),
      },
    });
  } catch (error) {
    console.error("Error listing B2B users:", error);

    if (error instanceof VincApiError) {
      return NextResponse.json(
        { error: error.detail || "Failed to fetch users from VINC API" },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to list B2B users" },
      { status: 500 }
    );
  }
}
