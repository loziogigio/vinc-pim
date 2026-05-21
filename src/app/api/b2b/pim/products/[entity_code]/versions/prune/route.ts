import { NextRequest, NextResponse } from "next/server";
import { getB2BSession } from "@/lib/auth/b2b-session";
import {
  pruneVersionsForProduct,
  type VersionRetentionPolicy,
} from "@/lib/pim/version-retention.service";

/**
 * POST /api/b2b/pim/products/[entity_code]/versions/prune
 * Prune old PIM versions for a single product per the configured retention
 * policy. Body (optional): { keepLastN?: number, keepWithinDays?: number, dryRun?: boolean }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ entity_code: string }> }
) {
  try {
    const session = await getB2BSession();
    if (!session || !session.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { entity_code } = await params;
    const body = await safeJson(req);
    const policy: Partial<VersionRetentionPolicy> = {};
    if (typeof body.keepLastN === "number" && body.keepLastN > 0) {
      policy.keepLastN = body.keepLastN;
    }
    if (typeof body.keepWithinDays === "number" && body.keepWithinDays > 0) {
      policy.keepWithinDays = body.keepWithinDays;
    }
    const dryRun = body.dryRun === true || req.nextUrl.searchParams.get("dryRun") === "true";

    const tenantDb = `vinc-${session.tenantId}`;

    if (dryRun) {
      // Dry run: reuse the per-product logic but bail out before deleting by
      // passing an impossible policy is not viable — instead, run the service
      // and report what was deleted. For a single product the cheaper option
      // is to compute the diff inline.
      const { connectWithModels } = await import("@/lib/db/connection");
      const { PIMProduct } = await connectWithModels(tenantDb);
      const versions = await PIMProduct.find(
        { entity_code },
        { _id: 1, version: 1, isCurrent: 1, isCurrentPublished: 1, created_at: 1 }
      )
        .sort({ version: -1 })
        .lean();

      const resolvedKeepLastN = policy.keepLastN ?? 20;
      const resolvedKeepWithinDays = policy.keepWithinDays ?? 180;
      const cutoff = new Date(Date.now() - resolvedKeepWithinDays * 86_400_000);
      const topNIds = new Set(versions.slice(0, resolvedKeepLastN).map((v) => String(v._id)));

      const candidates = versions.filter((v) => {
        if (v.isCurrent || v.isCurrentPublished) return false;
        if (topNIds.has(String(v._id))) return false;
        const createdAt = v.created_at ? new Date(v.created_at as unknown as string) : null;
        if (createdAt && createdAt >= cutoff) return false;
        return true;
      });

      return NextResponse.json({
        entity_code,
        dryRun: true,
        policy: { keepLastN: resolvedKeepLastN, keepWithinDays: resolvedKeepWithinDays },
        totalVersions: versions.length,
        wouldDelete: candidates.length,
        wouldKeep: versions.length - candidates.length,
      });
    }

    const result = await pruneVersionsForProduct(tenantDb, entity_code, policy);
    return NextResponse.json({ dryRun: false, ...result });
  } catch (error: any) {
    console.error("Error pruning product versions:", error);
    return NextResponse.json(
      { error: "Failed to prune versions", details: error.message },
      { status: 500 }
    );
  }
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
