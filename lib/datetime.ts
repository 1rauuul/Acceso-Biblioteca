/**
 * Timezone helpers for México.
 *
 * México usa CST (UTC-6) todo el año desde 2022 (se abolió el DST).
 * Todas las marcas de tiempo se guardan en UTC en la base de datos;
 * estos helpers sirven para mostrar/formatear en hora local y para
 * calcular rangos "del día en México" en rutas que corren en Vercel
 * (cuyos servidores están en UTC).
 */

import {
  LIBRARY_CLOSE_HOUR,
  LIBRARY_MAX_SESSION_MINUTES,
  LIBRARY_OPEN_HOUR,
  MIN_VALID_SESSION_MINUTES,
  LOGIN_BUFFER_CLOSE_MINUTES,
  LOGIN_BUFFER_OPEN_MINUTES,
} from "./constants";

export const LIBRARY_TIMEZONE = "America/Mexico_City";

const MX_OFFSET_HOURS = 6;

/** Returns the Mexico-local hour (0-23) of a UTC Date. */
export function mxHour(utcDate: Date): number {
  return (utcDate.getUTCHours() - MX_OFFSET_HOURS + 24) % 24;
}

/** Returns the Mexico-local wall-clock minutes since midnight (0-1439). */
export function mxMinutesOfDay(utcDate: Date): number {
  return mxHour(utcDate) * 60 + utcDate.getUTCMinutes();
}

/**
 * RN-01: whether a UTC instant falls inside the service window
 * (07:00–18:00 Mexico-local, inclusive).
 */
export function isWithinServiceHours(utcDate: Date = new Date()): boolean {
  const minutes = mxMinutesOfDay(utcDate);
  return (
    minutes >= LIBRARY_OPEN_HOUR * 60 && minutes <= LIBRARY_CLOSE_HOUR * 60
  );
}

/**
 * RN-04: whether a UTC instant falls inside the logical login window
 * (06:55–18:03 Mexico-local, inclusive).
 */
export function isWithinLoginWindow(utcDate: Date = new Date()): boolean {
  const minutes = mxMinutesOfDay(utcDate);
  return (
    minutes >= LIBRARY_OPEN_HOUR * 60 - LOGIN_BUFFER_OPEN_MINUTES &&
    minutes <= LIBRARY_CLOSE_HOUR * 60 + LOGIN_BUFFER_CLOSE_MINUTES
  );
}

/** Returns whether a session is valid for synchronization (at least 9 min). */
export function isSessionLongEnough(
  entryTime: Date | string,
  exitTime: Date | string | null,
  reference: Date = new Date()
): boolean {
  const entry = typeof entryTime === "string" ? new Date(entryTime) : entryTime;
  const end = exitTime
    ? typeof exitTime === "string"
      ? new Date(exitTime)
      : exitTime
    : reference;
  const duration = end.getTime() - entry.getTime();
  return Number.isFinite(duration) && duration >= MIN_VALID_SESSION_MINUTES * 60 * 1000;
}

/** Returns whether an open local session should be sent to the server now. */
export function isOpenSessionReadyForSync(
  entryTime: Date | string,
  synced: boolean,
  reference: Date = new Date()
): boolean {
  return !synced && isSessionLongEnough(entryTime, null, reference);
}

/**
 * Returns the UTC `Date` for a wall-clock Mexico-local moment.
 * Example: `mxWallTimeToUtc(2026, 3, 20, 18, 0)` returns `2026-04-21T00:00:00Z`
 * (April 20 18:00 Mexico == April 21 00:00 UTC).
 *
 * `month` is 0-indexed (same as JS Date).
 */
export function mxWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  return new Date(
    Date.UTC(year, month, day, hour + MX_OFFSET_HOURS, minute, second)
  );
}

/**
 * Returns `{ start, end }` (UTC `Date`s) bracketing the Mexico-local day
 * that contains `reference`. `end` is exclusive (next day's 00:00).
 */
export function mxDayBounds(reference: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const mxShifted = new Date(reference.getTime() - MX_OFFSET_HOURS * 3600 * 1000);
  const y = mxShifted.getUTCFullYear();
  const m = mxShifted.getUTCMonth();
  const d = mxShifted.getUTCDate();
  const start = mxWallTimeToUtc(y, m, d, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

/**
 * Returns the UTC `Date` for today's closing time in Mexico-local
 * (default: 18:00, i.e. 6 PM) for the Mexico-local day containing
 * `reference`. Useful for reconciling local sessions that should have
 * been auto-closed by the cron but never were (offline device).
 */
export function mxTodayCloseUtc(
  reference: Date = new Date(),
  closeHour = 18
): Date {
  const { start } = mxDayBounds(reference);
  return mxWallTimeToUtc(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
    closeHour,
    0,
    0
  );
}

/**
 * RN-02 + RN-03: the UTC instant at which a session that opened at
 * `entryTime` must be sealed — the earlier of `entryTime + 3h` and today's
 * closing time (18:00 Mexico-local). Used by /salida's reconcile loop and
 * mirrored server-side by the sync route and the auto-close cron.
 */
export function sessionDeadlineUtc(
  entryTime: Date | string,
  reference: Date = new Date()
): Date {
  const entry = typeof entryTime === "string" ? new Date(entryTime) : entryTime;
  const maxDuration = new Date(
    entry.getTime() + LIBRARY_MAX_SESSION_MINUTES * 60 * 1000
  );
  const close = mxTodayCloseUtc(reference, LIBRARY_CLOSE_HOUR);
  return maxDuration < close ? maxDuration : close;
}

const mxDateFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: LIBRARY_TIMEZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const mxTimeFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: LIBRARY_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const mxDateTimeFmt = new Intl.DateTimeFormat("es-MX", {
  timeZone: LIBRARY_TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats a Date (or ISO string) as Mexico-local date: "20 abr 2026". */
export function formatMxDate(input: Date | string): string {
  return mxDateFmt.format(typeof input === "string" ? new Date(input) : input);
}

/** Formats a Date (or ISO string) as Mexico-local time: "14:05". */
export function formatMxTime(input: Date | string): string {
  return mxTimeFmt.format(typeof input === "string" ? new Date(input) : input);
}

/** Formats a Date (or ISO string) as Mexico-local date+time: "20/04/2026, 14:05". */
export function formatMxDateTime(input: Date | string): string {
  return mxDateTimeFmt.format(
    typeof input === "string" ? new Date(input) : input
  );
}
