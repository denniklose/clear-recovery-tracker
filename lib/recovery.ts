import { addCalendarDays, differenceInCalendarDays, todayLocalKey } from "./date";

export const SUBSTANCES = [
  "Amphetamin / Speed",
  "Kokain",
  "Cannabis",
  "Alkohol",
  "Nikotin",
  "Opioide",
  "Benzodiazepine",
  "Andere",
] as const;

export const MILESTONES = [1, 3, 7, 14, 30, 50, 90, 180, 365];
export const CHECK_IN_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type Substance = (typeof SUBSTANCES)[number];
export type AppTab = "today" | "progress" | "counters" | "profile";

/**
 * A segment is also a counter. Keeping the old name makes older cached and
 * cloud data source-compatible while every active substance gets its own
 * check-in history.
 */
export type RecoverySegment = {
  id: string;
  substance: string;
  startDate: string;
  endDate?: string;
  dailySpend?: number | null;
  motivation?: string;
  checkIns?: string[];
  hardDays?: string[];
  lastCheckInAt?: number | null;
};

export type RecoveryCounter = RecoverySegment;

export type UserSettings = {
  /** Projection of the currently selected counter for legacy screens/cloud rows. */
  substance: string;
  cleanStartDate: string;
  dailySpend: number | null;
  motivation: string;
  onboardingCompleted: boolean;
  soundEnabled: boolean;
};

export type AppState = {
  user: UserSettings;
  recoverySegments: RecoverySegment[];
  activeCounterId?: string | null;
  /** Projection of the currently selected counter for legacy consumers. */
  checkIns: string[];
  hardDays: string[];
};

export type AppMetrics = {
  currentStreak: number;
  bestStreak: number;
  totalCleanDays: number;
  cleanRate30: number;
  moneySaved: number;
  hoursClean: number;
  level: number;
  levelStart: number;
  levelEnd: number;
  xp: number;
  xpInLevel: number;
  xpProgress: number;
  nextMilestone: number;
  previousMilestone: number;
  milestoneProgress: number;
  daysToMilestone: number;
  todayChecked: boolean;
  canCheckIn: boolean;
  checkInRemainingMs: number;
  lastCheckInAt: number | null;
  clockTampered: boolean;
  isMilestone: boolean;
};

export const EMPTY_APP_STATE: AppState = {
  user: {
    substance: "",
    cleanStartDate: "",
    dailySpend: null,
    motivation: "",
    onboardingCompleted: false,
    soundEnabled: true,
  },
  recoverySegments: [],
  activeCounterId: null,
  checkIns: [],
  hardDays: [],
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object");
}

function hasOwn(value: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asTimestampOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeDayKeys(value: unknown, todayKey: string): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((key): key is string => (
    typeof key === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(key)
    && key <= todayKey
  )))].sort();
}

function segmentContainsDate(segment: RecoverySegment, date: string): boolean {
  return segment.startDate <= date && (!segment.endDate || segment.endDate >= date);
}

function projectActiveCounter(state: AppState): AppState {
  const activeCounter = getActiveCounter(state);
  if (!activeCounter) {
    return {
      ...state,
      activeCounterId: null,
      checkIns: [...state.checkIns],
      hardDays: [...state.hardDays],
    };
  }

  const dailySpend = hasOwn(activeCounter as UnknownRecord, "dailySpend")
    ? activeCounter.dailySpend ?? null
    : state.user.dailySpend;
  const motivation = hasOwn(activeCounter as UnknownRecord, "motivation")
    ? activeCounter.motivation ?? ""
    : state.user.motivation;

  return {
    ...state,
    activeCounterId: activeCounter.id,
    user: {
      ...state.user,
      substance: activeCounter.substance,
      cleanStartDate: activeCounter.startDate,
      dailySpend,
      motivation,
      onboardingCompleted: true,
    },
    checkIns: [...(activeCounter.checkIns ?? [])],
    hardDays: [...(activeCounter.hardDays ?? [])],
  };
}

export function normalizeAppState(value: unknown): AppState {
  if (!isRecord(value)) return EMPTY_APP_STATE;

  const candidateUser = isRecord(value.user) ? value.user : {};
  const todayKey = todayLocalKey();
  const legacyCheckIns = normalizeDayKeys(value.checkIns, todayKey);
  const legacyHardDays = normalizeDayKeys(value.hardDays, todayKey);
  const rawSegments = Array.isArray(value.recoverySegments)
    ? value.recoverySegments.filter(isRecord)
    : [];
  const fallbackSubstance = typeof candidateUser.substance === "string" ? candidateUser.substance : "";
  const fallbackStartDate = typeof candidateUser.cleanStartDate === "string" ? candidateUser.cleanStartDate : "";
  const fallbackDailySpend = asNumberOrNull(candidateUser.dailySpend);
  const fallbackMotivation = typeof candidateUser.motivation === "string" ? candidateUser.motivation : "";
  const onboardingCompleted = Boolean(candidateUser.onboardingCompleted) || rawSegments.length > 0;

  const segmentInputs = rawSegments.length > 0
    ? rawSegments
    : onboardingCompleted && fallbackStartDate
      ? [{
          id: "counter-legacy",
          substance: fallbackSubstance,
          startDate: fallbackStartDate,
        }]
      : [];

  const usedIds = new Set<string>();
  const segments = segmentInputs.map((rawSegment, index): RecoverySegment | null => {
    const rawId = typeof rawSegment.id === "string" ? rawSegment.id.trim() : "";
    const idBase = rawId || `counter-${index + 1}`;
    let id = idBase;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${idBase}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    const substance = typeof rawSegment.substance === "string" ? rawSegment.substance : fallbackSubstance;
    const requestedStartDate = typeof rawSegment.startDate === "string" ? rawSegment.startDate : fallbackStartDate;
    if (!requestedStartDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate)) return null;
    const startDate = requestedStartDate > todayKey ? todayKey : requestedStartDate;

    const requestedEndDate = typeof rawSegment.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawSegment.endDate)
      ? rawSegment.endDate
      : undefined;
    const endDate = requestedEndDate && requestedEndDate <= todayKey ? requestedEndDate : undefined;
    const legacyDaysForSegment = (days: string[]) => days.filter((day) => segmentContainsDate({ id, substance, startDate, endDate }, day));
    const checkIns = hasOwn(rawSegment, "checkIns")
      ? normalizeDayKeys(rawSegment.checkIns, todayKey)
      : legacyDaysForSegment(legacyCheckIns);
    const hardDays = hasOwn(rawSegment, "hardDays")
      ? normalizeDayKeys(rawSegment.hardDays, todayKey)
      : legacyDaysForSegment(legacyHardDays);
    const dailySpend = hasOwn(rawSegment, "dailySpend") ? asNumberOrNull(rawSegment.dailySpend) : fallbackDailySpend;
    const motivation = hasOwn(rawSegment, "motivation")
      ? typeof rawSegment.motivation === "string" ? rawSegment.motivation : ""
      : fallbackMotivation;

    return {
      id,
      substance,
      startDate,
      ...(endDate ? { endDate } : {}),
      dailySpend,
      motivation,
      checkIns,
      hardDays,
      lastCheckInAt: asTimestampOrNull(rawSegment.lastCheckInAt),
    };
  }).filter((segment): segment is RecoverySegment => Boolean(segment));

  const requestedActiveId = typeof value.activeCounterId === "string" ? value.activeCounterId : null;
  const activeSegments = segments.filter((segment) => !segment.endDate);
  const activeCounterId = (requestedActiveId && activeSegments.some((segment) => segment.id === requestedActiveId))
    ? requestedActiveId
    : activeSegments[activeSegments.length - 1]?.id ?? segments[segments.length - 1]?.id ?? null;

  const normalized: AppState = {
    user: {
      substance: fallbackSubstance,
      cleanStartDate: fallbackStartDate,
      dailySpend: fallbackDailySpend,
      motivation: fallbackMotivation,
      onboardingCompleted,
      soundEnabled: candidateUser.soundEnabled !== false,
    },
    recoverySegments: segments,
    activeCounterId,
    checkIns: legacyCheckIns,
    hardDays: legacyHardDays,
  };

  return projectActiveCounter(normalized);
}

export function createSegmentId(prefix = "segment"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createStartedState(input: {
  substances?: string[];
  substance?: string;
  cleanStartDate: string;
  dailySpend: number | null;
  motivation: string;
}, todayKey: string): AppState {
  const substances = [...new Set((input.substances?.length ? input.substances : [input.substance ?? ""]).filter(Boolean))];
  const checkIns = input.cleanStartDate < todayKey
    ? keysThroughYesterday(input.cleanStartDate, todayKey)
    : [];
  const lastCheckInAt = checkIns.length ? Date.now() - CHECK_IN_INTERVAL_MS - 1 : null;
  const recoverySegments = substances.map((substance) => ({
    id: createSegmentId("counter"),
    substance,
    startDate: input.cleanStartDate,
    dailySpend: input.dailySpend,
    motivation: input.motivation,
    checkIns: [...checkIns],
    hardDays: [],
    lastCheckInAt,
  }));
  const activeCounterId = recoverySegments[0]?.id ?? null;

  return normalizeAppState({
    activeCounterId,
    user: {
      substance: substances[0] ?? "",
      cleanStartDate: input.cleanStartDate,
      dailySpend: input.dailySpend,
      motivation: input.motivation,
      onboardingCompleted: true,
      soundEnabled: true,
    },
    recoverySegments,
    checkIns,
    hardDays: [],
  });
}

export function createDemoState(days: number, todayKey: string, todayChecked = false): AppState {
  const startDate = addCalendarDays(todayKey, -days);
  const checkIns = keysThroughYesterday(startDate, todayKey);
  if (todayChecked) checkIns.push(todayKey);
  const segmentId = createSegmentId("demo");

  return normalizeAppState({
    activeCounterId: segmentId,
    user: {
      substance: "Alkohol",
      cleanStartDate: startDate,
      dailySpend: 30,
      motivation: "Ich will mein Leben wieder selbst bestimmen.",
      onboardingCompleted: true,
      soundEnabled: true,
    },
    recoverySegments: [{
      id: segmentId,
      substance: "Alkohol",
      startDate,
      dailySpend: 30,
      motivation: "Ich will mein Leben wieder selbst bestimmen.",
      checkIns: [...new Set(checkIns)],
      hardDays: [addCalendarDays(todayKey, -2)],
      lastCheckInAt: todayChecked ? Date.now() : Date.now() - CHECK_IN_INTERVAL_MS - 1,
    }],
    checkIns: [...new Set(checkIns)],
    hardDays: [addCalendarDays(todayKey, -2)],
  });
}

function keysThroughYesterday(startDate: string, todayKey: string): string[] {
  const days = Math.max(0, differenceInCalendarDays(startDate, todayKey));
  return Array.from({ length: days }, (_, index) => addCalendarDays(startDate, index));
}

export function getCounters(state: AppState): RecoverySegment[] {
  const activeCounters = state.recoverySegments.filter((segment) => !segment.endDate);
  return activeCounters.length ? activeCounters : state.recoverySegments;
}

export function getActiveCounter(state: AppState): RecoverySegment | undefined {
  if (state.activeCounterId) {
    const requested = state.recoverySegments.find((segment) => segment.id === state.activeCounterId);
    if (requested) return requested;
  }
  return getCounters(state).at(-1);
}

export function withActiveCounter(state: AppState, counterId: string): AppState {
  if (!state.recoverySegments.some((segment) => segment.id === counterId)) return normalizeAppState(state);
  return normalizeAppState({ ...state, activeCounterId: counterId });
}

export function updateActiveCounter(
  state: AppState,
  updates: Partial<Pick<RecoverySegment, "substance" | "dailySpend" | "motivation">>,
): AppState {
  const activeCounter = getActiveCounter(state);
  if (!activeCounter) return normalizeAppState(state);
  return normalizeAppState({
    ...state,
    recoverySegments: state.recoverySegments.map((segment) => (
      segment.id === activeCounter.id ? { ...segment, ...updates } : segment
    )),
  });
}

export type CheckInResult = {
  state: AppState;
  recorded: boolean;
  reason: "recorded" | "already-checked" | "cooldown" | "clock-tampered" | "no-counter";
};

export function recordActiveCheckIn(state: AppState, todayKey: string, nowMs = Date.now()): CheckInResult {
  const normalized = normalizeAppState(state);
  const activeCounter = getActiveCounter(normalized);
  if (!activeCounter) return { state: normalized, recorded: false, reason: "no-counter" };

  const eligibility = getCheckInEligibility(activeCounter, todayKey, nowMs);
  if (eligibility.todayChecked) return { state: normalized, recorded: false, reason: "already-checked" };
  if (eligibility.clockTampered) return { state: normalized, recorded: false, reason: "clock-tampered" };
  if (!eligibility.canCheckIn) return { state: normalized, recorded: false, reason: "cooldown" };

  const next = normalizeAppState({
    ...normalized,
    recoverySegments: normalized.recoverySegments.map((segment) => (
      segment.id === activeCounter.id
        ? { ...segment, checkIns: [...new Set([...(segment.checkIns ?? []), todayKey])], lastCheckInAt: nowMs }
        : segment
    )),
  });
  return { state: next, recorded: true, reason: "recorded" };
}

export type CheckInEligibility = {
  canCheckIn: boolean;
  todayChecked: boolean;
  checkInRemainingMs: number;
  lastCheckInAt: number | null;
  clockTampered: boolean;
};

export function getCheckInEligibility(counter: RecoverySegment | undefined, todayKey: string, nowMs = Date.now()): CheckInEligibility {
  const checkIns = counter?.checkIns ?? [];
  const todayChecked = checkIns.includes(todayKey);
  const lastCheckInAt = typeof counter?.lastCheckInAt === "number" && Number.isFinite(counter.lastCheckInAt)
    ? counter.lastCheckInAt
    : null;
  const clockTampered = Boolean(lastCheckInAt !== null && nowMs < lastCheckInAt);
  const elapsed = lastCheckInAt === null ? CHECK_IN_INTERVAL_MS : nowMs - lastCheckInAt;
  const checkInRemainingMs = todayChecked || clockTampered
    ? 0
    : Math.max(0, CHECK_IN_INTERVAL_MS - elapsed);

  return {
    canCheckIn: !todayChecked && !clockTampered && elapsed >= CHECK_IN_INTERVAL_MS,
    todayChecked,
    checkInRemainingMs,
    lastCheckInAt,
    clockTampered,
  };
}

export function calculateCurrentStreak(checkIns: string[], todayKey: string): number {
  const checkInSet = new Set(checkIns);
  let cursor = checkInSet.has(todayKey) ? todayKey : addCalendarDays(todayKey, -1);
  let streak = 0;

  while (checkInSet.has(cursor)) {
    streak += 1;
    cursor = addCalendarDays(cursor, -1);
  }

  return streak;
}

export function calculateBestStreak(checkIns: string[]): number {
  const uniqueDays = [...new Set(checkIns)].sort();
  let best = 0;
  let current = 0;
  let previous = "";

  for (const key of uniqueDays) {
    if (previous && differenceInCalendarDays(previous, key) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    previous = key;
  }

  return best;
}

export function calculateCleanRate30(checkIns: string[], todayKey: string): number {
  const checkInSet = new Set(checkIns);
  let cleanDays = 0;
  for (let index = 0; index < 30; index += 1) {
    if (checkInSet.has(addCalendarDays(todayKey, -index))) cleanDays += 1;
  }
  return Math.round((cleanDays / 30) * 100);
}

function levelForDays(days: number): number {
  const thresholds = [1, 3, 7, 14, 30, 60, 90, 180, 270, 365];
  return thresholds.reduce((level, threshold, index) => days >= threshold ? index + 1 : level, 0);
}

function calculateMetricsForCounter(counter: RecoverySegment | undefined, fallbackUser: UserSettings, todayKey: string, nowMs: number): AppMetrics {
  const activeCheckIns = counter?.checkIns ?? [];
  const currentStreak = calculateCurrentStreak(activeCheckIns, todayKey);
  const bestStreak = calculateBestStreak(activeCheckIns);
  const totalCleanDays = new Set(activeCheckIns).size;
  const eligibility = getCheckInEligibility(counter, todayKey, nowMs);
  const level = Math.max(1, levelForDays(currentStreak));
  const levelThresholds = [0, 1, 3, 7, 14, 30, 60, 90, 180, 270, 365];
  const levelStart = levelThresholds[Math.min(level - 1, levelThresholds.length - 1)] ?? 0;
  const levelEnd = levelThresholds[Math.min(level, levelThresholds.length - 1)] ?? 365;
  const xp = totalCleanDays * 100;
  const xpInLevel = level === 10 ? Math.min(xp, 1000) : xp % 1000;
  const previousMilestone = [...MILESTONES].reverse().find((milestone) => milestone <= currentStreak) ?? 0;
  const nextMilestone = MILESTONES.find((milestone) => milestone > currentStreak) ?? 365;
  const milestoneSpan = Math.max(1, nextMilestone - previousMilestone);
  const milestoneProgress = Math.min(100, Math.max(0, ((currentStreak - previousMilestone) / milestoneSpan) * 100));
  const dailySpend = counter && hasOwn(counter as UnknownRecord, "dailySpend") ? counter.dailySpend ?? null : fallbackUser.dailySpend;

  return {
    currentStreak,
    bestStreak,
    totalCleanDays,
    cleanRate30: calculateCleanRate30(activeCheckIns, todayKey),
    moneySaved: Math.round((dailySpend ?? 0) * totalCleanDays),
    hoursClean: currentStreak * 24,
    level,
    levelStart,
    levelEnd,
    xp,
    xpInLevel,
    xpProgress: Math.min(100, Math.max(0, (xpInLevel / 1000) * 100)),
    nextMilestone,
    previousMilestone,
    milestoneProgress,
    daysToMilestone: Math.max(0, nextMilestone - currentStreak),
    todayChecked: eligibility.todayChecked,
    canCheckIn: eligibility.canCheckIn,
    checkInRemainingMs: eligibility.checkInRemainingMs,
    lastCheckInAt: eligibility.lastCheckInAt,
    clockTampered: eligibility.clockTampered,
    isMilestone: MILESTONES.includes(currentStreak),
  };
}

export function calculateCounterMetrics(counter: RecoverySegment, todayKey: string, nowMs = Date.now()): AppMetrics {
  return calculateMetricsForCounter(counter, {
    ...EMPTY_APP_STATE.user,
    substance: counter.substance,
    cleanStartDate: counter.startDate,
    dailySpend: counter.dailySpend ?? null,
    motivation: counter.motivation ?? "",
  }, todayKey, nowMs);
}

export function calculateMetrics(state: AppState, todayKey: string, nowMs = Date.now()): AppMetrics {
  const activeCounter = getActiveCounter(state);
  return calculateMetricsForCounter(activeCounter, state.user, todayKey, nowMs);
}

export function currency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function dayLabel(value: number): string {
  return `${value} ${value === 1 ? "Tag" : "Tage"}`;
}
