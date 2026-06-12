// Anthropic peak window (in effect since 2026-03-27): weekdays 13:00–19:00 UTC.
// Fixed schedule — edit here if Anthropic ever changes it.
export const PEAK_SCHEDULE = {
  startHourUTC: 13,
  endHourUTC: 19,
  weekdays: [1, 2, 3, 4, 5], // 0=Sun .. 6=Sat
} as const;

export type PeakSchedule = typeof PEAK_SCHEDULE;

export interface PeakState {
  isPeak: boolean;
  secondsToSwitch: number;
}

const DAY = 86400;
const HOUR = 3600;

/** True when the given epoch-seconds instant falls inside the peak window. */
function peakAt(nowS: number, s: PeakSchedule): boolean {
  const d = new Date(nowS * 1000);
  const secOfDay = d.getUTCHours() * HOUR + d.getUTCMinutes() * 60 + d.getUTCSeconds();
  return (
    s.weekdays.includes(d.getUTCDay() as 1 | 2 | 3 | 4 | 5) &&
    secOfDay >= s.startHourUTC * HOUR &&
    secOfDay < s.endHourUTC * HOUR
  );
}

/** Next start- or end-of-window boundary strictly after nowS. */
function nextBoundary(nowS: number, s: PeakSchedule): number {
  const d = new Date(nowS * 1000);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000;
  const candidates = [
    midnight + s.startHourUTC * HOUR,
    midnight + s.endHourUTC * HOUR,
    midnight + DAY,
  ];
  for (const c of candidates) if (c > nowS) return c;
  return nowS + DAY;
}

/** Pure: current peak status + seconds until the status next flips. */
export function derivePeakState(nowS: number, schedule: PeakSchedule = PEAK_SCHEDULE): PeakState {
  const isPeak = peakAt(nowS, schedule);
  let t = nowS;
  for (let guard = 0; guard < 20; guard++) {
    const next = nextBoundary(t, schedule);
    if (peakAt(next, schedule) !== isPeak) {
      return { isPeak, secondsToSwitch: next - nowS };
    }
    t = next;
  }
  return { isPeak, secondsToSwitch: 0 };
}
