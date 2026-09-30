# Training

Trainings-Dashboard für den 12-Wochen-Bogen vom **28.09.2026** bis zum Abflug am **18.12.2026**,
danach Reise-Modus bis **08.01.2027**.

Läuft als Web-App auf Cloudflare Pages, speichert in Cloudflare D1 und holt Radeinheiten
direkt von Strava. Auf dem iPhone lässt es sich als App auf den Home-Bildschirm legen und
funktioniert dort auch ohne Empfang.

---

## Was es kann

- **Tagesplan** mit letzter Leistung und begründetem Gewichtsvorschlag pro Übung
- **Offline** nutzbar — im Gym wird lokal gespeichert, der Abgleich läuft, sobald wieder Netz da ist
- **Sync zwischen Geräten**: Handy und Laptop sehen denselben Stand, ohne sich zu überschreiben
- **Strava** direkt angebunden — beim Öffnen wird die laufende Woche automatisch nachgezogen
- **Konstanz** als Leitkennzahl: erfüllte von geplanten Einheiten, pro Woche und über vier Wochen
- **Gewichtstrend** gegen einen Korridor statt gegen eine Zielzahl, inklusive Kreatin-Wasserfenster
- **Export** als Text für die Analyse im Chat und als JSON zur Sicherung

---

## Einrichtung

Einmalig, etwa 25 Minuten, komplett im Browser — **ohne Terminal**.

**→ [SETUP.md](SETUP.md)** führt dich Schritt für Schritt durch:
Datenbank anlegen, Datenbank-ID eintragen, App bei Cloudflare anlegen, Geheimnisse
hinterlegen, Strava verbinden, aufs iPhone legen. Mit Prüfpunkt nach jedem Abschnitt
und einer Tabelle für den Fall, dass etwas klemmt.

Kurzfassung für alle, die es eilig haben:

1. Cloudflare → **D1** → Datenbank `training` anlegen, ID notieren, Schema in der Console einspielen
2. ID in `wrangler.toml` eintragen (geht direkt auf github.com)
3. Cloudflare → **Pages** → **Connect to Git** → Repo `training`, Build `npm run build`, Output `dist`
4. Secrets `APP_PASSWORD` und `SESSION_SECRET` setzen, dann **Retry deployment**
5. Strava-App unter [strava.com/settings/api](https://www.strava.com/settings/api) anlegen —
   als Callback Domain **nur die Domain**, ohne `https://` und ohne Pfad. `STRAVA_CLIENT_ID`
   und `STRAVA_CLIENT_SECRET` als Secrets setzen, wieder neu deployen.
6. In Safari öffnen → **Teilen → Zum Home-Bildschirm**

### Prüfen, ob alles sitzt

```
https://DEINE-ADRESSE/api/health
```

Gibt zurück, was konfiguriert ist und ob die Datenbank erreichbar ist. Der einzige Endpunkt,
der ohne Anmeldung antwortet — und der schnellste Weg zu sehen, woran es hakt.

---

## Entwicklung

```bash
npm install
npm test                  # 91 Tests, reine Logik — braucht kein Cloudflare
npm run build             # nach dist/

# Lokal mit echter API und lokaler Datenbank:
cp .dev.vars.example .dev.vars        # Passwort und Secret eintragen
npx wrangler d1 execute training --local --file=schema.sql
npm run cf:dev                        # baut und startet auf :8788
```

`npm run dev` startet nur das Frontend auf :5173 und leitet `/api` an :8788 weiter — dafür muss
`npm run cf:dev` parallel laufen.

---

## Aufbau

```
src/lib/          Reine Logik, ohne React — hier liegt der Plan
  plan.js         Blöcke, Wochenstruktur, Übungen, Reise-Modus
  progression.js  Gewichtsempfehlung
  metrics.js      Konstanz, Gewichtstrend, EF, Zonen
  store.js        Offline-Speicher und Zusammenführen zweier Geräte
  export.js       Textexport für die Analyse
src/components/   Oberfläche
functions/api/    Cloudflare Pages Functions
  state.js        Abgleich: GET holt alles, PUT schreibt einzelne Datensätze
  strava/         OAuth und Sync direkt gegen die Strava-API
schema.sql        D1-Tabellen
test/             Tests für alles oben
```

### Wie der Sync funktioniert

Jede Eingabe geht **zuerst in den localStorage** und gilt damit als gespeichert. Der Server ist
nur der Abgleich zwischen Geräten, nie der kritische Pfad — im Gym ist der Empfang schlecht,
und ein Satz, der wegen eines Timeouts verloren geht, wäre der schlimmste denkbare Fehler.

Gespeichert wird **eine Zeile pro Tag**, nicht ein großes Dokument. Jeder Datensatz trägt einen
Zeitstempel. Beim Schreiben setzt sich der jüngere durch — auf dem Server per SQL-Bedingung, im
Browser beim Zusammenführen. Zwei Geräte können sich damit nicht gegenseitig überschreiben,
solange sie nicht denselben Tag gleichzeitig bearbeiten.

Der Strava-Sync fasst ausschließlich den Cardio-Teil eines Tages an. Hanteleinträge, Notizen und
das Befinden bleiben unberührt — sonst würde eine Radfahrt das Protokoll der Kraftsession vom
selben Tag löschen.

---

## Der Plan

Drei Blöcke à vier Wochen, jede vierte Woche ist Deload:

| Block | Zeitraum | Fokus |
|---|---|---|
| 1 · Wiedereinstieg & Gewohnheit | 28.09. – 25.10. | Erst die Routine, dann die Last. FTP-Test in Woche 1. |
| 2 · Kapazität | 26.10. – 22.11. | Mehr Zeit unter Last, höhere Wiederholungszahlen. |
| 3 · Verdichtung & Abreise | 23.11. – 20.12. | Woche 11 Standortbestimmung, Woche 12 fährt runter. |

**Die Woche:** Mo Beine + Core · Di/Mi Rad-Pendeln · Do Klettern (blockiert) ·
Fr Oberkörper + Rudergerät · Sa lange Ausdauer · So Motor: Steigung & Tragen.

**Reise-Modus** ab 18.12.: Erhalt statt Aufbau, zwei bis drei kurze Zirkel pro Woche,
keine Progression. Ausgefallene Einheiten zählen dort nicht gegen die Konstanz.

### Festgelegte Randbedingungen

Diese sind in Tests abgesichert, nicht nur im Text:

- **Kein Laufen.** Auf dem Laufband wird gegangen.
- **Keine Zusatzlast auf dem Laufband** — das Studio hat weder Rucksäcke noch Gewichtswesten,
  nur Sandsäcke für die Schulter. Rucksacklast gibt es nur draußen.
- **Donnerstag ist blockiert:** Arbeit bis 17:30, Klettern um 18:00.
- **Kein Fingerboard** — der Kletterreiz genügt.
- **Keine Kalorienvorgaben.** Gesteuert wird über die Wochenrate; fällt sie schneller als
  1 kg pro Woche, lautet die Antwort *mehr essen*, nicht weniger.
- **Kein Bergsteigen-Framing.** Eine 4000er-Woche ist derzeit kein Ziel.
