/**
 * Bull Board API Route
 * Serves the Bull Board UI for monitoring BullMQ queues
 *
 * Access at: http://localhost:3001/api/admin/bull-board
 */

import { NextRequest, NextResponse } from "next/server";
import { serverAdapter } from "@/lib/queue/bull-board";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";

// Get the Express app from the server adapter
const handler = serverAdapter.getRouter();

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

// Convert Express middleware to Next.js route handler
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  const resolvedParams = await params;
  return handleRequest(req, resolvedParams);
}

async function handleRequest(
  req: NextRequest,
  params: { path: string[] }
) {
  // Convert Next.js request to Express-like request
  const path = params.path ? `/${params.path.join("/")}` : "/";
  const url = new URL(req.url);

  // Create a mock Express request/response
  const mockReq: any = {
    method: req.method,
    url: path + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    query: Object.fromEntries(url.searchParams.entries()),
  };

  let responseStatus = 200;
  const responseHeaders: Record<string, string> = {};
  let responseBody: any = null;

  const mockRes: any = {
    status: (code: number) => {
      responseStatus = code;
      return mockRes;
    },
    setHeader: (name: string, value: string) => {
      responseHeaders[name] = value;
      return mockRes;
    },
    send: (data: any) => {
      responseBody = data;
      return mockRes;
    },
    json: (data: any) => {
      responseHeaders["Content-Type"] = "application/json";
      responseBody = JSON.stringify(data);
      return mockRes;
    },
    end: () => {
      return mockRes;
    },
  };

  // Handle the request with Express router
  try {
    await new Promise((resolve, reject) => {
      handler(mockReq, mockRes, (err?: any) => {
        if (err) reject(err);
        else resolve(undefined);
      });
    });

    // Return Next.js response
    const headers = new Headers(responseHeaders);

    return new NextResponse(responseBody, {
      status: responseStatus,
      headers,
    });
  } catch (error) {
    console.error("Bull Board error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
