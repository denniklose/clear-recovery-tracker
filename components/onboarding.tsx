"use client";

import { ArrowLeft, ArrowRight, Check, ChevronRight, Euro, Heart, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { addCalendarDays, todayLocalKey } from "../lib/date";
import { SUBSTANCES } from "../lib/recovery";

export type OnboardingData = {
  substances: string[];
  cleanStartDate: string;
  dailySpend: number | null;
  motivation: string;
};

type OnboardingProps = {
  cloudEnabled: boolean;
  onComplete: (data: OnboardingData) => void;
  onTap: () => void;
  onSelect: () => void;
};

const stepTitles = [
  "Wovon willst du clean bleiben?",
  "Seit wann bist du clean?",
  "Was bleibt dir jetzt mehr?",
  "Was gibt dir Halt?",
];

export function Onboarding({ cloudEnabled, onComplete, onTap, onSelect }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [substances, setSubstances] = useState<string[]>([]);
  const [startMode, setStartMode] = useState<"today" | "yesterday" | "date">("today");
  const [customDate, setCustomDate] = useState(todayLocalKey());
  const [dailySpend, setDailySpend] = useState("");
  const [motivation, setMotivation] = useState("");

  const startDate = useMemo(() => {
    if (startMode === "yesterday") return addCalendarDays(todayLocalKey(), -1);
    if (startMode === "date") return customDate;
    return todayLocalKey();
  }, [customDate, startMode]);

  const goNext = () => {
    onTap();
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }
    onComplete({
      substances,
      cleanStartDate: startDate,
      dailySpend: dailySpend ? Number(dailySpend.replace(",", ".")) : null,
      motivation: motivation.trim(),
    });
  };

  const canContinue = step === 0 ? substances.length > 0 : true;

  return (
    <main className="onboarding-shell">
      <div className="onboarding-glow onboarding-glow-one" />
      <div className="onboarding-glow onboarding-glow-two" />
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <div className="onboarding-topline">
          <div className="brand-lockup" aria-label="Clear">
            <span className="brand-mark"><span /></span>
            <span>clear</span>
          </div>
          <span className="step-count">{step + 1} / 4</span>
        </div>

        <div className="step-progress" aria-label={`Schritt ${step + 1} von 4`}>
          {stepTitles.map((title, index) => (
            <span className={index <= step ? "is-current" : ""} key={title} />
          ))}
        </div>

        <div className="onboarding-copy">
          <span className="quiet-kicker">Ein Schritt nach dem anderen</span>
          <h1 id="onboarding-title">{stepTitles[step]}</h1>
          <p>
            {step === 0 && "Wähle eine oder mehrere Substanzen. Für jede Auswahl entsteht ein eigener Counter."}
            {step === 1 && "Dein Startpunkt. Er bleibt für jeden Counter fest und ist später nicht mehr bearbeitbar."}
            {step === 2 && "Eine grobe Zahl genügt — dieser Wert bleibt privat und wird nur für deinen Fortschritt verwendet."}
            {step === 3 && "Ein Satz, zu dem du zurückkehren kannst, wenn es schwer wird."}
          </p>
        </div>

        {step === 0 && (
          <div className="selection-list" role="listbox" aria-label="Substanzen auswählen" aria-multiselectable="true">
            {SUBSTANCES.map((option) => {
              const selected = substances.includes(option);
              return (
                <button
                  className={`selection-row ${selected ? "is-selected" : ""}`}
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    setSubstances((current) => current.includes(option)
                      ? current.filter((item) => item !== option)
                      : [...current, option]);
                    onSelect();
                  }}
                >
                  <span className="selection-icon"><Sparkles size={17} /></span>
                  <span>{option}</span>
                  <span className="selection-check">{selected ? <Check size={17} /> : <ChevronRight size={17} />}</span>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="option-stack">
            <DateOption active={startMode === "today"} onClick={() => { setStartMode("today"); onSelect(); }} label="Heute" hint="Ab jetzt" />
            <DateOption active={startMode === "yesterday"} onClick={() => { setStartMode("yesterday"); onSelect(); }} label="Gestern" hint="Seit gestern" />
            <div className={`date-option ${startMode === "date" ? "is-selected" : ""}`}>
              <button type="button" className="date-option-trigger" onClick={() => { setStartMode("date"); onSelect(); }}>
                <span className="selection-icon"><Heart size={17} /></span>
                <span><strong>Datum auswählen</strong><small>Dein eigener Startpunkt</small></span>
                <span className="selection-check">{startMode === "date" ? <Check size={17} /> : <ChevronRight size={17} />}</span>
              </button>
              {startMode === "date" && (
                <input
                  className="date-input"
                  type="date"
                  value={customDate}
                  max={todayLocalKey()}
                  onChange={(event) => setCustomDate(event.target.value)}
                  aria-label="Clean-Startdatum"
                />
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <label className="field-card">
            <span className="field-icon"><Euro size={17} /></span>
            <span className="field-label">Ungefähr pro Tag</span>
            <span className="field-input-wrap">
              <input
                className="field-input field-input-money"
                inputMode="decimal"
                type="text"
                placeholder="0"
                value={dailySpend}
                onChange={(event) => setDailySpend(event.target.value.replace(/[^0-9,.]/g, ""))}
                aria-label="Tageskosten in Euro"
              />
              <span>€</span>
            </span>
            <small>Optional · hilft dir später beim Sichtbarwerden</small>
          </label>
        )}

        {step === 3 && (
          <label className="field-card field-card-textarea">
            <span className="field-icon"><Heart size={17} /></span>
            <span className="field-label">Dein Warum</span>
            <textarea
              className="field-input field-textarea"
              placeholder="Ich will mein Leben wieder selbst bestimmen."
              value={motivation}
              onChange={(event) => setMotivation(event.target.value)}
              aria-label="Deine Motivation"
            />
            <small className="character-count">{motivation.length} Zeichen</small>
          </label>
        )}

        <div className="onboarding-actions">
          {step > 0 ? (
            <button className="text-button" type="button" onClick={() => { onTap(); setStep((current) => current - 1); }}>
              <ArrowLeft size={17} /> Zurück
            </button>
          ) : <span />}
          <button className="primary-button onboarding-next" type="button" disabled={!canContinue} onClick={goNext}>
            {step === 3 ? "Start" : "Weiter"}
            <ArrowRight size={18} />
          </button>
        </div>
        {step >= 2 && <span className="skip-note">Du kannst diesen Schritt überspringen.</span>}
      </section>
      <p className="onboarding-footnote">{cloudEnabled ? "Optional: später per E-Mail auf einem anderen Gerät wiederherstellen." : "Deine Daten bleiben lokal auf diesem Gerät."}</p>
    </main>
  );
}

function DateOption({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint: string }) {
  return (
    <button className={`date-option date-option-trigger ${active ? "is-selected" : ""}`} type="button" onClick={onClick}>
      <span className="selection-icon"><Heart size={17} /></span>
      <span><strong>{label}</strong><small>{hint}</small></span>
      <span className="selection-check">{active ? <Check size={17} /> : <ChevronRight size={17} />}</span>
    </button>
  );
}
