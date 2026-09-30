import { useState } from "react";
import { kurz, fmtNum, fmtKg, num, plusTage, tage } from "../lib/dates.js";
import { FTP_ZONES, ZIEL_DATUM, GEWICHT, EX_INDEX } from "../lib/plan.js";
import { gewichtStatus, efVerlauf, zonenWatt, streak, kreatinStreak } from "../lib/metrics.js";
import { exportText, exportJson } from "../lib/export.js";
import { Karte, Balken, Sparkline } from "./ui.jsx";

const listeAus = (map) =>
  Object.entries(map || {})
    .map(([datum, v]) => ({ datum, ...v }))
    .sort((a, b) => a.datum.localeCompare(b.datum));

/** Kraftverlauf einer Übung: höchstes Gewicht pro Einheit. */
function kraftVerlauf(logs, exId) {
  const out = [];
  for (const datum of Object.keys(logs).sort()) {
    const e = (logs[datum].entries || {})[exId];
    if (!e) continue;
    const werte = (e.sets || []).map(num).filter((x) => x !== null);
    if (!werte.length) continue;
    out.push({ datum, wert: Math.max(...werte) });
  }
  return out;
}

export default function Analyse({ data, schreibe, todayStr, k, melde }) {
  const [ftpFeld, setFtpFeld] = useState("");
  const [text, setText] = useState("");

  const ftpListe = listeAus(data.ftp);
  const aktuelleFtp = ftpListe.length ? ftpListe[ftpListe.length - 1] : null;
  const gewichtListe = listeAus(data.gewicht);
  const gw = gewichtStatus(gewichtListe, todayStr);
  const efs = efVerlauf(data.logs);

  const kopieren = async (t) => {
    try {
      await navigator.clipboard.writeText(t);
      melde("In die Zwischenablage kopiert", "ok");
    } catch {
      setText(t);
      melde("Bitte manuell markieren und kopieren", "", 3000);
    }
  };

  const jsonSichern = () => {
    const blob = new Blob([exportJson(data)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `training-sicherung-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const kernUebungen = ["kniebeuge", "rumnkreuzheben", "klimmzge", "langhantelrudern"];

  return (
    <>
      {/* ── Konstanz: die Leitkennzahl ── */}
      <Karte>
        <h2>Konstanz</h2>
        {k ? (
          <>
            <div className="karte-kopf">
              <div>
                <span className="kennzahl" style={{ color: k.farbe }}>
                  {Math.round(k.quote * 100)} <small>%</small>
                </span>
                <div className="dim klein-text">der geplanten Einheiten, letzte 4 Wochen</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span className="kennzahl" style={{ fontSize: 20 }}>
                  {streak(data.logs, todayStr)}
                </span>
                <div className="dim klein-text">Serie</div>
              </div>
            </div>
            <Balken
              werte={k.wochen.map((w) => ({ wert: w.done, max: w.planned }))}
              labels={k.wochen.map((w) => `${w.done}/${w.planned}`)}
              farbe={(w) => (w.wert / w.max >= 0.85 ? "var(--ok)" : w.wert / w.max >= 0.65 ? "var(--warn)" : "var(--bad)")}
            />
            <div className="klein-text dim mt">
              Das ist die Zahl, auf die es in diesem Bogen ankommt — nicht ein Rekord in einer einzelnen Einheit. Unter
              65 % liegt es fast nie an der Motivation, sondern am Plan; dann kürzen wir ihn.
            </div>
          </>
        ) : (
          <div className="dim klein-text">Noch keine abgeschlossenen Plantage.</div>
        )}
      </Karte>

      {/* ── Körpergewicht ── */}
      <Karte>
        <h2>Körpergewicht</h2>
        {gw ? (
          <>
            <div className="karte-kopf">
              <div>
                <span className="kennzahl">
                  {fmtKg(gw.avg)} <small>kg</small>
                </span>
                <div className="dim klein-text">7-Tage-Schnitt, {gw.n} Wiegungen</div>
              </div>
              {gw.rate !== null && (
                <div style={{ textAlign: "right" }}>
                  <span className="kennzahl" style={{ fontSize: 20, color: gw.farbe }}>
                    {gw.rate > 0 ? "+" : ""}
                    {fmtKg(gw.rate)}
                  </span>
                  <div className="dim klein-text">kg/Woche</div>
                </div>
              )}
            </div>
            {gw.label && (
              <div className="klein-text" style={{ color: gw.farbe }}>
                {gw.label}
              </div>
            )}
            {gw.hinweis && <div className="klein-text dim mt">{gw.hinweis}</div>}
            {gewichtListe.length > 2 && (
              <div className="mt">
                <Sparkline punkte={gewichtListe.map((g) => ({ y: g.kg }))} farbe="var(--ice)" />
                <div className="dim mono klein-text">
                  {kurz(gewichtListe[0].datum)} → {kurz(gewichtListe[gewichtListe.length - 1].datum)}
                </div>
              </div>
            )}
            {gw.prognose && (
              <div className="klein-text dim mt">
                Bei diesem Tempo rund <b className="mono">{fmtKg(gw.prognose)} kg</b> am {kurz(ZIEL_DATUM)}.
              </div>
            )}
            <div className="klein-text dim mt">
              Zielkorridor {fmtNum(GEWICHT.rateZiel[0])} bis {fmtNum(GEWICHT.rateZiel[1])} kg pro Woche. Schneller als{" "}
              {fmtNum(GEWICHT.rateHart)} kg heißt: mehr essen. Eiweiß etwa {fmtNum(GEWICHT.eiweissProKg)} g pro kg
              Körpergewicht.
            </div>
          </>
        ) : (
          <div className="dim klein-text">Noch keine Wiegungen eingetragen.</div>
        )}
        <div className="klein-text dim mt">
          Kreatin-Serie: {kreatinStreak(data.supplements || {}, todayStr)}{" "}
          {kreatinStreak(data.supplements || {}, todayStr) === 1 ? "Tag" : "Tage"}.
        </div>
      </Karte>

      {/* ── FTP & Zonen ── */}
      <Karte>
        <h2>Wattzonen</h2>
        {aktuelleFtp ? (
          <div className="klein-text">
            FTP <b className="mono">{aktuelleFtp.watts} W</b> · {kurz(aktuelleFtp.datum)} · {aktuelleFtp.quelle}
            {aktuelleFtp.vorlaeufig && <span className="warn"> · vorläufig, Test ersetzt das</span>}
          </div>
        ) : (
          <div className="dim klein-text">Keine FTP bekannt — ohne sie sind die Zonen nur Prozentwerte.</div>
        )}
        <div className="zonen">
          {Object.entries(FTP_ZONES).map(([key, z]) => (
            <div className="zone" key={key}>
              <span className="punkt" style={{ background: z.farbe }} />
              <span className="nm">
                <b>{key}</b> {z.name}
              </span>
              <span className="wt">{zonenWatt(z, aktuelleFtp ? aktuelleFtp.watts : null)}</span>
            </div>
          ))}
        </div>
        <div className="reihe mt">
          <div>
            <label className="feld">Neue FTP nach Test (W)</label>
            <input inputMode="numeric" value={ftpFeld} onChange={(e) => setFtpFeld(e.target.value)} placeholder="z. B. 230" />
          </div>
          <button
            style={{ flex: "0 0 auto" }}
            onClick={() => {
              const w = num(ftpFeld);
              if (!w) {
                melde("Bitte eine Wattzahl eingeben", "fehler");
                return;
              }
              schreibe("ftp", todayStr, { watts: w, quelle: "Test", vorlaeufig: false });
              setFtpFeld("");
              melde("FTP gespeichert — die Zonen sind jetzt echt", "ok");
            }}
          >
            Speichern
          </button>
        </div>
        {ftpListe.length > 1 && (
          <div className="klein-text dim mt mono">{ftpListe.map((f) => `${kurz(f.datum)} ${f.watts} W`).join("  →  ")}</div>
        )}
      </Karte>

      {/* ── Efficiency Factor ── */}
      {efs.length > 0 && (
        <Karte>
          <h2>Efficiency Factor</h2>
          <div className="klein-text dim">
            Watt pro Herzschlag, nur aus Fahrten mit echtem Leistungsmesser. Steigt der Wert bei gleichem Puls, wird die
            Grundlage besser — das ist der ehrlichste Fortschrittsindikator, den du hast.
          </div>
          <div className="karte-kopf mt">
            <div>
              <span className="kennzahl">{fmtNum(efs[efs.length - 1].ef)}</span>
              <div className="dim klein-text">
                {efs[efs.length - 1].watts} W @ {efs[efs.length - 1].hf} bpm · {kurz(efs[efs.length - 1].datum)}
              </div>
            </div>
            {efs.length > 1 && (
              <div style={{ textAlign: "right" }}>
                <span
                  className="kennzahl"
                  style={{ fontSize: 20, color: efs[efs.length - 1].ef >= efs[0].ef ? "var(--ok)" : "var(--warn)" }}
                >
                  {efs[efs.length - 1].ef - efs[0].ef > 0 ? "+" : ""}
                  {fmtNum(efs[efs.length - 1].ef - efs[0].ef)}
                </span>
                <div className="dim klein-text">seit Start</div>
              </div>
            )}
          </div>
          {efs.length > 2 && <Sparkline punkte={efs.map((e) => ({ y: e.ef }))} farbe="var(--ok)" />}
        </Karte>
      )}

      {/* ── Kraftverläufe ── */}
      <Karte>
        <h2>Kraft</h2>
        <table className="tabelle">
          <thead>
            <tr>
              <th>Übung</th>
              <th className="z">Erste</th>
              <th className="z">Jetzt</th>
              <th className="z">Δ</th>
            </tr>
          </thead>
          <tbody>
            {kernUebungen.map((id) => {
              const v = kraftVerlauf(data.logs, id);
              if (v.length < 1) return null;
              const meta = EX_INDEX[id] || { name: id };
              const erst = v[0].wert;
              const jetzt = v[v.length - 1].wert;
              const d = jetzt - erst;
              return (
                <tr key={id}>
                  <td>{meta.name}</td>
                  <td className="z dim">{fmtNum(erst)}</td>
                  <td className="z">{fmtNum(jetzt)}</td>
                  <td className="z" style={{ color: d > 0 ? "var(--ok)" : d < 0 ? "var(--bad)" : "var(--dim)" }}>
                    {d > 0 ? "+" : ""}
                    {fmtNum(d)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="klein-text dim mt">
          Fallen zwei dieser Werte über zwei Einheiten zusammen mit dem Befinden, ist nicht das Training das Problem,
          sondern das Defizit.
        </div>
      </Karte>

      {/* ── Export ── */}
      <Karte>
        <h2>Export</h2>
        <div className="klein-text dim">
          Der Textexport ist die Brücke zur Analyse: kopieren, in den Chat werfen, nach Einschätzung fragen. Er enthält
          Kontext, Kennzahlen und die offenen Fragen — du musst nichts dazuschreiben.
        </div>
        <div className="knopfreihe mt">
          <button className="primaer" onClick={() => kopieren(exportText(data, todayStr))}>
            Analyse-Text kopieren
          </button>
          <button onClick={jsonSichern}>Sicherung (JSON)</button>
        </div>
        {text && (
          <textarea className="mt" style={{ minHeight: 220, fontFamily: "var(--mono)", fontSize: 12 }} readOnly value={text} />
        )}
      </Karte>
    </>
  );
}
