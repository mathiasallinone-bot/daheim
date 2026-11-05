# Daheim einrichten – Schritt für Schritt

Alles läuft auf Gratis-Tarifen. Kosten: **CHF 0 pro Monat**. Es wird nichts Kostenpflichtiges aktiviert.
Zeitbedarf für dich: etwa 5 Minuten. Aufbau wie bei SwissScore.

| Dienst | Wofür | Tarif |
|---|---|---|
| GitHub | Quellcode | Free |
| Supabase | Login und Datenbank | Free |
| Vercel | Webseite / App im Internet | Hobby (gratis, privat) |

Die Lovable-Version läuft weiter, bis die neue Version funktioniert.

---

## 1. GitHub – Repository ✅

Erledigt: `mathiasallinone-bot/daheim` (privat). Claude hat den Code hochgeladen.

## 2. Supabase – Projekt ✅

Erledigt über den Supabase-Connector: Projekt `daheim` (Region Zürich, Free), Datenbank mit allen Regeln und den Daten aus Lovable (Stand 05.11.2026).

Noch von dir zu tun, im Supabase-Dashboard (<https://supabase.com/dashboard> → Projekt `daheim`):

1. **Authentication → Users → Add user → Create new user**: E-Mail und Passwort eintragen, *Auto Confirm User* anhaken. Für jede Person wiederholen, die sich anmelden soll.
2. Danach **Authentication → Sign In / Providers**: *Allow new users to sign up* **ausschalten** → Save. So kann sich niemand Fremdes registrieren.
3. **Authentication → URL Configuration → Site URL**: die Vercel-Adresse eintragen (für «Passwort vergessen»-Mails).

Datenbank-Änderungen macht Claude künftig direkt über den Supabase-Connector; jede Änderung liegt zusätzlich als Datei in `supabase/migrations`.

## 3. Vercel – App

Wird von Claude über den Vercel-Connector eingerichtet (Projekt `daheim`, verbunden mit diesem Repo). Jeder Push auf `main` veröffentlicht automatisch.

## 4. Erste Anmeldung und Familie verbinden

1. Vercel-Adresse öffnen und mit einem Konto aus Schritt 2.1 anmelden.
2. Die App fragt nach der Familie. Bei **Einladung annehmen** den Code `6a2cea9e0f` eingeben → **Beitreten**.
3. Jetzt erscheinen Sianas Sterne und alle bisherigen Aufgaben. Für jedes weitere Konto Schritt 1–2 wiederholen.

## 5. Aufs Handy / Tablet

- **iPhone/iPad (Safari):** Adresse öffnen → Teilen → *Zum Home-Bildschirm*. Das Kätzchen wird zum App-Symbol.
- **Android (Chrome):** Adresse öffnen → Menü → *App installieren*.

## 6. Umstellen

Am Tag des Wechsels Claude sagen: «Übernimm die neuen Daten aus Lovable». Claude ergänzt dann alles, was seit dem 05.11.2026 in der Lovable-Version dazugekommen ist. Danach nur noch die neue Adresse benutzen.

---

## Was die Gratis-Tarife bedeuten

- **Supabase Free** pausiert ein Projekt nach 7 Tagen ohne Nutzung. Bei täglicher Nutzung passiert das nicht. Sonst im Supabase-Dashboard auf *Restore* klicken – die Daten bleiben erhalten.
- **Vercel Hobby** reicht für eine Familie bei weitem.

## Hilfe bei Problemen

| Anzeige | Ursache | Lösung |
|---|---|---|
| Weisse Seite / «VITE_SUPABASE_URL … fehlen» | Vercel-Variablen fehlen | Claude bitten, die Vercel-Variablen zu prüfen |
| Login: «E-Mail oder Passwort stimmt nicht» | Konto fehlt | Schritt 2.1 |
| Videos ohne Ton | Ton ist aus | Im Abschluss-Dialog «Ton aus – antippen zum Einschalten» |
