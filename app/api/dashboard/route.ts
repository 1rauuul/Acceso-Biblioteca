import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mxDayBounds, mxHour } from "@/lib/datetime";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { start: todayStart, end: todayEnd } = mxDayBounds();

  // Students currently inside (have entry today, no exit)
  const currentlyInside = await prisma.accessRecord.count({
    where: {
      entryTime: { gte: todayStart },
      exitTime: null,
      autoClosed: false,
    },
  });

  // Total visits today
  const totalVisitsToday = await prisma.accessRecord.count({
    where: {
      entryTime: { gte: todayStart, lt: todayEnd },
    },
  });

  // Average stay duration today (completed visits only)
  const completedToday = await prisma.accessRecord.findMany({
    where: {
      entryTime: { gte: todayStart, lt: todayEnd },
      exitTime: { not: null },
      durationMinutes: { not: null },
    },
    select: { durationMinutes: true },
  });

  const avgDuration =
    completedToday.length > 0
      ? Math.round(
          completedToday.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0) /
            completedToday.length
        )
      : 0;

  // Hourly distribution (entries by hour today)
  const hourlyRecords = await prisma.accessRecord.findMany({
    where: { entryTime: { gte: todayStart, lt: todayEnd } },
    select: { entryTime: true },
  });

  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    entradas: hourlyRecords.filter((r) => mxHour(r.entryTime) === hour).length,
  })).filter((h) => h.hour >= "06:00" && h.hour <= "21:00");

  // Peak hour
  const peakHourEntry = hourlyData.reduce(
    (max, h) => (h.entradas > max.entradas ? h : max),
    { hour: "N/A", entradas: 0 }
  );

  // Usage by career
  const careerData = await prisma.accessRecord.findMany({
    where: { entryTime: { gte: todayStart, lt: todayEnd } },
    select: { student: { select: { carrera: true } } },
  });

  const careerCounts: Record<string, number> = {};
  for (const record of careerData) {
    const c = record.student.carrera;
    careerCounts[c] = (careerCounts[c] || 0) + 1;
  }

  const totalCareer = Object.values(careerCounts).reduce((s, v) => s + v, 0);
  const careerDistribution = Object.entries(careerCounts)
    .map(([carrera, count]) => ({
      carrera,
      visitas: count,
      porcentaje: totalCareer > 0 ? Math.round((count / totalCareer) * 100) : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas);

  return NextResponse.json({
    currentlyInside,
    totalVisitsToday,
    avgDuration,
    peakHour: peakHourEntry.hour,
    peakHourCount: peakHourEntry.entradas,
    hourlyData,
    careerDistribution,
  });
}
