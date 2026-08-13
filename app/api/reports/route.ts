import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Carrera, Sexo } from "@/lib/generated/prisma/enums";
import { mxWallTimeToUtc } from "@/lib/datetime";

// Parse "YYYY-MM-DD" as the start (00:00) of that Mexico-local day.
// Returns the equivalent UTC Date.
function parseMxDateStart(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;
  const [, y, m, d] = match;
  return mxWallTimeToUtc(Number(y), Number(m) - 1, Number(d), 0, 0, 0);
}

// Clamp pagination params to safe ranges. NaN, negatives, zero, or absurd
// values would otherwise produce 500s, infinite totalPages, or pull huge
// result sets from Postgres.
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_PAGE = 10_000;

function parsePositiveInt(
  raw: string | null,
  fallback: number,
  max: number
): number {
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return fallback;
  if (n > max) return max;
  return n;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const carrera = searchParams.get("carrera");
  const semestre = searchParams.get("semestre");
  const sexo = searchParams.get("sexo");
  const page = parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE, MAX_PAGE);
  const limit = parsePositiveInt(
    searchParams.get("limit"),
    DEFAULT_LIMIT,
    MAX_LIMIT
  );

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

  const [records, total] = await Promise.all([
    prisma.accessRecord.findMany({
      where,
      include: {
        student: {
          select: {
            nombre: true,
            apellidoPaterno: true,
            numeroControl: true,
            carrera: true,
            semestre: true,
            sexo: true,
          },
        },
      },
      orderBy: { entryTime: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.accessRecord.count({ where }),
  ]);

  // Aggregate metrics
  const allForMetrics = await prisma.accessRecord.findMany({
    where,
    select: {
      durationMinutes: true,
      entryTime: true,
      student: { select: { carrera: true, sexo: true } },
    },
  });

  const completed = allForMetrics.filter((r) => r.durationMinutes !== null);
  const avgDuration =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0) /
            completed.length
        )
      : 0;

  const careerCounts: Record<string, number> = {};
  const sexCounts = { M: 0, F: 0 };
  for (const r of allForMetrics) {
    const c = r.student.carrera;
    careerCounts[c] = (careerCounts[c] || 0) + 1;
    sexCounts[r.student.sexo]++;
  }
  const totalCareer = Object.values(careerCounts).reduce((s, v) => s + v, 0);
  const careerDistribution = Object.entries(careerCounts)
    .map(([c, count]) => ({
      carrera: c,
      visitas: count,
      porcentaje: totalCareer > 0 ? Math.round((count / totalCareer) * 100) : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas);

  const totalSex = sexCounts.M + sexCounts.F;
  const sexDistribution = [
    {
      sexo: "Masculino",
      visitas: sexCounts.M,
      porcentaje: totalSex > 0 ? Math.round((sexCounts.M / totalSex) * 100) : 0,
    },
    {
      sexo: "Femenino",
      visitas: sexCounts.F,
      porcentaje: totalSex > 0 ? Math.round((sexCounts.F / totalSex) * 100) : 0,
    },
  ];

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      studentName: `${r.student.nombre} ${r.student.apellidoPaterno}`,
      numeroControl: r.student.numeroControl,
      carrera: r.student.carrera,
      semestre: r.student.semestre,
      sexo: r.student.sexo,
      entryTime: r.entryTime.toISOString(),
      exitTime: r.exitTime?.toISOString() ?? null,
      durationMinutes: r.durationMinutes,
      autoClosed: r.autoClosed,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    metrics: {
      totalVisits: total,
      avgDuration,
      careerDistribution,
      sexDistribution,
    },
  });
}
