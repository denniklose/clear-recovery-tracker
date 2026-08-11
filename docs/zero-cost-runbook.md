# Clear V2 — kostenloser Betriebs- und Sicherheits-Runbook

Die App ist als lokaler First-Client gebaut. Der Cloud-Pfad und die optionalen Push-API-Routen nutzen ausschließlich den jeweiligen Free-Tier. Es gibt keine Analytics-Integration, keine Zahlungslogik und keine KI-/OpenAI-Abhängigkeit im Repository.

> **Aktueller Production-Stand:** Supabase und Push sind im Code vorbereitet, aber in Vercel noch nicht aktiviert, solange keine Supabase-, VAPID- und Cron-Variablen hinterlegt sind. Ohne diese Variablen bleibt Clear vollständig lokal/offline; die Push-Einstellung zeigt dann bewusst einen Einrichtungsstatus.

## Einmalige Einrichtung

1. Ein Supabase-Projekt im Free-Tier anlegen und **keine** Upgrade-, Pay-as-you-go- oder Kartenaufforderung bestätigen. `supabase/schema.sql` einmal im SQL Editor ausführen.
   Das aktuelle Schema enthält die Multi-Counter-Felder und den zusammengesetzten Schlüssel für mehrere Check-ins am selben Datum. Bei einem bereits bestehenden Projekt das Skript vollständig erneut ausführen, damit die V1-Spalten und die Migration angelegt werden.
2. In Supabase unter Authentication → Providers den E-Mail-Provider aktivieren. Magic Link und der einmalige E-Mail-Code werden über `signInWithOtp` / `verifyOtp` verwendet.
3. In Resend den kostenlosen Tarif verwenden und die SMTP-Daten in Supabase Authentication → SMTP Settings hinterlegen. Diese Daten werden nur im Supabase-Dashboard verwendet, niemals in `.env` oder im Browser.
4. In Supabase Authentication → URL Configuration die lokale URL und die spätere Cloudflare-Pages-URL als erlaubte Redirect URLs eintragen.
5. `.env.example` nach `.env.local` kopieren und nur die Supabase-Projekt-URL sowie den **anon/public key** eintragen. Ein Service-Role-Key gehört niemals in `NEXT_PUBLIC_*`.
6. Für die bestehende Vercel-Production im Projekt `clear-recovery-tracker` unter Settings → Environment Variables `NEXT_PUBLIC_SUPABASE_URL` und genau einen öffentlichen Schlüssel setzen: den älteren `NEXT_PUBLIC_SUPABASE_ANON_KEY` oder den neuen `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Die Variablen für Production (und optional Preview/Development) setzen und danach neu deployen. Für Cloudflare Pages gelten dieselben Variablen als Build-Variablen.
7. Push einmalig einrichten: im Projektverzeichnis `npx web-push generate-vapid-keys` ausführen und die beiden Werte sicher kopieren. Der öffentliche Wert kommt in `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` **und** `WEB_PUSH_PUBLIC_KEY`, der private Wert nur in `WEB_PUSH_PRIVATE_KEY`. `WEB_PUSH_SUBJECT` ist z. B. `mailto:deine-adresse@example.com`.
8. In Vercel zusätzlich `SUPABASE_SERVICE_ROLE_KEY` und ein eigenes langes `CRON_SECRET` als **Production-Variablen** hinterlegen. Beide bleiben serverseitig. Das vorhandene `vercel.json` ruft die tägliche Route zweimal in UTC auf, damit Sommer- und Winterzeit jeweils die lokale 18-Uhr-Stunde treffen.
9. Die Push-Variante bleibt auf Vercel, weil sie die Node.js-API-Routen und den Cron benötigt; der lokale Client funktioniert auch ohne diese Einrichtung. Ein separater Cloudflare-Static-Export ist weiterhin möglich, braucht aber eine eigene API-/Push-Hosting-Variante und ist nicht der veröffentlichte Push-Pfad.
10. Wenn ein Anbieter eine Kreditkarte, ein Upgrade oder Pay-as-you-go verlangt: Vorgang abbrechen, Daten erhalten und nicht fortfahren. Die V2 darf lieber ein Limit erreichen als Kosten zu verursachen.

## Kosten- und Nutzungsmonitoring

- Supabase: Project → Reports/Usage für Database Usage; Authentication → Usage für Auth-Nutzung.
- Resend: Dashboard → Usage für Daily Email Usage und Monthly Email Usage.
- Cloudflare: Pages/Workers & Pages → Analytics/Usage für Requests und Pages/Workers Usage.
- GitHub: Repository und Actions/Traffic im Free-Tier prüfen; für die App sind keine bezahlten Actions oder externen Runner erforderlich.

## Expliziter Kosten-Audit

| SERVICE | PLAN | MONTHLY BASE COST | PAYMENT METHOD REQUIRED? | AUTO-OVERAGE POSSIBLE? | FREE LIMIT RELEVANT TO THIS APP? | STATUS |
| --- | --- | ---: | --- | --- | --- | --- |
| Cloudflare Pages | Free | 0 € | Nein für den beschriebenen Pages-Free-Pfad; bei einer Aufforderung stoppen | Nicht aktiviert | Requests/Builds können begrenzen | Für V1 vorgesehen |
| Supabase | Free | 0 € | Nein für den beschriebenen Free-Pfad; keine Karte hinterlegen | Nicht aktiviert | Datenbank/Auth-Kontingent | Für V1 vorgesehen |
| Resend | Free | 0 € | Nein für den beschriebenen Free-Pfad; bei einer Aufforderung stoppen | Nicht aktiviert | Login-Mail-Tages-/Monatslimit | Für Auth-Mail vorgesehen |
| GitHub | Free | 0 € | Nein | Nicht aktiviert | Repository-/Actions-Limits | Für Quellcode vorgesehen |
| IndexedDB / Web Audio | Browserstandard | 0 € | Nein | Nicht möglich | Browser-Speicher des Geräts | Lokal/offline vorgesehen |
| `@supabase/supabase-js` | Open Source Dependency | 0 € | Nein | Nicht möglich | Keine laufenden Kosten | Im Bundle enthalten |
| `web-push` / Vercel Hobby Cron | Open Source + Free | 0 € | Nein für den beschriebenen Free-Pfad | Nicht aktiviert | Funktions-/Cron-Limits des Free-Tiers | Optional für Push |

**Zielzustand:** Alle zwingend benötigten Dienste haben 0 € monatliche Basiskosten. Die Anwendung aktiviert keine bezahlten Ressourcen und versendet ausschließlich Auth-Mails.

## Sicherheitsmodell

- IndexedDB ist im Offline-Modus der lokale Primärspeicher. Supabase PostgreSQL ist die optionale Sicherung und die Quelle beim Gerätewechsel.
- Ein leerer oder gelöschter lokaler Cache wird nie in die Cloud geschrieben. Bei bestehender Cloud wird zuerst gelesen.
- Jede nutzerspezifische Tabelle hat RLS mit `auth.uid() = user_id` (bei `profiles` mit `id`).
- Derived Values wie Serie, XP, Level, Quote und gespartes Geld werden lokal aus den Cloud-Primärdaten berechnet.
- Jeder Counter speichert seine Check-ins, schwierige Tage und den letzten Check-in-Zeitpunkt getrennt. Der lokale Level-up-Button lässt höchstens ein Level-up pro 24 Stunden zu, blockiert doppelte Tagesdaten und erkennt eine zurückgestellte Geräteuhr.
- Ein vollständig offline laufender Client kann nie absolut fälschungssicher sein: Die Person kontrolliert auf dem eigenen Gerät Browser, Uhr und lokalen Speicher. Für eine harte serverseitige Durchsetzung muss der Check-in bei aktiviertem Supabase über einen serverseitig geprüften RPC/Event-Endpoint aufgezeichnet werden; das ist bewusst als nächster Cloud-Härtungsschritt getrennt vom Offline-Pfad.
- Es gibt kein Polling und keine Realtime-Verbindung. Synchronisation erfolgt beim Start, nach relevantem Write und bei `online`/Rückkehr in die App.
- Push ist optional, anonym pro Gerät und ohne Login: IndexedDB hält Gerätekennung und Warteschlange, Supabase speichert nur den Hash der Gerätekennung plus Web-Push-Schlüssel. Die API akzeptiert nur serverseitig erzeugte statische Texte; es werden keine Substanznamen in Push-Nachrichten übertragen.
- Es gibt keine Marketing- oder Check-in-E-Mails. Push besteht aus einem statischen Satz um 18:00 Uhr und einem Hinweis nach dem lokalen 24-Stunden-Level-up. Die App verwendet dafür keine KI-Aufrufe.

## Abnahmetests mit einem echten Projekt

1. Device A: neuen Account einloggen, Onboarding abschließen, mehrere Clean-Tage markieren und Sound/Einstellungen ändern.
2. Device B oder frischer Browser: Cookies, localStorage und IndexedDB löschen, mit derselben E-Mail einloggen. Die Cloud-Historie muss vollständig erscheinen.
3. Offline: Verbindung unterbrechen, Check-in ausführen, lokale Anzeige prüfen, Verbindung wiederherstellen. Ein einzelner Sync muss den Check-in ohne Duplikat in `daily_checkins` speichern.
4. Push auf einem echten iPhone: Safari öffnen, Clear zum Home-Bildschirm hinzufügen, in `Ich → Benachrichtigungen` aktivieren, die beiden Kategorien prüfen und einen Test-Level-up mit der Dev-Sperre auslösen. Die tägliche Route mit `Authorization: Bearer <CRON_SECRET>` testen.
5. Supabase SQL Editor/Policies prüfen: anonyme Requests dürfen keine Nutzerdaten lesen; ein eingeloggter Nutzer darf ausschließlich seine eigenen Zeilen lesen/schreiben. Push-Tabellen sind nur für die serverseitige Service-Role bestimmt.

Diese Tests benötigen ein reales Supabase-Projekt. Ohne URL, anon key, ausgeführtes Schema und eingerichteten Auth-SMTP kann das Repository nur Build und lokale Fallback-/Offline-Grundlagen verifizieren.
