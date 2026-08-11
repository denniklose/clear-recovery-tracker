"use client";

import { Check, CircleUserRound, HeartHandshake } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuthGate } from "../components/auth-gate";
import { BottomNav } from "../components/bottom-nav";
import { CountersScreen } from "../components/counters-screen";
import { Onboarding, type OnboardingData } from "../components/onboarding";
import { ProfileScreen, type DemoPreset, type ProfileUpdates } from "../components/profile-screen";
import { ProgressScreen } from "../components/progress-screen";
import { PwaRegister } from "../components/pwa-register";
import { RescueScreen } from "../components/rescue-screen";
import { SyncConflictDialog } from "../components/sync-conflict";
import { SyncStatus, type SyncStatusValue } from "../components/sync-status";
import { TodayScreen } from "../components/today-screen";
import { addCalendarDays, todayLocalKey } from "../lib/date";
import { clearCachedState, loadCachedState, saveCachedState } from "../lib/indexed-db";
import { resolveSyncConflict, syncAfterLocalWrite, syncStateForUser, type SyncDecision } from "../lib/cloud-sync";
import { flushPushEvents, getPushPermission, isPushAvailable, isStandalonePwa, loadStoredPushPreferences, queueLevelUpPush, subscribeToPush, updatePushPreferences, type PushPermission, type PushPreferences } from "../lib/push";
import { soundManager } from "../lib/sound";
import { clearAppState, loadAppState } from "../lib/storage";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabase";
import {
  AppState,
  AppTab,
  calculateMetrics,
  createDemoState,
  createSegmentId,
  createStartedState,
  EMPTY_APP_STATE,
  getActiveCounter,
  MILESTONES,
  normalizeAppState,
  recordActiveCheckIn,
  updateActiveCounter,
  withActiveCounter,
} from "../lib/recovery";

type SyncConflictState = {
  remoteState: AppState;
  localState: AppState;
};

export default function HomePage() {
  const cloudConfigured = isSupabaseConfigured();
  const [state, setState] = useState<AppState>(EMPTY_APP_STATE);
  const [storageReady, setStorageReady] = useState(false);
  const [authReady, setAuthReady] = useState(!cloudConfigured);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [todayKey, setTodayKey] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [rescueOpen, setRescueOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [milestone, setMilestone] = useState<number | null>(null);
  const [toast, setToast] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatusValue>(cloudConfigured ? "loading" : "local");
  const [syncConflict, setSyncConflict] = useState<SyncConflictState | null>(null);
  const [syncConflictBusy, setSyncConflictBusy] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermission>("unsupported");
  const [pushStandalone, setPushStandalone] = useState(false);
  const [pushPreferences, setPushPreferences] = useState<PushPreferences | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const screenScrollRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  const initialCacheRef = useRef<AppState>(EMPTY_APP_STATE);
  const cacheOwnerRef = useRef<string | null>(null);

  const isDev = process.env.NODE_ENV !== "production";
  const currentTodayKey = todayKey || todayLocalKey();
  const currentNowMs = nowMs || 1;
  const metrics = useMemo(() => calculateMetrics(state, currentTodayKey, currentNowMs), [currentNowMs, currentTodayKey, state]);

  const applySyncResult = useCallback((result: Awaited<ReturnType<typeof syncStateForUser>>, ownerId: string) => {
    if (result.source === "conflict" && result.remoteState && result.localState) {
      const localState = normalizeAppState(result.localState);
      const remoteState = normalizeAppState(result.remoteState);
      stateRef.current = localState;
      initialCacheRef.current = localState;
      cacheOwnerRef.current = ownerId;
      setNowMs(Date.now());
      setState(localState);
      setSyncConflict({ remoteState, localState });
      void saveCachedState(localState, ownerId);
      setSyncStatus("pending");
      return false;
    }

    stateRef.current = result.state;
    initialCacheRef.current = result.state;
    cacheOwnerRef.current = ownerId;
    setNowMs(Date.now());
    setState(result.state);
    void saveCachedState(result.state, ownerId);
    return true;
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const updateClock = () => {
      setTodayKey(todayLocalKey());
      setNowMs(Date.now());
    };
    updateClock();
    const timer = window.setInterval(updateClock, 30_000);
    window.addEventListener("focus", updateClock);
    document.addEventListener("visibilitychange", updateClock);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", updateClock);
      document.removeEventListener("visibilitychange", updateClock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshPushState = () => {
      setPushAvailable(isPushAvailable());
      setPushPermission(getPushPermission());
      setPushStandalone(isStandalonePwa());
      void flushPushEvents();
    };

    void loadStoredPushPreferences().then((preferences) => {
      if (!cancelled) setPushPreferences(preferences);
    });
    refreshPushState();
    window.addEventListener("online", refreshPushState);
    window.addEventListener("focus", refreshPushState);
    document.addEventListener("visibilitychange", refreshPushState);
    return () => {
      cancelled = true;
      window.removeEventListener("online", refreshPushState);
      window.removeEventListener("focus", refreshPushState);
      document.removeEventListener("visibilitychange", refreshPushState);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrapStorage = async () => {
      const cached = await loadCachedState();
      if (cancelled) return;

      const legacy = loadAppState();
      const initialState = cached?.state ?? legacy;
      const visibleState = cloudConfigured && cached?.ownerId ? EMPTY_APP_STATE : initialState;
      initialCacheRef.current = initialState;
      cacheOwnerRef.current = cached?.ownerId ?? null;
      stateRef.current = visibleState;
      setTodayKey(todayLocalKey());
      setState(visibleState);
      soundManager.setEnabled(visibleState.user.soundEnabled);

      if (!cached && initialState.user.onboardingCompleted) {
        await saveCachedState(initialState, null);
      }
      setStorageReady(true);
    };

    void bootstrapStorage();
    return () => {
      cancelled = true;
    };
  }, [cloudConfigured]);

  useEffect(() => {
    if (!cloudConfigured) {
      return;
    }

    const client = getSupabaseClient();
    if (!client) {
      const timer = window.setTimeout(() => {
        setAuthReady(true);
        setSyncStatus("error");
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setAuthUserId(data.session?.user.id ?? null);
      setAuthReady(true);
      setHydrated(false);
    }).catch(() => {
      if (cancelled) return;
      setAuthReady(true);
      setSyncStatus("error");
      setHydrated(true);
    });

    const { data: authListener } = client.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user.id ?? null);
      setHydrated(Boolean(!session));
      if (!session) {
        setSyncStatus("local");
        setSyncConflict(null);
        if (cacheOwnerRef.current) {
          stateRef.current = EMPTY_APP_STATE;
          setState(EMPTY_APP_STATE);
        }
      } else {
        setAuthOpen(false);
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [cloudConfigured]);

  useEffect(() => {
    if (!storageReady || !authReady) return;
    if (!cloudConfigured || !authUserId) {
      const timer = window.setTimeout(() => {
        setSyncStatus("local");
        setHydrated(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    let cancelled = false;
    const seedState = cacheOwnerRef.current === authUserId
      ? initialCacheRef.current
      : cacheOwnerRef.current === null
        ? stateRef.current
        : EMPTY_APP_STATE;

    void syncStateForUser(authUserId, seedState).then((result) => {
      if (cancelled) return;
      const applied = applySyncResult(result, authUserId);
      if (applied) setSyncStatus(result.synced ? "synced" : "pending");
    }).catch(() => {
      if (cancelled) return;
      setSyncStatus(navigator.onLine ? "error" : "offline");
    }).finally(() => {
      if (!cancelled) setHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [applySyncResult, authReady, authUserId, cloudConfigured, storageReady]);

  useEffect(() => {
    soundManager.setEnabled(state.user.soundEnabled);
  }, [state.user.soundEnabled]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    screenScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeTab, rescueOpen]);

  useEffect(() => {
    if (!cloudConfigured || !authUserId) return;

    const syncOnReturn = () => {
      if (!navigator.onLine) {
        setSyncStatus("offline");
        return;
      }

      setSyncStatus("loading");
      void syncStateForUser(authUserId, stateRef.current, "write").then((result) => {
        const applied = applySyncResult(result, authUserId);
        if (applied) setSyncStatus(result.synced ? "synced" : "pending");
      }).catch(() => setSyncStatus("pending"));
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncOnReturn();
    };

    window.addEventListener("online", syncOnReturn);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", syncOnReturn);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [applySyncResult, authUserId, cloudConfigured]);

  const setLocalState = useCallback((next: AppState) => {
    const normalized = normalizeAppState(next);
    stateRef.current = normalized;
    initialCacheRef.current = normalized;
    cacheOwnerRef.current = authUserId;
    setNowMs(Date.now());
    setState(normalized);
    void saveCachedState(normalized, authUserId);
  }, [authUserId]);

  const commitState = useCallback((next: AppState) => {
    const normalized = normalizeAppState(next);
    stateRef.current = normalized;
    initialCacheRef.current = normalized;
    cacheOwnerRef.current = authUserId;
    setNowMs(Date.now());
    setState(normalized);
    void saveCachedState(normalized, authUserId);

    if (!cloudConfigured || !authUserId) {
      setSyncStatus("local");
      return;
    }

    setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "loading" : "offline");
    void syncAfterLocalWrite(authUserId, normalized).then((result) => {
      const applied = applySyncResult(result, authUserId);
      if (!applied) return;
      if (result.synced) {
        setSyncStatus("synced");
        return;
      }
      setSyncStatus(typeof navigator !== "undefined" && navigator.onLine ? "pending" : "offline");
    }).catch(() => setSyncStatus("pending"));
  }, [applySyncResult, authUserId, cloudConfigured]);

  const handleTabChange = useCallback((tab: AppTab) => {
    soundManager.playTap();
    setRescueOpen(false);
    setActiveTab(tab);
  }, []);

  const handleOnboardingTap = useCallback(() => soundManager.playTap(), []);
  const handleOnboardingSelect = useCallback(() => soundManager.playSelect(), []);

  const handleOpenAuth = useCallback(() => {
    soundManager.playTap();
    setRescueOpen(false);
    setAuthOpen(true);
  }, []);

  const handleEnablePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const preferences = await subscribeToPush();
      setPushPreferences(preferences);
      setPushPermission("granted");
      setToast("Push ist aktiv. Du bekommst nur die gewählten, ruhigen Hinweise.");
    } catch (error) {
      setPushPermission(getPushPermission());
      setToast(error instanceof Error ? error.message : "Push konnte nicht aktiviert werden.");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy]);

  const handleTogglePush = useCallback(async (key: "dailyEnabled" | "levelUpEnabled") => {
    if (pushBusy || !pushPreferences) return;
    setPushBusy(true);
    const enabled = !pushPreferences[key];
    try {
      const result = await updatePushPreferences({ [key]: enabled });
      setPushPreferences(result.preferences);
      setToast(result.synced ? "Benachrichtigungseinstellung gespeichert." : "Lokal gespeichert — wird bei Internet synchronisiert.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Die Einstellung konnte nicht gespeichert werden.");
    } finally {
      setPushBusy(false);
    }
  }, [pushBusy, pushPreferences]);

  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    const next = createStartedState(data, currentTodayKey);
    soundManager.playTap();
    commitState(next);
    setActiveTab("today");
    setToast("Dein Weg beginnt heute.");
  }, [commitState, currentTodayKey]);

  const handleCheckIn = useCallback(() => {
    if (checkingIn || !metrics.canCheckIn) {
      if (metrics.clockTampered) setToast("Bitte stelle die Gerätezeit automatisch ein.");
      return;
    }
    soundManager.playTap();
    setCheckingIn(true);

    window.setTimeout(() => {
      const current = stateRef.current;
      const checkInNow = Date.now();
      const result = recordActiveCheckIn(current, currentTodayKey, checkInNow);
      if (!result.recorded) {
        setCheckingIn(false);
        setToast(result.reason === "clock-tampered" ? "Bitte stelle die Gerätezeit automatisch ein." : "Dieses Level-up ist noch nicht freigeschaltet.");
        return;
      }
      setNowMs(checkInNow);
      const nextMetrics = calculateMetrics(result.state, currentTodayKey, checkInNow);
      const nextStreak = nextMetrics.currentStreak;
      commitState(result.state);
      setCheckingIn(false);
      setSuccessMessage(`Tag ${nextStreak} gehört dir.`);
      soundManager.playSuccess();
      const reachedMilestone = MILESTONES.includes(nextStreak);
      void queueLevelUpPush({
        counterId: getActiveCounter(result.state)?.id ?? "active",
        dateKey: currentTodayKey,
        streak: nextStreak,
        milestone: reachedMilestone,
      });
      if (reachedMilestone) {
        setMilestone(nextStreak);
        soundManager.playMilestone();
      }
      window.setTimeout(() => {
        setSuccessMessage("");
        setMilestone(null);
      }, 2600);
    }, 560);
  }, [checkingIn, commitState, currentTodayKey, metrics.canCheckIn, metrics.clockTampered]);

  const handleHardDay = useCallback(() => {
    soundManager.playTap();
    const current = stateRef.current;
    const activeCounter = getActiveCounter(current);
    if (!activeCounter) return;
    const activeHardDays = activeCounter.hardDays ?? [];
    const alreadyMarked = activeHardDays.includes(currentTodayKey);
    commitState({
      ...current,
      recoverySegments: current.recoverySegments.map((segment) => segment.id === activeCounter.id
        ? {
            ...segment,
            hardDays: alreadyMarked
              ? activeHardDays.filter((day) => day !== currentTodayKey)
              : [...new Set([...activeHardDays, currentTodayKey])],
          }
        : segment),
    });
    setToast(alreadyMarked ? "Die Markierung für heute wurde entfernt." : "Heute war schwer — und du bist trotzdem hier.");
  }, [commitState, currentTodayKey]);

  const handleEmergency = useCallback(() => {
    soundManager.playTap();
    setRescueOpen(true);
  }, []);

  const handleTimerStart = useCallback(() => soundManager.playTimerStart(), []);
  const handleTimerEnd = useCallback(() => {
    soundManager.playTimerEnd();
    setToast("Die 10 Minuten sind geschafft.");
  }, []);

  const handleToggleSound = useCallback(() => {
    const nextEnabled = !stateRef.current.user.soundEnabled;
    commitState({ ...stateRef.current, user: { ...stateRef.current.user, soundEnabled: nextEnabled } });
    soundManager.setEnabled(nextEnabled);
    if (nextEnabled) soundManager.playToggle();
    setToast(nextEnabled ? "Soundeffekte sind an." : "Soundeffekte sind aus.");
  }, [commitState]);

  const handleUpdateProfile = useCallback((updates: ProfileUpdates) => {
    const current = stateRef.current;
    commitState(updateActiveCounter(current, {
      ...(updates.substance !== undefined ? { substance: updates.substance } : {}),
      ...(updates.dailySpend !== undefined ? { dailySpend: updates.dailySpend } : {}),
      ...(updates.motivation !== undefined ? { motivation: updates.motivation } : {}),
    }));
    setToast("Einstellungen gespeichert.");
  }, [commitState]);

  const handleNewSegment = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("Neuen Clean-Abschnitt starten? Deine bisherige Historie bleibt erhalten.")) return;
    const current = stateRef.current;
    const currentSegment = getActiveCounter(current);
    const nextSegment = {
      id: createSegmentId(),
      substance: current.user.substance,
      startDate: currentTodayKey,
      dailySpend: current.user.dailySpend,
      motivation: current.user.motivation,
      checkIns: [],
      hardDays: [],
      lastCheckInAt: null,
    };
    commitState(normalizeAppState({
      ...current,
      recoverySegments: currentSegment
        ? [...current.recoverySegments.map((segment) => segment.id === currentSegment.id ? { ...segment, endDate: addCalendarDays(currentTodayKey, -1) } : segment), nextSegment]
        : [nextSegment],
      activeCounterId: nextSegment.id,
    }));
    setToast("Neuer Clean-Abschnitt gestartet.");
    setActiveTab("today");
  }, [commitState, currentTodayKey]);

  const handleSelectCounter = useCallback((counterId: string) => {
    const current = stateRef.current;
    const counter = current.recoverySegments.find((segment) => segment.id === counterId);
    if (!counter) return;
    soundManager.playSelect();
    commitState(withActiveCounter(current, counterId));
    setActiveTab("today");
    setToast(`Counter für ${counter.substance} ist jetzt aktiv.`);
  }, [commitState]);

  const handleReset = useCallback(async () => {
    if (typeof window !== "undefined" && !window.confirm("Den lokalen Cache auf diesem Gerät löschen? Deine Cloud-Daten bleiben erhalten.")) return;
    await clearCachedState();
    clearAppState();
    stateRef.current = EMPTY_APP_STATE;
    initialCacheRef.current = EMPTY_APP_STATE;
    cacheOwnerRef.current = authUserId;
    setState(EMPTY_APP_STATE);
    setActiveTab("today");
    setRescueOpen(false);
    setSyncConflict(null);

    if (cloudConfigured && authUserId && navigator.onLine) {
      setSyncStatus("loading");
      try {
        const result = await syncStateForUser(authUserId, EMPTY_APP_STATE);
        const applied = applySyncResult(result, authUserId);
        if (applied) setSyncStatus("synced");
        setToast("Lokaler Cache gelöscht und aus der Cloud neu aufgebaut.");
      } catch {
        setSyncStatus("error");
        setToast("Der Cache ist gelöscht. Die Cloud wird beim nächsten Online-Sync geladen.");
      }
      return;
    }

    setSyncStatus(cloudConfigured ? "offline" : "local");
    setToast(cloudConfigured ? "Lokaler Cache gelöscht. Beim nächsten Login wird die Cloud geladen." : "Lokale Daten gelöscht.");
  }, [applySyncResult, authUserId, cloudConfigured]);

  const handleSignOut = useCallback(async () => {
    const client = getSupabaseClient();
    if (client) await client.auth.signOut();
    await clearCachedState();
    clearAppState();
    stateRef.current = EMPTY_APP_STATE;
    initialCacheRef.current = EMPTY_APP_STATE;
    cacheOwnerRef.current = null;
    setState(EMPTY_APP_STATE);
    setAuthUserId(null);
    setAuthOpen(false);
    setSyncConflict(null);
    setSyncStatus("local");
    setToast("");
  }, []);

  const handleResolveSyncConflict = useCallback(async (decision: SyncDecision) => {
    if (!authUserId || !syncConflict || syncConflictBusy) return;

    setSyncConflictBusy(true);
    setSyncStatus("loading");
    try {
      const result = await resolveSyncConflict(authUserId, syncConflict.remoteState, syncConflict.localState, decision);
      setSyncConflict(null);
      applySyncResult(result, authUserId);
      setSyncStatus("synced");
      setToast(decision === "cloud" ? "Der Cloud-Fortschritt ist jetzt auf diesem Gerät aktiv." : "Der Fortschritt dieses Geräts ist jetzt gesichert.");
    } catch {
      setSyncStatus("error");
      setToast("Die Auswahl konnte nicht synchronisiert werden. Versuche es erneut.");
    } finally {
      setSyncConflictBusy(false);
    }
  }, [applySyncResult, authUserId, syncConflict, syncConflictBusy]);

  const handleSoundTest = useCallback((sound: "tap" | "select" | "success" | "milestone" | "timer-start" | "timer-end") => {
    const methods = {
      tap: soundManager.playTap,
      select: soundManager.playSelect,
      success: soundManager.playSuccess,
      milestone: soundManager.playMilestone,
      "timer-start": soundManager.playTimerStart,
      "timer-end": soundManager.playTimerEnd,
    };
    methods[sound]();
  }, []);

  const handleDemoPreset = useCallback((preset: DemoPreset) => {
    if (preset === "fresh") {
      setLocalState(EMPTY_APP_STATE);
      setActiveTab("today");
      setRescueOpen(false);
      return;
    }
    if (preset === "sound-test") {
      setLocalState(createDemoState(1, currentTodayKey));
      setActiveTab("profile");
      setRescueOpen(false);
      return;
    }
    if (preset === "cooldown") {
      const demo = createDemoState(1, currentTodayKey);
      const lastCheckInAt = Date.now();
      demo.recoverySegments = demo.recoverySegments.map((segment) => ({ ...segment, lastCheckInAt }));
      setLocalState(demo);
      setActiveTab("today");
      setRescueOpen(false);
      return;
    }
    if (preset === "new-segment") {
      const demo = createDemoState(4, currentTodayKey);
      demo.recoverySegments = [
        { id: "demo-old", substance: "Alkohol", startDate: addCalendarDays(currentTodayKey, -22), endDate: addCalendarDays(currentTodayKey, -10) },
        { ...demo.recoverySegments[0], startDate: addCalendarDays(currentTodayKey, -4) },
      ];
      demo.user.cleanStartDate = addCalendarDays(currentTodayKey, -4);
      setLocalState(demo);
      setActiveTab("profile");
      return;
    }
    const tagMatch = preset.match(/^tag-(\d+)$/);
    const days = tagMatch ? Number(tagMatch[1]) : 7;
    setLocalState(createDemoState(days, currentTodayKey, preset === "already-checked"));
    setActiveTab("today");
    setRescueOpen(false);
    setSuccessMessage("");
    setMilestone(null);
  }, [currentTodayKey, setLocalState]);

  if (!hydrated) {
    return <><PwaRegister /><div className="loading-screen"><span className="loading-mark"><span /></span><span>clear</span></div></>;
  }

  if (authOpen && cloudConfigured && !authUserId) {
    return <><PwaRegister /><AuthGate onBack={() => setAuthOpen(false)} /></>;
  }

  if (!state.user.onboardingCompleted) {
    return <><PwaRegister /><Onboarding cloudEnabled={cloudConfigured} onComplete={handleOnboardingComplete} onTap={handleOnboardingTap} onSelect={handleOnboardingSelect} /></>;
  }

  const screenTitle = rescueOpen ? "Sofort-Modus" : activeTab === "today" ? "Heute" : activeTab === "progress" ? "Fortschritt" : activeTab === "counters" ? "Counter" : "Ich";

  return (
    <>
      <PwaRegister />
      <main className="app-viewport">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />
        <div className="app-shell">
          <header className="app-topbar">
            <div className="brand-lockup" aria-label="Clear"><span className="brand-mark"><span /></span><span>clear</span></div>
            <div className="topbar-center"><span>{screenTitle}</span><SyncStatus status={syncStatus} /></div>
            <button className="profile-button" type="button" aria-label="Zu deinem Profil" onClick={() => handleTabChange("profile")}><CircleUserRound size={21} /></button>
          </header>

          <div className="screen-scroll" ref={screenScrollRef}>
            {rescueOpen ? (
              <RescueScreen onBack={() => { soundManager.playTap(); setRescueOpen(false); }} onTimerStart={handleTimerStart} onTimerEnd={handleTimerEnd} />
            ) : activeTab === "today" ? (
              <TodayScreen metrics={metrics} substance={state.user.substance} checkingIn={checkingIn} isHardDay={state.hardDays.includes(currentTodayKey)} successMessage={successMessage} milestone={milestone} onCheckIn={handleCheckIn} onHardDay={handleHardDay} onEmergency={handleEmergency} />
            ) : activeTab === "progress" ? (
              <ProgressScreen state={state} metrics={metrics} todayKey={currentTodayKey} cloudConfigured={cloudConfigured} isAuthenticated={Boolean(authUserId)} />
            ) : activeTab === "counters" ? (
              <CountersScreen state={state} todayKey={currentTodayKey} nowMs={currentNowMs} onSelectCounter={handleSelectCounter} />
            ) : (
              <ProfileScreen state={state} metrics={metrics} soundEnabled={state.user.soundEnabled} isDev={isDev} cloudConfigured={cloudConfigured} authUserId={authUserId} pushAvailable={pushAvailable} pushPermission={pushPermission} pushStandalone={pushStandalone} pushPreferences={pushPreferences} pushBusy={pushBusy} onOpenAuth={cloudConfigured && !authUserId ? handleOpenAuth : undefined} onEnablePush={() => void handleEnablePush()} onTogglePush={(key) => void handleTogglePush(key)} onToggleSound={handleToggleSound} onUpdateProfile={handleUpdateProfile} onNewSegment={handleNewSegment} onReset={handleReset} onSignOut={authUserId ? handleSignOut : undefined} onSoundTest={handleSoundTest} onDemoPreset={handleDemoPreset} />
            )}
          </div>

          {!rescueOpen && <BottomNav activeTab={activeTab} onChange={handleTabChange} />}
          {toast && <div className="app-toast" role="status"><span><Check size={14} /></span>{toast}</div>}
          <div className="app-privacy"><HeartHandshake size={13} /> Ein ruhiger Ort, nur für dich.</div>
        </div>
      </main>
      {syncConflict && authUserId && <SyncConflictDialog busy={syncConflictBusy} onUseCloud={() => void handleResolveSyncConflict("cloud")} onKeepLocal={() => void handleResolveSyncConflict("local")} />}
    </>
  );
}
