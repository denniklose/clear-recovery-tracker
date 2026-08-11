import { CalendarDays, ChevronRight, Coins, LockKeyhole, Target, Trophy } from "lucide-react";
import { addCalendarDays, dateFromKey, differenceInCalendarDays, formatMonthYear, formatShortDate } from "../lib/date";
import type { AppMetrics, AppState } from "../lib/recovery";
import { currency, dayLabel, MILESTONES } from "../lib/recovery";

type ProgressScreenProps = {
  state: AppState;
  metrics: AppMetrics;
  todayKey: string;
  cloudConfigured: boolean;
  isAuthenticated: boolean;
};

export function ProgressScreen({ state, metrics, todayKey, cloudConfigured, isAuthenticated }: ProgressScreenProps) {
  const calendar = buildMonthCalendar(todayKey);
  const cleanSet = new Set(state.checkIns);
  const startDate = state.user.cleanStartDate;
  const nextMilestone = metrics.nextMilestone;
  const yearDays = Array.from({ length: 365 }, (_, index) => addCalendarDays(todayKey, index - 364));

  return (
    <section className="progress-screen screen-enter" aria-labelledby="progress-heading">
      <div className="section-heading-row">
        <div>
          <span className="quiet-kicker">Was sich verändert</span>
          <h1 id="progress-heading">Fortschritt</h1>
        </div>
        <div className="heading-orb"><Target size={18} /></div>
      </div>

      <section className="stats-grid" aria-label="Deine Statistiken">
        <Stat label="Aktuelle Serie" value={dayLabel(metrics.currentStreak)} icon={<Target size={17} />} accent />
        <Stat label="Beste Serie" value={dayLabel(metrics.bestStreak)} icon={<Trophy size={17} />} />
        <Stat label="Clean-Tage" value={`${metrics.totalCleanDays}`} icon={<CalendarDays size={17} />} />
        <Stat label="Letzte 30 Tage" value={`${metrics.cleanRate30} %`} icon={<ChevronRight size={17} />} />
      </section>

      <section className="progress-panel calendar-panel" aria-labelledby="calendar-heading">
        <div className="panel-heading">
          <div><span className="panel-kicker">Kalender</span><h2 id="calendar-heading">{formatMonthYear(todayKey)}</h2></div>
          <span className="calendar-legend"><i /> clean</span>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="month-grid">
          {calendar.map((day, index) => {
            if (!day) return <span className="month-day is-empty" key={`empty-${index}`} />;
            const clean = cleanSet.has(day);
            const future = day > todayKey;
            return (
              <span className={`month-day ${clean ? "is-clean" : ""} ${future ? "is-future" : ""}`} key={day} title={formatShortDate(day)}>
                {dateFromKey(day).getDate()}
                {clean && <span className="day-check">✓</span>}
              </span>
            );
          })}
        </div>
      </section>

      <section className="money-panel" aria-labelledby="money-heading">
        <div className="money-copy">
          <span className="panel-kicker">Clean Money</span>
          <h2 id="money-heading">{currency(metrics.moneySaved)}</h2>
          <p>nicht ausgegeben</p>
          <small>{dayLabel(metrics.totalCleanDays)} × {currency(state.user.dailySpend ?? 0)}</small>
        </div>
        <div className="money-icon"><Coins size={22} /></div>
      </section>

      <section className="progress-panel milestone-panel" aria-labelledby="milestone-heading">
          <div className="panel-heading">
          <div><span className="panel-kicker">Nächster Milestone</span><h2 id="milestone-heading">{dayLabel(nextMilestone)}</h2></div>
          <strong className="milestone-days">Noch {dayLabel(metrics.daysToMilestone)}</strong>
        </div>
        <div className="progress-bar milestone-bar"><span style={{ width: `${metrics.milestoneProgress}%` }} /></div>
        <div className="milestone-meta"><span>{dayLabel(metrics.previousMilestone || 0)}</span><span>{dayLabel(nextMilestone)}</span></div>
      </section>

      <section className="progress-panel year-panel" aria-labelledby="year-heading">
        <div className="panel-heading">
          <div><span className="panel-kicker">Jahresblick</span><h2 id="year-heading">Deine letzten 365 Tage</h2></div>
          <span className="year-count">{metrics.totalCleanDays} clean</span>
        </div>
        <div className="year-grid" aria-label="Jahresübersicht mit cleanen Tagen">
          {yearDays.map((day) => {
            const clean = cleanSet.has(day);
            const future = day > todayKey;
            const milestoneDay = startDate && differenceInCalendarDays(startDate, day) >= 0 && MILESTONES.includes(differenceInCalendarDays(startDate, day) + 1);
            return <span className={`year-dot ${clean ? "is-clean" : ""} ${future ? "is-future" : ""} ${milestoneDay ? "is-milestone" : ""}`} key={day} title={formatShortDate(day)} />;
          })}
        </div>
        <div className="year-legend"><span><i className="legend-dot is-clean" /> clean</span><span><i className="legend-dot" /> offen</span><span><i className="legend-dot is-milestone" /> milestone</span></div>
      </section>

      <div className="quiet-support-note"><LockKeyhole size={15} /> {isAuthenticated ? "Cloud-Sicherung aktiv — Änderungen werden automatisch synchronisiert." : cloudConfigured ? "Offline bereit. Sichere deinen Fortschritt optional per E-Mail." : "Deine Daten bleiben auf diesem Gerät."}</div>
    </section>
  );
}

function Stat({ label, value, icon, accent = false }: { label: string; value: string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`stat-card ${accent ? "is-accent" : ""}`}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function buildMonthCalendar(todayKey: string): Array<string | null> {
  const today = dateFromKey(todayKey);
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const days: Array<string | null> = Array.from({ length: mondayOffset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  }
  return days;
}
