// Holt die Aktivitäten eines Zeitraums und schreibt sie in die Tages-Logs.
//
// Zentrale Vorsicht: der Sync fasst NUR den Cardio-Teil an. Hanteleinträge, Notizen
// und das Befinden bleiben unberührt — sonst würde eine Radfahrt das Protokoll der
// Kraftsession vom selben Tag löschen.
//
// Zweite Vorsicht: `updated_at` wird nur erhöht, wenn sich wirklich etwas geändert hat.
// Sonst wäre der Server nach jedem Sync „neuer“ als das Handy und würde beim Abgleich
// gewinnen, ohne neue Information zu tragen.

import { aktivitaetenHolen, normalisieren } from "../../_lib/strava.js";
import { json } from "../../_lib/auth.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: "Keine Datenbank angebunden" }, 503);

  let body = {};
  try {
    body = await request.json();
  } catch {
    /* Standardzeitraum unten */
  }

  const heute = new Date().toISOString().slice(0, 10);
  const von = ISO.test(body.von || "") ? body.von : new Date(Date.now() - 27 * 864e5).toISOString().slice(0, 10);
  const bis = ISO.test(body.bis || "") ? body.bis : heute;
  if (von > bis) return json({ error: "Zeitraum verdreht: „von“ liegt nach „bis“" }, 400);

  let roh;
  try {
    roh = await aktivitaetenHolen(env, von, bis);
  } catch (e) {
    const msg = String(e.message || e);
    const status = msg.includes("nicht verbunden") ? 409 : msg.includes("Limit") ? 429 : 502;
    return json({ error: msg.slice(0, 300) }, status);
  }

  // Nach lokalem Datum gruppieren, nur der angefragte Zeitraum.
  const perTag = new Map();
  for (const a of roh) {
    const n = normalisieren(a);
    if (!n.datum || n.datum < von || n.datum > bis) continue;
    if (!perTag.has(n.datum)) perTag.set(n.datum, []);
    perTag.get(n.datum).push(n);
  }

  // Bestehende Logs der betroffenen Tage laden.
  const tage = [...perTag.keys()];
  const vorhanden = new Map();
  if (tage.length) {
    const platzhalter = tage.map(() => "?").join(",");
    const res = await env.DB.prepare(`SELECT datum, payload, updated_at FROM logs WHERE datum IN (${platzhalter})`)
      .bind(...tage)
      .all();
    for (const r of res.results || []) {
      try {
        vorhanden.set(r.datum, { payload: JSON.parse(r.payload), updated_at: r.updated_at });
      } catch {
        vorhanden.set(r.datum, { payload: {}, updated_at: r.updated_at });
      }
    }
  }

  const jetzt = Date.now();
  const stmts = [];
  const tageAusgabe = {};
  let geaendert = 0;

  for (const [datum, acts] of perTag) {
    acts.sort((a, b) => (b.distanz_km || 0) - (a.distanz_km || 0));
    const haupt = acts[0];
    const summeKm = Math.round(acts.reduce((s, a) => s + (a.distanz_km || 0), 0) * 10) / 10;
    const summeHm = acts.reduce((s, a) => s + (a.anstieg_m || 0), 0);
    const mitHf = acts.filter((a) => a.hf_avg);
    // Puls über die Aktivitäten nach Bewegungszeit gewichten, nicht stumpf mitteln.
    const hfGewichtet = mitHf.length
      ? Math.round(
          mitHf.reduce((s, a) => s + a.hf_avg * (a.bewegt_sek || 1), 0) / mitHf.reduce((s, a) => s + (a.bewegt_sek || 1), 0)
        )
      : null;

    const alt = vorhanden.get(datum) || { payload: {}, updated_at: 0 };
    const altCardio = alt.payload.cardio || {};

    const neuCardio = {
      ...altCardio, // manuelle Felder und eine vorhandene Bewertung behalten
      quelle: "Strava",
      sport: acts.length > 1 ? `${acts.length} Aktivitäten` : haupt.sport,
      distanz: String(summeKm),
      zeit: haupt.zeit_hmm || altCardio.zeit || "",
      hf: hfGewichtet ? String(hfGewichtet) : altCardio.hf || "",
      hm: summeHm ? String(summeHm) : altCardio.hm || "",
      pendel: acts.some((a) => a.pendel),
      done: true,
      aktivitaeten: acts,
    };

    const neuPayload = { ...alt.payload, cardio: neuCardio };
    tageAusgabe[datum] = neuCardio;

    // Nur schreiben, wenn sich der Cardio-Teil inhaltlich unterscheidet.
    if (JSON.stringify(altCardio) === JSON.stringify(neuCardio)) continue;
    geaendert++;

    stmts.push(
      env.DB.prepare(
        `INSERT INTO logs (datum, payload, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(datum) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`
      ).bind(datum, JSON.stringify(neuPayload), jetzt)
    );

    for (const a of acts)
      stmts.push(
        env.DB.prepare(
          `INSERT INTO strava_activities (id, datum, payload, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET datum = excluded.datum, payload = excluded.payload, updated_at = excluded.updated_at`
        ).bind(a.strava_id, datum, JSON.stringify(a), jetzt)
      );
  }

  if (stmts.length) {
    try {
      // D1 verträgt große Batches schlecht — in Häppchen schreiben.
      for (let i = 0; i < stmts.length; i += 40) await env.DB.batch(stmts.slice(i, i + 40));
    } catch (e) {
      return json({ error: "Schreiben fehlgeschlagen: " + String(e.message || e).slice(0, 200) }, 500);
    }
  }

  return json({
    ok: true,
    von,
    bis,
    gefunden: roh.length,
    tage: tageAusgabe,
    geaendert,
    stand: jetzt,
  });
}
