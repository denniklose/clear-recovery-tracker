import {
  clearPendingSyncState,
  enqueueSyncState,
  loadPendingSyncState,
} from "./indexed-db";
import {
  EMPTY_APP_STATE,
  normalizeAppState,
  type AppState,
  type RecoverySegment,
} from "./recovery";
import { getSupabaseClient } from "./supabase";

type SettingsRow = {
  active_segment_id: string | null;
  substance: string;
  clean_start_date: string;
  daily_spend: number | string | null;
  motivation: string;
  onboarding_completed: boolean;
  sound_enabled: boolean;
};

type SegmentRow = {
  id: string;
  substance: string;
  start_date: string;
  end_date: string | null;
  daily_spend: number | string | null;
  motivation: string;
};

type DailyCheckinRow = {
  checkin_date: string;
  segment_id: string | null;
  hard_day: boolean;
  is_clean: boolean;
  checked_at: string | null;
};

type CloudSnapshot = {
  state: AppState;
  hasRemoteData: boolean;
};

export type SyncSource = "cloud" | "local" | "empty" | "conflict";

type SyncMode = "restore" | "write";

export type SyncDecision = "cloud" | "local";

export type SyncResult = {
  state: AppState;
  source: SyncSource;
  synced: boolean;
  error?: string;
  remoteState?: AppState;
  localState?: AppState;
};

function throwIfError(result: { error: { message?: string } | null }): void {
  if (result.error) {
    throw new Error(result.error.message || "Supabase-Anfrage fehlgeschlagen.");
  }
}

function asMoney(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function segmentIdForDate(segments: SegmentRow[], date: string): string | null {
  const matching = segments
    .filter((segment) => segment.start_date <= date && (!segment.end_date || segment.end_date >= date))
    .sort((left, right) => right.start_date.localeCompare(left.start_date));
  return matching[0]?.id ?? segments.at(-1)?.id ?? null;
}

export async function fetchCloudState(userId: string): Promise<CloudSnapshot> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase ist nicht konfiguriert.");

  const [profileResult, settingsResult, segmentsResult, dailyResult] = await Promise.all([
    client.from("profiles").select("id").eq("id", userId).maybeSingle(),
    client.from("recovery_settings").select("active_segment_id, substance, clean_start_date, daily_spend, motivation, onboarding_completed, sound_enabled").eq("user_id", userId).maybeSingle(),
    client.from("recovery_segments").select("id, substance, start_date, end_date, daily_spend, motivation").eq("user_id", userId).order("start_date", { ascending: true }),
    client.from("daily_checkins").select("checkin_date, segment_id, hard_day, is_clean, checked_at").eq("user_id", userId).order("checkin_date", { ascending: true }),
  ]);

  throwIfError(profileResult);
  throwIfError(settingsResult);
  throwIfError(segmentsResult);
  throwIfError(dailyResult);

  const settings = settingsResult.data as SettingsRow | null;
  const segments = (segmentsResult.data ?? []) as SegmentRow[];
  const dailyRows = (dailyResult.data ?? []) as DailyCheckinRow[];
  const hasRemoteData = Boolean(settings) || segments.length > 0 || dailyRows.length > 0;
  const rowsBySegment = new Map<string, DailyCheckinRow[]>();
  for (const row of dailyRows) {
    const segmentId = row.segment_id && segments.some((segment) => segment.id === row.segment_id)
      ? row.segment_id
      : segmentIdForDate(segments, row.checkin_date);
    if (!segmentId) continue;
    const rows = rowsBySegment.get(segmentId) ?? [];
    rows.push(row);
    rowsBySegment.set(segmentId, rows);
  }
  const recoverySegments: RecoverySegment[] = segments.map((segment) => {
    const rows = rowsBySegment.get(segment.id) ?? [];
    const checkIns = rows.filter((row) => row.is_clean).map((row) => row.checkin_date);
    const hardDays = rows.filter((row) => row.hard_day).map((row) => row.checkin_date);
    const checkedAtValues = rows
      .map((row) => row.checked_at ? new Date(row.checked_at).getTime() : NaN)
      .filter((value) => Number.isFinite(value));
    return {
      id: segment.id,
      substance: segment.substance,
      startDate: segment.start_date,
      ...(segment.end_date ? { endDate: segment.end_date } : {}),
      dailySpend: asMoney(segment.daily_spend),
      motivation: segment.motivation || settings?.motivation || "",
      checkIns,
      hardDays,
      lastCheckInAt: checkedAtValues.length ? Math.max(...checkedAtValues) : null,
    };
  });
  const cleanStartDate = settings?.clean_start_date || recoverySegments[0]?.startDate || "";
  const checkIns = dailyRows.filter((row) => row.is_clean).map((row) => row.checkin_date);
  const hardDays = dailyRows.filter((row) => row.hard_day).map((row) => row.checkin_date);

  return {
    hasRemoteData,
    state: normalizeAppState({
      user: {
        substance: settings?.substance || recoverySegments[recoverySegments.length - 1]?.substance || "",
        cleanStartDate,
        dailySpend: asMoney(settings?.daily_spend),
        motivation: settings?.motivation || "",
        onboardingCompleted: settings ? settings.onboarding_completed !== false : hasRemoteData,
        soundEnabled: settings?.sound_enabled !== false,
      },
      activeCounterId: settings?.active_segment_id || recoverySegments.find((segment) => !segment.endDate)?.id || null,
      recoverySegments,
      checkIns,
      hardDays,
    }),
  };
}

async function upsertChunks(
  table: string,
  rows: Record<string, unknown>[],
  onConflict?: string,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase ist nicht konfiguriert.");

  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200);
    const result = await client.from(table).upsert(chunk, onConflict ? { onConflict } : undefined);
    throwIfError(result);
  }
}

export async function pushStateToCloud(userId: string, rawState: AppState): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase ist nicht konfiguriert.");

  const state = normalizeAppState(rawState);
  if (!state.user.onboardingCompleted || !state.user.cleanStartDate) return;

  const profileResult = await client.from("profiles").upsert({ id: userId }, { onConflict: "id" });
  throwIfError(profileResult);

  const settingsResult = await client.from("recovery_settings").upsert({
    user_id: userId,
    active_segment_id: state.activeCounterId || state.recoverySegments.find((segment) => !segment.endDate)?.id || null,
    substance: state.user.substance,
    clean_start_date: state.user.cleanStartDate,
    daily_spend: state.user.dailySpend,
    motivation: state.user.motivation,
    onboarding_completed: state.user.onboardingCompleted,
    sound_enabled: state.user.soundEnabled,
  }, { onConflict: "user_id" });
  throwIfError(settingsResult);

  await upsertChunks("recovery_segments", state.recoverySegments.map((segment) => ({
    id: segment.id,
    user_id: userId,
    substance: segment.substance,
    start_date: segment.startDate,
    end_date: segment.endDate ?? null,
    daily_spend: segment.dailySpend ?? null,
    motivation: segment.motivation ?? "",
  })), "id");

  const dailyRows = state.recoverySegments.flatMap((segment) => {
    const cleanDays = new Set(segment.checkIns ?? []);
    const hardDays = new Set(segment.hardDays ?? []);
    const allDates = [...new Set([...cleanDays, ...hardDays])].sort();
    const latestCleanDate = [...cleanDays].sort().at(-1);
    const checkedAt = segment.lastCheckInAt && latestCleanDate
      ? new Date(segment.lastCheckInAt).toISOString()
      : null;
    return allDates.map((date) => ({
      user_id: userId,
      checkin_date: date,
      segment_id: segment.id,
      hard_day: hardDays.has(date),
      is_clean: cleanDays.has(date),
      checked_at: date === latestCleanDate ? checkedAt : null,
    }));
  });
  await upsertChunks("daily_checkins", dailyRows, "user_id,segment_id,checkin_date");
}

function statesMatch(left: AppState, right: AppState): boolean {
  return JSON.stringify(normalizeAppState(left)) === JSON.stringify(normalizeAppState(right));
}

export async function syncStateForUser(
  userId: string,
  localState: AppState = EMPTY_APP_STATE,
  mode: SyncMode = "restore",
): Promise<SyncResult> {
  const remote = await fetchCloudState(userId);
  const pendingState = await loadPendingSyncState(userId);
  const candidate = pendingState?.user.onboardingCompleted ? pendingState : normalizeAppState(localState);

  if (remote.hasRemoteData) {
    if (mode === "write" && pendingState?.user.onboardingCompleted) {
      await pushStateToCloud(userId, pendingState);
      await clearPendingSyncState();
      const merged = await fetchCloudState(userId);
      return { state: merged.state, source: "cloud", synced: true };
    }

    if (candidate.user.onboardingCompleted && !statesMatch(remote.state, candidate)) {
      return {
        state: candidate,
        source: "conflict",
        synced: false,
        remoteState: remote.state,
        localState: candidate,
      };
    }

    return { state: remote.state, source: "cloud", synced: true };
  }

  if (candidate.user.onboardingCompleted) {
    await pushStateToCloud(userId, candidate);
    await clearPendingSyncState();
    const created = await fetchCloudState(userId);
    return { state: created.state, source: "cloud", synced: true };
  }

  return { state: EMPTY_APP_STATE, source: "empty", synced: true };
}

export async function resolveSyncConflict(
  userId: string,
  remoteState: AppState,
  localState: AppState,
  decision: SyncDecision,
): Promise<SyncResult> {
  if (decision === "cloud") {
    await clearPendingSyncState();
    return { state: normalizeAppState(remoteState), source: "cloud", synced: true };
  }

  await pushStateToCloud(userId, localState);
  await clearPendingSyncState();
  const merged = await fetchCloudState(userId);
  return { state: merged.state, source: "cloud", synced: true };
}

export async function syncAfterLocalWrite(userId: string, state: AppState): Promise<SyncResult> {
  try {
    await enqueueSyncState(state, userId);
  } catch {
    // A browser that blocks IndexedDB can still sync while online; offline state remains visible locally.
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { state, source: "local", synced: false };
  }

  try {
    return await syncStateForUser(userId, state, "write");
  } catch (error) {
    return {
      state,
      source: "local",
      synced: false,
      error: error instanceof Error ? error.message : "Cloud-Sync fehlgeschlagen.",
    };
  }
}
