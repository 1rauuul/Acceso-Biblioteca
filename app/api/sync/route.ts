import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Carrera, Sexo } from "@/lib/generated/prisma/enums";

type Platform = "ios" | "android" | "desktop" | "unknown";

interface DevicePayload {
  id: string;
  platform?: Platform;
  userAgent?: string;
}

interface StudentPayload {
  numeroControl: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  sexo: Sexo;
  carrera: string;
  semestre: number;
  currentDeviceId: string;
}

interface RecordPayload {
  id: string;
  numeroControl: string;
  entryTime: string;
  exitTime: string | null;
  clientRecordedAt: string;
  sourceDeviceId: string;
}

interface SurveyPayload {
  id: string;
  numeroControl: string;
  accessRecordId: string;
  stars: number;
  limpieza: number;
  mesas: number;
  silencio: number;
  comment: string;
  sourceDeviceId: string;
  clientRecordedAt: string;
}

interface SyncPayload {
  student?: StudentPayload | null;
  device?: DevicePayload;
  records?: RecordPayload[];
  surveys?: SurveyPayload[];
  // UUIDs of sessions the client wants the server's current state for
  // (typically sessions still open locally, so the client can detect
  // cron-driven auto-closes and reconcile its IndexedDB).
  openRecordIds?: string[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string | undefined | null): v is string =>
  !!v && UUID_RE.test(v);
const CONTROL_NUMBER_RE = /^\d{8}$/;
const isControlNumber = (v: string | undefined | null): v is string =>
  !!v && CONTROL_NUMBER_RE.test(v);

export async function POST(request: NextRequest) {
  try {
    const body: SyncPayload = await request.json();
    const syncedRecordIds: string[] = [];
    const syncedSurveyIds: string[] = [];
    let studentSynced = false;

    // 1) Device upsert (every sync refreshes last_seen_at).
    if (body.device && isUuid(body.device.id)) {
      await prisma.$executeRaw`
        INSERT INTO "devices" ("id", "platform", "user_agent", "first_seen_at", "last_seen_at")
        VALUES (
          ${body.device.id}::uuid,
          COALESCE(${body.device.platform ?? null}::"DevicePlatform", 'unknown'::"DevicePlatform"),
          ${body.device.userAgent ?? null},
          now(),
          now()
        )
        ON CONFLICT ("id") DO UPDATE SET
          "last_seen_at" = now(),
          "user_agent"   = COALESCE(EXCLUDED."user_agent", "devices"."user_agent"),
          "platform"     = CASE
                             WHEN "devices"."platform" = 'unknown' THEN EXCLUDED."platform"
                             ELSE "devices"."platform"
                           END
      `;
    }

    // 2) Student upsert keyed by numero_control. No client_recorded_at guard
    //    here: student data is master-data that only changes at registration.
    if (body.student && isControlNumber(body.student.numeroControl)) {
      const deviceId = isUuid(body.student.currentDeviceId)
        ? body.student.currentDeviceId
        : null;
      await prisma.student.upsert({
        where: { numeroControl: body.student.numeroControl },
        create: {
          numeroControl: body.student.numeroControl,
          nombre: body.student.nombre,
          apellidoPaterno: body.student.apellidoPaterno,
          apellidoMaterno: body.student.apellidoMaterno,
          sexo: body.student.sexo,
          carrera: body.student.carrera as Carrera,
          semestre: body.student.semestre,
          currentDeviceId: deviceId,
        },
        update: {
          nombre: body.student.nombre,
          apellidoPaterno: body.student.apellidoPaterno,
          apellidoMaterno: body.student.apellidoMaterno,
          sexo: body.student.sexo,
          carrera: body.student.carrera as Carrera,
          semestre: body.student.semestre,
          currentDeviceId: deviceId,
        },
      });
      studentSynced = true;
    } else if (body.student) {
      console.warn("[api/sync] invalid student numeroControl, skipped");
    }

    // 3) Access records: idempotent upsert guarded by client_recorded_at.
    //    Clients may have sent older offline data after a newer sync already
    //    landed (e.g. from a different device), so we never overwrite newer
    //    timestamps. `duration_minutes` is a GENERATED column and must not
    //    appear in INSERT/UPDATE.
    if (body.records?.length) {
      for (const record of body.records) {
        if (
          !isUuid(record.id) ||
          !isUuid(record.sourceDeviceId) ||
          !isControlNumber(record.numeroControl)
        ) {
          continue;
        }
        try {
          await prisma.$executeRaw`
            INSERT INTO "access_records" (
              "id",
              "numero_control",
              "entry_time",
              "exit_time",
              "auto_closed",
              "source_device_id",
              "client_recorded_at",
              "synced_at"
            )
            VALUES (
              ${record.id}::uuid,
              ${record.numeroControl},
              ${new Date(record.entryTime)},
              ${record.exitTime ? new Date(record.exitTime) : null},
              false,
              ${record.sourceDeviceId}::uuid,
              ${new Date(record.clientRecordedAt)},
              now()
            )
            ON CONFLICT ("id") DO UPDATE SET
              "exit_time"          = EXCLUDED."exit_time",
              "client_recorded_at" = EXCLUDED."client_recorded_at",
              "synced_at"          = now()
            WHERE EXCLUDED."client_recorded_at" >= "access_records"."client_recorded_at"
          `;
          syncedRecordIds.push(record.id);
        } catch (err) {
          console.error("[api/sync] record upsert failed", record.id, err);
        }
      }
    }

    // 4) Surveys: idempotent upsert. The (access_record_id) uniqueness is the
    //    real conflict target; `id` uniqueness lets the same client retry.
    if (body.surveys?.length) {
      for (const survey of body.surveys) {
        if (
          !isUuid(survey.id) ||
          !isUuid(survey.accessRecordId) ||
          !isUuid(survey.sourceDeviceId) ||
          !isControlNumber(survey.numeroControl)
        ) {
          continue;
        }
        try {
          await prisma.$executeRaw`
            INSERT INTO "survey_responses" (
              "id",
              "numero_control",
              "access_record_id",
              "stars",
              "limpieza",
              "mesas",
              "silencio",
              "comment",
              "source_device_id",
              "client_recorded_at",
              "synced_at",
              "created_at"
            )
            VALUES (
              ${survey.id}::uuid,
              ${survey.numeroControl},
              ${survey.accessRecordId}::uuid,
              ${survey.stars}::smallint,
              ${survey.limpieza}::smallint,
              ${survey.mesas}::smallint,
              ${survey.silencio}::smallint,
              ${survey.comment?.trim() || null},
              ${survey.sourceDeviceId}::uuid,
              ${new Date(survey.clientRecordedAt)},
              now(),
              ${new Date(survey.clientRecordedAt)}
            )
            ON CONFLICT ("access_record_id") DO NOTHING
          `;
          syncedSurveyIds.push(survey.id);
        } catch (err) {
          console.error("[api/sync] survey upsert failed", survey.id, err);
        }
      }
    }

    // 5) Reverse sync: return the authoritative server state for every UUID
    //    the client asked about (its open sessions) plus everything it just
    //    pushed. This lets the PWA detect sessions auto-closed by the cron.
    const queryIds = Array.from(
      new Set<string>([
        ...(body.openRecordIds ?? []),
        ...(body.records?.map((r) => r.id) ?? []),
      ])
    ).filter(isUuid);

    let serverRecords: {
      id: string;
      exitTime: string | null;
      autoClosed: boolean;
    }[] = [];

    if (queryIds.length > 0) {
      const rows = await prisma.accessRecord.findMany({
        where: { id: { in: queryIds } },
        select: { id: true, exitTime: true, autoClosed: true },
      });
      serverRecords = rows.map((r) => ({
        id: r.id,
        exitTime: r.exitTime ? r.exitTime.toISOString() : null,
        autoClosed: r.autoClosed,
      }));
    }

    return NextResponse.json({
      studentSynced,
      syncedRecordIds,
      syncedSurveyIds,
      serverRecords,
    });
  } catch (error) {
    console.error("[api/sync] FAILED:", error);
    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
