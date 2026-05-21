import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import { getPooledConnection } from "@/lib/db/connection";
import { verifyAPIKeyFromRequest } from "@/lib/auth/api-key-auth";

/**
 * GET /api/b2b/pim/fare-types?slug=...
 * Returns Drupal-sourced fare types (optionally filtered by slug).
 *
 * Response:
 * { fare_types: [{ id, name, slug, includes_html, excludes_html }] }
 */
export async function GET(req: NextRequest) {
  try {
    // Check for API key authentication first
    const authMethod = req.headers.get("x-auth-method");
    let tenantDb: string;

    if (authMethod === "api-key") {
      const apiKeyResult = await verifyAPIKeyFromRequest(req, "read");
      if (!apiKeyResult.authenticated) {
        return NextResponse.json(
          { error: apiKeyResult.error || "Unauthorized" },
          { status: apiKeyResult.statusCode || 401 }
        );
      }
      tenantDb = apiKeyResult.tenantDb!;
    } else {
      const session = await getB2BSession();
      if (!session || !session.tenantId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      tenantDb = `vinc-${session.tenantId}`;
    }

    const connection = await getPooledConnection(tenantDb);
    const db = connection.db;
    if (!db) {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }

    const slug = req.nextUrl.searchParams.get("slug");
    const query: Record<string, unknown> = {};
    if (slug) {
      query.slug = slug;
    }

    const raw = await db
      .collection("fare_types")
      .find(query)
      .sort({ fare_type_id: 1 })
      .toArray();

    const fare_types = raw.map((f: any) => ({
      id: f.fare_type_id,
      name: f.name,
      slug: f.slug,
      includes_html: f.includes_html ?? null,
      excludes_html: f.excludes_html ?? null,
    }));

    return NextResponse.json({ fare_types });
  } catch (error) {
    console.error("Error fetching fare types:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
