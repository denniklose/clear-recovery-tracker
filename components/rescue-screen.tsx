"use client";

import { ArrowLeft, MapPin, Pause, Phone, Play, ShieldAlert, TimerReset } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

type RescueScreenProps = {
  onBack: () => void;
  onTimerStart: () => void;
  onTimerEnd: () => void;
};

type SupportAction = "why" | "person" | "place";

export function RescueScreen({ onBack, onTimerStart, onTimerEnd }: RescueScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSupport, setSelectedSupport] = useState<SupportAction | null>(null);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          onTimerEnd();
          setMessage("Die 10 Minuten sind geschafft.");
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onTimerEnd, running]);

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      setMessage("Der Timer ist pausiert.");
      return;
    }
    if (secondsLeft === 0) setSecondsLeft(600);
    setRunning(true);
    setMessage("");
    onTimerStart();
  };

  const selectSupport = (action: SupportAction, nextMessage: string) => {
    setSelectedSupport(action);
    setMessage(nextMessage);
  };

  const progress = ((600 - secondsLeft) / 600) * 360;

  return (
    <section className="rescue-screen screen-enter" aria-labelledby="rescue-heading">
      <button className="back-button" type="button" onClick={onBack}><ArrowLeft size={18} /> Zurück</button>
      <div className="rescue-intro">
        <div className="rescue-title-icon"><ShieldAlert size={22} /></div>
        <span className="quiet-kicker">Sofort-Modus</span>
        <h1 id="rescue-heading">Nur die nächsten<br /><em>10 Minuten.</em></h1>
        <p>Du musst gerade nichts für immer entscheiden. Bleib nur hier, bis diese Welle vorbeizieht.</p>
      </div>

      <div className="timer-orbit" style={{ "--timer-progress": `${progress}deg` } as CSSProperties}>
        <div className="timer-orbit-inner">
          <span className="timer-label">jetzt</span>
          <strong>{formatTime(secondsLeft)}</strong>
          <span className="timer-state">{secondsLeft === 0 ? "geschafft" : running ? "läuft" : "bereit"}</span>
        </div>
      </div>

      <button className={`timer-button ${running ? "is-running" : ""}`} type="button" onClick={toggleTimer}>
        {running ? <Pause size={19} /> : secondsLeft === 0 ? <TimerReset size={19} /> : <Play size={19} />}
        {running ? "Timer pausieren" : secondsLeft === 0 ? "Noch einmal starten" : "10-Minuten-Timer starten"}
      </button>

      <div className="rescue-actions" aria-label="Sofort-Hilfen">
        <button className={selectedSupport === "why" ? "is-selected" : ""} type="button" aria-pressed={selectedSupport === "why"} onClick={() => selectSupport("why", "Lies deinen Satz noch einmal. Du weißt, warum du aufgehört hast.")}><span><ShieldAlert size={18} /></span><strong>Warum ich aufgehört habe</strong><b>›</b></button>
        <button className={selectedSupport === "person" ? "is-selected" : ""} type="button" aria-pressed={selectedSupport === "person"} onClick={() => selectSupport("person", "Öffne jetzt deine Telefon-App und ruf eine vertraute Person an.")}><span><Phone size={18} /></span><strong>Person kontaktieren</strong><b>›</b></button>
        <button className={selectedSupport === "place" ? "is-selected" : ""} type="button" aria-pressed={selectedSupport === "place"} onClick={() => selectSupport("place", "Ein anderer Ort kann helfen. Geh für ein paar Minuten nach draußen.")}><span><MapPin size={18} /></span><strong>Ort verlassen</strong><b>›</b></button>
      </div>

      {message && <p className="rescue-message" role="status">{message}</p>}
      <p className="medical-note">Diese App ersetzt keine professionelle medizinische oder therapeutische Unterstützung.</p>
    </section>
  );
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}
