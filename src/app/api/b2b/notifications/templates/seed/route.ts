/**
 * Seed Default Templates
 *
 * POST /api/b2b/notifications/templates/seed
 */

import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { seedDefaultTemplates } from "@/lib/notifications/seed-templates";

export async function POST(req: NextRequest) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantDb = `vinc-${session.tenantId}`;

    // Check for force param
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";

    const result = await seedDefaultTemplates(tenantDb, force);

    return NextResponse.json({
      success: true,
      created: result.created,
      skipped: result.skipped,
    });
  } catch (error) {
    console.error("Error seeding templates:", error);
    return NextResponse.json(
      { error: "Failed to seed templates" },
      { status: 500 }
    );
  }
}
