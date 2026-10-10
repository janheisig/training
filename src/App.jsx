import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { fmt, heute as heuteFn, plusTage, kurz, tage, dow, weekBounds } from "./lib/dates.js";
import { blockInfo, getSession, inReise, ZIEL_DATUM, ZIEL_TITEL, PLAN_START } from "./lib/plan.js";
import { konstanz, streak, kreatinStreak } from "./lib/metrics.js";
import * as store from "./lib/store.js";
import Login from "./components/Login.jsx";
import Heute from "./components/Heute.jsx";
import Woche from "./components/Woche.jsx";
import Analyse from "./components/Analyse.jsx";
import PlanTab from "./components/PlanTab.jsx";
import Einstellungen from "./components/Einstellungen.jsx";

const TABS = [
  { id: "heute", label: "Heute", sym: "●" },
  { id: "woche", label: "Woche", sym: "▤" },
  { id: "analyse", label: "Analyse", sym: "◈" },
  { id: "plan", label: "Plan", sym: "▦" },
  { id: "mehr", label: "Mehr", sym: "⚙" },
];

export default function App() {
  const [angemeldet, setAngemeldet] = useState(() => !!store.getToken());
  const [tab, setTab] = useState("heute");
  const [dateStr, setDateStr] = useState(() => heuteFn());
  const [data, setData] = useState(store.leer);
  const [geladen, setGeladen] = useState(false);
  const [status, setStatus] = useState(null); // { text, art }
  const [busy, setBusy] = useState("");
  const [strava, setStrava] = useState(null);

  const dirty = useRef(new Set());
  const pushTimer = useRef(null);
  const statusTimer = useRef(null);

  const melde = useCallback((text, art = "", ms = 2200) => {
    setStatus({ text, art });
    clearTimeout(statusTimer.current);
    if (ms) statusTimer.current = setTimeout(() => setStatus(null), ms);
  }, []);

  // ─── Erststart: lokal laden, Altbestand einspielen ───
  useEffect(() => {
    let d = store.loadLocal();
    const s = store.seedOnce(d);
    d = s.data;
    dirty.current = store.loadDirty();
    if (s.veraendert) {
      store.saveLocal(d);
      // Altbestand nicht hochschieben — er ist überall gleich und würde nur Lärm machen.
    }
    setData(d);
    setGeladen(true);
  }, []);

  // ─── Push: gesammelt, verzögert, fehlertolerant ───
  const pushJetzt = useCallback(
    async (still = false) => {
      if (!store.getToken() || dirty.current.size === 0) return;
      const aktuell = store.loadLocal();
      const records = store.dirtyRecords(aktuell, dirty.current);
      if (!records.length) {
        dirty.current.clear();
        store.saveDirty(dirty.current);
        return;
      }
      try {
        await store.push(records);
        dirty.current.clear();
        store.saveDirty(dirty.current);
        if (!still) melde("Synchronisiert", "ok", 1200);
      } catch (e) {
        if (e.status === 401) {
          store.setToken("");
          setAngemeldet(false);
          return;
        }
        // Absichtlich nichts verwerfen: der lokale Stand bleibt die Wahrheit,
        // und beim nächsten Versuch geht es wieder mit.
        if (!still) melde(e.status === 0 ? "Offline — lokal gespeichert" : `Sync später: ${e.message}`, "", 2600);
      }
    },
    [melde]
  );

  const planePush = useCallback(() => {
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushJetzt(true), 1200);
  }, [pushJetzt]);

  /** Der einzige Schreibweg. Lokal zuerst, Server danach. */
  const schreibe = useCallback(
    (table, key, wert) => {
      setData((vorher) => {
        const value = wert === null ? null : { ...wert, _t: Date.now() };
        const naechste = { ...vorher, [table]: { ...vorher[table] } };
        if (value === null) delete naechste[table][key];
        else naechste[table][key] = value;
        const ok = store.saveLocal(naechste);
        if (!ok) melde("Speicher voll — bitte alte Daten exportieren", "fehler", 5000);
        if (value !== null) {
          dirty.current.add(`${table}:${key}`);
          store.saveDirty(dirty.current);
          planePush();
        }
        return naechste;
      });
    },
    [melde, planePush]
  );

  /** Teil-Änderung an einem Tages-Log, ohne den Rest zu verlieren. */
  const aendereLog = useCallback(
    (datum, mutator) => {
      setData((vorher) => {
        const alt = vorher.logs[datum] || { entries: {}, cardio: {}, note: "" };
        const neu = mutator({
          entries: { ...(alt.entries || {}) },
          cardio: { ...(alt.cardio || {}) },
          note: alt.note || "",
          befinden: alt.befinden || null,
          modus: alt.modus || null,
        });
        neu._t = Date.now();
        const naechste = { ...vorher, logs: { ...vorher.logs, [datum]: neu } };
        if (!store.saveLocal(naechste)) melde("Speicher voll — bitte exportieren", "fehler", 5000);
        dirty.current.add(`logs:${datum}`);
        store.saveDirty(dirty.current);
        planePush();
        return naechste;
      });
    },
    [melde, planePush]
  );

  // ─── Abgleich mit dem Server ───
  const abgleich = useCallback(
    async (still = false) => {
      if (!store.getToken()) return;
      if (!still) setBusy("sync");
      try {
        const fern = await store.pull();
        setData((lokal) => {
          const zusammen = store.merge(lokal, fern);
          store.saveLocal(zusammen);
          return zusammen;
        });
        await pushJetzt(true);
        if (!still) melde("Abgeglichen", "ok");
      } catch (e) {
        if (e.status === 401) {
          store.setToken("");
          setAngemeldet(false);
        } else if (!still) {
          melde(e.status === 0 ? "Offline — du arbeitest lokal weiter" : e.message, e.status === 0 ? "" : "fehler", 3000);
        }
      } finally {
        setBusy("");
      }
    },
    [melde, pushJetzt]
  );

  // ─── Strava ───
  const stravaLaden = useCallback(async () => {
    if (!store.getToken()) return;
    try {
      setStrava(await store.stravaStatus());
    } catch {
      setStrava(null);
    }
  }, []);

  const stravaHolen = useCallback(
    async (von, bis, still = false) => {
      if (!still) setBusy("strava");
      try {
        const r = await store.stravaSync(von, bis);
        // Der Server hat die Logs schon geschrieben — einmal ziehen genügt.
        const fern = await store.pull();
        setData((lokal) => {
          const zusammen = store.merge(lokal, fern);
          store.saveLocal(zusammen);
          return zusammen;
        });
        if (!still)
          melde(
            r.geaendert ? `${r.geaendert} Tag${r.geaendert === 1 ? "" : "e"} aus Strava aktualisiert` : "Strava: nichts Neues",
            "ok"
          );
        return r;
      } catch (e) {
        if (!still) melde(e.message, "fehler", 4000);
        return null;
      } finally {
        setBusy("");
      }
    },
    [melde]
  );

  // Beim Öffnen: abgleichen, Strava-Status holen, laufende Woche stillschweigend nachziehen.
  useEffect(() => {
    if (!angemeldet || !geladen) return;
    let abgebrochen = false;
    (async () => {
      await abgleich(true);
      if (abgebrochen) return;
      let s = null;
      try {
        s = await store.stravaStatus();
      } catch {
        /* ignorieren */
      }
      if (abgebrochen) return;
      setStrava(s);
      if (s && s.verbunden) {
        const { mon } = weekBounds(heuteFn());
        await stravaHolen(mon, heuteFn(), true);
      }
    })();
    return () => {
      abgebrochen = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angemeldet, geladen]);

  // Wenn die Verbindung zurückkommt: nachschieben.
  useEffect(() => {
    const online = () => {
      melde("Wieder online", "ok", 1400);
      abgleich(true);
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [abgleich, melde]);

  // Wenn die App aus dem Hintergrund kommt: Datum prüfen (über Nacht offen gelassen).
  useEffect(() => {
    const sichtbar = () => {
      if (document.visibilityState !== "visible") return;
      const h = heuteFn();
      setDateStr((d) => (d === h ? d : h));
      abgleich(true);
    };
    document.addEventListener("visibilitychange", sichtbar);
    return () => document.removeEventListener("visibilitychange", sichtbar);
  }, [abgleich]);

  // Vor dem Schließen noch offene Änderungen wegschicken.
  useEffect(() => {
    const raus = () => {
      if (dirty.current.size) pushJetzt(true);
    };
    window.addEventListener("pagehide", raus);
    return () => window.removeEventListener("pagehide", raus);
  }, [pushJetzt]);

  const todayStr = heuteFn();
  const bi = useMemo(() => blockInfo(dateStr), [dateStr]);
  const session = useMemo(() => getSession(dateStr, dow(dateStr)), [dateStr]);
  const k = useMemo(() => konstanz(data.logs, todayStr), [data.logs, todayStr]);
  const restTage = tage(todayStr, ZIEL_DATUM);

  if (!angemeldet)
    return (
      <Login
        onFertig={() => {
          setAngemeldet(true);
          melde("Angemeldet", "ok");
        }}
      />
    );

  if (!geladen) return <div className="app" style={{ paddingTop: 40 }} />;

  const gemeinsam = { data, schreibe, aendereLog, dateStr, setDateStr, todayStr, bi, session, melde, busy, k };

  return (
    <div className="app">
      <header className="kopf">
        <div className="kopf-zeile">
          <h1>Training</h1>
          <span className="datum">
            {restTage > 0 ? `${restTage} Tage bis ${kurz(ZIEL_DATUM)}` : restTage === 0 ? "Heute geht's los" : "Im Urlaub"}
          </span>
        </div>
        <div className="zielbalken">
          {inReise(todayStr) ? (
            <span className="chip">Reise-Modus · Erhalt statt Aufbau</span>
          ) : (
            <span className="chip">
              {bi.imPlan ? (
                <>
                  Woche <b>{bi.weekOverall}</b>/12
                </>
              ) : (
                "außerhalb des Bogens"
              )}
            </span>
          )}
          <span className="chip">
            Block <b>{bi.blockType}</b> · W{bi.weekInBlock}
            {bi.deload ? " · Deload" : ""}
            {bi.retest ? " · Test" : ""}
            {bi.abreise ? " · Abreise" : ""}
          </span>
          {k && (
            <span className="chip" style={{ borderColor: k.farbe, color: k.farbe }}>
              Konstanz <b style={{ color: k.farbe }}>{Math.round(k.quote * 100)} %</b>
            </span>
          )}
          {streak(data.logs, todayStr) > 1 && <span className="chip">Serie <b>{streak(data.logs, todayStr)}</b></span>}
          {kreatinStreak(data.supplements || {}, todayStr) > 0 && (
            <span className="chip">
              Kreatin <b>{kreatinStreak(data.supplements || {}, todayStr)}</b>{" "}
              {kreatinStreak(data.supplements || {}, todayStr) === 1 ? "Tag" : "Tage"}
            </span>
          )}
        </div>
      </header>

      {tab === "heute" && <Heute {...gemeinsam} strava={strava} stravaHolen={stravaHolen} />}
      {tab === "woche" && <Woche {...gemeinsam} />}
      {tab === "analyse" && <Analyse {...gemeinsam} />}
      {tab === "plan" && <PlanTab {...gemeinsam} />}
      {tab === "mehr" && (
        <Einstellungen
          {...gemeinsam}
          strava={strava}
          stravaLaden={stravaLaden}
          stravaHolen={stravaHolen}
          abgleich={abgleich}
          offen={dirty.current.size}
          abmelden={() => {
            store.setToken("");
            setAngemeldet(false);
          }}
          setData={setData}
        />
      )}

      {status && <div className={`status ${status.art}`}>{status.text}</div>}

      <nav className="tabbar" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            <span className="sym" aria-hidden="true">
              {t.sym}
            </span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
