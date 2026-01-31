/**
 * Seed Default Templates
 *
 * POST /api/b2b/notifications/templates/seed
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateTenant } from "@/lib/auth/tenant-auth";
import { seedDefaultTemplates } from "@/lib/notifications/seed-templates";

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateTenant(req);
    if (!auth.authenticated || !auth.tenantDb) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    const tenantDb = auth.tenantDb;

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
