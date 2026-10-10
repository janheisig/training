// Export als Text. Das ist jetzt die Brücke zur Analyse: Knopf drücken, kopieren,
// in den Chat werfen. Deshalb muss der Text für sich allein verständlich sein —
// inklusive Kontext, Kennzahlen und offener Fragen.

import { plusTage, weekBounds, tage, kurz, fmtNum, fmtKg, dow } from "./dates.js";
import { PLAN_START, ZIEL_DATUM, ZIEL_TITEL, blockInfo, getSession, sessionFuer, inReise, EX_INDEX, GEWICHT } from "./plan.js";
import { konstanz, wochenQuote, gewichtStatus, efVerlauf, wochenVolumen, streak, kreatinStreak } from "./metrics.js";

const listeAus = (map) =>
  Object.entries(map || {})
    .map(([datum, v]) => ({ datum, ...v }))
    .sort((a, b) => a.datum.localeCompare(b.datum));

export function exportText(data, todayStr) {
  const L = [];
  const logs = data.logs || {};
  const gewichtListe = listeAus(data.gewicht);
  const ftpListe = listeAus(data.ftp);
  const bi = blockInfo(todayStr);
  const restTage = tage(todayStr, ZIEL_DATUM);
  const k = konstanz(logs, todayStr);
  const gw = gewichtStatus(gewichtListe, todayStr);
  const aktuelleFtp = ftpListe.length ? ftpListe[ftpListe.length - 1] : null;

  L.push(`TRAININGS-EXPORT · Stand ${kurz(todayStr)}`);
  L.push("");
  L.push(`ZIEL: ${ZIEL_TITEL} am ${kurz(ZIEL_DATUM)} — ${restTage >= 0 ? `${restTage} Tage` : `vorbei seit ${-restTage} Tagen`}`);
  L.push(
    "KONTEXT: Nach dem 18.12. drei Wochen Urlaub (Hongkong bis 25.12., 1 Tag Bangkok, dann Koh Chang und Koh Samet bis 08.01.). " +
      "Der Urlaub ist die Belohnung, kein Prüfungstermin. Bergsteigen ist derzeit ausdrücklich kein Ziel. " +
      "Kein Laufen. Donnerstag ist blockiert (Arbeit bis 17:30, Klettern 18:00). " +
      "Rucksacklast nur draußen, im Studio nur Sandsäcke auf der Schulter."
  );
  L.push(
    `PLAN: ${bi.imPlan ? `Woche ${bi.weekOverall} von 12` : inReise(todayStr) ? "Reise-Modus" : "außerhalb des 12-Wochen-Bogens"}` +
      ` · Block ${bi.blockNr} (${bi.blockType}) „${bi.blockName}“ · Woche ${bi.weekInBlock} im Block` +
      `${bi.deload ? " · DELOAD" : ""}${bi.retest ? " · STANDORTBESTIMMUNG" : ""}${bi.abreise ? " · ABREISEWOCHE" : ""}`
  );
  L.push("");

  // ── Leitkennzahl ──
  L.push("── KONSTANZ (die Leitkennzahl) ──");
  if (k) {
    L.push(`Letzte 4 Wochen: ${Math.round(k.quote * 100)} % der geplanten Einheiten erfüllt`);
    for (const w of k.wochen) L.push(`  KW ab ${w.mon}: ${w.done}/${w.planned}`);
    L.push(`Aktuelle Serie: ${streak(logs, todayStr)} Einheiten ohne Ausfall`);
    if (k.quote < 0.65)
      L.push("HINWEIS: Unter 65 % liegt es fast nie an der Motivation, sondern am Plan. Bitte Kürzungsvorschlag machen, keine Motivationsrede.");
  } else {
    L.push("Noch keine abgeschlossenen Plantage.");
  }
  L.push("");

  // ── Körpergewicht ──
  L.push("── KÖRPERGEWICHT ──");
  if (gw) {
    L.push(`7-Tage-Schnitt: ${fmtKg(gw.avg)} kg (aus ${gw.n} Wiegungen)`);
    if (gw.rate !== null) L.push(`Rate gegen Vorwoche: ${gw.rate > 0 ? "+" : ""}${fmtKg(gw.rate)} kg — ${gw.label}`);
    if (gw.imWasserfenster) L.push("ACHTUNG: noch im Kreatin-Wasserfenster (erste 2 Wochen), Rate nicht bewerten.");
    if (gw.prognose) L.push(`Fortschreibung bis ${kurz(ZIEL_DATUM)}: ~${fmtKg(gw.prognose)} kg`);
    L.push(`Korridor: ${GEWICHT.rateZiel[0]} bis ${GEWICHT.rateZiel[1]} kg/Woche · schneller als ${GEWICHT.rateHart} heißt MEHR essen, nicht weniger`);
    L.push(`Alle Wiegungen: ${gewichtListe.map((g) => `${g.datum} ${fmtKg(g.kg)}`).join(" · ")}`);
  } else {
    L.push("Keine Wiegungen eingetragen.");
  }
  L.push(`Kreatin-Serie: ${kreatinStreak(data.supplements || {}, todayStr)} Tage`);
  L.push("");

  // ── Rad / Watt ──
  L.push("── RAD & WATT ──");
  L.push(aktuelleFtp ? `FTP: ${aktuelleFtp.watts} W (${aktuelleFtp.datum}, ${aktuelleFtp.quelle}${aktuelleFtp.vorlaeufig ? ", VORLÄUFIG" : ""})` : "Keine FTP bekannt.");
  if (ftpListe.length > 1) L.push(`FTP-Verlauf: ${ftpListe.map((f) => `${f.datum} ${f.watts} W`).join(" → ")}`);
  const efs = efVerlauf(logs);
  if (efs.length) {
    L.push(`Efficiency Factor (nur echte Gerätewatt): ${efs.map((e) => `${e.datum} ${fmtNum(e.ef)} (${e.watts} W @ ${e.hf} bpm)`).join(" · ")}`);
    if (efs.length >= 2) {
      const d = efs[efs.length - 1].ef - efs[0].ef;
      L.push(`EF-Veränderung seit erster Messung: ${d > 0 ? "+" : ""}${fmtNum(d)}`);
    }
  }
  L.push("");

  // ── Wochenprotokoll, letzte 6 Wochen ──
  L.push("── PROTOKOLL (letzte 6 Wochen) ──");
  const startMon = plusTage(weekBounds(todayStr).mon, -5 * 7);
  for (let w = 0; w < 6; w++) {
    const mon = plusTage(startMon, w * 7);
    const q = wochenQuote(logs, mon, todayStr);
    const vol = wochenVolumen(logs, mon);
    const wbi = blockInfo(mon);
    const kopf = `KW ab ${mon}${wbi.imPlan ? ` · Plan-Woche ${wbi.weekOverall}` : ""}${wbi.deload ? " · Deload" : ""}${q.planned ? ` · ${q.done}/${q.planned} erfüllt` : ""}${vol.saetze ? ` · ${vol.saetze} Sätze, ~${vol.tonnage} kg Tonnage` : ""}`;
    const zeilen = [];
    for (let i = 0; i < 7; i++) {
      const datum = plusTage(mon, i);
      const l = logs[datum];
      if (!l) continue;
      const s = sessionFuer(datum, dow(datum), l);
      const teile = [];
      for (const [exId, e] of Object.entries(l.entries || {})) {
        const meta = EX_INDEX[exId] || { name: exId, unit: "" };
        const sets = (e.sets || []).filter((x) => x);
        if (!sets.length && !e.done) continue;
        const kz = (e.sets || []).map((r, i) => (r ? `${r}${(e.kg || [])[i] ? "+" + e.kg[i] + "kg" : ""}${(e.band || [])[i] ? "(Band)" : ""}` : null)).filter(Boolean);
        if (exId === "klimmzge" && kz.length) {
          teile.push(`${meta.name} ${kz.join("/")} Reps${e.done ? "" : " (offen)"}`);
          continue;
        }
        const rp = (e.reps || []).filter((x) => x);
        teile.push(`${meta.name} ${sets.length ? sets.join("/") : "✓"}${meta.unit && sets.length ? " " + meta.unit : ""}${rp.length ? ` × ${rp.join("/")} Reps` : ""}${e.done ? "" : " (offen)"}`);
      }
      const c = l.cardio || {};
      if ((c.aktivitaeten || []).length)
        for (const a of c.aktivitaeten)
          teile.push(
            `${a.sport || "Aktivität"}${a.distanz_km ? ` ${a.distanz_km} km` : ""}${a.zeit_hmm ? ` ${a.zeit_hmm}` : ""}${a.hf_avg ? ` Ø${a.hf_avg}bpm` : ""}${a.watts_avg ? ` Ø${a.watts_avg}W${a.watts_ist_geschaetzt ? "(gesch.)" : ""}` : ""}${a.ef != null ? ` EF${fmtNum(a.ef)}` : ""}`
          );
      else if (c.done || c.distanz) teile.push(`Cardio ${c.distanz ? c.distanz + " km" : "erledigt"}`);
      if (!teile.length && !l.note) continue;
      zeilen.push(
        `  ${kurz(datum)} [${s.title}]${l.befinden ? ` (Befinden ${l.befinden}/5)` : ""}: ${teile.join(" · ")}${l.note ? ` — Notiz: ${l.note}` : ""}`
      );
    }
    if (zeilen.length || q.planned) {
      L.push(kopf);
      L.push(...(zeilen.length ? zeilen : ["  (keine Einträge)"]));
    }
  }
  L.push("");

  // ── Die heutige Einheit ──
  const s = getSession(todayStr, dow(todayStr));
  L.push(`── HEUTE (${kurz(todayStr)}): ${s.title} ──`);
  if (s.hint) L.push(s.hint);
  for (const ex of s.exercises) L.push(`  ${ex.name} · ${ex.scheme}${ex.note ? ` — ${ex.note}` : ""}`);
  L.push("");
  L.push("── FRAGE AN CLAUDE ──");
  L.push(
    "Schau dir die Konstanz, die Kraftverläufe, den EF und den Gewichtstrend an. Sag mir: (1) was in dieser Woche gut lief, " +
      "(2) wo der Plan nicht zum Alltag passt und was ich streichen oder kürzen soll, (3) welche Gewichte oder Zeiten ich nächste Woche " +
      "konkret ansteuere. Keine Kalorienzahlen, keine Motivationsreden, kein Bergsteigen."
  );
  L.push(`(Plan-Start ${PLAN_START} · Export erzeugt ${new Date().toISOString()})`);
  return L.join("\n");
}

/** Vollständiger Datenexport als JSON-Datei — die Sicherung. */
export const exportJson = (data) => JSON.stringify({ version: 1, erzeugt: new Date().toISOString(), data }, null, 2);
