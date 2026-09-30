// Zugangsschutz. Die App liegt auf einer öffentlichen URL — ohne Gate könnte jeder
// deine Trainingsdaten lesen und überschreiben.
//
// Ein Passwort, daraus ein signiertes Token mit Ablaufdatum. Kein Framework, nur
// Web Crypto, das in Workern eingebaut ist.

const enc = new TextEncoder();

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** Vergleich in konstanter Zeit — verhindert, dass die Antwortzeit das Passwort verrät. */
function gleich(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const GUELTIG_MS = 1000 * 60 * 60 * 24 * 180; // ein halbes Jahr — du willst dich nicht wöchentlich anmelden

export async function tokenErzeugen(env) {
  const exp = Date.now() + GUELTIG_MS;
  const sig = await hmac(env.SESSION_SECRET, `v1.${exp}`);
  return `v1.${exp}.${sig}`;
}

export async function tokenPruefen(env, token) {
  if (!token) return false;
  const teile = token.split(".");
  if (teile.length !== 3 || teile[0] !== "v1") return false;
  const exp = parseInt(teile[1], 10);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return gleich(teile[2], await hmac(env.SESSION_SECRET, `v1.${exp}`));
}

export async function passwortPruefen(env, passwort) {
  if (!env.APP_PASSWORD) return false;
  // Über den Hash vergleichen, damit unterschiedliche Längen nichts verraten.
  const a = await hmac(env.SESSION_SECRET || "x", String(passwort || ""));
  const b = await hmac(env.SESSION_SECRET || "x", env.APP_PASSWORD);
  return gleich(a, b);
}

export const bearer = (request) => (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export const fehlt = (env) => {
  const offen = ["SESSION_SECRET", "APP_PASSWORD"].filter((k) => !env[k]);
  return offen.length ? offen : null;
};
