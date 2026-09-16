import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const launch = await prisma.surveyLaunch.create({ data: {} });
  return NextResponse.json({ launchedAt: launch.launchedAt.toISOString() });
}
