"use client";

import { CalendarDays, Check, ChevronRight, CircleHelp, Cloud, Headphones, History, LockKeyhole, Palette, RotateCcw, Settings2, Smartphone, Sparkles, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { NotificationSettings } from "./notification-settings";
import { formatDate } from "../lib/date";
import { getActiveCounter, SUBSTANCES, dayLabel } from "../lib/recovery";
import type { AppMetrics, AppState, UserSettings } from "../lib/recovery";
import type { PushPermission, PushPreferences } from "../lib/push";

export type DemoPreset = "fresh" | "tag-1" | "tag-6" | "tag-7" | "tag-13" | "tag-29" | "tag-89" | "already-checked" | "cooldown" | "new-segment" | "sound-test";
export type ProfileEditField = "substance" | "dailySpend" | "motivation";
export type ProfileUpdates = Partial<Pick<UserSettings, "substance" | "dailySpend" | "motivation">>;

const fieldTitles: Record<ProfileEditField, string> = {
  substance: "Substanz bearbeiten",
  dailySpend: "Tageskosten bearbeiten",
  motivation: "Dein Warum bearbeiten",
};

type ProfileScreenProps = {
  state: AppState;
  metrics: AppMetrics;
  soundEnabled: boolean;
  isDev: boolean;
  cloudConfigured: boolean;
  authUserId: string | null;
  pushAvailable: boolean;
  pushPermission: PushPermission;
  pushStandalone: boolean;
  pushPreferences: PushPreferences | null;
  pushBusy: boolean;
  onOpenAuth?: () => void;
  onEnablePush: () => void;
  onTogglePush: (key: "dailyEnabled" | "levelUpEnabled") => void;
  onToggleSound: () => void;
  onUpdateProfile: (updates: ProfileUpdates) => void;
  onNewSegment: () => void;
  onReset: () => void;
  onSignOut?: () => void;
  onSoundTest: (sound: "tap" | "select" | "success" | "milestone" | "timer-start" | "timer-end") => void;
  onDemoPreset: (preset: DemoPreset) => void;
};

export function ProfileScreen({
  state,
  metrics,
  soundEnabled,
  isDev,
  cloudConfigured,
  authUserId,
  pushAvailable,
  pushPermission,
  pushStandalone,
  pushPreferences,
  pushBusy,
  onOpenAuth,
  onEnablePush,
  onTogglePush,
  onToggleSound,
  onUpdateProfile,
  onNewSegment,
  onReset,
  onSignOut,
  onSoundTest,
  onDemoPreset,
}: ProfileScreenProps) {
  const currentSegment = getActiveCounter(state);
  const [editingField, setEditingField] = useState<ProfileEditField | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [editorError, setEditorError] = useState("");

  const openEditor = (field: ProfileEditField) => {
    const currentValue = field === "dailySpend"
      ? state.user.dailySpend === null ? "" : String(state.user.dailySpend).replace(".", ",")
      : state.user[field];
    setEditingField(field);
    setDraftValue(currentValue);
    setEditorError("");
  };

  const closeEditor = () => {
    setEditingField(null);
    setDraftValue("");
    setEditorError("");
  };

  const saveEditor = () => {
    if (!editingField) return;
    const value = draftValue.trim();
    const updates: ProfileUpdates = {};

    if (editingField === "substance") {
      if (!value) {
        setEditorError("Bitte wähle eine Substanz aus.");
        return;
      }
      updates.substance = value;
    }

    if (editingField === "dailySpend") {
      if (!value) {
        updates.dailySpend = null;
      } else {
        const parsedValue = Number(value.replace(",", "."));
        if (!Number.isFinite(parsedValue) || parsedValue < 0) {
          setEditorError("Bitte gib einen gültigen Betrag ein.");
          return;
        }
        updates.dailySpend = Math.round(parsedValue * 100) / 100;
      }
    }

    if (editingField === "motivation") {
      updates.motivation = value;
    }

    onUpdateProfile(updates);
    closeEditor();
  };

  const substanceOptions: readonly string[] = state.user.substance && !SUBSTANCES.some((option) => option === state.user.substance)
    ? [state.user.substance, ...SUBSTANCES]
    : SUBSTANCES;

  return (
    <section className="profile-screen screen-enter" aria-labelledby="profile-heading">
      <div className="section-heading-row profile-heading">
        <div>
          <span className="quiet-kicker">Dein Raum</span>
          <h1 id="profile-heading">Ich</h1>
        </div>
        <div className="heading-orb"><Settings2 size={18} /></div>
      </div>

      <section className="identity-panel">
        <div className="profile-avatar"><span>c</span></div>
        <div><strong>{state.user.substance || "Dein Clean-Weg"}</strong><span>seit {state.user.cleanStartDate ? formatDate(state.user.cleanStartDate) : "heute"}</span></div>
        <span className="profile-streak"><Sparkles size={14} /> {metrics.currentStreak}</span>
      </section>

      <section className="profile-list" aria-label="Deine Angaben">
        <InfoRow label="Substanz" value={state.user.substance || "Noch nicht festgelegt"} icon={<CircleHelp size={17} />} onClick={() => openEditor("substance")} isEditing={editingField === "substance"} />
        <ReadonlyInfoRow label="Clean-Startdatum" value={state.user.cleanStartDate ? formatDate(state.user.cleanStartDate) : "Heute"} icon={<CalendarDays size={17} />} />
        <InfoRow label="Tageskosten" value={formatDailySpend(state.user.dailySpend)} icon={<span className="euro-symbol">€</span>} onClick={() => openEditor("dailySpend")} isEditing={editingField === "dailySpend"} />
      </section>

      <button className={`motivation-card ${!state.user.motivation ? "is-empty" : ""}`} type="button" onClick={() => openEditor("motivation")} aria-label="Dein Warum bearbeiten">
          <span className="panel-kicker">Dein Warum</span>
          <span className="motivation-copy">{state.user.motivation ? `„${state.user.motivation}“` : "Füge einen Satz hinzu, der dir Halt gibt."}</span>
          <span className="motivation-edit"><span>{state.user.motivation ? "Bearbeiten" : "Hinzufügen"}</span><ChevronRight size={15} /></span>
      </button>

      {editingField && (
        <form className="profile-editor" onSubmit={(event) => { event.preventDefault(); saveEditor(); }} aria-labelledby="profile-editor-heading">
          <div className="profile-editor-heading">
            <div>
              <span className="panel-kicker">Einstellung</span>
              <h2 id="profile-editor-heading">{fieldTitles[editingField]}</h2>
            </div>
            <button className="profile-editor-close" type="button" onClick={closeEditor} aria-label="Bearbeitung schließen">×</button>
          </div>

          {editingField === "substance" && (
            <label className="profile-editor-field">
              <span>Womit möchtest du weitergehen?</span>
              <select className="profile-editor-control" value={draftValue} onChange={(event) => { setDraftValue(event.target.value); setEditorError(""); }}>
                <option value="">Bitte auswählen</option>
                {substanceOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          )}

          {editingField === "dailySpend" && (
            <label className="profile-editor-field">
              <span>Ungefähr pro Tag</span>
              <div className="profile-editor-input-wrap">
                <input className="profile-editor-control" type="text" inputMode="decimal" placeholder="0" value={draftValue} onChange={(event) => { setDraftValue(event.target.value.replace(/[^0-9,.]/g, "")); setEditorError(""); }} />
                <b>€</b>
              </div>
              <small>Leer lassen, wenn du diesen Wert nicht verfolgen möchtest.</small>
            </label>
          )}

          {editingField === "motivation" && (
            <label className="profile-editor-field">
              <span>Ein Satz, zu dem du zurückkehren kannst</span>
              <textarea className="profile-editor-control profile-editor-textarea" value={draftValue} onChange={(event) => { setDraftValue(event.target.value); setEditorError(""); }} placeholder="Ich will mein Leben wieder selbst bestimmen." />
              <small className="profile-editor-count">{draftValue.length} Zeichen</small>
            </label>
          )}

          {editorError && <p className="profile-editor-error" role="alert">{editorError}</p>}
          <div className="profile-editor-actions">
            <button className="text-button" type="button" onClick={closeEditor}>Abbrechen</button>
            <button className="primary-button profile-editor-save" type="submit">Speichern <Check size={17} /></button>
          </div>
        </form>
      )}

      {cloudConfigured && !authUserId && onOpenAuth && (
        <button className="cloud-save-card" type="button" onClick={onOpenAuth} aria-label="Fortschritt optional sichern">
          <span className="cloud-save-icon"><Cloud size={18} /></span>
          <span className="cloud-save-copy"><strong>Fortschritt sichern</strong><small>Optional — per E-Mail für ein anderes Gerät</small></span>
          <ChevronRight size={17} />
        </button>
      )}

      {cloudConfigured && authUserId && (
        <div className="cloud-connected-note"><Cloud size={16} /><span><strong>Cloud-Sicherung aktiv</strong><small>Deine lokalen Änderungen werden automatisch synchronisiert, sobald Internet da ist.</small></span></div>
      )}

      <Link className="design-preview-link" href="/designs">
        <span className="design-preview-icon"><Palette size={17} /></span>
        <span><strong>Design-Vorlagen ansehen</strong><small>Vier neue Richtungen für Clear vergleichen</small></span>
        <ChevronRight size={17} />
      </Link>

      <section className="settings-panel" aria-labelledby="settings-heading">
        <div className="panel-heading settings-heading"><div><span className="panel-kicker">Einstellungen</span><h2 id="settings-heading">Sound</h2></div><Headphones size={18} /></div>
        <div className="setting-row">
          <span className="setting-icon">{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</span>
          <span><strong>Soundeffekte</strong><small>{soundEnabled ? "Subtil und an" : "Stummgeschaltet"}</small></span>
          <button className={`switch ${soundEnabled ? "is-on" : ""}`} type="button" role="switch" aria-checked={soundEnabled} aria-label="Soundeffekte umschalten" onClick={onToggleSound}>
            <span />
          </button>
        </div>
      </section>

      <NotificationSettings available={pushAvailable} permission={pushPermission} standalone={pushStandalone} preferences={pushPreferences} busy={pushBusy} onEnable={onEnablePush} onToggle={onTogglePush} />

      <section className="settings-panel actions-panel" aria-labelledby="recovery-heading">
        <div className="panel-heading settings-heading"><div><span className="panel-kicker">Verlauf</span><h2 id="recovery-heading">Clean-Abschnitte</h2></div><History size={18} /></div>
        <div className="segment-current"><span className="segment-status"><Check size={14} /></span><span><strong>Aktueller Clean-Abschnitt</strong><small>{currentSegment ? `seit ${formatDate(currentSegment.startDate)}` : "Beginnt heute"}</small></span><b>{dayLabel(metrics.currentStreak)}</b></div>
        {state.recoverySegments.filter((segment) => Boolean(segment.endDate)).reverse().map((segment) => (
          <div className="segment-history" key={segment.id}><span /><span><strong>Früherer Abschnitt</strong><small>{formatDate(segment.startDate)}{segment.endDate ? ` – ${formatDate(segment.endDate)}` : ""}</small></span></div>
        ))}
        <button className="list-action" type="button" onClick={onNewSegment}><span className="list-action-icon"><RotateCcw size={17} /></span><span><strong>Neuen Clean-Abschnitt starten</strong><small>Deine Historie bleibt erhalten.</small></span><ChevronRight size={17} /></button>
      </section>

      {isDev && (
        <section className="qa-panel" aria-labelledby="qa-heading">
          <div className="panel-heading settings-heading"><div><span className="panel-kicker">Development only</span><h2 id="qa-heading">Demo & Sound-Test</h2></div><Settings2 size={18} /></div>
          <div className="qa-presets">
            {([
              ["fresh", "Fresh User"], ["tag-1", "Tag 1"], ["tag-6", "Tag 6"], ["tag-7", "Tag 7"], ["tag-13", "Tag 13"], ["tag-29", "Tag 29"], ["tag-89", "Tag 89"], ["already-checked", "Heute checked"], ["cooldown", "24h-Sperre"], ["new-segment", "Neuer Abschnitt"], ["sound-test", "Sound-Test"],
            ] as Array<[DemoPreset, string]>).map(([id, label]) => <button type="button" key={id} onClick={() => onDemoPreset(id)}>{label}</button>)}
          </div>
          <div className="sound-test-grid">
            {([
              ["tap", "Tap"], ["select", "Select"], ["success", "Success"], ["milestone", "Milestone"], ["timer-start", "Timer Start"], ["timer-end", "Timer End"],
            ] as Array<["tap" | "select" | "success" | "milestone" | "timer-start" | "timer-end", string]>).map(([id, label]) => <button type="button" key={id} onClick={() => onSoundTest(id)}><Volume2 size={14} />{label}</button>)}
          </div>
        </section>
      )}

      <button className="reset-link" type="button" onClick={onReset}>Lokale Daten zurücksetzen</button>
      {onSignOut && <button className="reset-link" type="button" onClick={onSignOut}>Von diesem Gerät abmelden</button>}
      <div className="install-help"><Smartphone size={17} /><span><strong>Auf dem iPhone offline nutzen</strong><small>Safari → Teilen → „Zum Home-Bildschirm“ hinzufügen. Danach funktioniert Clear auch im Flugmodus.</small></span></div>
      <div className="profile-footer"><span><Headphones size={14} /> Sound jederzeit abschaltbar</span><span>v1 · {authUserId ? "Cloud gesichert" : cloudConfigured ? "nur lokal" : "lokal"}</span></div>
    </section>
  );
}

function InfoRow({ label, value, icon, onClick, isEditing }: { label: string; value: string; icon: ReactNode; onClick: () => void; isEditing: boolean }) {
  return <button className={`info-row ${isEditing ? "is-editing" : ""}`} type="button" onClick={onClick} aria-label={`${label} bearbeiten`}><span className="info-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span><span className="info-row-action"><span>Bearbeiten</span><ChevronRight size={16} /></span></button>;
}

function ReadonlyInfoRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="info-row info-row-readonly"><span className="info-icon">{icon}</span><span><small>{label}</small><strong>{value}</strong></span><span className="info-row-action"><LockKeyhole size={15} /><span>Fest</span></span></div>;
}

function formatDailySpend(value: number | null): string {
  if (value === null) return "Nicht angegeben";
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value)} €`;
}
