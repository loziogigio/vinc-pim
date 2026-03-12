import { NextResponse } from "next/server";
import { connectToAdminDatabase } from "@/lib/db/admin-connection";
import { getPoolStats } from "@/lib/db/connection-pool";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const adminConn = await connectToAdminDatabase();
    await adminConn.db.admin().ping();

    const poolStats = getPoolStats();

    return NextResponse.json({
      status: "healthy",
      mongo: "connected",
      pool: poolStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        status: "unhealthy",
        mongo: "disconnected",
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
