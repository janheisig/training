// Direkte Strava-Anbindung. Kein Claude mehr dazwischen: das ist schneller, kostet
// nichts und liefert Rohwerte statt einer Interpretation.

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

export const AUTH_URL = "https://www.strava.com/oauth/authorize";
export const SCOPE = "activity:read_all";

export function redirectUri(request) {
  // Aus der aufgerufenen URL bauen, damit es auf *.pages.dev und auf einer eigenen
  // Domain gleichermaßen funktioniert. Bei Strava wird nur die Domain registriert.
  const u = new URL(request.url);
  return `${u.origin}/api/strava/callback`;
}

async function tokenAnfrage(env, params) {
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    ...params,
  });
  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await resp.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
    /* Strava antwortet im Fehlerfall gelegentlich mit HTML */
  }
  if (!resp.ok || !j || !j.access_token) {
    const grund = (j && (j.message || JSON.stringify(j.errors || j))) || text.slice(0, 200);
    throw new Error(`Strava-Token abgelehnt (${resp.status}): ${grund}`);
  }
  return j;
}

export const codeEinloesen = (env, code) => tokenAnfrage(env, { code, grant_type: "authorization_code" });

export const tokenErneuern = (env, refreshToken) =>
  tokenAnfrage(env, { refresh_token: refreshToken, grant_type: "refresh_token" });

export async function tokenLesen(env) {
  const r = await env.DB.prepare("SELECT access_token, refresh_token, expires_at, athlete FROM strava_token WHERE id = 1").first();
  return r || null;
}

export async function tokenSchreiben(env, t) {
  await env.DB.prepare(
    `INSERT INTO strava_token (id, access_token, refresh_token, expires_at, athlete, updated_at)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET access_token = excluded.access_token, refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at, athlete = COALESCE(excluded.athlete, strava_token.athlete),
       updated_at = excluded.updated_at`
  )
    .bind(t.access_token, t.refresh_token, t.expires_at, t.athlete ? JSON.stringify(t.athlete) : null, Date.now())
    .run();
}

/** Gültiges Access-Token holen und bei Bedarf erneuern. */
export async function gueltigesToken(env) {
  const t = await tokenLesen(env);
  if (!t) throw new Error("Strava ist nicht verbunden");
  // 120 Sekunden Sicherheitsabstand, damit ein Token nicht mitten im Request abläuft.
  if (t.expires_at > Math.floor(Date.now() / 1000) + 120) return t.access_token;
  const neu = await tokenErneuern(env, t.refresh_token);
  await tokenSchreiben(env, {
    access_token: neu.access_token,
    refresh_token: neu.refresh_token || t.refresh_token,
    expires_at: neu.expires_at,
    athlete: neu.athlete || null,
  });
  return neu.access_token;
}

/**
 * Aktivitäten in einem Zeitraum. `von`/`bis` sind ISO-Daten (lokale Tage, inklusive).
 * Strava erwartet Unix-Sekunden und grenzt exklusiv ab — daher der Tag Puffer.
 */
export async function aktivitaetenHolen(env, von, bis) {
  const token = await gueltigesToken(env);
  const after = Math.floor(new Date(von + "T00:00:00Z").getTime() / 1000) - 86400;
  const before = Math.floor(new Date(bis + "T23:59:59Z").getTime() / 1000) + 86400;

  const url = `${API}/athlete/activities?after=${after}&before=${before}&per_page=100`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (resp.status === 429) throw new Error("Strava-Limit erreicht (100 Anfragen je 15 Min). Später erneut versuchen.");
  const text = await resp.text();
  let j = null;
  try {
    j = JSON.parse(text);
  } catch {
    /* ignorieren */
  }
  if (!resp.ok) throw new Error(`Strava ${resp.status}: ${(j && j.message) || text.slice(0, 160)}`);
  if (!Array.isArray(j)) throw new Error("Unerwartete Antwort von Strava (keine Liste)");
  return j;
}

const hhmm = (sek) => {
  if (!sek) return null;
  const h = Math.floor(sek / 3600);
  const m = Math.round((sek % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
};

/** Strava-Rohdaten auf die Felder reduzieren, die das Dashboard nutzt. */
export function normalisieren(a) {
  const watts = a.average_watts ?? null;
  const hf = a.average_heartrate ?? null;
  return {
    strava_id: a.id,
    name: a.name || "",
    sport: a.sport_type || a.type || "Aktivität",
    // start_date_local ist bereits in Ortszeit — genau das brauchen wir für die Tageszuordnung.
    datum: (a.start_date_local || a.start_date || "").slice(0, 10),
    distanz_km: a.distance ? Math.round((a.distance / 1000) * 100) / 100 : null,
    zeit_hmm: hhmm(a.moving_time || a.elapsed_time),
    bewegt_sek: a.moving_time ?? null,
    hf_avg: hf ? Math.round(hf) : null,
    hf_max: a.max_heartrate ? Math.round(a.max_heartrate) : null,
    anstieg_m: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : null,
    watts_avg: watts ? Math.round(watts) : null,
    watts_normalisiert: a.weighted_average_watts ?? null,
    // device_watts sagt, ob ein echter Leistungsmesser die Werte geliefert hat oder
    // Strava sie geschätzt hat. Für EF-Vergleiche ist das der entscheidende Unterschied.
    watts_ist_geschaetzt: watts ? a.device_watts === false : null,
    kadenz_avg: a.average_cadence ? Math.round(a.average_cadence) : null,
    kj: a.kilojoules ? Math.round(a.kilojoules) : null,
    // Strava kennt das Pendel-Häkchen selbst — besser als aus der Distanz zu raten.
    pendel: !!a.commute,
    indoor: !!a.trainer,
    ef: watts && hf ? Math.round((watts / hf) * 100) / 100 : null,
  };
}
