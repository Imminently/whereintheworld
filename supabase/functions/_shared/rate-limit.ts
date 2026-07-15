import { hashPlayerSessionToken } from "./crypto.ts";
import { createAdminClient } from "./supabase.ts";

function getClientIpAddress(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp !== null && cloudflareIp.trim().length > 0) {
    return cloudflareIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor !== null && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp !== null && realIp.trim().length > 0) {
    return realIp.trim();
  }

  return "unknown";
}

export async function enforceRateLimit(
  adminClient: ReturnType<typeof createAdminClient>,
  request: Request,
  scope: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<void> {
  const clientIpAddress = getClientIpAddress(request);
  const rateKey = await hashPlayerSessionToken(`${scope}:${clientIpAddress}`);
  const { data, error } = await adminClient.rpc("check_edge_function_rate_limit", {
    p_rate_key: rateKey,
    p_max_requests: maxRequests,
    p_window_seconds: windowSeconds,
  });

  if (error !== null) {
    throw error;
  }

  if (data !== true) {
    throw new Error("Too many attempts. Wait a minute and try again.");
  }
}
