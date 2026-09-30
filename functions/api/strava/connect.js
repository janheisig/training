// Start des OAuth-Tanzes. Öffentlich erreichbar, weil der Aufruf aus einem
// normalen Link kommt und keinen Authorization-Header mitbringen kann.
// Schutz: ein kurzlebiger, signierter `state`-Parameter, den der Callback prüft.

import { AUTH_URL, SCOPE, redirectUri } from "../../_lib/strava.js";
import { tokenErzeugen, json } from "../../_lib/auth.js";

export async function onRequestGet({ request, env }) {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET)
    return json({ error: "Strava ist nicht eingerichtet — STRAVA_CLIENT_ID und STRAVA_CLIENT_SECRET fehlen." }, 503);

  const url = new URL(request.url);
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: redirectUri(request),
    response_type: "code",
    approval_prompt: "auto",
    scope: SCOPE,
    // Der Callback bekommt kein Bearer-Token von Strava. Über `state` reisen wir
    // ein frisches App-Token mit, damit der Rücksprung zuordenbar bleibt.
    state: url.searchParams.get("t") || (await tokenErzeugen(env)),
  });

  return Response.redirect(`${AUTH_URL}?${params}`, 302);
}
