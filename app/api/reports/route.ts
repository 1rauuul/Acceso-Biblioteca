import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Carrera } from "@/lib/generated/prisma/enums";

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
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};
  const studentWhere: Record<string, unknown> = {};

  if (from || to) {
    where.entryTime = {};
    if (from)
      (where.entryTime as Record<string, unknown>).gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setDate(toDate.getDate() + 1);
      (where.entryTime as Record<string, unknown>).lt = toDate;
    }
  }

  if (carrera) studentWhere.carrera = carrera as Carrera;
  if (semestre) studentWhere.semestre = parseInt(semestre);
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
      student: { select: { carrera: true } },
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
  for (const r of allForMetrics) {
    const c = r.student.carrera;
    careerCounts[c] = (careerCounts[c] || 0) + 1;
  }
  const totalCareer = Object.values(careerCounts).reduce((s, v) => s + v, 0);
  const careerDistribution = Object.entries(careerCounts)
    .map(([c, count]) => ({
      carrera: c,
      visitas: count,
      porcentaje: totalCareer > 0 ? Math.round((count / totalCareer) * 100) : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas);

  return NextResponse.json({
    records: records.map((r) => ({
      id: r.id,
      studentName: `${r.student.nombre} ${r.student.apellidoPaterno}`,
      numeroControl: r.student.numeroControl,
      carrera: r.student.carrera,
      semestre: r.student.semestre,
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
    },
  });
}
