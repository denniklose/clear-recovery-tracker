"use client";

import { Cloud, ShieldCheck, Upload } from "lucide-react";

type SyncConflictDialogProps = {
  busy: boolean;
  onUseCloud: () => void;
  onKeepLocal: () => void;
};

export function SyncConflictDialog({ busy, onUseCloud, onKeepLocal }: SyncConflictDialogProps) {
  return (
    <div className="sync-conflict-backdrop">
      <section className="sync-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-conflict-title">
        <div className="sync-conflict-icon"><ShieldCheck size={21} /></div>
        <span className="quiet-kicker">Sicherheitscheck</span>
        <h2 id="sync-conflict-title">Welcher Fortschritt soll bleiben?</h2>
        <p>Auf diesem Gerät und in der Cloud liegen unterschiedliche Stände. Clear überschreibt nichts automatisch.</p>

        <button className="primary-button sync-conflict-action" type="button" disabled={busy} onClick={onUseCloud}>
          <Cloud size={18} /> Cloud-Fortschritt verwenden
        </button>
        <button className="quiet-action sync-conflict-action" type="button" disabled={busy} onClick={onKeepLocal}>
          <Upload size={18} />
          <span>Diesen Geräte-Stand sichern</span>
        </button>

        <small>„Diesen Geräte-Stand sichern“ ersetzt die Cloud-Version erst nach deiner ausdrücklichen Auswahl.</small>
      </section>
    </div>
  );
}
