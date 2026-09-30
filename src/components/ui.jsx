import { useState, useEffect, useRef } from "react";

export function Karte({ children, style }) {
  return (
    <div className="karte" style={style}>
      {children}
    </div>
  );
}

export function Chip({ children, farbe }) {
  return (
    <span className="chip" style={farbe ? { borderColor: farbe, color: farbe } : undefined}>
      {children}
    </span>
  );
}

/** Balkenreihe, z. B. für die Konstanz pro Woche. */
export function Balken({ werte, labels, farbe }) {
  const max = Math.max(1, ...werte.map((w) => w.max || 0));
  return (
    <>
      <div className="balkenreihe">
        {werte.map((w, i) => (
          <div className="balken" key={i} title={`${w.wert} von ${w.max}`}>
            <i
              style={{
                height: `${Math.max(3, ((w.wert || 0) / max) * 100)}%`,
                background: typeof farbe === "function" ? farbe(w) : farbe,
              }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="balkenlabel">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </>
  );
}

/** Kleine Linie für Verläufe (Gewicht, EF). Bewusst ohne Bibliothek. */
export function Sparkline({ punkte, farbe = "#8FD6CC", hoehe = 52 }) {
  if (!punkte || punkte.length < 2) return null;
  const w = 300;
  const h = hoehe;
  const pad = 4;
  const ys = punkte.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const spanne = max - min || 1;
  const px = (i) => pad + (i / (punkte.length - 1)) * (w - 2 * pad);
  const py = (y) => h - pad - ((y - min) / spanne) * (h - 2 * pad);
  const d = punkte.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Verlauf">
      <path d={d} fill="none" stroke={farbe} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(punkte.length - 1)} cy={py(ys[ys.length - 1])} r="3" fill={farbe} />
    </svg>
  );
}

/**
 * Intervall-Timer. Sonntags sind 4x4-Minuten-Intervalle und 6-Minuten-Trageblöcke
 * geplant — ohne Timer zählt man im Kopf und macht es falsch.
 */
export function Timer({ sekunden, label }) {
  const [rest, setRest] = useState(sekunden);
  const [laeuft, setLaeuft] = useState(false);
  const ziel = useRef(0);

  useEffect(() => {
    if (!laeuft) return;
    // Gegen die Uhr rechnen, nicht herunterzählen — sonst driftet der Timer,
    // wenn der Browser im Hintergrund die Intervalle ausbremst.
    ziel.current = Date.now() + rest * 1000;
    const id = setInterval(() => {
      const uebrig = Math.max(0, Math.round((ziel.current - Date.now()) / 1000));
      setRest(uebrig);
      if (uebrig === 0) {
        setLaeuft(false);
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laeuft]);

  const mm = Math.floor(rest / 60);
  const ss = rest % 60;

  return (
    <div className="timer">
      <span className={`uhr${rest === 0 ? " aus" : ""}`}>
        {mm}:{String(ss).padStart(2, "0")}
      </span>
      <button className="klein" onClick={() => setLaeuft((l) => !l)}>
        {laeuft ? "Pause" : rest === 0 ? "Nochmal" : "Start"}
      </button>
      <button
        className="klein"
        onClick={() => {
          setLaeuft(false);
          setRest(sekunden);
        }}
      >
        Zurück
      </button>
      {label && <span className="dim klein-text">{label}</span>}
    </div>
  );
}

/** Aus einem Schema wie "4x4 Min" oder "3x6 Min" die Intervalldauer in Sekunden lesen. */
export function timerSekunden(scheme) {
  if (!scheme) return null;
  let m = /(\d+)\s*x\s*(\d+)\s*Min/i.exec(scheme);
  if (m) return parseInt(m[2], 10) * 60;
  m = /(\d+)\s*x\s*(\d+)\s*Sek/i.exec(scheme);
  if (m) return parseInt(m[2], 10);
  m = /^(\d+)\s*Sek/i.exec(scheme);
  if (m) return parseInt(m[1], 10);
  m = /^(\d+)\s*Min\/Seite/i.exec(scheme);
  if (m) return parseInt(m[1], 10) * 60;
  return null;
}
