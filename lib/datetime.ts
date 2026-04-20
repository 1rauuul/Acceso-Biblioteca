/**
 * Timezone helpers for México.
 *
 * México usa CST (UTC-6) todo el año desde 2022 (se abolió el DST).
 * Todas las marcas de tiempo se guardan en UTC en la base de datos;
 * estos helpers sirven para mostrar/formatear en hora local y para
 * calcular rangos "del día en México" en rutas que corren en Vercel
 * (cuyos servidores están en UTC).
 */

export const LIBRARY_TIMEZONE = "America/Mexico_City";

const MX_OFFSET_HOURS = 6;

/** Returns the Mexico-local hour (0-23) of a UTC Date. */
export function mxHour(utcDate: Date): number {
  return (utcDate.getUTCHours() - MX_OFFSET_HOURS + 24) % 24;
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
