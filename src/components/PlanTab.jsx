import { kurz, plusTage, tage, dow, DAYS_KURZ } from "../lib/dates.js";
import { BLOCKS, REISE_ETAPPEN, REISE, PLAN_START, ZIEL_DATUM, ZIEL_TITEL, blockInfo, getSession } from "../lib/plan.js";
import { wochenQuote } from "../lib/metrics.js";
import { Karte } from "./ui.jsx";

export default function PlanTab({ data, todayStr, setDateStr }) {
  const bi = blockInfo(todayStr);
  const restTage = tage(todayStr, ZIEL_DATUM);

  // Die 12 Plan-Wochen mit ihrer erfüllten Quote.
  const wochen = Array.from({ length: 12 }).map((_, i) => {
    const mon = plusTage(PLAN_START, i * 7);
    const wbi = blockInfo(mon);
    return { nr: i + 1, mon, ...wbi, q: wochenQuote(data.logs, mon, todayStr) };
  });

  return (
    <>
      <Karte>
        <h2>{ZIEL_TITEL}</h2>
        <div className="klein-text">
          {kurz(ZIEL_DATUM)} · {restTage > 0 ? `${restTage} Tage` : restTage === 0 ? "heute" : `vorbei seit ${-restTage} Tagen`}
        </div>
        <div className="klein-text dim mt">
          Zwölf Wochen mit einem einzigen Zweck: eine Routine, die im Alltag hält. Der Urlaub danach ist die Belohnung,
          nicht die Prüfung. Woche 11 zeigt dir schwarz auf weiß, was sich verändert hat; Woche 12 fährt runter, damit du
          ausgeruht ins Flugzeug steigst.
        </div>
      </Karte>

      <Karte>
        <h3>Die zwölf Wochen</h3>
        <table className="tabelle">
          <thead>
            <tr>
              <th>W</th>
              <th>ab</th>
              <th>Block</th>
              <th className="z">erfüllt</th>
            </tr>
          </thead>
          <tbody>
            {wochen.map((w) => {
              const quote = w.q.planned ? w.q.done / w.q.planned : null;
              const jetzt = w.nr === bi.weekOverall && bi.imPlan;
              return (
                <tr key={w.nr} style={jetzt ? { background: "rgba(255,106,43,0.08)" } : undefined}>
                  <td style={jetzt ? { color: "var(--rope)", fontWeight: 650 } : undefined}>{w.nr}</td>
                  <td className="mono dim" style={{ fontSize: 12 }}>
                    {kurz(w.mon).replace(/^\w+, /, "")}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {w.blockType}
                    {w.deload ? " · Deload" : ""}
                    {w.retest ? " · Test" : ""}
                    {w.abreise ? " · Abreise" : ""}
                  </td>
                  <td
                    className="z mono"
                    style={{
                      color:
                        quote === null
                          ? "var(--dim)"
                          : quote >= 0.85
                            ? "var(--ok)"
                            : quote >= 0.65
                              ? "var(--warn)"
                              : "var(--bad)",
                    }}
                  >
                    {w.q.planned ? `${w.q.done}/${w.q.planned}` : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Karte>

      {BLOCKS.map((b, i) => (
        <Karte key={i}>
          <div className="karte-kopf">
            <h3 style={{ margin: 0 }}>
              Block {i + 1} · {b.name}
            </h3>
            <span className="schema">{b.typ}</span>
          </div>
          <div className="dim mono klein-text">
            {kurz(b.start)} – {kurz(b.ende)}
          </div>
          <div className="klein-text mt">{b.fokus}</div>
        </Karte>
      ))}

      <Karte>
        <h3>Die Woche im Normalfall</h3>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          // Einen Referenztag im aktuellen Blocktyp wählen, damit die Titel stimmen.
          const basis = plusTage(PLAN_START, (bi.imPlan ? bi.blockNr - 1 : 0) * 28);
          const mon = plusTage(basis, 0);
          const datum = plusTage(mon, (d + 6) % 7);
          const s = getSession(datum, d);
          return (
            <div className="woche-tag" key={d}>
              <span className="tag">{DAYS_KURZ[d]}</span>
              <span className="inhalt">
                <span className="t">{s.title}</span>
                {s.exercises.length > 0 && (
                  <span className="u">{s.exercises.map((e) => e.name).slice(0, 4).join(" · ")}</span>
                )}
              </span>
            </div>
          );
        })}
        <div className="klein-text dim mt">
          Donnerstag ist blockiert: Arbeit bis 17:30, Klettern um 18:00. Kein Laufen. Zusatzlast auf dem Laufband gibt es
          nicht — im Studio nur Sandsäcke auf der Schulter, Rucksack nur draußen.
        </div>
        <div className="klein-text dim mt">
          Schaffst du es montags, freitags oder sonntags nicht ins Gym: Unter „Heute" gibt es oben die Umschaltung auf
          „Zuhause · Kettlebell" — 15–20 Minuten, zählt für die Konstanz.
        </div>
      </Karte>

      <Karte>
        <h3>Reise-Modus · {kurz(REISE.start)} – {kurz(REISE.ende)}</h3>
        <div className="klein-text dim mb">
          Erhalt statt Aufbau. Zwei bis drei kurze Zirkel pro Woche halten die Kraft über drei Wochen. Ausgefallene
          Einheiten zählen in dieser Zeit nicht gegen dich.
        </div>
        {REISE_ETAPPEN.map((e, i) => (
          <div className="woche-tag" key={i}>
            <span className="inhalt">
              <span className="t">{e.ort}</span>
              <span className="u">bis {kurz(e.bis)} · {e.hinweis}</span>
            </span>
          </div>
        ))}
      </Karte>
    </>
  );
}
