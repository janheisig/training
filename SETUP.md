# Einrichtung — Schritt für Schritt

Diese Anleitung geht davon aus, dass du **kein Terminal benutzen willst**. Alles passiert
im Browser: im Cloudflare-Dashboard und auf github.com.

Rechne mit 25 Minuten. Du kannst jederzeit aufhören und später weitermachen — nach jedem
Abschnitt steht, wie du prüfst, ob es geklappt hat.

Was du brauchst:
- Ein Cloudflare-Konto (kostenlos, [dash.cloudflare.com](https://dash.cloudflare.com))
- Dein GitHub-Konto mit dem Repo `janheisig/training`
- Dein Strava-Konto

> **Hinweis zu Menünamen:** Cloudflare benennt seine Menüpunkte hin und wieder um. Wenn ein
> Name bei dir anders heißt, such im Dashboard oben nach dem Stichwort in **fett** — die
> Sache selbst ist dieselbe.

---

## Schritt 1 · Datenbank anlegen

Hier entstehen deine Trainingsdaten. Das machen wir zuerst, damit später nichts wartet.

1. Gehe auf [dash.cloudflare.com](https://dash.cloudflare.com) und melde dich an.
2. In der linken Seitenleiste: **Storage & Databases** → **D1 SQL Database**.
   (Falls du das nicht findest: oben ins Suchfeld `D1` eintippen.)
3. Klick auf **Create** (oder **Create database**).
4. Als Namen eintragen — **exakt so, kleingeschrieben**:

   ```
   training
   ```

5. **Create** klicken.

Du landest auf der Übersichtsseite deiner neuen Datenbank.

### Die Datenbank-ID kopieren

Auf dieser Seite steht ein Feld **Database ID**. Das ist eine lange Zeichenkette in der Form

```
a1b2c3d4-5678-90ab-cdef-1234567890ab
```

**Kopiere sie und leg sie irgendwo zwischen** (Notizen-App). Du brauchst sie in Schritt 3.

### Tabellen anlegen

1. Auf derselben Seite den Reiter **Console** öffnen. (Bei manchen Konten heißt er
   **Query** oder liegt hinter einem Knopf **Explore Data**.)
2. Den **kompletten** folgenden Block markieren, kopieren und in das Eingabefeld einfügen:

```sql
CREATE TABLE IF NOT EXISTS logs (
  datum      TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS gewicht (
  datum      TEXT PRIMARY KEY,
  kg         REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ftp (
  datum       TEXT PRIMARY KEY,
  watts       REAL NOT NULL,
  quelle      TEXT,
  vorlaeufig  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS benchmarks (
  datum      TEXT PRIMARY KEY,
  kmh        REAL,
  hf         REAL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS supplements (
  datum      TEXT PRIMARY KEY,
  kreatin    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  mon        TEXT PRIMARY KEY,
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS strava_token (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  athlete       TEXT,
  updated_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS strava_activities (
  id         INTEGER PRIMARY KEY,
  datum      TEXT NOT NULL,
  payload    TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_strava_datum ON strava_activities (datum);
CREATE INDEX IF NOT EXISTS idx_logs_updated ON logs (updated_at);
```

3. Auf **Execute** / **Run** klicken.

**Geschafft, wenn:** du im Reiter **Tables** acht Tabellen siehst — `benchmarks`, `ftp`,
`gewicht`, `logs`, `notes`, `strava_activities`, `strava_token`, `supplements`.

> Falls die Konsole meckert, dass nur ein Befehl auf einmal geht: füge die Blöcke einzeln ein
> (jeder beginnt mit `CREATE` und endet mit `;`) und führe sie nacheinander aus.

---

## Schritt 2 · Zwei Passwörter erzeugen

Du brauchst gleich zwei Zeichenketten. Erzeuge sie **jetzt** und leg sie neben die
Datenbank-ID.

**`APP_PASSWORD`** — dein Passwort für die App. Denk dir eins aus, mindestens 12 Zeichen.
Das tippst du später einmal auf dem iPhone ein.

**`SESSION_SECRET`** — eine lange Zufallszeichenkette, die deine Anmeldung signiert. Die
musst du dir nicht merken. So kommst du an eine, ohne Terminal:

- Öffne [1password.com/de/password-generator](https://1password.com/de/password-generator)
  oder einen beliebigen Passwortgenerator
- Länge auf **40 Zeichen** stellen, Sonderzeichen an
- Erzeugen und kopieren

Beide Werte gehen gleich als **Secret** zu Cloudflare — sie tauchen nie im Code auf und sind
auch für dich später nicht mehr auslesbar. Deshalb: jetzt zwischenspeichern.

---

## Schritt 3 · Datenbank-ID ins Repo eintragen

Genau eine Zeile im Repo muss geändert werden. Das geht direkt auf GitHub.

1. Öffne <https://github.com/janheisig/training/blob/main/wrangler.toml>
2. Klick rechts oben auf das **Stift-Symbol** (✏️, „Edit this file")
3. Du siehst diesen Text:

   ```toml
   name = "training"
   compatibility_date = "2026-09-01"
   pages_build_output_dir = "dist"

   [[d1_databases]]
   binding = "DB"
   database_name = "training"
   database_id = "00000000-0000-0000-0000-000000000000"  # ← ersetzen, siehe README
   ```

4. Ersetze `00000000-0000-0000-0000-000000000000` durch **deine** Datenbank-ID aus Schritt 1.
   Die Anführungszeichen bleiben stehen. Danach sieht die Zeile etwa so aus:

   ```toml
   database_id = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
   ```

5. Rechts oben **Commit changes…** → im Dialog nochmal **Commit changes**

**Geschafft, wenn:** in der Datei auf GitHub jetzt deine echte ID steht und nicht mehr die
Nullen.

---

## Schritt 4 · Die App bei Cloudflare anlegen

1. Im Cloudflare-Dashboard links: **Compute (Workers)** → **Workers & Pages**.
   (Falls anders benannt: oben nach `Pages` suchen.)
2. **Create** klicken → Reiter **Pages** → **Connect to Git**
3. Beim ersten Mal fragt Cloudflare nach Zugriff auf GitHub. Bestätige das und wähle
   entweder alle Repos oder gezielt `janheisig/training`.
4. In der Liste `training` auswählen → **Begin setup**
5. Jetzt kommt das Formular. Trag **genau** das ein:

   | Feld | Wert |
   |---|---|
   | Project name | `training` |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |

   > **Wichtig:** Der Project name muss `training` heißen. In `wrangler.toml` steht
   > `name = "training"` — weichen die beiden voneinander ab, bricht der Build ab.

6. **Save and Deploy**

Der erste Build läuft jetzt ein bis zwei Minuten. Danach bekommst du eine Adresse in der Form

```
https://training-xyz.pages.dev
```

**Notiere dir diese Adresse** — du brauchst sie in Schritt 6.

### Prüfen

Öffne im Browser:

```
https://DEINE-ADRESSE.pages.dev/api/health
```

Du solltest so etwas sehen:

```json
{"ok":true,"db":"ok","konfiguriert":{"SESSION_SECRET":false,"APP_PASSWORD":false,"STRAVA_CLIENT_ID":false,"STRAVA_CLIENT_SECRET":false}}
```

**Das ist der richtige Zwischenstand.** Wichtig ist `"db":"ok"` — die Datenbank hängt dran.
Dass die vier Werte auf `false` stehen, ist korrekt, die kommen jetzt.

> **`"db":"fehlt"` oder eine Fehlermeldung?** Dann stimmt die Datenbank-ID in `wrangler.toml`
> nicht, oder der Deploy lief noch mit der alten Version. Schritt 3 prüfen, dann in Cloudflare
> unter **Deployments** beim obersten Eintrag **Retry deployment**.

---

## Schritt 5 · Die beiden Geheimnisse hinterlegen

1. In Cloudflare: **Workers & Pages** → dein Projekt **training**
2. Reiter **Settings**
3. Abschnitt **Variables and Secrets** (bei manchen Konten: **Environment variables**)
4. Sicherstellen, dass oben **Production** ausgewählt ist — nicht Preview
5. **Add** klicken. Für jeden der beiden Einträge:

   - **Type:** unbedingt **Secret** wählen, nicht *Text* / *Plaintext*
   - **Variable name** und **Value** wie in der Tabelle:

   | Variable name | Value |
   |---|---|
   | `APP_PASSWORD` | dein ausgedachtes Passwort aus Schritt 2 |
   | `SESSION_SECRET` | die Zufallszeichenkette aus Schritt 2 |

   Die Namen müssen **exakt** so geschrieben sein: Großbuchstaben, Unterstrich, keine
   Leerzeichen davor oder dahinter.

6. **Save** / **Deploy** klicken.

### Wirksam machen

Secrets greifen erst beim nächsten Deploy. Also:

**Deployments** → beim obersten Eintrag rechts auf **⋯** → **Retry deployment**

### Prüfen

```
https://DEINE-ADRESSE.pages.dev/api/health
```

Jetzt muss dort stehen:

```json
{"ok":true,"db":"ok","konfiguriert":{"SESSION_SECRET":true,"APP_PASSWORD":true,...}}
```

**Jetzt kannst du die App zum ersten Mal öffnen.** Ruf `https://DEINE-ADRESSE.pages.dev` auf,
gib dein `APP_PASSWORD` ein — du solltest den Tagesplan sehen.

Ab hier funktioniert alles außer Strava. Du könntest also schon loslegen.

---

## Schritt 6 · Strava verbinden

1. Öffne <https://www.strava.com/settings/api> (eingeloggt).
2. Falls du noch keine Anwendung hast, kommt ein Formular. Trag ein:

   | Feld | Wert |
   |---|---|
   | Application Name | `Training Dashboard` |
   | Category | `Training` |
   | Club | leer lassen |
   | Website | `https://DEINE-ADRESSE.pages.dev` |
   | Application Description | `Persönliches Trainingstagebuch` |
   | Authorization Callback Domain | **siehe unten** |

3. **Authorization Callback Domain** ist die Stelle, an der es am häufigsten klemmt. Dort
   gehört **nur die Domain** hin — ohne `https://`, ohne Schrägstrich, ohne Pfad:

   ✅ richtig:
   ```
   training-xyz.pages.dev
   ```

   ❌ falsch:
   ```
   https://training-xyz.pages.dev
   https://training-xyz.pages.dev/
   training-xyz.pages.dev/api/strava/callback
   ```

4. Ein Logo verlangt Strava auch — irgendein quadratisches Bild reicht, es wird nirgends
   angezeigt.
5. **Create** klicken.

### Die beiden Strava-Werte übertragen

Strava zeigt dir jetzt eine Seite mit unter anderem:

- **Client ID** — eine Zahl, etwa `168432`
- **Client Secret** — eine lange Zeichenkette (eventuell hinter **Show** versteckt)

Beide gehen nach Cloudflare, genauso wie in Schritt 5:

**Workers & Pages → training → Settings → Variables and Secrets → Production → Add**, jeweils
als **Secret**:

| Variable name | Value |
|---|---|
| `STRAVA_CLIENT_ID` | die Zahl von Strava |
| `STRAVA_CLIENT_SECRET` | die lange Zeichenkette von Strava |

Danach wieder: **Deployments → ⋯ → Retry deployment**

### In der App verbinden

1. App öffnen, unten rechts auf **Mehr**
2. Unter *Strava* auf **Mit Strava verbinden**
3. Strava fragt nach Berechtigungen. **Das Häkchen bei „Alle deine Aktivitäten ansehen"
   muss gesetzt sein** — ohne das kann das Dashboard deine Fahrten nicht lesen.
4. **Autorisieren**

Du landest wieder in der App und siehst „Strava ist verbunden".

### Prüfen

In der App: **Mehr → Letzte 4 Wochen**. Wenn Radfahrten im Zeitraum liegen, erscheinen sie
danach im Tab **Woche**.

---

## Schritt 7 · Aufs iPhone legen

Das muss **Safari** sein. Chrome auf dem iPhone kann keine Web-Apps installieren.

1. In Safari `https://DEINE-ADRESSE.pages.dev` öffnen
2. Anmelden (dein `APP_PASSWORD`) — danach bleibst du ein halbes Jahr angemeldet
3. Unten in der Mitte auf das **Teilen-Symbol** (Quadrat mit Pfeil nach oben)
4. In der Liste nach unten scrollen → **Zum Home-Bildschirm**
5. Name steht schon auf „Training" → oben rechts **Hinzufügen**

Jetzt liegt das Icon auf deinem Home-Bildschirm. Die App startet ohne Adressleiste und
funktioniert im Gym auch ohne Empfang.

> **Wichtig:** Melde dich in der App auf dem Home-Bildschirm noch einmal an, falls sie danach
> fragt. Safari und die installierte App teilen sich den Speicher nicht immer.

---

## Wenn etwas nicht klappt

| Was du siehst | Was los ist |
|---|---|
| „Server nicht fertig eingerichtet — es fehlen: …" | Die genannten Secrets fehlen oder der Retry-Deploy steht noch aus. Schritt 5. |
| `"db":"fehlt"` unter `/api/health` | Datenbank-ID in `wrangler.toml` stimmt nicht, oder der Build lief vor deiner Änderung. Schritt 3, dann neu deployen. |
| Build schlägt fehl mit Namensfehler | Project name in Cloudflare und `name` in `wrangler.toml` müssen beide `training` sein. |
| „Passwort stimmt nicht" | Leerzeichen am Anfang oder Ende des Secrets. In Cloudflare löschen und neu anlegen. |
| Strava: „Berechtigung fehlt" | Beim Autorisieren war das Häkchen „Alle deine Aktivitäten ansehen" nicht gesetzt. Nochmal verbinden. |
| Strava: „redirect_uri mismatch" o. Ä. | Die Callback Domain bei Strava enthält `https://` oder einen Pfad. Nur die nackte Domain eintragen. Schritt 6.3. |
| App zeigt alte Version | Rechts unten **Mehr** öffnen, Seite neu laden. Der Service Worker aktualisiert beim nächsten Start. |

Was `/api/health` sagt, ist immer der schnellste Hinweis — der Endpunkt antwortet ohne
Anmeldung und listet auf, was konfiguriert ist.

---

## Was du nie tun solltest

- **`APP_PASSWORD` oder `SESSION_SECRET` in eine Datei im Repo schreiben.** Das Repo ist
  öffentlich einsehbar, sobald du es teilst. Beide gehören ausschließlich in die Cloudflare-Secrets.
- **Die Datei `.dev.vars` committen.** Sie steht in `.gitignore` und soll da bleiben.
- **`Client Secret` von Strava weitergeben.** Damit könnte jemand in deinem Namen auf deine
  Strava-Daten zugreifen. Falls es doch mal irgendwo landet: auf strava.com/settings/api
  neu erzeugen und in Cloudflare aktualisieren.

---

## Mit Terminal (Alternative)

Falls du doch lieber die Kommandozeile nimmst, ersetzen diese Befehle die Schritte 1 und 3:

```bash
git clone https://github.com/janheisig/training
cd training
npm install
npx wrangler login
npx wrangler d1 create training          # gibt die database_id aus
# ID in wrangler.toml eintragen, dann:
npx wrangler d1 execute training --remote --file=schema.sql
```

Die Secrets (Schritt 5 und 6) setzt du trotzdem am besten im Dashboard — auf der
Kommandozeile landen sie sonst in deiner Shell-Historie.
