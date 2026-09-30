// Rücksprung von Strava. Kommt aus dem Browser, nicht aus der App — deshalb
// antworten wir mit einer kleinen HTML-Seite statt mit JSON und schicken den
// Nutzer danach zurück in die App.

import { codeEinloesen, tokenSchreiben } from "../../_lib/strava.js";
import { tokenPruefen } from "../../_lib/auth.js";

const seite = (titel, text, ok) => `<!doctype html>
<html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${titel}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; background:#10161C; color:#EDF2F4;
         font-family: system-ui, -apple-system, sans-serif; padding:24px; }
  .k { background:#1A2229; border:1px solid #2A3540; border-radius:12px; padding:24px; max-width:420px; }
  h1 { font-size:18px; margin:0 0 10px; color:${ok ? "#7CC98A" : "#E05656"}; }
  p { margin:0 0 18px; line-height:1.55; color:#8FA1AC; font-size:14px; }
  a { display:inline-block; background:#FF6A2B; color:#10161C; text-decoration:none;
      padding:11px 18px; border-radius:8px; font-weight:600; font-size:14px; }
</style></head>
<body><div class="k"><h1>${titel}</h1><p>${text}</p><a href="/">Zurück zum Dashboard</a></div></body></html>`;

const html = (body, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const fehler = url.searchParams.get("error");
  if (fehler)
    return html(seite("Nicht verbunden", `Strava hat abgelehnt: <code>${fehler}</code>. Meist heißt das, dass der Zugriff nicht bestätigt wurde.`, false), 400);

  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("scope") || "";
  const state = url.searchParams.get("state") || "";

  if (!code) return html(seite("Nicht verbunden", "Strava hat keinen Autorisierungscode mitgeschickt.", false), 400);
  if (!(await tokenPruefen(env, state)))
    return html(seite("Abgelehnt", "Der Sicherheitsparameter war ungültig oder abgelaufen. Bitte die Verbindung in der App noch einmal starten.", false), 403);

  if (!scope.includes("activity:read_all"))
    return html(
      seite(
        "Berechtigung fehlt",
        "Ohne die Freigabe „Alle Aktivitäten ansehen“ kann das Dashboard deine Einheiten nicht lesen. Bitte noch einmal verbinden und das Häkchen setzen.",
        false
      ),
      400
    );

  try {
    const t = await codeEinloesen(env, code);
    await tokenSchreiben(env, {
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      athlete: t.athlete || null,
    });
  } catch (e) {
    return html(seite("Fehler beim Verbinden", String(e.message || e).slice(0, 300), false), 500);
  }

  const name = "Strava ist verbunden";
  return html(seite(name, "Ab jetzt holt das Dashboard deine Radeinheiten selbst — beim Öffnen für die laufende Woche.", true));
}
