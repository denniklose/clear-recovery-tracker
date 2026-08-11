import { NextResponse } from "next/server";
import {
  getPushServerClient,
  hashDeviceToken,
  isPushServerConfigured,
  isValidDeviceIdentity,
  parseWebPushSubscription,
} from "../../../../lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function safeTimezone(value: unknown): string {
  if (typeof value !== "string" || value.length < 1 || value.length > 100) return "Europe/Berlin";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value;
  } catch {
    return "Europe/Berlin";
  }
}

export async function POST(request: Request) {
  if (!isPushServerConfigured()) {
    return NextResponse.json({ error: "Push ist noch nicht eingerichtet." }, { status: 503 });
  }

  const client = getPushServerClient();
  if (!client) return NextResponse.json({ error: "Push ist noch nicht eingerichtet." }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Push-Anfrage." }, { status: 400 });
  }
  if (!isRecord(body) || !isValidDeviceIdentity(body.deviceId, body.deviceToken)) {
    return NextResponse.json({ error: "Gerätekennung ist ungültig." }, { status: 400 });
  }

  const subscription = parseWebPushSubscription(body.subscription);
  if (!subscription) {
    return NextResponse.json({ error: "Push-Subscription ist ungültig." }, { status: 400 });
  }

  const deviceId = body.deviceId as string;
  const deviceToken = body.deviceToken as string;
  const endpointCleanup = await client
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", subscription.endpoint)
    .neq("device_id", deviceId);
  if (endpointCleanup.error) {
    return NextResponse.json({ error: "Push-Subscription konnte nicht gespeichert werden." }, { status: 500 });
  }

  const result = await client.from("push_subscriptions").upsert({
    device_id: deviceId,
    device_token_hash: hashDeviceToken(deviceToken),
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    timezone: safeTimezone(body.timezone),
    daily_enabled: body.dailyEnabled !== false,
    level_up_enabled: body.levelUpEnabled !== false,
  }, { onConflict: "device_id" });

  if (result.error) {
    return NextResponse.json({ error: "Push-Subscription konnte nicht gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
