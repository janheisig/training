import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tage, plusTage, dow, weekBounds } from "../src/lib/dates.js";
import {
  PLAN_START,
  ZIEL_DATUM,
  BLOCKS,
  REISE,
  blockInfo,
  getSession,
  inReise,
  reiseEtappe,
  setCount,
  EX_INDEX,
} from "../src/lib/plan.js";

describe("Kalender", () => {
  test("Trainingsstart ist ein Montag", () => {
    assert.equal(dow(PLAN_START), 1);
  });

  test("Abflug ist ein Freitag", () => {
    assert.equal(dow(ZIEL_DATUM), 5);
  });

  test("Vom Start bis zum Abflug sind es genau 81 Tage — Woche 12", () => {
    assert.equal(tage(PLAN_START, ZIEL_DATUM), 81);
    assert.equal(blockInfo(ZIEL_DATUM).weekOverall, 12);
  });

  test("Die drei Blöcke schließen lückenlos aneinander an", () => {
    for (let i = 1; i < BLOCKS.length; i++)
      assert.equal(BLOCKS[i].start, plusTage(BLOCKS[i - 1].ende, 1), `Lücke vor Block ${i + 1}`);
    assert.equal(BLOCKS[0].start, PLAN_START);
  });

  test("Jeder Block dauert genau 28 Tage", () => {
    for (const b of BLOCKS) assert.equal(tage(b.start, b.ende), 27, `Block ${b.name}`);
  });
});

describe("Blocklogik", () => {
  test("Woche 1 liegt in Block A", () => {
    const b = blockInfo(PLAN_START);
    assert.equal(b.blockType, "A");
    assert.equal(b.weekOverall, 1);
    assert.equal(b.weekInBlock, 1);
    assert.ok(b.imPlan);
  });

  test("Deload liegt in Woche 4, 8 und 12", () => {
    for (const w of [4, 8, 12]) {
      const d = plusTage(PLAN_START, (w - 1) * 7);
      assert.ok(blockInfo(d).deload, `Woche ${w} sollte Deload sein`);
    }
    for (const w of [1, 2, 3, 5, 6, 7, 9, 10, 11]) {
      const d = plusTage(PLAN_START, (w - 1) * 7);
      assert.ok(!blockInfo(d).deload, `Woche ${w} sollte kein Deload sein`);
    }
  });

  test("Woche 11 ist Standortbestimmung, Woche 12 Abreisewoche", () => {
    const w11 = blockInfo(plusTage(PLAN_START, 10 * 7));
    const w12 = blockInfo(plusTage(PLAN_START, 11 * 7));
    assert.ok(w11.retest, "Woche 11 muss Retest sein");
    assert.ok(!w11.abreise);
    assert.ok(w12.abreise, "Woche 12 muss Abreisewoche sein");
    assert.ok(!w12.retest);
  });

  test("Die Blöcke wechseln A → B → A", () => {
    assert.equal(blockInfo(BLOCKS[0].start).blockType, "A");
    assert.equal(blockInfo(BLOCKS[1].start).blockType, "B");
    assert.equal(blockInfo(BLOCKS[2].start).blockType, "A");
  });

  test("Vor dem Plan-Start stürzt nichts ab (Altbestand Juli)", () => {
    const b = blockInfo("2026-07-18");
    assert.ok(!b.imPlan);
    assert.ok(["A", "B"].includes(b.blockType));
    assert.ok(b.weekInBlock >= 1 && b.weekInBlock <= 4);
  });

  test("Nach dem Plan läuft das Blockmodell rollierend weiter", () => {
    const b = blockInfo("2027-06-01");
    assert.ok(!b.imPlan);
    assert.ok(["A", "B"].includes(b.blockType));
  });
});

describe("Wochenstruktur", () => {
  const woche1 = (d) => plusTage(PLAN_START, d); // 0 = Montag

  test("Montag, Freitag und Sonntag sind Studio-Einheiten", () => {
    assert.equal(getSession(woche1(0), 1).type, "gym");
    assert.equal(getSession(woche1(4), 5).type, "gym");
    assert.equal(getSession(woche1(6), 0).type, "gym");
  });

  test("Donnerstag ist blockiert: Klettern, keine eigenen Übungen", () => {
    const s = getSession(woche1(3), 4);
    assert.equal(s.type, "climb");
    assert.equal(s.exercises.length, 0);
    assert.match(s.hint, /blockiert/i);
  });

  test("Dienstag und Mittwoch sind Pendeltage", () => {
    assert.equal(getSession(woche1(1), 2).type, "cardio");
    assert.equal(getSession(woche1(2), 3).type, "cardio");
  });

  test("VO2max-Intervalle nur in Woche 2 und 3 eines Blocks", () => {
    const di = (w) => getSession(plusTage(PLAN_START, (w - 1) * 7 + 1), 2).title;
    assert.ok(!di(1).includes("VO2max"), "Woche 1 ohne Intervalle");
    assert.ok(di(2).includes("VO2max"));
    assert.ok(di(3).includes("VO2max"));
    assert.ok(!di(4).includes("VO2max"), "Deload ohne Intervalle");
  });

  test("In Woche 11 ersetzt der FTP-Test die lange Ausdauereinheit", () => {
    const sa = getSession(plusTage(PLAN_START, 10 * 7 + 5), 6);
    assert.equal(sa.title, "FTP-Test");
    assert.match(sa.hint, /20 Min/);
  });

  test("In Woche 11 laufen dienstags keine Intervalle mehr", () => {
    const di = getSession(plusTage(PLAN_START, 10 * 7 + 1), 2);
    assert.ok(!di.title.includes("VO2max"));
  });

  test("Samstag im Deload ist ausdrücklich locker", () => {
    const sa = getSession(plusTage(PLAN_START, 3 * 7 + 5), 6);
    assert.match(sa.hint, /Deload/i);
  });
});

describe("Randbedingungen aus der Absprache", () => {
  const alleTexte = () => {
    let t = "";
    for (let i = 0; i < 12 * 7; i++) {
      const d = plusTage(PLAN_START, i);
      const s = getSession(d, dow(d));
      t += `${s.title} ${s.hint} ` + s.exercises.map((e) => `${e.name} ${e.scheme} ${e.note}`).join(" ");
    }
    for (let i = 0; i < 22; i++) {
      const d = plusTage(REISE.start, i);
      const s = getSession(d, dow(d));
      t += `${s.title} ${s.hint} ` + s.exercises.map((e) => `${e.name} ${e.scheme} ${e.note}`).join(" ");
    }
    return t;
  };

  test("Kein Laufen im ganzen Plan", () => {
    const t = alleTexte();
    assert.ok(!/\bjogg/i.test(t), "kein Joggen");
    assert.ok(!/\bLaufeinheit/i.test(t));
    // „Laufband“ ist erlaubt — es wird gegangen, nicht gelaufen.
    assert.ok(/Gehen, nicht laufen/i.test(t), "der Laufband-Hinweis muss Gehen vorschreiben");
  });

  test("Keine Zusatzlast auf dem Laufband", () => {
    for (let i = 0; i < 12 * 7; i++) {
      const d = plusTage(PLAN_START, i);
      for (const e of getSession(d, dow(d)).exercises) {
        if (!/Laufband/i.test(e.name)) continue;
        const text = `${e.scheme} ${e.note}`;
        // Eine Last wäre entweder eine Gewichtsangabe oder ein Tragemittel.
        assert.ok(!/\d+\s*kg/i.test(text), `Laufband mit Kilo-Angabe am ${d}: ${text}`);
        assert.ok(!/Rucksack|Weste|Sandsack/i.test(text), `Laufband mit Tragemittel am ${d}: ${text}`);
        assert.notEqual(e.unit, "kg", `Laufband darf keine Kilo-Eingabe haben (${d})`);
      }
    }
  });

  test("Rucksacklast kommt im Studio nirgends vor", () => {
    for (let i = 0; i < 12 * 7; i++) {
      const d = plusTage(PLAN_START, i);
      const s = getSession(d, dow(d));
      if (s.type !== "gym") continue;
      for (const e of s.exercises)
        assert.ok(!/Rucksack|Weste/i.test(`${e.name} ${e.scheme} ${e.note}`), `Rucksack im Studio am ${d}: ${e.name}`);
    }
  });

  test("Kein Bergsteigen-Framing", () => {
    const t = alleTexte();
    assert.ok(!/Wallis|4000er|Viertausend|Gipfel|Bergmotor/i.test(t), "Bergsteigen darf nicht vorkommen");
  });

  test("Kein Fingerboard — der Kletterreiz genügt", () => {
    assert.ok(!/Fingerboard|Griffbrett|Campus/i.test(alleTexte()));
  });

  test("Sonntag heißt Motor, nicht Bergmotor", () => {
    assert.equal(getSession(plusTage(PLAN_START, 6), 0).title, "Motor: Steigung & Tragen");
  });
});

describe("Reise-Modus", () => {
  test("Der Reisezeitraum ist erkannt", () => {
    assert.ok(inReise("2026-12-18"));
    assert.ok(inReise("2027-01-08"));
    assert.ok(!inReise("2026-12-17"));
    assert.ok(!inReise("2027-01-09"));
  });

  test("Der Abflugtag hat eine eigene Karte", () => {
    const s = getSession("2026-12-18", dow("2026-12-18"));
    assert.equal(s.title, "Abflug nach Hongkong");
    assert.match(s.hint, /Jetlag/);
  });

  test("Die Etappen stimmen", () => {
    assert.equal(reiseEtappe("2026-12-22").ort, "Hongkong");
    assert.equal(reiseEtappe("2026-12-26").ort, "Bangkok");
    assert.equal(reiseEtappe("2027-01-02").ort, "Koh Chang & Koh Samet");
  });

  test("Im Reise-Modus gibt es keine Gewichtsvorgaben", () => {
    const s = getSession("2026-12-28", dow("2026-12-28"));
    assert.equal(s.type, "reise");
    for (const e of s.exercises) assert.equal(e.inc, 0, `${e.name} darf nicht progressiv sein`);
  });

  test("Auch am Sonntag in der Reise gilt der Reise-Modus, nicht die Motoreinheit", () => {
    const so = "2026-12-20";
    assert.equal(dow(so), 0);
    assert.equal(getSession(so, 0).type, "reise");
  });
});

describe("Hilfsfunktionen", () => {
  test("setCount liest die Satzzahl", () => {
    assert.equal(setCount("4x5"), 4);
    assert.equal(setCount("3x12-15"), 3);
    assert.equal(setCount("2 Min/Seite"), 1);
    assert.equal(setCount("45-60 Min"), 1);
    assert.equal(setCount(""), 1);
    assert.equal(setCount("99x1"), 8, "auf 8 gedeckelt");
  });

  test("weekBounds beginnt am Montag", () => {
    const b = weekBounds("2026-10-01"); // Donnerstag
    assert.equal(b.mon, "2026-09-28");
    assert.equal(b.sun, "2026-10-04");
    assert.equal(dow(b.mon), 1);
  });

  test("Der Übungsindex kennt alle Übungen des Plans", () => {
    for (let i = 0; i < 12 * 7; i++) {
      const d = plusTage(PLAN_START, i);
      for (const e of getSession(d, dow(d)).exercises)
        assert.ok(EX_INDEX[e.id], `${e.name} (${e.id}) fehlt im Index`);
    }
  });

  test("Keine zwei Übungen teilen sich eine ID", () => {
    // Gleiche ID heißt geteilte Historie — genau der Bug, der Montag und Sonntag
    // beim Laufband früher zusammengeworfen hat.
    const gesehen = new Map();
    for (let i = 0; i < 12 * 7; i++) {
      const d = plusTage(PLAN_START, i);
      for (const e of getSession(d, dow(d)).exercises) {
        const vorher = gesehen.get(e.id);
        if (vorher) assert.equal(vorher, e.name, `ID ${e.id} wird von "${vorher}" und "${e.name}" geteilt`);
        else gesehen.set(e.id, e.name);
      }
    }
  });
});
