import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin-auth";
import { serverAdapter } from "@/lib/queue/bull-board";

const handler = serverAdapter.getRouter();

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const auth = await verifyAdminAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return runHandler(req);
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  return runHandler(req);
}

async function runHandler(req: NextRequest) {
  const url = new URL(req.url);
  const mockReq: any = {
    method: req.method,
    url: "/" + url.search,
    headers: Object.fromEntries(req.headers.entries()),
    query: Object.fromEntries(url.searchParams.entries()),
  };

  let responseStatus = 200;
  const responseHeaders: Record<string, string> = {};
  let responseBody: any = null;

  const mockRes: any = {
    status: (code: number) => { responseStatus = code; return mockRes; },
    setHeader: (name: string, value: string) => { responseHeaders[name] = value; return mockRes; },
    send: (data: any) => { responseBody = data; return mockRes; },
    json: (data: any) => {
      responseHeaders["Content-Type"] = "application/json";
      responseBody = JSON.stringify(data);
      return mockRes;
    },
    end: () => mockRes,
  };

  try {
    await new Promise((resolve, reject) => {
      handler(mockReq, mockRes, (err?: any) => {
        if (err) reject(err); else resolve(undefined);
      });
    });
    return new NextResponse(responseBody, { status: responseStatus, headers: new Headers(responseHeaders) });
  } catch (error) {
    console.error("Bull Board base route error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
