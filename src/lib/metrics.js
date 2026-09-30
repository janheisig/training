// Alle Kennzahlen werden hier deterministisch gerechnet — kein Modell, keine Schätzung.
// Die Leitkennzahl dieses Bogens ist die Konstanz: wie viele geplante Einheiten
// tatsächlich stattgefunden haben.

import { plusTage, weekBounds, tage, dow, num } from "./dates.js";
import { PLAN_START, ZIEL_DATUM, GEWICHT, KREATIN, FTP_ZONES, inReise, getSession } from "./plan.js";

export const FARBEN = { ok: "#7CC98A", warn: "#E8B94A", bad: "#E05656", dim: "#8FA1AC" };

/** Gilt eine Einheit an diesem Tag als erfüllt? Ein Satz oder eine Cardio-Aktivität reicht. */
export function einheitErfuellt(logs, k) {
  const l = logs[k];
  if (!l) return false;
  const anySet = Object.values(l.entries || {}).some((e) => e.done || (e.sets || []).some((x) => x));
  const c = l.cardio || {};
  return anySet || !!(c.done || (c.aktivitaeten || []).length || c.distanz || c.zeit);
}

/** Erfüllte von geplanten Einheiten in der Woche ab `monStr`. Reisetage und Ruhetage zählen nicht. */
export function wochenQuote(logs, monStr, todayStr) {
  let done = 0;
  let planned = 0;
  for (let i = 0; i < 7; i++) {
    const k = plusTage(monStr, i);
    if (k > todayStr || k < PLAN_START || inReise(k)) continue;
    if (getSession(k, dow(k)).type === "rest") continue;
    planned++;
    if (einheitErfuellt(logs, k)) done++;
  }
  return { mon: monStr, done, planned };
}

/** Konstanz über die letzten vier Wochen. `null`, solange keine Plan-Tage vergangen sind. */
export function konstanz(logs, todayStr) {
  const wochen = [];
  for (let i = 3; i >= 0; i--) {
    const q = wochenQuote(logs, plusTage(weekBounds(todayStr).mon, -i * 7), todayStr);
    if (q.planned > 0) wochen.push(q);
  }
  if (!wochen.length) return null;
  const sum = wochen.reduce((a, w) => ({ done: a.done + w.done, planned: a.planned + w.planned }), { done: 0, planned: 0 });
  const quote = sum.done / sum.planned;
  return {
    wochen,
    quote,
    diese: wochen[wochen.length - 1],
    farbe: quote >= 0.85 ? FARBEN.ok : quote >= 0.65 ? FARBEN.warn : FARBEN.bad,
  };
}

/** Streak erfüllter Tage bis heute (Ruhe- und Reisetage brechen ihn nicht). */
export function streak(logs, todayStr) {
  let n = 0;
  let k = todayStr;
  // Heute zählt nur, wenn schon etwas eingetragen ist — sonst beginnt der Streak gestern.
  if (!einheitErfuellt(logs, k)) k = plusTage(k, -1);
  for (let i = 0; i < 400; i++) {
    if (k < PLAN_START) break;
    const s = getSession(k, dow(k));
    if (s.type === "rest" || inReise(k)) {
      k = plusTage(k, -1);
      continue;
    }
    if (!einheitErfuellt(logs, k)) break;
    n++;
    k = plusTage(k, -1);
  }
  return n;
}

/** Gleitender Mittelwert über die letzten `tageZurueck` Tage bis `bisDatum`. */
export function schnitt(gewichtListe, bisDatum, tageZurueck) {
  const von = plusTage(bisDatum, -(tageZurueck - 1));
  const w = gewichtListe.filter((g) => g.datum >= von && g.datum <= bisDatum);
  return w.length ? { avg: w.reduce((s, g) => s + g.kg, 0) / w.length, n: w.length } : null;
}

/**
 * Gewichtstrend gegen den Zielkorridor. Bewertet wird die Rate im 7-Tage-Schnitt,
 * nie das Absolutgewicht. In den ersten zwei Kreatin-Wochen wird nicht bewertet —
 * das eingelagerte Wasser überdeckt den echten Trend.
 */
export function gewichtStatus(gewichtListe, todayStr) {
  if (!gewichtListe.length) return null;
  const jetzt = schnitt(gewichtListe, todayStr, 7);
  const davor = schnitt(gewichtListe, plusTage(todayStr, -7), 7);
  const start = gewichtListe[0];
  const basis = jetzt || { avg: gewichtListe[gewichtListe.length - 1].kg, n: 1 };
  const restTage = tage(todayStr, ZIEL_DATUM);

  const kreatinTage = tage(KREATIN.startAb, todayStr);
  const imWasserfenster = kreatinTage >= 0 && kreatinTage < KREATIN.wasserWochen * 7;

  const genugDaten = jetzt && davor && jetzt.n >= 2 && davor.n >= 2;
  const rate = genugDaten ? jetzt.avg - davor.avg : null;

  // Das Kreatin-Fenster zuerst: gerade am Anfang liegen noch wenige Wiegungen vor,
  // und genau dann muss der Hinweis erscheinen — sonst käme er nie.
  if (imWasserfenster) {
    return {
      avg: (jetzt || basis).avg,
      n: (jetzt || basis).n,
      rate,
      start,
      imWasserfenster,
      farbe: FARBEN.dim,
      label: "Kreatin-Wasser — Trend noch nicht aussagekräftig",
      hinweis:
        "In den ersten zwei Wochen zieht Kreatin 1–1,5 kg Wasser in die Muskelzelle. Das ist kein Rückschritt. Ab Woche 3 ist die Rate wieder belastbar.",
    };
  }

  if (!genugDaten) {
    return {
      avg: basis.avg,
      n: basis.n,
      rate: null,
      start,
      imWasserfenster,
      hinweis: "Trend ab etwa zwei Wochen mit je zwei Wiegungen pro Woche.",
    };
  }

  let farbe = FARBEN.ok;
  let label = "im Zielkorridor";
  if (rate <= GEWICHT.rateHart) {
    farbe = FARBEN.bad;
    label = "zu schnell — iss mehr";
  } else if (rate < GEWICHT.rateZiel[0]) {
    farbe = FARBEN.warn;
    label = "etwas zu schnell";
  } else if (rate > GEWICHT.rateZiel[1]) {
    farbe = FARBEN.warn;
    label = "kaum Bewegung";
  }

  return {
    avg: jetzt.avg,
    n: jetzt.n,
    rate,
    farbe,
    label,
    start,
    imWasserfenster,
    prognose: jetzt.avg + rate * Math.max(0, restTage / 7),
  };
}

/** Efficiency Factor: Watt pro Herzschlag. Steigt er bei gleichem Puls, wird die Aerobik besser. */
export const ef = (watts, hf) => (watts && hf ? Math.round((watts / hf) * 100) / 100 : null);

/** EF-Verlauf aus allen Cardio-Einträgen mit echten Gerätewatt. */
export function efVerlauf(logs) {
  const out = [];
  for (const datum of Object.keys(logs).sort()) {
    for (const a of (logs[datum].cardio || {}).aktivitaeten || []) {
      if (a.ef != null && a.watts_ist_geschaetzt === false) out.push({ datum, ef: a.ef, watts: a.watts_avg, hf: a.hf_avg });
    }
  }
  return out;
}

/** Wattbereich einer Zone als Text. Ohne FTP werden die Prozentwerte gezeigt. */
export const zonenWatt = (z, currentFtp) =>
  currentFtp
    ? `${Math.round((currentFtp * z.min) / 100)}–${z.max === 999 ? "∞" : Math.round((currentFtp * z.max) / 100)} W`
    : `${z.min}–${z.max === 999 ? "150+" : z.max} %`;

/** In welcher Zone liegt eine Wattzahl? */
export function zoneVon(watts, currentFtp) {
  if (!watts || !currentFtp) return null;
  const pct = (watts / currentFtp) * 100;
  for (const [key, z] of Object.entries(FTP_ZONES)) if (pct >= z.min && pct <= z.max) return { key, ...z, pct: Math.round(pct) };
  return null;
}

/** Wochenvolumen im Studio: Sätze und, wo Gewichte stehen, Tonnage. */
export function wochenVolumen(logs, monStr) {
  let saetze = 0;
  let tonnage = 0;
  for (let i = 0; i < 7; i++) {
    const l = logs[plusTage(monStr, i)];
    if (!l) continue;
    for (const e of Object.values(l.entries || {})) {
      for (const s of e.sets || []) {
        const v = num(s);
        if (v === null) continue;
        saetze++;
        if (v > 5) tonnage += v;
      }
    }
  }
  return { saetze, tonnage: Math.round(tonnage) };
}

/** Kreatin-Streak: aufeinanderfolgende Tage bis heute mit gesetztem Häkchen. */
export function kreatinStreak(supplements, todayStr) {
  let n = 0;
  let k = todayStr;
  if (!(supplements[k] && supplements[k].kreatin)) k = plusTage(k, -1);
  for (let i = 0; i < 400; i++) {
    if (k < KREATIN.startAb) break;
    if (!(supplements[k] && supplements[k].kreatin)) break;
    n++;
    k = plusTage(k, -1);
  }
  return n;
}
