# Daheim

Familienplaner für Eltern und Siana: Tagesaufgaben mit Kätzchen-Videos, Wochenplan, Sterne und Belohnungen, regelmässige Arbeiten.
Privat, nur für die Familie (`noindex`).

**Einrichten:** siehe [ANLEITUNG.md](ANLEITUNG.md).

## Aufbau (wie SwissScore)

- **Vite + React 19 + TanStack Router** (dateibasierte Routen in `src/routes`), Tailwind CSS 4, React Query
- **Supabase**: Login, Postgres mit Row Level Security (jede Familie sieht nur ihre Daten); Sterne, Wochenbonus, Hausaufgaben-Sperre und Rücknahme werden in der Datenbank geprüft (`supabase/migrations`)
- **Vercel**: statische App aus `dist/`, Videos in `public/media` (720p)
- **GitHub Actions**: `ci.yml` prüft Tests und Build

## Entwickeln

```bash
cp .env.example .env.local   # Supabase-URL und öffentlichen Schlüssel eintragen
npm install
npm run dev
npm test
npm run build
```

## Wichtige Dateien

| Datei | Inhalt |
|---|---|
| `src/lib/plan.ts` | alle Regeln: Aufgaben pro Tag, Ferien, Donnerstagsrotation, Hausaufgaben, Stundenplan, Wasser-Zeiten |
| `src/lib/kitten-video.ts` | welches Kätzchen-Video wann erscheint |
| `src/components/WaterReminder.tsx`, `src/lib/push.ts`, `public/sw.js` | Wasser-Wecker in der App und Benachrichtigungen |
| `supabase/functions/water-reminder` | verschickt die Benachrichtigungen (stündlich per pg_cron) |
| `src/lib/data.ts` | Laden und Speichern |
| `supabase/migrations/` | Tabellen, Zugriffsregeln, Sterne-Trigger; zuletzt die Datenübernahme aus Lovable |

Herkunft: Ursprünglich mit Lovable gebaut (Projekt «Daheim Family Compass»), am 05.11.2026 auf eigenen Stack übernommen.
Regeln für Änderungen: Fachregeln in `plan.ts` und in der Datenbank (`expected_routines`, `set_completion_stars`) immer gemeinsam ändern, neue Datenbank-Änderungen nur als neue Migration.
