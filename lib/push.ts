import {
  enqueuePushEvent,
  loadPushPreferences,
  loadQueuedPushEvents,
  removeQueuedPushEvent,
  savePushPreferences,
  type PushPreferencesRecord,
} from "./indexed-db";

export type PushPermission = NotificationPermission | "unsupported";
export type PushPreferences = Omit<PushPreferencesRecord, "key" | "updatedAt">;

type PushEventInput = {
  counterId: string;
  dateKey: string;
  streak: number;
  milestone: boolean;
};

export class PushClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushClientError";
  }
}

export function isPushAvailable(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window
    && Boolean(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY);
}

export function getPushPermission(): PushPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export async function loadStoredPushPreferences(): Promise<PushPreferences | null> {
  const record = await loadPushPreferences();
  if (!record || typeof record.deviceId !== "string" || typeof record.deviceToken !== "string") return null;
  return {
    deviceId: record.deviceId,
    deviceToken: record.deviceToken,
    dailyEnabled: record.dailyEnabled !== false,
    levelUpEnabled: record.levelUpEnabled !== false,
    timezone: record.timezone || getDeviceTimezone(),
  };
}

function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

function createRandomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function createDeviceId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `device-${createRandomToken()}`;
}

async function getOrCreatePreferences(): Promise<PushPreferences> {
  const existing = await loadStoredPushPreferences();
  if (existing) return existing;

  const preferences: PushPreferences = {
    deviceId: createDeviceId(),
    deviceToken: createRandomToken(),
    dailyEnabled: true,
    levelUpEnabled: true,
    timezone: getDeviceTimezone(),
  };
  await savePushPreferences(preferences);
  return preferences;
}

function publicKeyToUint8Array(value: string): Uint8Array {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new PushClientError("Dieser Browser unterstützt keine Push-Benachrichtigungen.");
  }

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
}

function subscriptionPayload(subscription: PushSubscription): Record<string, unknown> {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
  };
}

async function postPushRequest(path: string, payload: Record<string, unknown>): Promise<Response> {
  try {
    return await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new PushClientError("Keine Verbindung zum Push-Dienst. Die Änderung bleibt lokal vorgemerkt.");
  }
}

async function readPushError(response: Response, fallback: string): Promise<PushClientError> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error) return new PushClientError(body.error);
  } catch {
    // The endpoint may return a plain text error or no body.
  }
  return new PushClientError(fallback);
}

async function syncStoredPushPreferences(preferences: PushPreferences): Promise<void> {
  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) throw new PushClientError("Diese PWA ist noch nicht für Push registriert.");

  const response = await postPushRequest("/api/push/subscribe", {
    deviceId: preferences.deviceId,
    deviceToken: preferences.deviceToken,
    timezone: preferences.timezone,
    dailyEnabled: preferences.dailyEnabled,
    levelUpEnabled: preferences.levelUpEnabled,
    subscription: subscriptionPayload(subscription),
  });
  if (!response.ok) throw await readPushError(response, "Push konnte nicht synchronisiert werden.");
}

export async function subscribeToPush(): Promise<PushPreferences> {
  if (!isPushAvailable()) {
    throw new PushClientError("Push wird nach der einmaligen VAPID-Einrichtung verfügbar.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new PushClientError(permission === "denied"
      ? "Push ist blockiert. Erlaube Mitteilungen in den iPhone-Einstellungen."
      : "Push wurde noch nicht freigegeben.");
  }

  const registration = await getServiceWorkerRegistration();
  const existing = await registration.pushManager.getSubscription();
  if (!existing) {
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: publicKeyToUint8Array(process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? "") as unknown as BufferSource,
    });
  }
  const preferences = await getOrCreatePreferences();
  await syncStoredPushPreferences(preferences);
  await savePushPreferences(preferences);
  return preferences;
}

export async function updatePushPreferences(
  updates: Partial<Pick<PushPreferences, "dailyEnabled" | "levelUpEnabled">>,
): Promise<{ preferences: PushPreferences; synced: boolean }> {
  const current = await loadStoredPushPreferences();
  if (!current) throw new PushClientError("Aktiviere Push zuerst auf diesem Gerät.");
  const preferences = { ...current, ...updates, timezone: getDeviceTimezone() };
  await savePushPreferences(preferences);

  if (typeof navigator === "undefined" || !navigator.onLine) return { preferences, synced: false };
  try {
    await syncStoredPushPreferences(preferences);
    return { preferences, synced: true };
  } catch {
    return { preferences, synced: false };
  }
}

export async function queueLevelUpPush(event: PushEventInput): Promise<void> {
  try {
    const preferences = await loadStoredPushPreferences();
    if (!preferences?.levelUpEnabled) return;
    const eventKey = `level-up:${event.counterId}:${event.dateKey}`;
    await enqueuePushEvent({
      key: `event:${eventKey}`,
      eventKey,
      deviceId: preferences.deviceId,
      kind: "level-up",
      streak: Math.max(1, Math.min(3650, Math.round(event.streak))),
      milestone: event.milestone,
      queuedAt: Date.now(),
    });
    await flushPushEvents();
  } catch {
    // Push is an optional enhancement; the check-in itself must never fail because of it.
  }
}

export async function flushPushEvents(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) return;
  const preferences = await loadStoredPushPreferences();
  if (!preferences) return;

  try {
    await syncStoredPushPreferences(preferences);
  } catch {
    // Keep the queue local until the next online/visibility event.
  }

  const events = await loadQueuedPushEvents(preferences.deviceId);
  for (const event of events) {
    try {
      const response = await postPushRequest("/api/push/event", {
        deviceId: preferences.deviceId,
        deviceToken: preferences.deviceToken,
        eventKey: event.eventKey,
        kind: event.kind,
        streak: event.streak,
        milestone: event.milestone,
      });
      if (response.ok || response.status === 400 || response.status === 401 || response.status === 404 || response.status === 410) {
        await removeQueuedPushEvent(event.key);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
}
