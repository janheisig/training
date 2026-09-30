// Die Server-Teile, die sich ohne Cloudflare-Laufzeit prüfen lassen: Token-Logik
// (sicherheitsrelevant) und die Normalisierung der Strava-Rohdaten.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { tokenErzeugen, tokenPruefen, passwortPruefen, bearer, fehlt } from "../functions/_lib/auth.js";
import { normalisieren, redirectUri } from "../functions/_lib/strava.js";

const env = { SESSION_SECRET: "geheim-fuer-den-test", APP_PASSWORD: "hunter2" };

describe("Zugangsschutz", () => {
  test("Ein frisches Token wird akzeptiert", async () => {
    assert.ok(await tokenPruefen(env, await tokenErzeugen(env)));
  });

  test("Ein manipuliertes Token wird abgelehnt", async () => {
    const t = await tokenErzeugen(env);
    const [v, exp, sig] = t.split(".");
    assert.ok(!(await tokenPruefen(env, `${v}.${exp}.${sig.slice(0, -2)}XY`)), "verfälschte Signatur");
    // Ablauf nach hinten schieben, ohne neu zu signieren
    assert.ok(!(await tokenPruefen(env, `${v}.${Number(exp) + 999999}.${sig}`)), "verlängerter Ablauf");
  });

  test("Ein abgelaufenes Token wird abgelehnt", async () => {
    // Von Hand bauen, wie tokenErzeugen es täte, aber mit Ablauf in der Vergangenheit.
    const gueltig = await tokenErzeugen(env);
    const sig = gueltig.split(".")[2];
    assert.ok(!(await tokenPruefen(env, `v1.${Date.now() - 1000}.${sig}`)));
  });

  test("Ein Token aus einem anderen Secret wird abgelehnt", async () => {
    const fremd = await tokenErzeugen({ ...env, SESSION_SECRET: "anderes-secret" });
    assert.ok(!(await tokenPruefen(env, fremd)));
  });

  test("Unsinn wird abgelehnt, ohne zu werfen", async () => {
    for (const t of ["", null, undefined, "abc", "v1.x.y", "v2.1.2", "a.b.c.d"])
      assert.equal(await tokenPruefen(env, t), false, `Token: ${t}`);
  });

  test("Das Passwort wird korrekt geprüft", async () => {
    assert.ok(await passwortPruefen(env, "hunter2"));
    assert.ok(!(await passwortPruefen(env, "hunter3")));
    assert.ok(!(await passwortPruefen(env, "")));
    assert.ok(!(await passwortPruefen(env, "hunter2 ")), "kein Trimmen");
  });

  test("Ohne gesetztes Passwort kommt niemand rein", async () => {
    assert.ok(!(await passwortPruefen({ SESSION_SECRET: "x" }, "")));
    assert.ok(!(await passwortPruefen({ SESSION_SECRET: "x" }, "irgendwas")));
  });

  test("Fehlende Konfiguration wird gemeldet", () => {
    assert.equal(fehlt(env), null);
    assert.deepEqual(fehlt({ SESSION_SECRET: "x" }), ["APP_PASSWORD"]);
    assert.deepEqual(fehlt({}), ["SESSION_SECRET", "APP_PASSWORD"]);
  });

  test("Der Bearer-Header wird sauber ausgelesen", () => {
    const r = (v) => ({ headers: { get: () => v } });
    assert.equal(bearer(r("Bearer abc")), "abc");
    assert.equal(bearer(r("bearer abc")), "abc");
    assert.equal(bearer(r(null)), "");
  });
});

describe("Strava-Rohdaten", () => {
  const roh = {
    id: 123,
    name: "Pendeln",
    sport_type: "Ride",
    type: "Ride",
    start_date_local: "2026-09-09T07:42:11Z",
    start_date: "2026-09-09T05:42:11Z",
    distance: 15442.3,
    moving_time: 2760,
    elapsed_time: 2900,
    total_elevation_gain: 106.4,
    average_heartrate: 130.2,
    max_heartrate: 158,
    average_watts: 151.4,
    weighted_average_watts: 168,
    device_watts: true,
    average_cadence: 77.3,
    kilojoules: 418.2,
    commute: true,
    trainer: false,
  };

  test("Die Kernwerte werden korrekt umgerechnet", () => {
    const n = normalisieren(roh);
    assert.equal(n.datum, "2026-09-09");
    assert.equal(n.distanz_km, 15.44);
    assert.equal(n.zeit_hmm, "0:46");
    assert.equal(n.hf_avg, 130);
    assert.equal(n.watts_avg, 151);
    assert.equal(n.anstieg_m, 106);
    assert.equal(n.kadenz_avg, 77);
  });

  test("Der Efficiency Factor wird gerechnet, nicht geschätzt", () => {
    assert.equal(normalisieren(roh).ef, 1.16);
  });

  test("Echte Gerätewatt werden von geschätzten unterschieden", () => {
    assert.equal(normalisieren(roh).watts_ist_geschaetzt, false);
    assert.equal(normalisieren({ ...roh, device_watts: false }).watts_ist_geschaetzt, true);
    assert.equal(normalisieren({ ...roh, average_watts: null }).watts_ist_geschaetzt, null);
  });

  test("Das Pendel-Häkchen kommt von Strava, nicht aus einer Schätzung", () => {
    assert.equal(normalisieren(roh).pendel, true);
    assert.equal(normalisieren({ ...roh, commute: false }).pendel, false);
  });

  test("Das lokale Datum gewinnt über UTC — sonst rutschen Abendfahrten einen Tag", () => {
    const spaet = { ...roh, start_date_local: "2026-09-09T23:30:00Z", start_date: "2026-09-09T21:30:00Z" };
    assert.equal(normalisieren(spaet).datum, "2026-09-09");
    const frueh = { ...roh, start_date_local: "2026-09-10T00:30:00Z", start_date: "2026-09-09T22:30:00Z" };
    assert.equal(normalisieren(frueh).datum, "2026-09-10");
  });

  test("Fehlende Felder führen zu null, nicht zu NaN", () => {
    const n = normalisieren({ id: 1, start_date_local: "2026-09-09T07:00:00Z" });
    for (const [k, v] of Object.entries(n)) assert.ok(!Number.isNaN(v), `${k} ist NaN`);
    assert.equal(n.distanz_km, null);
    assert.equal(n.ef, null);
    assert.equal(n.hf_avg, null);
  });

  test("Die Rücksprung-Adresse wird aus der aufgerufenen URL gebaut", () => {
    assert.equal(redirectUri({ url: "https://training.pages.dev/api/strava/connect" }), "https://training.pages.dev/api/strava/callback");
    assert.equal(redirectUri({ url: "https://sport.example.com/api/strava/connect?t=x" }), "https://sport.example.com/api/strava/callback");
  });
});
