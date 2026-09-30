// Gewichtsempfehlung pro Übung. Die Regel ist bewusst stumpf und nachvollziehbar:
// alle Sätze gleich und abgehakt → hochgehen. Uneinheitlich → halten. Nicht abgehakt
// → halten. In Deload-, Retest- und Abreisewochen wird grundsätzlich nicht erhöht.

import { num, fmtNum } from "./dates.js";

/**
 * Letzter Eintrag für eine Übung vor `dateStr`.
 * @returns {{date:string, sets:string[], done:boolean}|null}
 */
export function lastFor(logs, exId, dateStr) {
  const dates = Object.keys(logs)
    .filter((k) => k < dateStr)
    .sort()
    .reverse();
  for (const k of dates) {
    const e = logs[k] && logs[k].entries && logs[k].entries[exId];
    if (e && (e.sets ? e.sets.some((s) => s) : e.value)) {
      return {
        date: k,
        sets: e.sets ? e.sets.filter((s) => s) : [e.value],
        done: !!e.done,
      };
    }
  }
  return null;
}

/**
 * @param {object} ex     Übung aus getSession
 * @param {object|null} last  Rückgabe von lastFor
 * @param {object} bi     blockInfo für den Zieltag
 * @returns {{sugg:number|null, why:string, lastLabel:string|null}}
 */
export function empfehlung(ex, last, bi) {
  const nums = last ? last.sets.map(num).filter((x) => x !== null) : [];
  const allEqual = nums.length > 0 && nums.every((x) => x === nums[0]);
  const gebremst = bi.deload || bi.retest || bi.abreise;

  let sugg = null;
  let why = "";

  if (last && nums.length && gebremst) {
    sugg = Math.max(...nums);
    why = bi.retest
      ? "Standortbestimmung — Gewicht halten, sauber ausführen"
      : bi.abreise
        ? "Abreisewoche — Gewicht halten oder leichter, ein Satz weniger"
        : "Deload — Gewicht halten, ein Satz weniger";
  } else if (last && nums.length && ex.inc > 0) {
    if (!last.done) {
      sugg = nums[0];
      why = "letzte Einheit nicht abgehakt — Gewicht halten";
    } else if (allEqual) {
      sugg = nums[0] + ex.inc;
      why = `alle Sätze sauber — plus ${fmtNum(ex.inc)} ${ex.unit}`;
    } else {
      sugg = Math.max(...nums);
      why = "Sätze waren uneinheitlich — Gewicht halten";
    }
  } else if (!last && ex.start !== null && ex.start !== undefined) {
    sugg = ex.start;
    why = "Startwert — noch kein Eintrag vorhanden";
  }

  const lastLabel = last
    ? allEqual && nums.length > 1
      ? `${fmtNum(nums[0])} ${ex.unit} in allen ${nums.length} Sätzen`
      : `${last.sets.join(" / ")} ${ex.unit}`
    : null;

  return { sugg, why, lastLabel };
}
