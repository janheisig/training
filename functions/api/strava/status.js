import { tokenLesen } from "../../_lib/strava.js";
import { tokenErzeugen, json } from "../../_lib/auth.js";

export async function onRequestGet({ env }) {
  if (!env.STRAVA_CLIENT_ID) return json({ verbunden: false, eingerichtet: false });
  if (!env.DB) return json({ verbunden: false, eingerichtet: true, fehler: "Keine Datenbank angebunden" });

  let t = null;
  try {
    t = await tokenLesen(env);
  } catch (e) {
    return json({ verbunden: false, eingerichtet: true, fehler: String(e.message || e).slice(0, 160) });
  }

  let athlet = null;
  try {
    athlet = t && t.athlete ? JSON.parse(t.athlete) : null;
  } catch {
    /* ignorieren */
  }

  return json({
    verbunden: !!t,
    eingerichtet: true,
    athlet: athlet ? { vorname: athlet.firstname, nachname: athlet.lastname } : null,
    laeuft_ab: t ? t.expires_at : null,
    // Der Verbindungs-Link braucht ein frisches Token für den state-Parameter.
    connect_url: `/api/strava/connect?t=${encodeURIComponent(await tokenErzeugen(env))}`,
  });
}
