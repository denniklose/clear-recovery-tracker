"use client";

import { Bell, BellRing, ChevronRight, Smartphone } from "lucide-react";
import type { PushPermission, PushPreferences } from "../lib/push";

type NotificationSettingsProps = {
  available: boolean;
  permission: PushPermission;
  standalone: boolean;
  preferences: PushPreferences | null;
  busy: boolean;
  onEnable: () => void;
  onToggle: (key: "dailyEnabled" | "levelUpEnabled") => void;
};

export function NotificationSettings({
  available,
  permission,
  standalone,
  preferences,
  busy,
  onEnable,
  onToggle,
}: NotificationSettingsProps) {
  const isSubscribed = Boolean(preferences);

  return (
    <section className="settings-panel notification-settings" aria-labelledby="notification-heading">
      <div className="panel-heading settings-heading">
        <div><span className="panel-kicker">Sanfte Erinnerungen</span><h2 id="notification-heading">Benachrichtigungen</h2></div>
        {isSubscribed ? <BellRing size={18} /> : <Bell size={18} />}
      </div>

      {!available && (
        <div className="notification-status">
          <span className="setting-icon"><Bell size={17} /></span>
          <span><strong>Push ist vorbereitet</strong><small>Nach der einmaligen VAPID-/Supabase-Einrichtung erscheinen hier die kostenlosen Mitteilungen.</small></span>
        </div>
      )}

      {available && !standalone && !isSubscribed && (
        <div className="notification-hint"><Smartphone size={16} /><span>Füge Clear zuerst über Safari → Teilen → „Zum Home-Bildschirm“ hinzu. Nur die installierte iPhone-PWA kann Push anfordern.</span></div>
      )}

      {available && permission === "denied" && (
        <div className="notification-hint is-warning"><Bell size={16} /><span>Push ist blockiert. Erlaube Mitteilungen in den iPhone-Einstellungen und öffne Clear danach erneut.</span></div>
      )}

      {available && !isSubscribed && permission !== "denied" && (
        <button className="notification-enable" type="button" onClick={onEnable} disabled={busy || !standalone}>
          <span><BellRing size={17} /><strong>{busy ? "Wird eingerichtet …" : "Push aktivieren"}</strong><small>Einmal antippen — ohne Login</small></span>
          <ChevronRight size={17} />
        </button>
      )}

      {available && isSubscribed && preferences && (
        <div className="notification-options">
          <NotificationToggle label="Täglicher Satz" description="Ein ruhiger Impuls um 18:00 Uhr" enabled={preferences.dailyEnabled} disabled={busy} onClick={() => onToggle("dailyEnabled")} />
          <NotificationToggle label="Level-up" description="Nach jedem echten 24-Stunden-Check-in" enabled={preferences.levelUpEnabled} disabled={busy} onClick={() => onToggle("levelUpEnabled")} />
        </div>
      )}
    </section>
  );
}

function NotificationToggle({
  label,
  description,
  enabled,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="notification-option">
      <span className="setting-icon">{enabled ? <BellRing size={17} /> : <Bell size={17} />}</span>
      <span><strong>{label}</strong><small>{description}</small></span>
      <button className={`switch ${enabled ? "is-on" : ""}`} type="button" role="switch" aria-checked={enabled} aria-label={`${label} umschalten`} onClick={onClick} disabled={disabled}><span /></button>
    </div>
  );
}
