import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseReportFilters } from "@/lib/report-filters";
import { SURVEY_ANSWER_SELECT, buildSurveySummary } from "@/lib/survey-stats";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const { from, to, where } = parseReportFilters(searchParams);

  const responses = await prisma.surveyResponse.findMany({
    where: { accessRecord: where },
    select: SURVEY_ANSWER_SELECT,
  });

  return NextResponse.json(buildSurveySummary(responses, from, to));
}
