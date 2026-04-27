import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LIBRARY_CLOSE_HOUR } from "@/lib/constants";
import { mxDayBounds, mxWallTimeToUtc } from "@/lib/datetime";

async function handler(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    console.warn(
      "[cron/auto-close] Unauthorized call (authorization header mismatch)"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Compute today's closing time at LIBRARY_CLOSE_HOUR Mexico-local, then
  // materialize it as a UTC Date so date comparisons work regardless of the
  // server's own timezone (Vercel runs in UTC).
  const { start: mxDayStart } = mxDayBounds(now);
  const todayClose = mxWallTimeToUtc(
    mxDayStart.getUTCFullYear(),
    mxDayStart.getUTCMonth(),
    mxDayStart.getUTCDate(),
    LIBRARY_CLOSE_HOUR,
    0,
    0
  );

  console.log("[cron/auto-close] start", {
    now: now.toISOString(),
    todayClose: todayClose.toISOString(),
  });

  // Single UPDATE that closes every open session with the smaller of
  //   (entry_time + per-student average duration) vs today's closing time,
  //   but never before entry_time.
  // Average is computed over the student's last 20 non-auto-closed visits;
  // if there's no history we fall back to 120 minutes.
  // `duration_minutes` is a GENERATED STORED column and is recomputed
  // automatically when `exit_time` is written.
  const closedCount = await prisma.$executeRaw`
    UPDATE "access_records" ar
    SET
      "exit_time"   = LEAST(
        GREATEST(
          ar."entry_time",
          ar."entry_time" + COALESCE((
            SELECT ROUND(AVG(h."duration_minutes"))::int
            FROM (
              SELECT "duration_minutes"
              FROM "access_records"
              WHERE "numero_control" = ar."numero_control"
                AND "duration_minutes" IS NOT NULL
                AND "auto_closed" = false
              ORDER BY "entry_time" DESC
              LIMIT 20
            ) h
          ), 120) * INTERVAL '1 minute'
        ),
        ${todayClose}::timestamptz
      ),
      "auto_closed" = true
    WHERE ar."exit_time" IS NULL
  `;

  console.log("[cron/auto-close] done", {
    closedSessions: closedCount,
    timestamp: now.toISOString(),
  });

  return NextResponse.json({
    success: true,
    closedSessions: Number(closedCount),
    timestamp: now.toISOString(),
  });
}

// Vercel Cron invokes this endpoint via GET; we also accept POST for manual/testing use.
export const GET = handler;
export const POST = handler;
