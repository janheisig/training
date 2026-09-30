import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { plusTage } from "../src/lib/dates.js";
import { PLAN_START, blockInfo, getSession, KREATIN } from "../src/lib/plan.js";
import { lastFor, empfehlung } from "../src/lib/progression.js";
import {
  einheitErfuellt,
  wochenQuote,
  konstanz,
  streak,
  gewichtStatus,
  ef,
  efVerlauf,
  wochenVolumen,
  kreatinStreak,
  zoneVon,
} from "../src/lib/metrics.js";
import { merge, dirtyRecords, leer } from "../src/lib/store.js";
import { exportText } from "../src/lib/export.js";

const ex = (over = {}) => ({ id: "kniebeuge", name: "Kniebeuge", scheme: "4x5", unit: "kg", inc: 5, start: 60, note: "", ...over });
const normal = { deload: false, retest: false, abreise: false };

describe("Progression", () => {
  test("Alle Sätze gleich und abgehakt → Gewicht steigt", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["60", "60", "60", "60"], done: true }, normal);
    assert.equal(r.sugg, 65);
    assert.match(r.why, /alle Sätze sauber/);
  });

  test("Uneinheitliche Sätze → Gewicht halten", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["60", "60", "55", "50"], done: true }, normal);
    assert.equal(r.sugg, 60);
    assert.match(r.why, /uneinheitlich/);
  });

  test("Nicht abgehakt → Gewicht halten, nicht steigern", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["60", "60", "60", "60"], done: false }, normal);
    assert.equal(r.sugg, 60);
    assert.match(r.why, /nicht abgehakt/);
  });

  test("Im Deload wird nie erhöht", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["60", "60", "60", "60"], done: true }, { ...normal, deload: true });
    assert.equal(r.sugg, 60);
    assert.match(r.why, /Deload/);
  });

  test("In der Standortbestimmung wird nie erhöht", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["70", "70", "70", "70"], done: true }, { ...normal, retest: true });
    assert.equal(r.sugg, 70);
    assert.match(r.why, /Standortbestimmung/);
  });

  test("In der Abreisewoche wird nie erhöht", () => {
    const r = empfehlung(ex(), { date: "2026-09-28", sets: ["70", "70", "70", "70"], done: true }, { ...normal, abreise: true });
    assert.equal(r.sugg, 70);
    assert.match(r.why, /Abreisewoche/);
  });

  test("Ohne Vorgeschichte kommt der Startwert", () => {
    const r = empfehlung(ex(), null, normal);
    assert.equal(r.sugg, 60);
    assert.match(r.why, /Startwert/);
  });

  test("Übungen ohne Steigerung bekommen keinen Vorschlag", () => {
    const r = empfehlung(ex({ inc: 0, start: null }), { date: "2026-09-28", sets: ["16,25"], done: true }, normal);
    assert.equal(r.sugg, null);
  });

  test("Kommazahlen mit Komma werden verstanden", () => {
    const r = empfehlung(ex({ inc: 2.5 }), { date: "2026-09-28", sets: ["16,25", "16,25"], done: true }, normal);
    assert.equal(r.sugg, 18.75);
  });

  test("lastFor nimmt den jüngsten Eintrag davor, nicht danach", () => {
    const logs = {
      "2026-09-28": { entries: { kniebeuge: { sets: ["60"], done: true } } },
      "2026-10-05": { entries: { kniebeuge: { sets: ["65"], done: true } } },
      "2026-10-12": { entries: { kniebeuge: { sets: ["70"], done: true } } },
    };
    assert.equal(lastFor(logs, "kniebeuge", "2026-10-12").date, "2026-10-05");
    assert.equal(lastFor(logs, "kniebeuge", "2026-09-28"), null);
  });

  test("Leere Sätze zählen nicht als Eintrag", () => {
    const logs = { "2026-09-28": { entries: { kniebeuge: { sets: ["", "", ""], done: false } } } };
    assert.equal(lastFor(logs, "kniebeuge", "2026-10-05"), null);
  });
});

describe("Konstanz", () => {
  const heute = "2026-10-11"; // Sonntag, Ende Woche 2
  const tag = (n) => plusTage(PLAN_START, n);

  test("Ein Satz reicht, damit die Einheit zählt", () => {
    assert.ok(einheitErfuellt({ x: { entries: { kniebeuge: { sets: ["60"] } } } }, "x"));
    assert.ok(einheitErfuellt({ x: { entries: { kniebeuge: { done: true } } } }, "x"));
    assert.ok(einheitErfuellt({ x: { cardio: { done: true } } }, "x"));
    assert.ok(einheitErfuellt({ x: { cardio: { aktivitaeten: [{ sport: "Ride" }] } } }, "x"));
    assert.ok(!einheitErfuellt({ x: { entries: {}, cardio: {}, note: "nur eine Notiz" } }, "x"));
    assert.ok(!einheitErfuellt({}, "x"));
  });

  test("Ruhetage zählen nicht als geplant", () => {
    // Woche 1: Mo, Di, Mi, Do, Fr, Sa, So sind alle belegt außer keinem —
    // in diesem Plan gibt es innerhalb der Woche keinen Ruhetag.
    const q = wochenQuote({}, PLAN_START, tag(6));
    assert.equal(q.planned, 7);
    assert.equal(q.done, 0);
  });

  test("Zukünftige Tage zählen nicht gegen dich", () => {
    const q = wochenQuote({}, PLAN_START, tag(2)); // Mittwoch
    assert.equal(q.planned, 3, "nur Mo, Di, Mi");
  });

  test("Tage vor dem Plan-Start zählen nicht", () => {
    const q = wochenQuote({}, "2026-09-21", "2026-10-11");
    assert.equal(q.planned, 0);
  });

  test("Die Quote rechnet über vier Wochen korrekt", () => {
    const logs = {};
    // Woche 1 komplett, Woche 2 nur drei Tage
    for (let i = 0; i < 7; i++) logs[tag(i)] = { entries: { kniebeuge: { sets: ["60"] } } };
    for (let i = 7; i < 10; i++) logs[tag(i)] = { entries: { kniebeuge: { sets: ["60"] } } };
    const k = konstanz(logs, heute);
    assert.equal(k.wochen.length, 2);
    assert.equal(k.wochen[0].done, 7);
    assert.equal(k.wochen[0].planned, 7);
    assert.equal(k.wochen[1].done, 3);
    assert.equal(k.wochen[1].planned, 7);
    assert.equal(k.quote, 10 / 14);
  });

  test("Vor dem ersten Plantag gibt es noch keine Konstanz", () => {
    assert.equal(konstanz({}, "2026-09-27"), null);
  });

  test("Die Farbe folgt den Schwellen 85 und 65 Prozent", () => {
    const bau = (erfuellt) => {
      const logs = {};
      for (let i = 0; i < erfuellt; i++) logs[tag(i)] = { entries: { kniebeuge: { sets: ["60"] } } };
      return konstanz(logs, tag(6));
    };
    assert.equal(bau(7).farbe, "#7CC98A"); // 100 %
    assert.equal(bau(5).farbe, "#E8B94A"); // 71 %
    assert.equal(bau(3).farbe, "#E05656"); // 43 %
  });

  test("Die Serie bricht bei einer ausgefallenen Einheit", () => {
    const logs = {};
    for (let i = 0; i < 7; i++) if (i !== 3) logs[tag(i)] = { entries: { kniebeuge: { sets: ["60"] } } };
    // tag(3) = Donnerstag fehlt → Serie ab Freitag zurück zählt 3 (Fr, Sa, So)
    assert.equal(streak(logs, tag(6)), 3);
  });
});

describe("Körpergewicht", () => {
  // Wiegungen so legen, dass sie außerhalb des Kreatin-Wasserfensters liegen.
  const bauGewicht = (werte, ab) => werte.map((kg, i) => ({ datum: plusTage(ab, i), kg }));

  test("Ohne genug Wiegungen gibt es keine Rate, aber einen Hinweis", () => {
    const s = gewichtStatus([{ datum: "2026-11-01", kg: 100 }], "2026-11-01");
    assert.equal(s.rate, null);
    assert.match(s.hinweis, /zwei Wochen/);
  });

  test("Im Zielkorridor wird grün gemeldet", () => {
    // Vorwoche Ø 100, aktuelle Woche Ø 99,5 → −0,5 kg
    const liste = [
      { datum: "2026-11-02", kg: 100 },
      { datum: "2026-11-05", kg: 100 },
      { datum: "2026-11-09", kg: 99.5 },
      { datum: "2026-11-12", kg: 99.5 },
    ];
    const s = gewichtStatus(liste, "2026-11-12");
    assert.equal(s.label, "im Zielkorridor");
    assert.equal(s.farbe, "#7CC98A");
  });

  test("Zu schneller Verlust rät ausdrücklich zu mehr Essen", () => {
    const liste = [
      { datum: "2026-11-02", kg: 100 },
      { datum: "2026-11-05", kg: 100 },
      { datum: "2026-11-09", kg: 98.8 },
      { datum: "2026-11-12", kg: 98.8 },
    ];
    const s = gewichtStatus(liste, "2026-11-12");
    assert.equal(s.label, "zu schnell — iss mehr");
    assert.equal(s.farbe, "#E05656");
  });

  test("Stillstand wird als solcher benannt, nicht als Erfolg", () => {
    const liste = [
      { datum: "2026-11-02", kg: 100 },
      { datum: "2026-11-05", kg: 100 },
      { datum: "2026-11-09", kg: 100 },
      { datum: "2026-11-12", kg: 100 },
    ];
    assert.equal(gewichtStatus(liste, "2026-11-12").label, "kaum Bewegung");
  });

  test("In den ersten zwei Kreatin-Wochen wird der Trend nicht bewertet", () => {
    const liste = [
      { datum: "2026-09-28", kg: 103 },
      { datum: "2026-09-30", kg: 103 },
      { datum: "2026-10-03", kg: 104 },
      { datum: "2026-10-05", kg: 104 },
    ];
    const s = gewichtStatus(liste, "2026-10-05");
    assert.ok(s.imWasserfenster);
    assert.match(s.label, /Kreatin/);
    assert.match(s.hinweis, /Wasser/);
  });

  test("Nach dem Wasserfenster wird wieder normal bewertet", () => {
    const liste = [
      { datum: "2026-10-19", kg: 102 },
      { datum: "2026-10-22", kg: 102 },
      { datum: "2026-10-26", kg: 101.5 },
      { datum: "2026-10-29", kg: 101.5 },
    ];
    const s = gewichtStatus(liste, "2026-10-29");
    assert.ok(!s.imWasserfenster);
    assert.equal(s.label, "im Zielkorridor");
  });

  test("Das Wasserfenster ist genau zwei Wochen lang", () => {
    assert.equal(KREATIN.wasserWochen, 2);
    assert.equal(KREATIN.startAb, PLAN_START);
  });
});

describe("Rad & Watt", () => {
  test("Efficiency Factor ist Watt durch Puls", () => {
    assert.equal(ef(151, 130), 1.16);
    assert.equal(ef(null, 130), null);
    assert.equal(ef(151, null), null);
  });

  test("Nur echte Gerätewatt kommen in den EF-Verlauf", () => {
    const logs = {
      "2026-09-09": { cardio: { aktivitaeten: [{ ef: 1.16, watts_avg: 151, hf_avg: 130, watts_ist_geschaetzt: false }] } },
      "2026-09-10": { cardio: { aktivitaeten: [{ ef: 2.0, watts_avg: 260, hf_avg: 130, watts_ist_geschaetzt: true }] } },
    };
    const v = efVerlauf(logs);
    assert.equal(v.length, 1);
    assert.equal(v[0].datum, "2026-09-09");
  });

  test("Zonen werden korrekt zugeordnet", () => {
    assert.equal(zoneVon(140, 200).key, "Z2"); // 70 %
    assert.equal(zoneVon(190, 200).key, "Z4"); // 95 %
    assert.equal(zoneVon(230, 200).key, "Z5"); // 115 %
    assert.equal(zoneVon(140, null), null);
  });
});

describe("Volumen und Supplement", () => {
  test("Tonnage zählt nur echte Gewichte, keine Wiederholungszahlen", () => {
    const logs = {
      [PLAN_START]: {
        entries: {
          kniebeuge: { sets: ["60", "60", "60"] },
          klimmzge: { sets: ["4", "4"] }, // Wiederholungen, keine Kilos
        },
      },
    };
    const v = wochenVolumen(logs, PLAN_START);
    assert.equal(v.saetze, 5);
    assert.equal(v.tonnage, 180);
  });

  test("Die Kreatin-Serie zählt zusammenhängende Tage", () => {
    const s = {
      "2026-09-28": { kreatin: true },
      "2026-09-29": { kreatin: true },
      "2026-09-30": { kreatin: true },
    };
    assert.equal(kreatinStreak(s, "2026-09-30"), 3);
    assert.equal(kreatinStreak({ ...s, "2026-09-29": { kreatin: false } }, "2026-09-30"), 1);
    assert.equal(kreatinStreak({}, "2026-09-30"), 0);
  });
});

describe("Abgleich zwischen Geräten", () => {
  test("Der jüngere Datensatz gewinnt", () => {
    const lokal = { ...leer(), logs: { "2026-09-28": { note: "Handy", _t: 200 } } };
    const fern = { ...leer(), logs: { "2026-09-28": { note: "Laptop", _t: 100 } } };
    assert.equal(merge(lokal, fern).logs["2026-09-28"].note, "Handy");
    assert.equal(merge(fern, lokal).logs["2026-09-28"].note, "Handy");
  });

  test("Datensätze, die nur eine Seite hat, bleiben erhalten", () => {
    const lokal = { ...leer(), logs: { a: { note: "A", _t: 1 } } };
    const fern = { ...leer(), logs: { b: { note: "B", _t: 1 } } };
    const m = merge(lokal, fern);
    assert.equal(Object.keys(m.logs).length, 2);
  });

  test("Fehlender Zeitstempel verliert gegen einen vorhandenen", () => {
    const lokal = { ...leer(), gewicht: { x: { kg: 100 } } };
    const fern = { ...leer(), gewicht: { x: { kg: 99, _t: 5 } } };
    assert.equal(merge(lokal, fern).gewicht.x.kg, 99);
  });

  test("Alle Tabellen werden zusammengeführt, nicht nur logs", () => {
    const lokal = { ...leer(), supplements: { x: { kreatin: true, _t: 2 } } };
    const m = merge(lokal, leer());
    assert.equal(m.supplements.x.kreatin, true);
  });

  test("Offene Änderungen werden als Datensätze verpackt", () => {
    const data = { ...leer(), logs: { "2026-09-28": { note: "x", _t: 5 } }, gewicht: { "2026-09-28": { kg: 103, _t: 6 } } };
    const r = dirtyRecords(data, new Set(["logs:2026-09-28", "gewicht:2026-09-28", "logs:gibtsnicht"]));
    assert.equal(r.length, 2);
    assert.deepEqual(
      r.map((x) => x.table).sort(),
      ["gewicht", "logs"]
    );
    assert.equal(r.find((x) => x.table === "gewicht").t, 6);
  });
});

describe("Export", () => {
  const data = {
    ...leer(),
    logs: {
      "2026-09-28": { entries: { kniebeuge: { sets: ["60", "60", "60", "60"], done: true } }, note: "lief gut", befinden: 4 },
      "2026-09-29": { cardio: { quelle: "Strava", aktivitaeten: [{ sport: "Ride", distanz_km: 15.4, watts_avg: 151, hf_avg: 130, ef: 1.16, watts_ist_geschaetzt: false }] } },
    },
    gewicht: { "2026-09-28": { kg: 103 }, "2026-09-30": { kg: 102.6 } },
    ftp: { "2026-09-09": { watts: 200, quelle: "vorläufig", vorlaeufig: true } },
    supplements: { "2026-09-28": { kreatin: true } },
  };

  test("Der Export nennt Ziel, Kontext und Reise", () => {
    const t = exportText(data, "2026-09-30");
    assert.match(t, /18\. Dez/);
    assert.match(t, /Hongkong/);
    assert.match(t, /Koh Chang/);
  });

  test("Der Export enthält kein Bergsteigen", () => {
    const t = exportText(data, "2026-09-30");
    assert.ok(!/Wallis|4000er|Viertausend/i.test(t));
    assert.match(t, /Bergsteigen ist derzeit ausdrücklich kein Ziel/);
  });

  test("Die Randbedingungen stehen im Export", () => {
    const t = exportText(data, "2026-09-30");
    assert.match(t, /Kein Laufen/);
    assert.match(t, /Donnerstag ist blockiert/);
    assert.match(t, /Sandsäcke/);
  });

  test("Trainingsdaten und Kennzahlen sind enthalten", () => {
    const t = exportText(data, "2026-09-30");
    assert.match(t, /Kniebeuge 60\/60\/60\/60/);
    assert.match(t, /EF1,16/);
    assert.match(t, /KONSTANZ/);
    assert.match(t, /Befinden 4\/5/);
    assert.match(t, /Kreatin-Serie/);
  });

  test("Der Export bittet nicht um Kalorienzahlen", () => {
    const t = exportText(data, "2026-09-30");
    assert.match(t, /Keine Kalorienzahlen/);
  });

  test("Der Export funktioniert auch mit leeren Daten", () => {
    const t = exportText(leer(), "2026-09-30");
    assert.ok(t.length > 100);
    assert.match(t, /Keine Wiegungen/);
  });
});
