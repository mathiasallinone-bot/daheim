# Daheim einrichten – Schritt für Schritt

Alles läuft auf Gratis-Tarifen. Kosten: **CHF 0 pro Monat**. Es wird nichts Kostenpflichtiges aktiviert.
Zeitbedarf: etwa 20–30 Minuten, einmalig. Aufbau wie bei SwissScore.

| Dienst | Wofür | Tarif |
|---|---|---|
| GitHub | Quellcode, automatische Einrichtung der Datenbank | Free |
| Supabase | Login und Datenbank | Free |
| Vercel | Webseite / App im Internet | Hobby (gratis, privat) |

Die Lovable-Version läuft weiter, bis die neue Version funktioniert.

---

## 1. GitHub – Repository ✅

Erledigt: `mathiasallinone-bot/daheim` (privat). Claude hat den Code hochgeladen.

## 2. Supabase – Projekt anlegen

> Supabase erlaubt gratis **2 aktive Projekte**. SwissScore belegt eines, Daheim wird das zweite.

1. <https://supabase.com/dashboard> öffnen und anmelden.
2. **New project**. Name `daheim`, Region **Zürich (eu-central-2)**, falls angeboten, sonst **Frankfurt (eu-central-1)**.
3. Ein **Datenbank-Passwort** wählen und sicher notieren (wird gleich gebraucht).
4. Plan: **Free**. Projekt erstellen und ca. 2 Minuten warten.
5. Folgende Werte notieren:
   - **Project ref**: Project Settings → General → *Reference ID* (z. B. `abcdefghijklmnop`)
   - **Project URL**: Project Settings → API → *Project URL* (`https://abcdefghijklmnop.supabase.co`)
   - **Öffentlicher Schlüssel**: Project Settings → API Keys → *anon* bzw. *publishable* Key
6. **Zugriffstoken für die Automatik**: Klick auf dein Profilbild → **Account preferences → Access Tokens → Generate new token**, Name `daheim-github`, kopieren.
   (Den Token von SwissScore kannst du nicht nochmals ansehen – einfach einen neuen erstellen.)

### Konten für die Familie anlegen

7. **Authentication → Users → Add user → Create new user**: E-Mail und Passwort eintragen, *Auto Confirm User* anhaken. Für jede Person wiederholen, die sich anmelden soll (z. B. du, deine Partnerin, Sianas Tablet).
8. Danach **Authentication → Sign In / Providers**: *Allow new users to sign up* **ausschalten** → Save.
   So kann sich niemand Fremdes registrieren.

## 3. GitHub – Geheimnisse hinterlegen (einmalig)

Im Repository `daheim` **Settings → Secrets and variables → Actions → New repository secret**. Je einen Eintrag:

| Name | Wert |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token aus Schritt 2.6 |
| `SUPABASE_PROJECT_REF` | Project ref aus Schritt 2.5 |
| `SUPABASE_DB_PASSWORD` | Datenbank-Passwort aus Schritt 2.3 |

Danach **Actions → Supabase deploy → Run workflow**. Nach 1–2 Minuten ist alles grün:
Tabellen, Regeln und **deine bisherigen Daten aus Lovable** (Sterne, erledigte Aufgaben, Wäsche, regelmässige Arbeiten) sind eingerichtet.

## 4. Vercel – App veröffentlichen

1. <https://vercel.com> → mit GitHub anmelden (wie bei SwissScore).
2. **Add New → Project** → das Repository `daheim` importieren.
   Falls es nicht in der Liste steht: *Adjust GitHub App Permissions* → Zugriff auf `daheim` erlauben.
3. Unter **Environment Variables** zwei Einträge:
   - `VITE_SUPABASE_URL` = Project URL aus Schritt 2.5
   - `VITE_SUPABASE_ANON_KEY` = öffentlicher Schlüssel aus Schritt 2.5
4. **Deploy**. Nach ca. 1 Minute gibt es eine Adresse wie `daheim-xyz.vercel.app`.

## 5. Letzte Verbindung

Supabase → **Authentication → URL Configuration → Site URL**: die Vercel-Adresse eintragen (für «Passwort vergessen»-Mails).

## 6. Erste Anmeldung und Familie verbinden

1. Vercel-Adresse öffnen und mit einem Konto aus Schritt 2.7 anmelden.
2. Die App fragt nach der Familie. Bei **Einladung annehmen** den Code `6a2cea9e0f` eingeben → **Beitreten**.
3. Jetzt erscheinen Sianas Sterne und alle bisherigen Aufgaben. Für jedes weitere Konto Schritt 1–2 wiederholen.

## 7. Aufs Handy / Tablet

- **iPhone/iPad (Safari):** Adresse öffnen → Teilen → *Zum Home-Bildschirm*. Das Kätzchen wird zum App-Symbol.
- **Android (Chrome):** Adresse öffnen → Menü → *App installieren*.

## 8. Umstellen

Am Tag des Wechsels Claude sagen: «Übernimm die neuen Daten aus Lovable». Claude ergänzt dann alles, was seit dem 05.11.2026 in der Lovable-Version dazugekommen ist. Danach nur noch die neue Adresse benutzen.

---

## Was die Gratis-Tarife bedeuten

- **Supabase Free** pausiert ein Projekt nach 7 Tagen ohne Nutzung. Bei täglicher Nutzung passiert das nicht. Sonst im Supabase-Dashboard auf *Restore* klicken – die Daten bleiben erhalten.
- **Vercel Hobby** reicht für eine Familie bei weitem.

## Hilfe bei Problemen

| Anzeige | Ursache | Lösung |
|---|---|---|
| Weisse Seite / «VITE_SUPABASE_URL … fehlen» | Vercel-Variablen fehlen | Schritt 4.3 prüfen, danach in Vercel *Redeploy* |
| Workflow rot bei «Mit Supabase-Projekt verbinden» | Token/Passwort falsch | Secrets aus Schritt 3 neu setzen, Workflow erneut starten |
| Login: «E-Mail oder Passwort stimmt nicht» | Konto fehlt | Schritt 2.7 |
| «Einladungscode ungültig» | Workflow noch nicht gelaufen | Schritt 3 (Run workflow) |
| Videos ohne Ton | Ton ist aus | Im Abschluss-Dialog «Ton aus – antippen zum Einschalten» |
