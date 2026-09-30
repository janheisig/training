// Der Abgleich. GET liefert den ganzen Serverstand, PUT schreibt einzelne Datensätze.
//
// Wichtig: PUT schreibt nur, wenn der mitgeschickte Zeitstempel neuer ist als der in
// der Datenbank. Damit kann ein Gerät, das drei Tage offline war, beim Nachsynchronisieren
// keine neueren Einträge des anderen Geräts überschreiben.

import { json } from "../_lib/auth.js";

const TABELLEN = {
  logs: { key: "datum", spalten: ["payload"], istJson: true },
  gewicht: { key: "datum", spalten: ["kg"] },
  ftp: { key: "datum", spalten: ["watts", "quelle", "vorlaeufig"] },
  benchmarks: { key: "datum", spalten: ["kmh", "hf"] },
  supplements: { key: "datum", spalten: ["kreatin"] },
  notes: { key: "mon", spalten: ["payload"], istJson: true },
};

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: "Keine Datenbank angebunden (Binding DB fehlt)" }, 503);
  const out = { now: Date.now(), logs: {}, gewicht: {}, ftp: {}, benchmarks: {}, supplements: {}, notes: {} };

  try {
    const [logs, gewicht, ftp, benchmarks, supplements, notes] = await env.DB.batch([
      env.DB.prepare("SELECT datum, payload, updated_at FROM logs"),
      env.DB.prepare("SELECT datum, kg, updated_at FROM gewicht"),
      env.DB.prepare("SELECT datum, watts, quelle, vorlaeufig, updated_at FROM ftp"),
      env.DB.prepare("SELECT datum, kmh, hf, updated_at FROM benchmarks"),
      env.DB.prepare("SELECT datum, kreatin, updated_at FROM supplements"),
      env.DB.prepare("SELECT mon, payload, updated_at FROM notes"),
    ]);

    for (const r of logs.results || []) {
      try {
        out.logs[r.datum] = { ...JSON.parse(r.payload), _t: r.updated_at };
      } catch {
        /* defekte Zeile überspringen, nicht die ganze Antwort verlieren */
      }
    }
    for (const r of gewicht.results || []) out.gewicht[r.datum] = { kg: r.kg, _t: r.updated_at };
    for (const r of ftp.results || [])
      out.ftp[r.datum] = { watts: r.watts, quelle: r.quelle, vorlaeufig: !!r.vorlaeufig, _t: r.updated_at };
    for (const r of benchmarks.results || []) out.benchmarks[r.datum] = { kmh: r.kmh, hf: r.hf, _t: r.updated_at };
    for (const r of supplements.results || []) out.supplements[r.datum] = { kreatin: !!r.kreatin, _t: r.updated_at };
    for (const r of notes.results || []) {
      try {
        out.notes[r.mon] = { ...JSON.parse(r.payload), _t: r.updated_at };
      } catch {
        /* überspringen */
      }
    }
  } catch (e) {
    return json({ error: "Datenbankfehler: " + String(e.message || e).slice(0, 200) }, 500);
  }

  return json(out);
}

export async function onRequestPut({ request, env }) {
  if (!env.DB) return json({ error: "Keine Datenbank angebunden (Binding DB fehlt)" }, 503);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Kein lesbarer Request" }, 400);
  }
  const records = Array.isArray(body.records) ? body.records : [];
  if (!records.length) return json({ ok: true, applied: 0 });
  if (records.length > 500) return json({ error: "Zu viele Datensätze in einem Rutsch (max. 500)" }, 413);

  const stmts = [];
  for (const r of records) {
    const def = TABELLEN[r.table];
    if (!def || typeof r.key !== "string" || !r.key || r.value == null) continue;
    const t = Number.isFinite(r.t) ? r.t : Date.now();
    const v = r.value;

    if (def.istJson) {
      const { _t, ...rest } = v;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO ${r.table} (${def.key}, payload, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(${def.key}) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
           WHERE excluded.updated_at > ${r.table}.updated_at`
        ).bind(r.key, JSON.stringify(rest), t)
      );
    } else if (r.table === "gewicht") {
      const kg = Number(v.kg);
      if (!Number.isFinite(kg)) continue;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO gewicht (datum, kg, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(datum) DO UPDATE SET kg = excluded.kg, updated_at = excluded.updated_at
           WHERE excluded.updated_at > gewicht.updated_at`
        ).bind(r.key, kg, t)
      );
    } else if (r.table === "ftp") {
      const watts = Number(v.watts);
      if (!Number.isFinite(watts)) continue;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO ftp (datum, watts, quelle, vorlaeufig, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(datum) DO UPDATE SET watts = excluded.watts, quelle = excluded.quelle,
             vorlaeufig = excluded.vorlaeufig, updated_at = excluded.updated_at
           WHERE excluded.updated_at > ftp.updated_at`
        ).bind(r.key, watts, v.quelle || "", v.vorlaeufig ? 1 : 0, t)
      );
    } else if (r.table === "benchmarks") {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO benchmarks (datum, kmh, hf, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(datum) DO UPDATE SET kmh = excluded.kmh, hf = excluded.hf, updated_at = excluded.updated_at
           WHERE excluded.updated_at > benchmarks.updated_at`
        ).bind(r.key, v.kmh ?? null, v.hf ?? null, t)
      );
    } else if (r.table === "supplements") {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO supplements (datum, kreatin, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(datum) DO UPDATE SET kreatin = excluded.kreatin, updated_at = excluded.updated_at
           WHERE excluded.updated_at > supplements.updated_at`
        ).bind(r.key, v.kreatin ? 1 : 0, t)
      );
    }
  }

  if (!stmts.length) return json({ ok: true, applied: 0 });

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    return json({ error: "Schreiben fehlgeschlagen: " + String(e.message || e).slice(0, 200) }, 500);
  }
  return json({ ok: true, applied: stmts.length });
}
