import { useState } from "react";
import { weekBounds, plusTage, kurz, dow, DAYS_KURZ } from "../lib/dates.js";
import { getSession, sessionFuer, blockInfo, inReise, EX_INDEX } from "../lib/plan.js";
import { einheitErfuellt, wochenQuote, wochenVolumen } from "../lib/metrics.js";
import { Karte } from "./ui.jsx";

export default function Woche({ data, schreibe, dateStr, setDateStr, todayStr }) {
  const [offset, setOffset] = useState(0);
  const mon = plusTage(weekBounds(dateStr).mon, offset * 7);
  const q = wochenQuote(data.logs, mon, todayStr);
  const vol = wochenVolumen(data.logs, mon);
  const wbi = blockInfo(mon);
  const notiz = ((data.notes || {})[mon] || {}).text || "";

  const zusammenfassung = (datum) => {
    const l = data.logs[datum];
    if (!l) return null;
    const teile = [];
    for (const [exId, e] of Object.entries(l.entries || {})) {
      const meta = EX_INDEX[exId] || { name: exId, unit: "" };
      const sets = (e.sets || []).filter((x) => x);
      if (!sets.length) continue;
      const alleGleich = sets.every((s) => s === sets[0]);
      const rp = (e.reps || []).filter((x) => x);
      teile.push(`${meta.name} ${alleGleich && sets.length > 1 ? `${sets.length}×${sets[0]}` : sets.join("/")}${rp.length ? ` × ${rp.join("/")}` : ""}`);
    }
    const acts = (l.cardio || {}).aktivitaeten || [];
    for (const a of acts)
      teile.push(
        `${a.sport}${a.distanz_km ? ` ${a.distanz_km} km` : ""}${
          a.watts_avg ? ` Ø${a.watts_avg} W` : a.hf_avg ? ` Ø${a.hf_avg} bpm` : ""
        }`
      );
    if (!acts.length && (l.cardio || {}).distanz) teile.push(`${l.cardio.distanz} km`);
    return teile.length ? teile.join(" · ") : l.note ? l.note.slice(0, 70) : null;
  };

  return (
    <>
      <div className="datumsnav">
        <button onClick={() => setOffset(offset - 1)} aria-label="Woche zurück">
          ‹
        </button>
        <div className="mitte">
          {kurz(mon)} – {kurz(plusTage(mon, 6))}
          <small>
            {wbi.imPlan
              ? `Plan-Woche ${wbi.weekOverall} · Block ${wbi.blockType} W${wbi.weekInBlock}`
              : inReise(mon)
                ? "Reise"
                : "außerhalb des Bogens"}
            {wbi.deload ? " · Deload" : ""}
            {wbi.retest ? " · Standortbestimmung" : ""}
            {wbi.abreise ? " · Abreise" : ""}
          </small>
        </div>
        <button onClick={() => setOffset(offset + 1)} aria-label="Woche vor">
          ›
        </button>
      </div>

      {q.planned > 0 && (
        <Karte>
          <div className="karte-kopf">
            <div>
              <span className="kennzahl">
                {q.done}
                <small>/{q.planned}</small>
              </span>
              <div className="dim klein-text">Einheiten erfüllt</div>
            </div>
            {vol.saetze > 0 && (
              <div style={{ textAlign: "right" }}>
                <span className="kennzahl" style={{ fontSize: 20 }}>
                  {vol.saetze}
                </span>
                <div className="dim klein-text">Sätze{vol.tonnage ? ` · ~${vol.tonnage} kg` : ""}</div>
              </div>
            )}
          </div>
        </Karte>
      )}

      <Karte>
        {Array.from({ length: 7 }).map((_, i) => {
          const datum = plusTage(mon, i);
          const s = sessionFuer(datum, dow(datum), data.logs[datum]);
          const erfuellt = einheitErfuellt(data.logs, datum);
          const zus = zusammenfassung(datum);
          const zukunft = datum > todayStr;
          return (
            <div
              key={datum}
              className={`woche-tag${datum === todayStr ? " heute" : ""}`}
              onClick={() => setDateStr(datum)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setDateStr(datum)}
              style={{ cursor: "pointer", opacity: zukunft ? 0.62 : 1 }}
            >
              <span className="tag">{DAYS_KURZ[dow(datum)]}</span>
              <span className="inhalt">
                <span className="t">{s.title}</span>
                {zus && <span className="u">{zus}</span>}
              </span>
              <span className="st">
                {s.type === "rest" || inReise(datum) ? (
                  <span className="dim">–</span>
                ) : erfuellt ? (
                  <span className="ok">✓</span>
                ) : zukunft ? (
                  <span className="dim">○</span>
                ) : (
                  <span className="bad">○</span>
                )}
              </span>
            </div>
          );
        })}
      </Karte>

      <Karte>
        <h3>Wochennotiz</h3>
        <textarea
          value={notiz}
          onChange={(e) => schreibe("notes", mon, { text: e.target.value })}
          placeholder="Was war diese Woche los? Krank, Arbeit, Reise, Motivation …"
        />
      </Karte>
    </>
  );
}
