-- Trainings-Dashboard · D1-Schema
-- Eine Zeile pro Tag bzw. pro Messung. Das ist der Kern des Sync-Modells:
-- zwei Geräte können nie denselben Datensatz gleichzeitig überschreiben, solange
-- sie nicht denselben Tag bearbeiten. Konflikte werden pro Zeile über updated_at
-- entschieden, nicht über ein globales JSON-Blob.

CREATE TABLE IF NOT EXISTS logs (
  datum      TEXT PRIMARY KEY,          -- YYYY-MM-DD
  payload    TEXT NOT NULL,             -- JSON: { entries, cardio, note, befinden }
  updated_at INTEGER NOT NULL           -- epoch ms
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
  mon        TEXT PRIMARY KEY,          -- Montag der Woche, YYYY-MM-DD
  payload    TEXT NOT NULL,             -- JSON: freie Wochennotiz
  updated_at INTEGER NOT NULL
);

-- Strava: ein Token-Satz (single user), Aktivitäten als Rohdaten-Cache.
CREATE TABLE IF NOT EXISTS strava_token (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,       -- epoch Sekunden (so liefert Strava es)
  athlete       TEXT,                   -- JSON
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS strava_activities (
  id         INTEGER PRIMARY KEY,       -- Strava-Aktivitäts-ID
  datum      TEXT NOT NULL,             -- lokales Datum YYYY-MM-DD
  payload    TEXT NOT NULL,             -- normalisiertes JSON
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_strava_datum ON strava_activities (datum);
CREATE INDEX IF NOT EXISTS idx_logs_updated ON logs (updated_at);
