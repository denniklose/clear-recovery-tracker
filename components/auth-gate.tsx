"use client";

import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { getSupabaseClient } from "../lib/supabase";

export function AuthGate({ onBack }: { onBack?: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const sendLoginEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || busy) return;

    const client = getSupabaseClient();
    if (!client) {
      setError("Die Cloud ist noch nicht konfiguriert.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    const result = await client.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });
    setBusy(false);

    if (result.error) {
      setError("Die Login-Mail konnte gerade nicht gesendet werden. Prüfe die Adresse oder versuche es später erneut.");
      return;
    }

    setEmail(normalizedEmail);
    setSent(true);
    setMessage("Die Login-Mail ist unterwegs. Nutze den Magic Link oder den einmaligen Code daraus.");
  };

  const verifyCode = async () => {
    const normalizedCode = code.replace(/\s/g, "");
    if (!email || !normalizedCode || busy) return;

    const client = getSupabaseClient();
    if (!client) {
      setError("Die Cloud ist noch nicht konfiguriert.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await client.auth.verifyOtp({ email, token: normalizedCode, type: "email" });
    setBusy(false);

    if (result.error) {
      setError("Der Code ist ungültig oder abgelaufen. Bitte fordere einen neuen Code an.");
    }
  };

  return (
    <main className="auth-shell">
      <div className="onboarding-glow onboarding-glow-one" />
      <div className="onboarding-glow onboarding-glow-two" />
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="onboarding-topline">
          <div className="brand-lockup" aria-label="Clear"><span className="brand-mark"><span /></span><span>clear</span></div>
          <span className="auth-lock"><ShieldCheck size={15} /> geschützt</span>
        </div>

        <div className="auth-copy">
          <span className="quiet-kicker">Dein Fortschritt reist mit</span>
          <h1 id="auth-title">{onBack ? "Fortschritt sichern" : "Mit E-Mail einloggen"}</h1>
          <p>{onBack ? "Clear funktioniert bereits offline. Mit einer E-Mail sicherst du deinen Stand optional für ein anderes Gerät." : "Ein einmaliger Link oder Code verbindet deinen Clean-Weg sicher mit deinem Account."}</p>
        </div>

        <form className="auth-form" onSubmit={sendLoginEmail}>
          <label className="auth-field">
            <Mail size={18} />
            <span className="sr-only">E-Mail-Adresse</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="du@beispiel.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <button className="primary-button auth-submit" type="submit" disabled={busy || !email.trim()}>
            {busy ? "Wird gesendet…" : "Login-Mail senden"}
            <ArrowRight size={18} />
          </button>
        </form>

        {sent && (
          <div className="auth-code-panel">
            <label className="auth-field">
              <KeyRound size={18} />
              <span className="sr-only">Einmaliger Code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code aus der E-Mail"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
              />
            </label>
            <button className="quiet-action auth-code-button" type="button" disabled={busy || !code.trim()} onClick={() => void verifyCode()}>
              Code bestätigen
            </button>
          </div>
        )}

        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        <div className="auth-footnote">
          <ShieldCheck size={15} /> Nur Auth-Mails — keine Motivation- oder Marketing-Mails.
        </div>
        {onBack && <button className="text-button auth-back" type="button" onClick={onBack}><ArrowLeft size={16} /> Zur lokalen App</button>}
      </section>
      <p className="onboarding-footnote">Kein Passwort, keine Telefonnummer, keine SIM-Bindung.</p>
    </main>
  );
}
