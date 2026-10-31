import { config } from '../config.js';

/** "HH:MM" of `d` in the canteen's timezone. */
export function localHHMM(d = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
}

/** "YYYY-MM-DD" of `d` in the canteen's timezone. */
export function localDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(d);
}

/** Same open and close time (e.g. 00:00–00:00) means open all day. */
export function isWithinHours(open: string, close: string, d = new Date()): boolean {
  if (open === close) return true;
  const now = localHHMM(d);
  return open <= close ? now >= open && now < close : now >= open || now < close;
}

export const minutesFromNow = (m: number, from = new Date()) => new Date(from.getTime() + m * 60_000);

/** UTC offset of the canteen's timezone right now, e.g. "+05:30". */
export function tzOffset(d = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: config.TIMEZONE, timeZoneName: 'longOffset' })
    .formatToParts(d)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = part?.match(/GMT([+-]\d{2}:\d{2})/);
  return m ? m[1] : '+00:00';
}

/** Start of a local calendar day (YYYY-MM-DD) as a UTC Date. */
export function startOfLocalDay(day: string): Date {
  return new Date(`${day}T00:00:00${tzOffset()}`);
}
