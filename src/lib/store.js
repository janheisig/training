// Offline-First-Speicher.
//
// Regel: jede Eingabe landet sofort im localStorage und gilt damit als gespeichert.
// Der Server ist nur der Abgleich zwischen Geräten, nie der kritische Pfad — im Gym
// ist der Empfang schlecht, und ein Satz, der wegen eines Timeouts verloren geht,
// wäre der schlimmste denkbare Fehler.
//
// Datenmodell: überall Maps mit dem Datum als Schlüssel, nie Arrays. Jeder Datensatz
// trägt seinen Zeitstempel `_t`. Damit ist das Zusammenführen zweier Geräte ein
// Vergleich pro Datensatz statt ein Konflikt auf dem ganzen Dokument.

import { SEED_LOGS, SEED_FTP, SEED_BENCHMARKS, SEED_GEWICHT } from "./seed.js";

const LS_DATA = "training-data-v1";
const LS_DIRTY = "training-dirty-v1";
const LS_TOKEN = "training-token";
const LS_SEEDED = "training-seeded-v1";

export const TABLES = ["logs", "gewicht", "ftp", "benchmarks", "supplements", "notes"];

export const leer = () => ({ logs: {}, gewicht: {}, ftp: {}, benchmarks: {}, supplements: {}, notes: {} });

// ─── Token ───────────────────────────────────────────────────
export const getToken = () => {
  try {
    return localStorage.getItem(LS_TOKEN) || "";
  } catch {
    return "";
  }
};
export const setToken = (t) => {
  try {
    t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN);
  } catch {
    /* Privatmodus — dann eben nur für diese Sitzung */
  }
};

// ─── Lokaler Speicher ────────────────────────────────────────
export function loadLocal() {
  let data = leer();
  try {
    const raw = localStorage.getItem(LS_DATA);
    if (raw) data = { ...data, ...JSON.parse(raw) };
  } catch {
    /* kaputter Eintrag — mit leerem Stand weitermachen, nicht abstürzen */
  }
  for (const t of TABLES) if (!data[t] || typeof data[t] !== "object") data[t] = {};
  return data;
}

export function saveLocal(data) {
  try {
    localStorage.setItem(LS_DATA, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadDirty() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LS_DIRTY) || "[]"));
  } catch {
    return new Set();
  }
}

export function saveDirty(set) {
  try {
    localStorage.setItem(LS_DIRTY, JSON.stringify([...set]));
  } catch {
    /* ignorieren */
  }
}

/** Altbestand einmalig einspielen. Eigene Einträge gewinnen immer. */
export function seedOnce(data) {
  let seeded = false;
  try {
    seeded = localStorage.getItem(LS_SEEDED) === "1";
  } catch {
    /* ignorieren */
  }
  if (seeded) return { data, veraendert: false };

  const next = { ...data, logs: { ...data.logs }, ftp: { ...data.ftp }, benchmarks: { ...data.benchmarks }, gewicht: { ...data.gewicht } };
  const t = 1; // Zeitstempel 1: älter als alles Echte, verliert jeden Abgleich
  let veraendert = false;

  for (const [datum, v] of Object.entries(SEED_LOGS))
    if (!next.logs[datum]) {
      next.logs[datum] = { ...v, _t: t };
      veraendert = true;
    }
  for (const e of SEED_FTP)
    if (!next.ftp[e.datum]) {
      next.ftp[e.datum] = { watts: e.watts, quelle: e.quelle, vorlaeufig: e.vorlaeufig, _t: t };
      veraendert = true;
    }
  for (const b of SEED_BENCHMARKS)
    if (!next.benchmarks[b.datum]) {
      next.benchmarks[b.datum] = { kmh: b.kmh, hf: b.hf, _t: t };
      veraendert = true;
    }
  for (const g of SEED_GEWICHT)
    if (!next.gewicht[g.datum]) {
      next.gewicht[g.datum] = { kg: g.kg, _t: t };
      veraendert = true;
    }

  try {
    localStorage.setItem(LS_SEEDED, "1");
  } catch {
    /* ignorieren */
  }
  return { data: next, veraendert };
}

/**
 * Zwei Stände zusammenführen: pro Datensatz gewinnt der jüngere Zeitstempel.
 * Rein und ohne Seiteneffekte, damit testbar.
 */
export function merge(local, remote) {
  const out = leer();
  for (const t of TABLES) {
    const a = local[t] || {};
    const b = remote[t] || {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const la = a[k];
      const lb = b[k];
      if (!la) out[t][k] = lb;
      else if (!lb) out[t][k] = la;
      else out[t][k] = (lb._t || 0) > (la._t || 0) ? lb : la;
    }
  }
  return out;
}

/** Datensätze, die noch zum Server müssen, in das Format der API bringen. */
export function dirtyRecords(data, dirty) {
  const out = [];
  for (const id of dirty) {
    const i = id.indexOf(":");
    const table = id.slice(0, i);
    const key = id.slice(i + 1);
    if (!TABLES.includes(table)) continue;
    const value = (data[table] || {})[key];
    if (value === undefined) continue;
    out.push({ table, key, value, t: value._t || Date.now() });
  }
  return out;
}

// ─── API ─────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function api(pfad, opts = {}) {
  const token = getToken();
  let resp;
  try {
    resp = await fetch(pfad, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  } catch (e) {
    throw new ApiError("Keine Verbindung", 0);
  }
  const text = await resp.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    /* kein JSON */
  }
  if (!resp.ok) throw new ApiError((j && j.error) || `Serverfehler ${resp.status}`, resp.status);
  return j;
}

export const login = (password) => api("/api/login", { method: "POST", body: JSON.stringify({ password }) });

export const pull = () => api("/api/state");

export const push = (records) => api("/api/state", { method: "PUT", body: JSON.stringify({ records }) });

export const stravaStatus = () => api("/api/strava/status");

export const stravaSync = (von, bis) =>
  api("/api/strava/sync", { method: "POST", body: JSON.stringify({ von, bis }) });

export const stravaDisconnect = () => api("/api/strava/disconnect", { method: "POST" });
