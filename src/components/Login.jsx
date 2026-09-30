import { useState } from "react";
import * as store from "../lib/store.js";

export default function Login({ onFertig }) {
  const [pw, setPw] = useState("");
  const [fehler, setFehler] = useState("");
  const [busy, setBusy] = useState(false);

  const senden = async (e) => {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setFehler("");
    try {
      const r = await store.login(pw);
      store.setToken(r.token);
      onFertig();
    } catch (err) {
      setFehler(err.status === 0 ? "Keine Verbindung — für die Anmeldung brauchst du einmal Netz." : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="box" onSubmit={senden}>
        <h1>Training</h1>
        <p>
          Die App liegt auf einer öffentlichen Adresse. Das Passwort hält deine Trainingsdaten privat — einmal eingeben,
          danach bleibst du ein halbes Jahr angemeldet.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Passwort"
          autoComplete="current-password"
          autoFocus
          aria-label="Passwort"
        />
        {fehler && (
          <div className="bad klein-text mt" role="alert">
            {fehler}
          </div>
        )}
        <button className="primaer mt" type="submit" disabled={busy} style={{ width: "100%" }}>
          {busy ? "…" : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
