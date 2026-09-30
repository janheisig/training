import { useState, useEffect } from "react";
import { plusTage, weekBounds, kurz } from "../lib/dates.js";
import * as store from "../lib/store.js";
import { Karte } from "./ui.jsx";

export default function Einstellungen({ data, setData, todayStr, melde, busy, strava, stravaLaden, stravaHolen, abgleich, offen, abmelden }) {
  const [importText, setImportText] = useState("");
  const [zeigeImport, setZeigeImport] = useState(false);

  useEffect(() => {
    if (!strava) stravaLaden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anzahl = (t) => Object.keys(data[t] || {}).length;

  const importieren = () => {
    let j;
    try {
      j = JSON.parse(importText);
    } catch {
      melde("Das ist kein gültiges JSON", "fehler", 3000);
      return;
    }
    const fremd = j.data || j;
    if (!fremd || typeof fremd !== "object") {
      melde("Keine Daten in der Datei gefunden", "fehler", 3000);
      return;
    }
    setData((lokal) => {
      const zusammen = store.merge(lokal, { ...store.leer(), ...fremd });
      store.saveLocal(zusammen);
      return zusammen;
    });
    setImportText("");
    setZeigeImport(false);
    melde("Importiert und zusammengeführt", "ok");
  };

  return (
    <>
      {/* ── Strava ── */}
      <Karte>
        <h2>Strava</h2>
        {!strava ? (
          <div className="dim klein-text">Status wird geladen …</div>
        ) : !strava.eingerichtet ? (
          <div className="klein-text warn">
            Auf dem Server fehlen noch <span className="mono">STRAVA_CLIENT_ID</span> und{" "}
            <span className="mono">STRAVA_CLIENT_SECRET</span>. Siehe README, Abschnitt „Strava verbinden“.
          </div>
        ) : strava.verbunden ? (
          <>
            <div className="klein-text ok">
              Verbunden{strava.athlet ? ` als ${strava.athlet.vorname} ${strava.athlet.nachname}` : ""}.
            </div>
            <div className="klein-text dim mt">
              Beim Öffnen der App wird die laufende Woche automatisch nachgezogen. Das Pendel-Häkchen kommt direkt aus
              Strava, nicht aus einer Schätzung.
            </div>
            <div className="knopfreihe mt">
              <button
                onClick={() => stravaHolen(weekBounds(todayStr).mon, todayStr)}
                disabled={busy === "strava"}
              >
                {busy === "strava" ? "…" : "Diese Woche holen"}
              </button>
              <button onClick={() => stravaHolen(plusTage(todayStr, -27), todayStr)} disabled={busy === "strava"}>
                Letzte 4 Wochen
              </button>
            </div>
            <button
              className="klein mt"
              onClick={async () => {
                try {
                  await store.stravaDisconnect();
                  melde("Strava getrennt", "ok");
                  stravaLaden();
                } catch (e) {
                  melde(e.message, "fehler");
                }
              }}
            >
              Verbindung trennen
            </button>
          </>
        ) : (
          <>
            <div className="klein-text dim">
              Noch nicht verbunden. Beim Verbinden musst du „Alle Aktivitäten ansehen“ freigeben — sonst kann das
              Dashboard deine Fahrten nicht lesen.
            </div>
            <a href={strava.connect_url || "/api/strava/connect"} style={{ textDecoration: "none" }}>
              <button className="primaer mt" style={{ width: "100%" }}>
                Mit Strava verbinden
              </button>
            </a>
          </>
        )}
      </Karte>

      {/* ── Sync ── */}
      <Karte>
        <h2>Daten</h2>
        <table className="tabelle">
          <tbody>
            <tr>
              <td>Trainingstage</td>
              <td className="z">{anzahl("logs")}</td>
            </tr>
            <tr>
              <td>Wiegungen</td>
              <td className="z">{anzahl("gewicht")}</td>
            </tr>
            <tr>
              <td>FTP-Werte</td>
              <td className="z">{anzahl("ftp")}</td>
            </tr>
            <tr>
              <td>Kreatin-Tage</td>
              <td className="z">{anzahl("supplements")}</td>
            </tr>
            <tr>
              <td>Noch nicht synchronisiert</td>
              <td className="z" style={{ color: offen ? "var(--warn)" : "var(--ok)" }}>
                {offen}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="klein-text dim mt">
          Eingaben landen sofort auf dem Gerät und gelten damit als gespeichert. Der Abgleich mit dem Server läuft im
          Hintergrund — im Gym ohne Empfang arbeitest du einfach weiter, es geht nichts verloren.
        </div>
        <div className="knopfreihe mt">
          <button onClick={() => abgleich(false)} disabled={busy === "sync"}>
            {busy === "sync" ? "…" : "Jetzt abgleichen"}
          </button>
          <button onClick={() => setZeigeImport((z) => !z)}>Sicherung einlesen</button>
        </div>
        {zeigeImport && (
          <>
            <textarea
              className="mt"
              style={{ minHeight: 120, fontFamily: "var(--mono)", fontSize: 12 }}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Inhalt einer training-sicherung-*.json hier einfügen"
            />
            <div className="klein-text dim mt">
              Wird zusammengeführt, nicht ersetzt: bei gleichem Datum gewinnt der neuere Eintrag.
            </div>
            <button className="primaer mt" onClick={importieren} disabled={!importText.trim()}>
              Zusammenführen
            </button>
          </>
        )}
      </Karte>

      {/* ── App ── */}
      <Karte>
        <h2>App</h2>
        <div className="klein-text dim">
          Auf dem iPhone: in Safari öffnen, Teilen-Symbol, „Zum Home-Bildschirm“. Danach startet sie ohne Adressleiste
          und funktioniert auch offline.
        </div>
        <button className="klein mt" onClick={abmelden}>
          Abmelden
        </button>
      </Karte>

      <Karte>
        <h3>Grundsätze</h3>
        <div className="klein-text dim">
          Kein Laufen. Donnerstag ist blockiert. Zusatzlast nur draußen, im Studio Sandsäcke auf der Schulter. Keine
          Kalorienvorgaben — gesteuert wird über die Wochenrate, und wenn sie zu schnell fällt, heißt die Antwort mehr
          essen. Fallen Kraftwerte zwei Einheiten in Folge, wird das Defizit kleiner, nicht das Training härter.
        </div>
      </Karte>
    </>
  );
}
