import type { Carrera, Sexo } from "@/lib/generated/prisma/enums";
import { mxWallTimeToUtc } from "@/lib/datetime";

// Parse "YYYY-MM-DD" as the start (00:00) of that Mexico-local day.
// Returns the equivalent UTC Date.
export function parseMxDateStart(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const [, y, m, d] = match;
  return mxWallTimeToUtc(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
}

export interface ReportFilters {
  from: string | null;
  to: string | null;
  where: Record<string, unknown>;
}

/**
 * Builds the Prisma `where` clause for AccessRecord from the shared report
 * query params (from, to, carrera, semestre, sexo). Invalid or missing
 * values are ignored so a crafted query string can't break the filter.
 */
export function parseReportFilters(
  searchParams: URLSearchParams
): ReportFilters {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const carrera = searchParams.get("carrera");
  const semestre = searchParams.get("semestre");
  const sexo = searchParams.get("sexo");

  const where: Record<string, unknown> = {};
  const studentWhere: Record<string, unknown> = {};

  if (from || to) {
    where.entryTime = {};
    if (from) {
      // Only accept strict YYYY-MM-DD; arbitrary strings would otherwise
      // become `Invalid Date` and 500 the endpoint.
      const fromDate = parseMxDateStart(from);
      if (fromDate) {
        (where.entryTime as Record<string, unknown>).gte = fromDate;
      }
    }
    if (to) {
      const toStart = parseMxDateStart(to);
      if (toStart) {
        const toDate = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
        (where.entryTime as Record<string, unknown>).lt = toDate;
      }
    }
  }

  if (carrera) studentWhere.carrera = carrera as Carrera;
  if (semestre && /^\d{1,2}$/.test(semestre)) {
    studentWhere.semestre = parseInt(semestre, 10);
  }
  if (sexo === "M" || sexo === "F") studentWhere.sexo = sexo as Sexo;
  if (Object.keys(studentWhere).length > 0) {
    where.student = studentWhere;
  }

  return { from, to, where };
}
