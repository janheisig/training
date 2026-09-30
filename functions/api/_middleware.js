// Alles unter /api/ ist geschützt, außer dem Login selbst und dem Strava-Rücksprung
// (der kommt von Strava und kann keinen Authorization-Header mitbringen).

import { tokenPruefen, bearer, json, fehlt } from "../_lib/auth.js";

const OFFEN = ["/api/login", "/api/strava/callback", "/api/strava/connect", "/api/health"];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const offeneKonfig = fehlt(env);
  if (offeneKonfig && url.pathname !== "/api/health")
    return json({ error: `Server nicht fertig eingerichtet — es fehlen: ${offeneKonfig.join(", ")}` }, 503);

  if (OFFEN.includes(url.pathname)) return next();

  if (!(await tokenPruefen(env, bearer(request)))) return json({ error: "Nicht angemeldet" }, 401);

  return next();
}
