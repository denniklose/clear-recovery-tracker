import { NextResponse } from "next/server";
import { levelUpCopy, PUSH_MILESTONES } from "../../../../lib/notification-copy";
import {
  deletePushSubscription,
  getPushServerClient,
  hashDeviceToken,
  isExpiredPushError,
  isPushServerConfigured,
  isValidDeviceIdentity,
  sendPushNotification,
  type PushSubscriptionRow,
} from "../../../../lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
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

  const eventKey = body.eventKey;
  const kind = body.kind;
  const streak = body.streak;
  if (kind !== "level-up"
    || typeof eventKey !== "string"
    || !/^level-up:[A-Za-z0-9_-]{1,100}:\d{4}-\d{2}-\d{2}$/.test(eventKey)
    || typeof streak !== "number"
    || !Number.isInteger(streak)
    || streak < 1
    || streak > 3650) {
    return NextResponse.json({ error: "Push-Ereignis ist ungültig." }, { status: 400 });
  }

  const deviceId = body.deviceId as string;
  const deviceTokenHash = hashDeviceToken(body.deviceToken as string);
  const subscriptionResult = await client
    .from("push_subscriptions")
    .select("device_id, device_token_hash, endpoint, p256dh, auth, timezone, daily_enabled, level_up_enabled, last_daily_local_date")
    .eq("device_id", deviceId)
    .maybeSingle();
  if (subscriptionResult.error) {
    return NextResponse.json({ error: "Push-Subscription konnte nicht geladen werden." }, { status: 500 });
  }

  const subscription = subscriptionResult.data as PushSubscriptionRow | null;
  if (!subscription) return NextResponse.json({ ok: true, skipped: "not-subscribed" });
  if (subscription.device_token_hash !== deviceTokenHash) {
    return NextResponse.json({ error: "Gerätekennung ist ungültig." }, { status: 401 });
  }
  if (!subscription.level_up_enabled) return NextResponse.json({ ok: true, skipped: "disabled" });

  const existingEvent = await client
    .from("push_events")
    .select("delivered_at")
    .eq("device_id", deviceId)
    .eq("event_key", eventKey)
    .maybeSingle();
  if (existingEvent.error) {
    return NextResponse.json({ error: "Push-Ereignis konnte nicht geprüft werden." }, { status: 500 });
  }
  if (existingEvent.data?.delivered_at) return NextResponse.json({ ok: true, duplicate: true });

  const isMilestone = PUSH_MILESTONES.includes(streak as (typeof PUSH_MILESTONES)[number]);
  const eventInsert = await client.from("push_events").upsert({
    device_id: deviceId,
    event_key: eventKey,
    kind,
    streak,
    milestone: isMilestone,
  }, { onConflict: "device_id,event_key" });
  if (eventInsert.error) {
    return NextResponse.json({ error: "Push-Ereignis konnte nicht gespeichert werden." }, { status: 500 });
  }

  const copy = levelUpCopy(streak, isMilestone);
  try {
    const delivery = await sendPushNotification(subscription, {
      ...copy,
      tag: eventKey,
      url: "/",
    });
    if (delivery === "expired") {
      await deletePushSubscription(client, deviceId);
      return NextResponse.json({ ok: true, expired: true });
    }
  } catch (error) {
    if (isExpiredPushError(error)) {
      await deletePushSubscription(client, deviceId);
      return NextResponse.json({ ok: true, expired: true });
    }
    return NextResponse.json({ error: "Push konnte gerade nicht zugestellt werden." }, { status: 502 });
  }

  const delivered = await client
    .from("push_events")
    .update({ delivered_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .eq("event_key", eventKey);
  if (delivered.error) {
    return NextResponse.json({ error: "Push-Zustellung konnte nicht bestätigt werden." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, delivered: true });
}
