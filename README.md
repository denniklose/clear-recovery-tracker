# Clear Recovery

Clear Recovery ist eine lokale, offline-fähige Recovery-PWA für iPhone und Desktop. Der Fortschritt wird zuerst lokal gespeichert; eine optionale Supabase-Sicherung kann später ergänzt werden.

Live-Version: https://clear-recovery-tracker.vercel.app

## Lokal starten

```bash
npm install
npm run dev
```

Weitere Prüfungen:

```bash
npm run lint
npm run typecheck
npm run build
```

## Optionale Cloud- und Push-Konfiguration

Die benötigten Variablen stehen in `.env.example`. Für lokale Entwicklung eine eigene `.env.local` anlegen. Secrets gehören niemals in GitHub; `.env.local` wird durch `.gitignore` ausgeschlossen.
