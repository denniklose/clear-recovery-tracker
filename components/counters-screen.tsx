import { Check, ChevronRight, Clock3, Layers3, LockKeyhole, Sparkles } from "lucide-react";
import { formatDate } from "../lib/date";
import { calculateCounterMetrics, dayLabel, getCounters } from "../lib/recovery";
import type { AppState } from "../lib/recovery";

type CountersScreenProps = {
  state: AppState;
  todayKey: string;
  nowMs: number;
  onSelectCounter: (counterId: string) => void;
};

export function CountersScreen({ state, todayKey, nowMs, onSelectCounter }: CountersScreenProps) {
  const counters = getCounters(state);

  return (
    <section className="counter-screen screen-enter" aria-labelledby="counter-heading">
      <div className="section-heading-row">
        <div>
          <span className="quiet-kicker">Deine Wege</span>
          <h1 id="counter-heading">Counter</h1>
        </div>
        <div className="heading-orb"><Layers3 size={18} /></div>
      </div>

      <div className="counter-intro-card">
        <span className="counter-intro-icon"><Clock3 size={19} /></span>
        <div>
          <strong>{counters.length === 1 ? "1 Counter aktiv" : `${counters.length} Counter aktiv`}</strong>
          <span>Wechsle hier zwischen deinen cleanen Wegen. Jeder Counter läuft unabhängig.</span>
        </div>
      </div>

      {counters.length > 0 ? (
        <div className="counter-grid" aria-label="Deine Counter">
          {counters.map((counter, index) => {
            const active = counter.id === state.activeCounterId;
            const metrics = calculateCounterMetrics(counter, todayKey, nowMs);
            return (
              <button
                className={`counter-card ${active ? "is-active" : ""}`}
                key={counter.id}
                type="button"
                aria-pressed={active}
                onClick={() => onSelectCounter(counter.id)}
              >
                <span className="counter-card-topline">
                  <span className="counter-card-number">0{index + 1}</span>
                  {active ? <span className="counter-active-label"><Check size={12} /> Aktiv</span> : <span className="counter-open-label">Öffnen <ChevronRight size={14} /></span>}
                </span>
                <span className="counter-card-name">{counter.substance || "Dein Weg"}</span>
                <span className="counter-card-date"><LockKeyhole size={13} /> Startdatum fest · seit {formatDate(counter.startDate)}</span>
                <span className="counter-card-stats">
                  <span><strong>{metrics.currentStreak}</strong><small> {metrics.currentStreak === 1 ? "Tag" : "Tage"} clean</small></span>
                  <span><strong>{metrics.hoursClean}</strong><small> Stunden</small></span>
                </span>
                <span className="counter-card-progress" aria-label={`${Math.round(metrics.milestoneProgress)} Prozent bis zum nächsten Milestone`}>
                  <span style={{ width: `${metrics.milestoneProgress}%` }} />
                </span>
                <span className="counter-card-meta">
                  <span><Sparkles size={13} /> Level {metrics.level}</span>
                  <span>{metrics.todayChecked ? "Heute bestätigt" : metrics.canCheckIn ? `Heute möglich · ${dayLabel(metrics.nextMilestone)} als Nächstes` : "24-Stunden-Schutz aktiv"}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="counter-empty">
          <Layers3 size={23} />
          <strong>Noch kein Counter angelegt</strong>
          <span>Wähle beim Start eine oder mehrere Substanzen aus.</span>
        </div>
      )}
    </section>
  );
}
