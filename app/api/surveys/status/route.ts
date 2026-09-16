import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const launch = await prisma.surveyLaunch.findFirst({
    orderBy: { launchedAt: "desc" },
    select: { launchedAt: true },
  });

  const responsesSince = launch
    ? await prisma.surveyResponse.count({
        where: { clientRecordedAt: { gte: launch.launchedAt } },
      })
    : 0;

  return NextResponse.json({
    launchedAt: launch?.launchedAt.toISOString() ?? null,
    responsesSince,
  });
}
