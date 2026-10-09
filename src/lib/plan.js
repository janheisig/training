// ─── Plan-Konfiguration ──────────────────────────────────────
// 12-Wochen-Bogen vom 28.09.2026 bis zum Abflug am 18.12.2026. Ziel ist nicht ein
// Testergebnis, sondern eine Routine, die hält — und sich am Abflugtag fit, gesund
// und schlank anfühlt. Drei Blöcke à 4 Wochen, Woche 4 jedes Blocks ist Deload.
// Woche 11 ist Standortbestimmung (Kraft + FTP), Woche 12 ist Abreisewoche.
// Ab dem 18.12. läuft der Reise-Modus, danach rollierend A/B weiter.

import { mod, tage, slug } from "./dates.js";

export const PLAN_START = "2026-09-28";
export const ZIEL_DATUM = "2026-12-18";
export const ZIEL_TITEL = "Abflug — fit, gesund, schlank";

export const BLOCK_NAMES = { A: "Kraft & Grundlage", B: "Kraftausdauer & Kapazität" };

export const BLOCKS = [
  {
    typ: "A",
    name: "Wiedereinstieg & Gewohnheit",
    start: "2026-09-28",
    ende: "2026-10-25",
    fokus:
      "Erst die Routine, dann die Last. Ziel dieses Blocks ist nicht ein Rekord, sondern vier Wochen, in denen kaum eine Einheit ausfällt. FTP-Test in Woche 1.",
  },
  {
    typ: "B",
    name: "Kapazität",
    start: "2026-10-26",
    ende: "2026-11-22",
    fokus:
      "Mehr Zeit unter Last: höhere Wiederholungszahlen, längere Trageblöcke, längerer Steigungsgang. Die Wochen, in denen Kondition und Körperbild wirklich kippen.",
  },
  {
    typ: "A",
    name: "Verdichtung & Abreise",
    start: "2026-11-23",
    ende: "2026-12-20",
    fokus:
      "Wieder schwer, aber knapper. Woche 11 ist Standortbestimmung (Kraft, FTP, Gewicht), Woche 12 fährt runter — du willst ausgeruht ins Flugzeug, nicht ausgelaugt.",
  },
];

/** Referenzdaten, um je Blocktyp die Übungsliste einzusammeln (Export, Historie). */
export const PLAN_SAMPLE = { A: "2026-09-28", B: "2026-10-26" };

// ─── Reise: 18.12.2026 bis 08.01.2027 ────────────────────────
export const REISE = { start: "2026-12-18", ende: "2027-01-08" };

export const REISE_ETAPPEN = [
  {
    bis: "2026-12-25",
    ort: "Hongkong",
    hinweis:
      "Die Stadt ist dein Training: Treppen, Hügel, zu Fuß statt MTR. Dragon's Back oder Victoria Peak sind je eine komplette Einheit.",
  },
  {
    bis: "2026-12-26",
    ort: "Bangkok",
    hinweis: "Reisetag. Bewegen reicht — laufen statt Taxi, abends 10 Minuten dehnen.",
  },
  {
    bis: "2027-01-08",
    ort: "Koh Chang & Koh Samet",
    hinweis:
      "Schwimmen ist deine Ausdauereinheit — morgens vor der Hitze. Zirkel im Schatten, nicht in der Mittagssonne. Viel trinken.",
  },
];

export const inReise = (dateStr) => dateStr >= REISE.start && dateStr <= REISE.ende;

export const reiseEtappe = (dateStr) =>
  REISE_ETAPPEN.find((e) => dateStr <= e.bis) || REISE_ETAPPEN[REISE_ETAPPEN.length - 1];

// ─── Wattzonen (Coggan, 6 Zonen, % FTP) ──────────────────────
export const FTP_ZONES = {
  Z1: { name: "Recovery", min: 0, max: 55, farbe: "#8FA1AC" },
  Z2: { name: "Grundlage", min: 56, max: 75, farbe: "#7CC98A" },
  Z3: { name: "Tempo", min: 76, max: 90, farbe: "#8FD6CC" },
  Z4: { name: "Schwelle", min: 91, max: 105, farbe: "#E8B94A" },
  Z5: { name: "VO2max", min: 106, max: 120, farbe: "#FF6A2B" },
  Z6: { name: "Anaerob", min: 121, max: 999, farbe: "#E05656" },
};

// Körpergewicht: Korridor statt Zielzahl. Rate ist die Steuergröße, nicht das Absolutgewicht.
export const GEWICHT = { rateZiel: [-0.8, -0.25], rateHart: -1.0, eiweissProKg: 2.0 };

// Kreatin: Sättigung nach ~3–4 Wochen, in den ersten zwei Wochen zieht es Wasser in
// die Zelle. Der Gewichtstrend ist in dieser Zeit nicht aussagekräftig.
export const KREATIN = { startAb: "2026-09-28", grammProTag: 5, wasserWochen: 2 };

/**
 * Blockinfo rein aus dem Datumsabstand zu PLAN_START — kein Sonderfall nötig,
 * auch nicht für Daten vor dem Start (Altbestand) oder nach dem 20.12.
 */
export function blockInfo(dateStr) {
  const diffDays = tage(PLAN_START, dateStr);
  const cycleIdx = Math.floor(diffDays / 28);
  const dayInBlock = mod(diffDays, 28);
  const weekInBlock = Math.floor(dayInBlock / 7) + 1;
  const weekOverall = Math.floor(diffDays / 7) + 1;
  const named = cycleIdx >= 0 ? BLOCKS[cycleIdx] : null;
  const blockType = named ? named.typ : mod(cycleIdx, 2) === 0 ? "A" : "B";
  const imPlan = diffDays >= 0 && weekOverall <= 12;
  const retest = imPlan && weekOverall === 11;
  const abreise = imPlan && weekOverall === 12;
  return {
    blockNr: cycleIdx + 1,
    blockType,
    weekInBlock,
    weekOverall,
    dayInBlock,
    imPlan,
    retest,
    abreise,
    deload: weekInBlock === 4,
    reise: inReise(dateStr),
    blockName: named ? named.name : BLOCK_NAMES[blockType],
    blockFokus: named ? named.fokus : "",
  };
}

const S = (name, scheme, unit, inc, start, note) => ({
  id: slug(name),
  name,
  scheme,
  unit,
  inc: inc || 0,
  start: start ?? null,
  note: note || "",
});

/** Klimmzüge: pro Satz Wiederholungen + Zusatzgewicht (kg) + Haken fürs grüne Band. */
const KZ = (scheme, note) => ({ ...S("Klimmzüge", scheme, "Reps", 0, null, note), zusatz: true });

/**
 * Die Einheit für einen Tag. `dowIdx`: 0 = Sonntag … 6 = Samstag.
 */
export function getSession(dateStr, dowIdx) {
  const { blockType, weekInBlock, deload, retest, abreise } = blockInfo(dateStr);
  const intervallWoche = (weekInBlock === 2 || weekInBlock === 3) && !retest;

  // ── Reise-Modus: Erhalt statt Aufbau ──
  if (inReise(dateStr)) {
    const et = reiseEtappe(dateStr);
    const abflug = dateStr === ZIEL_DATUM;
    return {
      title: abflug ? "Abflug nach Hongkong" : `Reise-Modus · ${et.ort}`,
      type: "reise",
      hint: abflug
        ? "Geschafft. Im Flieger stündlich aufstehen, viel Wasser, wenig Alkohol — und in Hongkong am ersten Tag raus ins Licht, das verkürzt den Jetlag. Ab jetzt zählt nichts mehr außer Erholung."
        : `${et.hinweis} Zwei bis drei Zirkel in der Woche reichen, um die Kraft zu halten — such dir die Tage aus, an denen es passt.`,
      exercises: [
        S("Kniebeuge Körpergewicht", "3x20", "✓", 0, null, "Zirkel, 3 Runden ohne Pause dazwischen, danach 90 Sek Pause. Insgesamt rund 20 Minuten."),
        S("Liegestütze", "3x AMRAP", "Reps", 0, null, "Zwei Wiederholungen vor dem Versagen abbrechen."),
        S("Ausfallschritt rückwärts", "3x12/Bein", "✓", 0),
        S("Hip Thrust einbeinig", "3x12/Bein", "✓", 0, null, "Schulter auf Bett oder Bankkante."),
        S("Plank", "3x45 Sek", "✓", 0),
        S("Bewegt", "Schwimmen, Gehen, Treppen", "min", 0, null, "Die Hauptsache. Trag ein, was zusammenkommt — alles über 30 Minuten zählt."),
      ],
    };
  }

  if (dowIdx === 2)
    return {
      title: intervallWoche ? "Rad-Pendeln · VO2max" : "Rad-Pendeln · Z2",
      type: "cardio",
      exercises: [],
      hint: intervallWoche
        ? "Hinweg: 10 Min einrollen, dann 6x3 Min hart (105–115 % FTP) / 3 Min locker (50 % FTP), Rest ausrollen. Rückweg strikt Z1–Z2, keine Sprints."
        : "Beide Wege strikt Z2 (56–75 % FTP). In Woche 1 und in der Deload-Woche bewusst ohne Intervalle.",
    };

  if (dowIdx === 3)
    return {
      title: "Rad-Pendeln · Erholung",
      type: "cardio",
      exercises: [],
      hint: "Beide Wege strikt Z2 (56–75 % FTP). Erholungstag — morgen ist Klettern.",
    };

  if (dowIdx === 4)
    return {
      title: "Klettern / Bouldern",
      type: "climb",
      exercises: [],
      hint: "18:00 · davor 5–8 Min Prehab (Band-Außenrotation 2x15 leicht, Wall Slides 2x10, Handgelenks-Mobilisation). Sonst nichts — Donnerstag ist blockiert.",
    };

  if (dowIdx === 6)
    return {
      title: retest ? "FTP-Test" : "Lange Ausdauereinheit",
      type: "cardio",
      exercises: [],
      hint: retest
        ? "Standortbestimmung auf dem Rad: 20 Min einrollen, dann 20 Min alles geben, was du gleichmäßig durchhältst — davon 95 % sind deine neue FTP. Ampelfreie Strecke, danach locker ausrollen. Wert unter Analyse eintragen."
        : deload
          ? "Deload: 75–90 Min locker Z2, kein Sweet Spot, keine Segmentjagd."
          : "Rad 2–3 h, überwiegend Z2 (56–75 % FTP), darin 2x15 Min Sweet Spot (88–93 % FTP), wenn du frisch bist. Gelegentlich stattdessen eine Taunus-Tour — Abwechslung hält die Routine am Leben.",
    };

  const titles = { 1: "Beine + Core + Prehab", 5: "Oberkörper/Zug + Rudergerät", 0: "Motor: Steigung & Tragen" };
  if (!titles[dowIdx])
    return { title: "Ruhetag", type: "rest", exercises: [], hint: "Bewusst frei. Spazieren, dehnen, essen, schlafen." };

  const ex = { A: {}, B: {} };

  // ── Montag: Beine + Core ──
  ex.A[1] = [
    S("Kniebeuge", "4x5", "kg", 5, 60, "RPE 8, zwei Wiederholungen im Tank lassen. +5 kg, wenn alle vier Sätze sauber waren."),
    S("Rumän. Kreuzheben", "3x6", "kg", 5, 50, "RPE 7–8. Rücken neutral, Bewegung aus der Hüfte."),
    S("Bulgarian Split Squat", "3x8/Bein", "kg/KH", 2, 14, "Langsam absetzen — die exzentrische Phase ist der eigentliche Reiz. Einbeinig deckt außerdem Seitenunterschiede auf."),
    S("Wadenheben", "4x12", "kg", 4, 28, "Volle Absenkung an der Stufe."),
    S("Pallof Press", "3x12/Seite", "✓", 0, null, "Anti-Rotation am Kabel oder Band. Hält den Rücken beim Tragen und beim Klettern stabil."),
    S("Hanging Leg Raises", "3x8-10", "✓", 0),
    S("Terminal Knee Extension", "3x10/Bein", "✓", 0, null, "Prehab Knie · Abschluss, zusammen mit der Hüftmobilität ~8 Min."),
    S("90/90-Hüftmobilität", "2 Min/Seite", "✓", 0),
  ];
  ex.B[1] = [
    S("Kniebeuge", "3x12-15", "kg", 2.5, null, "Pause maximal 90 Sek. Rund 65 % des Arbeitsgewichts aus Block A."),
    S("Step-up Box", "4x12/Bein", "kg/KH", 2, 14, "Hoch aus dem oberen Bein, nicht vom unteren abdrücken."),
    S("Sandsack Carry", "4x40 m", "kg", 4, 16, "Strecke und Zeit hochschrauben, Gewicht moderat halten."),
    S("Wadenheben", "4x20", "kg", 4, 28),
    S("Core-Zirkel", "3 Runden", "✓", 0, null, "Plank, Seitplank, Beinheben — je 45–60 Sek, ohne Pause dazwischen."),
    S("Terminal Knee Extension", "3x10/Bein", "✓", 0, null, "Prehab Knie · Abschluss."),
    S("90/90-Hüftmobilität", "2 Min/Seite", "✓", 0),
  ];

  // ── Freitag: Oberkörper + Rudergerät ──
  ex.A[5] = [
    KZ("4x4-6", "RPE 8, sauber ohne Kip. Pro Satz Wiederholungen, Zusatzgewicht (0 = Körpergewicht) und Haken, wenn du das grüne Band benutzt hast. Ziel: ohne Band 4x8, danach Zusatzgewicht."),
    S("Military Press", "3x6-8", "kg", 2.5, 40, "Stehend, Langhantel. Gesäß und Bauch fest, Rippen unten, kein Hohlkreuz. Gewicht = Stange plus Scheiben."),
    S("Langhantel-Rudern", "4x6", "kg", 5, 40, "RPE 7–8. Oberkörper ruhig, kein Schwung."),
    S("Face Pulls", "3x15", "kg", 0, 16.25, "Prehab Schulter. Gewicht bewusst konstant halten."),
    S("Rudergerät", "5x500 m", "Split", 0, null, "RPE 7, Pause = Ruderzeit. Pro Intervall die Zeit in Sekunden eintragen."),
    S("Exz. Handgelenke", "3x15", "✓", 0, null, "Strecker und Beuger, langsam exzentrisch. Prophylaxe gegen Kletterellbogen."),
    S("Y-T-W-Raises", "3x10", "✓", 0),
  ];
  ex.B[5] = [
    KZ("4x AMRAP", "Nicht bis zum Versagen — zwei Wiederholungen vor Schluss abbrechen. Pro Satz Wiederholungen, Zusatzgewicht und Haken fürs grüne Band."),
    S("Military Press", "3x12-15", "kg", 2.5, 30, "Stehend, Langhantel. Leichter als im Kraftblock, Wiederholungen sauber."),
    S("Langhantel-Rudern", "4x12", "kg", 2.5, 40),
    S("Face Pulls", "3x15", "kg", 0, 16.25, "Prehab Schulter. Gewicht konstant halten."),
    weekInBlock % 2 === 1
      ? S("Rudergerät", "Pyramide 250-500-750-500-250 m", "Split", 0, null, "RPE 6–7, Pause etwa so lang wie das Intervall. Zeit pro Intervall eintragen.")
      : S("Rudergerät", "4x750 m", "Split", 0, null, "RPE 5–6, Pause halbe Intervallzeit. Zeit pro Intervall eintragen."),
    S("Exz. Handgelenke", "3x15", "✓", 0, null, "Strecker und Beuger, langsam exzentrisch."),
    S("Y-T-W-Raises", "3x10", "✓", 0),
  ];

  // ── Sonntag: Motor — Steigung & Tragen (Zeitdeckel 75 Min) ──
  ex.A[0] = [
    S("Laufband Intervalle", "4x4 Min", "bpm", 0, null, "8–10 % Steigung. 10 Min einlaufen, dann 4x4 Min so zügig, dass du die letzten 60 Sek kaum noch sprechen kannst, dazwischen 3 Min locker. Ø-Puls pro Intervall eintragen — daraus leiten wir deine echten Zonen ab."),
    S("Sandsack-Tragen", "3x6 Min", "kg", 4, 20, "Sandsack auf der Schulter, Seite nach der Hälfte wechseln. 2 Min Pause ohne Sack."),
    S("Goblet Squat", "3x15", "kg", 2, 16, "Zirkel 1/2 · Hantel vor der Brust, Oberkörper aufrecht."),
    S("Farmer's Carry", "3x30 m", "kg", 4, 24, "Zirkel 2/2 · schwer, kurze Strecke, Schultern hinten."),
    S("Couch Stretch", "90 Sek/Seite", "✓", 0, null, "Mobility zum Abschluss."),
  ];
  ex.B[0] = [
    S("Laufband Kapazität", "45-60 Min", "min", 0, 45, "12–15 % Steigung, durchgehend Z2, ohne Zusatzgewicht. Gehen, nicht laufen, und nicht am Griff festhalten. Erst die Dauer steigern, dann die Steigung."),
    S("Sandsack-Tragen", "4x8 Min", "kg", 4, 20, "Schulterwechsel, 2 Min Pause ohne Sack zwischen den Blöcken."),
    S("Goblet Squat", "3x20", "kg", 2, 16, "Zirkel 1/2 · Kraftausdauer, moderates Gewicht."),
    S("Farmer's Carry", "4x30 m", "kg", 4, 24, "Zirkel 2/2 · moderates Gewicht, mehr Sätze."),
    S("Couch Stretch", "90 Sek/Seite", "✓", 0, null, "Mobility zum Abschluss."),
  ];

  const list = (ex[blockType] && ex[blockType][dowIdx]) || [];
  const hint = retest
    ? "Standortbestimmung: Gewichte der letzten Wochen sauber wiederholen, einen Satz weniger. Kein Maximalversuch — es geht darum, den Fortschritt schwarz auf weiß zu haben."
    : abreise
      ? "Abreisewoche: Volumen deutlich runter, Gewichte spürbar leichter. Du willst ausgeruht ins Flugzeug, nicht mit Muskelkater."
      : deload
        ? "Deload: Volumen etwa 40 % runter (ein Satz weniger pro Übung), Gewichte halten."
        : "";
  return { title: titles[dowIdx], type: "gym", hint, exercises: list };
}

/** Schema mit Wiederholungsspanne wie "3x6-8" oder "4x4-6": hier trägst du zusätzlich die tatsächlichen Wiederholungen ein. */
export const hatSpanne = (scheme) => /^\d+\s*x\s*\d+\s*-\s*\d+/i.test(scheme || "");

/** Anzahl Sätze aus einem Schema wie "4x5" oder "3x12-15". Maximal 8. */
export const setCount = (scheme) => {
  const m = /^(\d+)\s*x/i.exec(scheme || "");
  return m ? Math.min(parseInt(m[1], 10), 8) : 1;
};

/** Alle je definierten Übungen: ID → Name/Einheit, für Export und Alt-Einträge. */
export const EX_INDEX = (() => {
  const m = {};
  for (const bt of ["A", "B"])
    for (const dw of [0, 1, 5]) for (const x of getSession(PLAN_SAMPLE[bt], dw).exercises) m[x.id] = { name: x.name, unit: x.unit };
  for (const x of getSession(REISE.start, 1).exercises) m[x.id] = { name: x.name, unit: x.unit };
  const legacy = [
    ["Plank", "✓"],
    ["Steigungslaufband", "min"],
    ["Rudern Intervalle", "Split"],
    ["Rückwärts-Ausfallschritt", "kg/KH"],
    ["Wadenheben einbeinig", "✓"],
    ["Hanging Leg Raises", "✓"],
    ["Step-up Box", "kg/KH"],
    ["Schulterdrücken", "kg/KH"],
  ];
  for (const [name, unit] of legacy) {
    const id = slug(name);
    if (!m[id]) m[id] = { name, unit };
  }
  return m;
})();
