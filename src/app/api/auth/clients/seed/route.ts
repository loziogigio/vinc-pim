/**
 * Seed OAuth Clients API
 *
 * POST /api/auth/clients/seed
 *
 * Seeds the default first-party OAuth clients into the database.
 * This should be run once during initial setup.
 */

import { NextRequest, NextResponse } from "next/server";
import { seedOAuthClients, listOAuthClients } from "@/lib/sso/seed-clients";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const results = await seedOAuthClients(force);

    return NextResponse.json({
      success: true,
      results,
      message: force
        ? "OAuth clients recreated (new secrets generated)"
        : "OAuth clients seeded successfully",
    });
  } catch (error) {
    console.error("Seed OAuth clients error:", error);
    return NextResponse.json(
      { error: "Failed to seed OAuth clients" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const clients = await listOAuthClients();

    return NextResponse.json({
      clients: clients.map((c) => ({
        client_id: c.client_id,
        name: c.name,
        type: c.type,
        description: c.description,
        redirect_uris: c.redirect_uris,
        is_first_party: c.is_first_party,
      })),
    });
  } catch (error) {
    console.error("List OAuth clients error:", error);
    return NextResponse.json(
      { error: "Failed to list OAuth clients" },
      { status: 500 }
    );
  }
}
