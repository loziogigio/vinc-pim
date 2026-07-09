import { extractClientIp, normalizeIp } from "@/lib/utils/client-ip";

interface FormSubmissionIpBody {
  __client_ip?: unknown;
}

function normalizeFirstIp(value: string): string {
  return normalizeIp(value.split(",")[0]);
}

/**
 * Resolve the visitor IP for server-to-server form submissions.
 *
 * Public form routes are API-key authenticated and are normally called by a
 * storefront proxy. That proxy can pass the original browser IP in
 * x-vinc-client-ip; if it is absent, fall back to the normal edge-proxy model.
 */
export function extractFormSubmissionIp(
  req: Request,
  body?: FormSubmissionIpBody,
): string {
  const proxyHeaderIp = req.headers.get("x-vinc-client-ip");
  if (proxyHeaderIp) {
    return normalizeFirstIp(proxyHeaderIp);
  }

  if (typeof body?.__client_ip === "string" && body.__client_ip.trim()) {
    return normalizeFirstIp(body.__client_ip);
  }

  return extractClientIp(req);
}
