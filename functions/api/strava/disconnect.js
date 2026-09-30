import { json } from "../../_lib/auth.js";

export async function onRequestPost({ env }) {
  if (!env.DB) return json({ error: "Keine Datenbank angebunden" }, 503);
  try {
    await env.DB.prepare("DELETE FROM strava_token WHERE id = 1").run();
  } catch (e) {
    return json({ error: String(e.message || e).slice(0, 200) }, 500);
  }
  return json({ ok: true });
}
