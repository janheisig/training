import { useState } from "react";
import { kurz, plusTage, heute as heuteFn, num, fmtNum, fmtKg, DAYS } from "../lib/dates.js";
import { setCount, GEWICHT, KREATIN, inReise } from "../lib/plan.js";
import { lastFor, empfehlung } from "../lib/progression.js";
import { gewichtStatus, zoneVon } from "../lib/metrics.js";
import { Karte, Timer, timerSekunden } from "./ui.jsx";

function CardioInfo({ c, ftp }) {
  if (!c || !c.quelle) return null;
  const acts = c.aktivitaeten || [];
  return (
    <div className="mt">
      <div className="ice mono klein-text">
        {c.quelle}
        {c.pendel ? " · Pendeln ✓" : ""}
        {acts.length > 1 ? ` · ${acts.length} Aktivitäten · gesamt ${c.distanz} km` : ""}
      </div>
      {acts.map((a, i) => {
        const z = a.watts_avg && !a.watts_ist_geschaetzt ? zoneVon(a.watts_avg, ftp) : null;
        return (
          <div key={i} className="ice mono klein-text" style={{ marginTop: 4, paddingLeft: 8, borderLeft: "2px solid var(--line)" }}>
            {a.sport || "Aktivität"}
            {a.distanz_km ? ` · ${a.distanz_km} km` : ""}
            {a.zeit_hmm ? ` · ${a.zeit_hmm}` : ""}
            {a.hf_avg ? ` · Ø ${a.hf_avg} bpm` : ""}
            {a.anstieg_m ? ` · ${a.anstieg_m} hm` : ""}
            {a.watts_avg ? ` · Ø ${a.watts_avg} W${a.watts_ist_geschaetzt ? " (geschätzt)" : ""}` : ""}
            {a.kadenz_avg ? ` · ${a.kadenz_avg} rpm` : ""}
            {a.ef != null ? ` · EF ${fmtNum(a.ef)}` : ""}
            {z ? ` · ${z.key} ${z.name}` : ""}
          </div>
        );
      })}
      {c.bewertung && <div className="hinweis mt">{c.bewertung}</div>}
    </div>
  );
}

function Uebung({ ex, log, bi, logs, dateStr, aendereLog }) {
  const e = log.entries[ex.id] || {};
  const n = setCount(ex.scheme);
  const sets = e.sets || [];
  const last = lastFor(logs, ex.id, dateStr);
  const { sugg, why, lastLabel } = empfehlung(ex, last, bi);
  const tSek = timerSekunden(ex.scheme);

  const setzeSatz = (i, v) => {
    aendereLog(dateStr, (l) => {
      const alt = l.entries[ex.id] || {};
      const arr = [...(alt.sets || [])];
      while (arr.length < n) arr.push("");
      arr[i] = v;
      l.entries[ex.id] = { ...alt, sets: arr };
      return l;
    });
  };

  const toggleDone = () => {
    aendereLog(dateStr, (l) => {
      const alt = l.entries[ex.id] || {};
      l.entries[ex.id] = { ...alt, done: !alt.done };
      return l;
    });
  };

  // Ein Tipp füllt alle Sätze mit dem Vorschlag — der häufigste Fall, alle Sätze gleich.
  const alleFuellen = () => {
    if (sugg === null) return;
    aendereLog(dateStr, (l) => {
      const alt = l.entries[ex.id] || {};
      l.entries[ex.id] = { ...alt, sets: Array(n).fill(String(fmtNum(sugg))) };
      return l;
    });
  };

  return (
    <Karte>
      <div className="karte-kopf">
        <div className="uebung-name">{ex.name}</div>
        <div className="schema">{ex.scheme}</div>
      </div>
      {ex.note && <div className="notiz">{ex.note}</div>}

      {last && (
        <div className="letztes">
          <div>
            {kurz(last.date)}: <span className="wert">{lastLabel}</span>
            {!last.done && <span className="dim"> (nicht abgehakt)</span>}
          </div>
          {sugg !== null && (
            <div className="empfehlung">
              → {fmtNum(sugg)} {ex.unit} <span className="warum">· {why}</span>
            </div>
          )}
        </div>
      )}
      {!last && sugg !== null && (
        <div className="empfehlung" style={{ marginTop: 8 }}>
          → {fmtNum(sugg)} {ex.unit} <span className="warum">· {why}</span>
        </div>
      )}

      <div className="saetze">
        {Array.from({ length: n }).map((_, i) => (
          <input
            key={i}
            className="satz"
            inputMode="decimal"
            enterKeyHint="next"
            value={sets[i] || ""}
            onChange={(ev) => setzeSatz(i, ev.target.value)}
            placeholder={ex.unit === "✓" ? "✓" : ex.unit}
            aria-label={`${ex.name}, Satz ${i + 1}`}
          />
        ))}
        <button className="haken" aria-pressed={!!e.done} onClick={toggleDone} title="Übung abgeschlossen">
          {e.done ? "✓" : "○"}
        </button>
      </div>

      {sugg !== null && n > 1 && (
        <button className="klein mt" onClick={alleFuellen}>
          Alle Sätze mit {fmtNum(sugg)} füllen
        </button>
      )}

      {tSek && <Timer sekunden={tSek} label={`pro Intervall · ${ex.scheme}`} />}
    </Karte>
  );
}

export default function Heute({ data, aendereLog, schreibe, dateStr, setDateStr, todayStr, bi, session, strava, stravaHolen, busy }) {
  const rawLog = data.logs[dateStr] || {};
  const log = {
    entries: rawLog.entries || {},
    cardio: rawLog.cardio || {},
    note: rawLog.note || "",
    befinden: rawLog.befinden || null,
  };
  const ftpListe = Object.entries(data.ftp || {})
    .map(([datum, v]) => ({ datum, ...v }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const ftp = ftpListe.length ? ftpListe[ftpListe.length - 1].watts : null;

  const gewichtListe = Object.entries(data.gewicht || {})
    .map(([datum, v]) => ({ datum, ...v }))
    .sort((a, b) => a.datum.localeCompare(b.datum));
  const gwHeute = (data.gewicht || {})[dateStr];
  const gw = gewichtStatus(gewichtListe, todayStr);
  const [gwFeld, setGwFeld] = useState("");

  const kreatin = !!((data.supplements || {})[dateStr] || {}).kreatin;

  return (
    <>
      <div className="datumsnav">
        <button onClick={() => setDateStr(plusTage(dateStr, -1))} aria-label="Tag zurück">
          ‹
        </button>
        <div className="mitte">
          {DAYS[new Date(dateStr + "T12:00:00").getDay()]}
          <small>
            {kurz(dateStr)}
            {dateStr !== todayStr && (
              <>
                {" · "}
                <button
                  className="klein"
                  style={{ minHeight: 0, padding: "2px 7px", fontSize: 11 }}
                  onClick={() => setDateStr(todayStr)}
                >
                  zu heute
                </button>
              </>
            )}
          </small>
        </div>
        <button onClick={() => setDateStr(plusTage(dateStr, 1))} aria-label="Tag vor">
          ›
        </button>
      </div>

      <Karte>
        <div className="karte-kopf">
          <h2 style={{ margin: 0 }}>{session.title}</h2>
        </div>
        {session.hint && <div className="hinweis mt">{session.hint}</div>}
        {bi.blockFokus && bi.imPlan && (
          <details className="aufklapp mt">
            <summary>Warum dieser Block</summary>
            <div className="klein-text dim">{bi.blockFokus}</div>
          </details>
        )}
      </Karte>

      {/* ── Kraft- und Reiseübungen ── */}
      {(session.type === "gym" || session.type === "reise") &&
        session.exercises.map((ex) => (
          <Uebung key={ex.id} ex={ex} log={log} bi={bi} logs={data.logs} dateStr={dateStr} aendereLog={aendereLog} />
        ))}

      {/* ── Cardio ── */}
      {(session.type === "cardio" || session.type === "climb") && (
        <Karte>
          <h3>Was war</h3>
          <CardioInfo c={log.cardio} ftp={ftp} />
          {!log.cardio.quelle && (
            <>
              <div className="reihe mt">
                <div>
                  <label className="feld">Distanz (km)</label>
                  <input
                    inputMode="decimal"
                    value={log.cardio.distanz || ""}
                    onChange={(e) => aendereLog(dateStr, (l) => ((l.cardio.distanz = e.target.value), l))}
                  />
                </div>
                <div>
                  <label className="feld">Zeit (h:mm)</label>
                  <input
                    value={log.cardio.zeit || ""}
                    onChange={(e) => aendereLog(dateStr, (l) => ((l.cardio.zeit = e.target.value), l))}
                    placeholder="1:15"
                  />
                </div>
              </div>
              <div className="reihe mt">
                <div>
                  <label className="feld">Ø Puls</label>
                  <input
                    inputMode="numeric"
                    value={log.cardio.hf || ""}
                    onChange={(e) => aendereLog(dateStr, (l) => ((l.cardio.hf = e.target.value), l))}
                  />
                </div>
                <div>
                  <label className="feld">Ø Watt</label>
                  <input
                    inputMode="numeric"
                    value={log.cardio.watt || ""}
                    onChange={(e) => aendereLog(dateStr, (l) => ((l.cardio.watt = e.target.value), l))}
                  />
                </div>
              </div>
            </>
          )}
          <div className="knopfreihe mt">
            <button
              aria-pressed={!!log.cardio.done}
              className={log.cardio.done ? "primaer" : ""}
              onClick={() => aendereLog(dateStr, (l) => ((l.cardio.done = !l.cardio.done), l))}
            >
              {log.cardio.done ? "✓ Erledigt" : "Als erledigt markieren"}
            </button>
            {strava && strava.verbunden && (
              <button onClick={() => stravaHolen(dateStr, dateStr)} disabled={busy === "strava"}>
                {busy === "strava" ? "…" : "Aus Strava holen"}
              </button>
            )}
          </div>
        </Karte>
      )}

      {session.type === "rest" && (
        <Karte>
          <div className="hinweis">{session.hint}</div>
        </Karte>
      )}

      {/* ── Befinden: das Frühwarnsystem fürs Defizit ── */}
      <Karte>
        <h3>Befinden</h3>
        <div className="klein-text dim">
          Schlaf, Energie, Laune in einer Zahl. Fällt das zwei Einheiten in Folge zusammen mit den Kraftwerten, ist das
          Defizit zu groß.
        </div>
        <div className="befinden">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              aria-pressed={log.befinden === v}
              onClick={() => aendereLog(dateStr, (l) => ((l.befinden = l.befinden === v ? null : v), l))}
            >
              {v}
            </button>
          ))}
        </div>
      </Karte>

      {/* ── Gewicht & Kreatin ── */}
      <Karte>
        <h3>Morgengewicht</h3>
        <div className="reihe">
          <div>
            <input
              inputMode="decimal"
              value={gwFeld !== "" ? gwFeld : gwHeute ? String(gwHeute.kg).replace(".", ",") : ""}
              onChange={(e) => setGwFeld(e.target.value)}
              placeholder="kg"
              aria-label="Gewicht in Kilogramm"
            />
          </div>
          <button
            style={{ flex: "0 0 auto" }}
            onClick={() => {
              const kg = num(gwFeld);
              if (kg === null) return;
              schreibe("gewicht", dateStr, { kg });
              setGwFeld("");
            }}
          >
            Eintragen
          </button>
        </div>
        {gw && gw.rate !== null && (
          <div className="mt klein-text" style={{ color: gw.farbe }}>
            7-Tage-Schnitt {fmtKg(gw.avg)} kg · {gw.rate > 0 ? "+" : ""}
            {fmtKg(gw.rate)} kg/Woche — {gw.label}
          </div>
        )}
        {gw && gw.hinweis && <div className="mt klein-text dim">{gw.hinweis}</div>}
        {gw && gw.rate !== null && gw.rate <= GEWICHT.rateHart && (
          <div className="mt klein-text bad">
            Das geht zu schnell. Mehr essen, nicht weniger — vor allem Eiweiß und Kohlenhydrate um das Training herum.
            Sonst verlierst du Kraft statt Fett.
          </div>
        )}

        <div className="knopfreihe mt">
          <button
            aria-pressed={kreatin}
            className={kreatin ? "primaer" : ""}
            onClick={() => schreibe("supplements", dateStr, { kreatin: !kreatin })}
          >
            {kreatin ? `✓ Kreatin (${KREATIN.grammProTag} g)` : `Kreatin ${KREATIN.grammProTag} g`}
          </button>
        </div>
      </Karte>

      {/* ── Notiz ── */}
      <Karte>
        <h3>Notiz</h3>
        <textarea
          value={log.note}
          onChange={(e) => aendereLog(dateStr, (l) => ((l.note = e.target.value), l))}
          placeholder="Wie lief es? Was war schwer, was leicht?"
        />
      </Karte>
    </>
  );
}
