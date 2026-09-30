// Startbestand: alles, was vor dem Umbau schon protokolliert war. Wird beim ersten
// Start eingespielt und danach nie wieder angefasst — eigene Einträge gewinnen immer.

import { slug } from "./dates.js";

const SEED_RAW = {
  "2026-07-18": {
    ex: [
      ["Kniebeuge", ["50", "50", "50"]],
      ["Step-up Box", ["12", "12"]],
      ["Klimmzüge", ["4", "4", "4"]],
      ["Langhantel-Rudern", ["40", "40", "40"]],
      ["Wadenheben", ["24", "24", "24"]],
    ],
    note: "Wiedereinstieg Ganzkörper nach Pause. Zusätzlich 20 Min Steigungslaufband 10 % Z2, ohne Last.",
  },
  "2026-07-19": {
    cardio: {
      quelle: "Strava",
      sport: "Ride",
      distanz: "49.2",
      zeit: "2:17",
      hf: "127",
      hm: "288",
      aktivitaeten: [{ sport: "Ride", distanz_km: 49.2, zeit_hmm: "2:17", hf_avg: 127, anstieg_m: 288 }],
      bewertung: "Sehr saubere Z2-Disziplin mit Ø 127 bpm. Referenzrunde Frankfurt–Hanau.",
    },
    note: "Referenzrunde Frankfurt–Hanau.",
  },
  "2026-07-20": {
    ex: [
      ["Kniebeuge", ["60", "60", "60", "60", "60"]],
      ["Rumän. Kreuzheben", ["50", "50", "50", "50"]],
      ["Step-up Box", ["12", "12", "12"]],
      ["Wadenheben", ["24", "24", "24", "24"]],
    ],
    note: "Step-ups mit 12 kg in jeder Hand.",
  },
  "2026-07-24": {
    ex: [
      ["Klimmzüge", ["5", "5", "5"]],
      ["Langhantel-Rudern", ["40", "40", "40", "40"]],
      ["Schulterdrücken", ["15", "15", "15"]],
      ["Face Pulls", ["16,25", "16,25", "16,25"]],
    ],
    note: "Face Pulls und Schulterdrücken: nächstmögliches Gewicht am Gerät.",
  },
  "2026-07-26": {
    ex: [["Goblet Squat", ["16", "16", "16"]]],
    note: "Rucksack mit Gewicht geht im Studio nicht — daher jetzt Sandsack statt Traglast auf dem Laufband.",
  },
  "2026-09-01": {
    cardio: {
      quelle: "Strava",
      sport: "2 Aktivitäten",
      distanz: "29.2",
      zeit: "0:37",
      hm: "149",
      pendel: true,
      done: true,
      aktivitaeten: [
        { sport: "Ride", distanz_km: 13.71, zeit_hmm: "0:37", anstieg_m: 94 },
        { sport: "Ride", distanz_km: 15.45, zeit_hmm: "0:39", anstieg_m: 55 },
      ],
    },
  },
  "2026-09-02": {
    cardio: {
      quelle: "Strava",
      sport: "Ride",
      distanz: "15.4",
      zeit: "0:45",
      hm: "91",
      pendel: true,
      done: true,
      aktivitaeten: [{ sport: "Ride", distanz_km: 15.42, zeit_hmm: "0:45", anstieg_m: 91 }],
    },
  },
  "2026-09-09": {
    cardio: {
      quelle: "Strava",
      sport: "3 Aktivitäten",
      distanz: "32.8",
      zeit: "0:46",
      hf: "130",
      hm: "152",
      pendel: true,
      done: true,
      aktivitaeten: [
        { sport: "Ride", distanz_km: 15.44, zeit_hmm: "0:46", hf_avg: 130, anstieg_m: 106, watts_avg: 151, watts_ist_geschaetzt: false, kadenz_avg: 77, ef: 1.16 },
        { sport: "Ride", distanz_km: 9.9, zeit_hmm: "0:28", anstieg_m: 18 },
        { sport: "Ride", distanz_km: 7.42, zeit_hmm: "0:22", anstieg_m: 29 },
      ],
      bewertung:
        "Erste Fahrt mit echten Gerätewatt: Ø 151 W bei Ø 130 bpm, Efficiency Factor 1,16 — das ist der Startwert, gegen den ab jetzt gemessen wird.",
    },
    note: "Letzte Einheit vor der Pause.",
  },
};

export const SEED_BENCHMARKS = [{ datum: "2026-07-19", kmh: 21.5, hf: 127 }];

// Vorläufige FTP aus den Pendeldaten geschätzt — bestes 20-Min-Mittel 182 W stammt aus
// einer reinen Z2-Fahrt, der echte Wert liegt darüber. Der Test in Woche 1 ersetzt ihn.
export const SEED_FTP = [{ datum: "2026-09-09", watts: 200, quelle: "vorläufig aus Pendeldaten", vorlaeufig: true }];

export const SEED_GEWICHT = [{ datum: "2026-09-28", kg: 103 }];

export const SEED_LOGS = (() => {
  const out = {};
  for (const [d, v] of Object.entries(SEED_RAW)) {
    const entries = {};
    for (const [name, sets] of v.ex || []) entries[slug(name)] = { sets, done: true };
    out[d] = { entries, cardio: v.cardio || {}, note: v.note || "" };
  }
  return out;
})();
