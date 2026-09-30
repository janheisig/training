// Datums-Helfer. Alles arbeitet auf ISO-Strings "YYYY-MM-DD"; Date-Objekte werden
// immer auf 12:00 lokal gesetzt, damit Sommerzeit-Sprünge keine Tage verschieben.

export const pad = (n) => String(n).padStart(2, "0");

export const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const mittags = (dateStr) => new Date(dateStr + "T12:00:00");

export const heute = () => fmt(new Date());

export const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

export const DAYS_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export const mod = (n, m) => ((n % m) + m) % m;

/** Ganze Tage zwischen zwei ISO-Daten (b − a). */
export const tage = (a, b) => Math.round((mittags(b) - mittags(a)) / 864e5);

export const plusTage = (dateStr, n) => {
  const x = mittags(dateStr);
  x.setDate(x.getDate() + n);
  return fmt(x);
};

export const dow = (dateStr) => mittags(dateStr).getDay();

/** Montag und Sonntag der Kalenderwoche, in der dateStr liegt. */
export function weekBounds(dateStr) {
  const d = mittags(dateStr);
  const off = (d.getDay() + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - off);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { mon: fmt(mon), sun: fmt(sun) };
}

export const lang = (dateStr, opts) =>
  mittags(dateStr).toLocaleDateString("de-DE", opts || { weekday: "long", day: "numeric", month: "long" });

export const kurz = (dateStr) =>
  mittags(dateStr).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });

export const num = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

export const fmtNum = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

export const fmtKg = (n) => n.toFixed(1).replace(".", ",");

export const slug = (n) => n.toLowerCase().replace(/[^a-z]/g, "");
