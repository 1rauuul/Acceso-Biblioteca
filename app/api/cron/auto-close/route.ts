import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIBRARY_CLOSE_HOUR } from "@/lib/constants";

async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const todayClose = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    LIBRARY_CLOSE_HOUR,
    0,
    0
  );

  // Find all open sessions where entry was before closing time
  const openSessions = await prisma.accessRecord.findMany({
    where: {
      exitTime: null,
      entryTime: { lt: todayClose },
    },
    include: {
      student: {
        include: {
          records: {
            where: {
              durationMinutes: { not: null },
              autoClosed: false,
            },
            select: { durationMinutes: true },
            orderBy: { entryTime: "desc" },
            take: 20,
          },
        },
      },
    },
  });

  let closedCount = 0;

  for (const session of openSessions) {
    const history = session.student.records;
    let estimatedDuration: number;

    if (history.length > 0) {
      // Use average of last 20 completed visits
      estimatedDuration = Math.round(
        history.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0) /
          history.length
      );
    } else {
      // Default: 2 hours
      estimatedDuration = 120;
    }

    const estimatedExit = new Date(
      session.entryTime.getTime() + estimatedDuration * 60000
    );

    // Cap at closing time
    const exitTime = estimatedExit > todayClose ? todayClose : estimatedExit;

    const duration = Math.floor(
      (exitTime.getTime() - session.entryTime.getTime()) / 60000
    );

    await prisma.accessRecord.update({
      where: { id: session.id },
      data: {
        exitTime,
        durationMinutes: duration,
        autoClosed: true,
      },
    });

    closedCount++;
  }

  return NextResponse.json({
    success: true,
    closedSessions: closedCount,
    timestamp: now.toISOString(),
  });
}

// Vercel Cron invokes this endpoint via GET; we also accept POST for manual/testing use.
export const GET = handler;
export const POST = handler;

