import { NextResponse } from "next/server";
import {
  getPushServerClient,
  hashDeviceToken,
  isPushServerConfigured,
  isValidDeviceIdentity,
} from "../../../../lib/push-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isPushServerConfigured()) {
    return NextResponse.json({ error: "Push ist noch nicht eingerichtet." }, { status: 503 });
  }
  const client = getPushServerClient();
  if (!client) return NextResponse.json({ error: "Push ist noch nicht eingerichtet." }, { status: 503 });

  let body: { deviceId?: unknown; deviceToken?: unknown };
  try {
    body = await request.json() as { deviceId?: unknown; deviceToken?: unknown };
  } catch {
    return NextResponse.json({ error: "Ungültige Push-Anfrage." }, { status: 400 });
  }
  if (!isValidDeviceIdentity(body.deviceId, body.deviceToken)) {
    return NextResponse.json({ error: "Gerätekennung ist ungültig." }, { status: 400 });
  }
  const deviceId = body.deviceId as string;
  const deviceToken = body.deviceToken as string;

  const result = await client
    .from("push_subscriptions")
    .delete()
    .eq("device_id", deviceId)
    .eq("device_token_hash", hashDeviceToken(deviceToken));
  if (result.error) {
    return NextResponse.json({ error: "Push konnte nicht deaktiviert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
