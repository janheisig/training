import { tokenErzeugen, passwortPruefen, json } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Kein lesbarer Request" }, 400);
  }
  if (!(await passwortPruefen(env, body.password))) {
    // Kleine Bremse gegen Durchprobieren.
    await new Promise((r) => setTimeout(r, 400));
    return json({ error: "Passwort stimmt nicht" }, 401);
  }
  return json({ token: await tokenErzeugen(env) });
}
