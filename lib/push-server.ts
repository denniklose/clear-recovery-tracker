import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export type WebPushSubscription = webpush.PushSubscription;

export type PushSubscriptionRow = {
  device_id: string;
  device_token_hash: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  daily_enabled: boolean;
  level_up_enabled: boolean;
  last_daily_local_date: string | null;
};

export type PushPayload = {
  title: string;
  body: string;
  tag: string;
  url: string;
};

export function getPushServerClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isPushServerConfigured(): boolean {
  return Boolean(
    getPushServerClient()
    && process.env.WEB_PUSH_SUBJECT
    && process.env.WEB_PUSH_PUBLIC_KEY
    && process.env.WEB_PUSH_PRIVATE_KEY,
  );
}

function configureVapid(): void {
  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    throw new Error("Web-Push-VAPID-Variablen fehlen.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

export function parseWebPushSubscription(value: unknown): WebPushSubscription | null {
  if (!isRecord(value)) return null;
  const endpoint = value.endpoint;
  const keys = value.keys;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 2048) return null;
  if (!isRecord(keys) || typeof keys.p256dh !== "string" || typeof keys.auth !== "string") return null;
  if (keys.p256dh.length > 512 || keys.auth.length > 512) return null;
  return {
    endpoint,
    expirationTime: typeof value.expirationTime === "number" ? value.expirationTime : null,
    keys: {
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
  };
}

export function isValidDeviceIdentity(deviceId: unknown, deviceToken: unknown): deviceId is string {
  return typeof deviceId === "string"
    && /^[A-Za-z0-9_-]{8,120}$/.test(deviceId)
    && typeof deviceToken === "string"
    && /^[A-Fa-f0-9]{32,128}$/.test(deviceToken);
}

export function isExpiredPushError(error: unknown): boolean {
  return error instanceof webpush.WebPushError && (error.statusCode === 404 || error.statusCode === 410);
}

export async function sendPushNotification(row: PushSubscriptionRow, payload: PushPayload): Promise<"sent" | "expired"> {
  if (!isPushServerConfigured()) throw new Error("Push-Server ist nicht konfiguriert.");
  configureVapid();
  try {
    await webpush.sendNotification({
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
    return "sent";
  } catch (error) {
    if (isExpiredPushError(error)) return "expired";
    throw error;
  }
}

export async function deletePushSubscription(client: SupabaseClient, deviceId: string): Promise<void> {
  const result = await client.from("push_subscriptions").delete().eq("device_id", deviceId);
  if (result.error) throw new Error(result.error.message || "Push-Subscription konnte nicht gelöscht werden.");
}
