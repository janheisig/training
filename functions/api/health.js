// Diagnose ohne Anmeldung: sagt, was noch fehlt. Nützlich genau einmal — beim Einrichten.

import { json } from "../_lib/auth.js";

export async function onRequestGet({ env }) {
  let db = "fehlt";
  if (env.DB) {
    try {
      await env.DB.prepare("SELECT 1").first();
      db = "ok";
    } catch (e) {
      db = "Fehler: " + (e.message || "unbekannt").slice(0, 120);
    }
  }
  return json({
    ok: true,
    db,
    konfiguriert: {
      SESSION_SECRET: !!env.SESSION_SECRET,
      APP_PASSWORD: !!env.APP_PASSWORD,
      STRAVA_CLIENT_ID: !!env.STRAVA_CLIENT_ID,
      STRAVA_CLIENT_SECRET: !!env.STRAVA_CLIENT_SECRET,
    },
  });
}
