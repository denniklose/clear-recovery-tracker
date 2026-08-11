import { Check, Cloud, Flame, LockKeyhole, ShieldAlert, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { dayLabel } from "../lib/recovery";
import type { AppMetrics } from "../lib/recovery";

type TodayScreenProps = {
  metrics: AppMetrics;
  substance: string;
  checkingIn: boolean;
  isHardDay: boolean;
  successMessage: string;
  milestone: number | null;
  onCheckIn: () => void;
  onHardDay: () => void;
  onEmergency: () => void;
};

export function TodayScreen({
  metrics,
  substance,
  checkingIn,
  isHardDay,
  successMessage,
  milestone,
  onCheckIn,
  onHardDay,
  onEmergency,
}: TodayScreenProps) {
  const [displayStreak, setDisplayStreak] = useState(metrics.currentStreak);
  useEffect(() => {
    if (metrics.currentStreak === displayStreak) return;
    const direction = metrics.currentStreak > displayStreak ? 1 : -1;
    const timer = window.setInterval(() => {
      setDisplayStreak((current) => {
        if (current === metrics.currentStreak) {
          window.clearInterval(timer);
          return current;
        }
        const next = current + direction;
        if ((direction === 1 && next >= metrics.currentStreak) || (direction === -1 && next <= metrics.currentStreak)) {
          window.clearInterval(timer);
          return metrics.currentStreak;
        }
        return next;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, [displayStreak, metrics.currentStreak]);

  const ringProgress = metrics.currentStreak === 0
    ? 10
    : Math.min(100, Math.max(12, metrics.milestoneProgress));
  const ringStyle = { "--ring-progress": `${ringProgress * 3.6}deg` } as CSSProperties;
  const checkInLabel = metrics.clockTampered
    ? "Uhrzeit prüfen"
    : metrics.todayChecked
      ? "Heute bestätigt"
      : metrics.canCheckIn
        ? "Heute clean"
        : `Nächster Level-up in ${formatCooldown(metrics.checkInRemainingMs)}`;

  return (
    <section className="today-screen screen-enter" aria-labelledby="today-heading">
      <div className="today-intro">
        <div>
          <span className="quiet-kicker">Aktuelle Serie</span>
          <h1 id="today-heading">Heute</h1>
        </div>
        <div className="today-date">{substance || "Dein Weg"}</div>
      </div>

      <div className={`streak-orbit ${checkingIn ? "is-animating" : ""} ${metrics.todayChecked ? "is-complete" : ""}`} style={ringStyle}>
        <div className="orbit-particle particle-a" />
        <div className="orbit-particle particle-b" />
        <div className="orbit-particle particle-c" />
        <div className="streak-ring">
          <div className="streak-ring-inner">
            <span className="streak-number" aria-live="polite">{displayStreak}</span>
            <span className="streak-label">Tage clean</span>
            <span className="streak-hours">{metrics.hoursClean} Stunden</span>
          </div>
        </div>
        <span className="ring-endpoint" aria-hidden="true"><span /></span>
      </div>

      <div className="level-card">
        <div className="level-badge"><Star size={23} strokeWidth={1.8} /></div>
        <div className="level-copy">
          <div className="level-line"><strong>Level {metrics.level}</strong><span>{metrics.xpInLevel} / {Math.max(1000, Math.round((metrics.levelEnd - metrics.levelStart) * 100))} XP</span></div>
          <div className="progress-bar" aria-label={`${Math.round(metrics.xpProgress)} Prozent bis zum nächsten Level`}><span style={{ width: `${metrics.xpProgress}%` }} /></div>
        </div>
      </div>

      <div className="checkin-zone">
        <button
          className={`checkin-button ${checkingIn ? "is-pressing" : ""} ${metrics.todayChecked ? "is-checked" : ""} ${!metrics.canCheckIn && !metrics.todayChecked ? "is-locked" : ""}`}
          type="button"
          onClick={onCheckIn}
          disabled={checkingIn || !metrics.canCheckIn}
          aria-live="polite"
        >
          <span className="checkin-icon">{metrics.todayChecked ? <Check size={22} /> : !metrics.canCheckIn ? <LockKeyhole size={20} /> : <Flame size={21} />}</span>
          <span>{checkInLabel}</span>
          {metrics.canCheckIn && <span className="checkin-cta-arrow">↗</span>}
        </button>
        {!metrics.todayChecked && !metrics.canCheckIn && (
          <p className="checkin-lock-note" role="status">
            {metrics.clockTampered ? "Die Uhrzeit wirkt zurückgestellt. Stelle sie automatisch ein, um fortzufahren." : "Ein Level-up wird erst nach 24 Stunden wieder freigeschaltet."}
          </p>
        )}
        {successMessage && (
          <div className="success-note" role="status">
            <span className="success-dot"><Check size={13} /></span>
            <span>{successMessage}</span>
            <span className="xp-float">+100 XP</span>
          </div>
        )}
      </div>

      {milestone && (
        <div className="milestone-reveal" role="status">
          <div className="milestone-icon"><Sparkles size={18} /></div>
          <div><strong>{dayLabel(milestone)}</strong><span>Milestone freigeschaltet</span></div>
        </div>
      )}

      <div className="today-actions">
        <button className={`quiet-action ${isHardDay ? "is-selected" : ""}`} type="button" onClick={onHardDay} aria-pressed={isHardDay}>
          {isHardDay ? <Check size={19} /> : <Cloud size={19} />}
          <span>{isHardDay ? "Heute als schwer markiert" : "Heute war schwer"}</span>
          <span className="action-chevron">›</span>
        </button>
        <button className="quiet-action quiet-action-emergency" type="button" onClick={onEmergency}>
          <ShieldAlert size={19} />
          <span>Ich will gerade konsumieren</span>
          <span className="action-chevron">›</span>
        </button>
      </div>

    </section>
  );
}

function formatCooldown(remainingMs: number): string {
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  if (remainingMinutes < 60) return `${remainingMinutes} Min.`;
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}
