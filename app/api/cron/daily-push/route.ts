import { NextResponse } from "next/server";
import { dailyMotivationFor } from "../../../../lib/notification-copy";
import {
  deletePushSubscription,
  getPushServerClient,
  isExpiredPushError,
  isPushServerConfigured,
  sendPushNotification,
  type PushSubscriptionRow,
} from "../../../../lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalClock = { dateKey: string; hour: number };

function getLocalClock(timezone: string, date = new Date()): LocalClock {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
      dateKey: `${values.year}-${values.month}-${values.day}`,
      hour: Number(values.hour),
    };
  } catch {
    return getLocalClock("Europe/Berlin", date);
  }
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }
  if (!isPushServerConfigured()) {
    return NextResponse.json({ ok: true, skipped: "not-configured" });
  }

  const client = getPushServerClient();
  if (!client) return NextResponse.json({ ok: true, skipped: "not-configured" });

  const result = await client
    .from("push_subscriptions")
    .select("device_id, device_token_hash, endpoint, p256dh, auth, timezone, daily_enabled, level_up_enabled, last_daily_local_date")
    .eq("daily_enabled", true);
  if (result.error) return NextResponse.json({ error: "Push-Subscriptions konnten nicht geladen werden." }, { status: 500 });

  let sent = 0;
  let skipped = 0;
  let expired = 0;
  let failed = 0;
  for (const value of result.data ?? []) {
    const row = value as PushSubscriptionRow;
    const clock = getLocalClock(row.timezone);
    if (clock.hour !== 18 || row.last_daily_local_date === clock.dateKey) {
      skipped += 1;
      continue;
    }

    try {
      const delivery = await sendPushNotification(row, {
        title: "Clear · Dein heutiger Satz",
        body: dailyMotivationFor(clock.dateKey, row.device_id),
        tag: `daily:${clock.dateKey}`,
        url: "/",
      });
      if (delivery === "expired") {
        expired += 1;
        await deletePushSubscription(client, row.device_id);
        continue;
      }
      const update = await client
        .from("push_subscriptions")
        .update({ last_daily_local_date: clock.dateKey })
        .eq("device_id", row.device_id);
      if (update.error) {
        failed += 1;
      } else {
        sent += 1;
      }
    } catch (error) {
      if (isExpiredPushError(error)) {
        expired += 1;
        await deletePushSubscription(client, row.device_id);
      } else {
        failed += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, expired, failed });
}
