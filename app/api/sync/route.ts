import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isWithinLoginWindow } from "@/lib/datetime";
import { LIBRARY_MAX_SESSION_MINUTES } from "@/lib/constants";
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
  horarioConsulta?: number | null;
  apoyoAsignaturas?: number | null;
  disponibilidadBibliografia?: number | null;
  bibliografiaActualizada?: number | null;
  atencionBusqueda?: number | null;
  orientacionEquivalentes?: number | null;
  disposicionServicio?: number | null;
  amabilidadAtencion?: number | null;
  relacionAtenta?: number | null;
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
const isRating = (v: number | null | undefined): boolean =>
  v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 5);

export async function POST(request: NextRequest) {
  try {
    const body: SyncPayload = await request.json();
    const syncedRecordIds: string[] = [];
    const syncedSurveyIds: string[] = [];
    let studentSynced = false;
    let studentExists = false;

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

    // 2) Student sync, keyed by numero_control.
    //
    // Two rules enforced server-side:
    //   a) Master data (nombre, apellidos, sexo, carrera, semestre) is
    //      immutable from the client. It is only written the FIRST time the
    //      student is registered. After that, an anonymous client must never
    //      be able to rewrite another student's profile.
    //   b) The only field that may be updated is `currentDeviceId`, and only
    //      by the device that already owns the student. This lets a student
    //      migrate to a new device by going through their old one, while
    //      blocking any random device from "claiming" or mutating the row.
    //      A null `currentDeviceId` (e.g. legacy row) is treated as unowned
    //      and can be claimed by the first device to sync.
    if (body.student && isControlNumber(body.student.numeroControl)) {
      const deviceId = isUuid(body.student.currentDeviceId)
        ? body.student.currentDeviceId
        : null;

      if (!deviceId) {
        console.warn(
          "[api/sync] student sync requires a valid currentDeviceId UUID; skipped"
        );
      } else {
        try {
          const existing = await prisma.student.findUnique({
            where: { numeroControl: body.student.numeroControl },
            select: { currentDeviceId: true },
          });

          studentExists = existing !== null;

          if (!existing) {
            // First registration: create the student with master data.
            await prisma.student.create({
              data: {
                numeroControl: body.student.numeroControl,
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
          } else if (
            existing.currentDeviceId === null ||
            existing.currentDeviceId === deviceId
          ) {
            // Same (or previously-unowned) device: allow updating only the
            // device pointer. Master data is intentionally not in this SET.
            await prisma.student.update({
              where: { numeroControl: body.student.numeroControl },
              data: { currentDeviceId: deviceId },
            });
            studentSynced = true;
          } else {
            console.warn(
              "[api/sync] refusing student sync: device does not own this student",
              { numeroControl: body.student.numeroControl }
            );
          }
        } catch (err) {
          console.error("[api/sync] student sync failed", err);
        }
      }
    } else if (body.student) {
      console.warn("[api/sync] invalid student numeroControl, skipped");
    }

    // 3) Access records: idempotent upsert guarded by client_recorded_at.
    //    Clients may have sent older offline data after a newer sync already
    //    landed (e.g. from a different device), so we never overwrite newer
    //    timestamps.
    //
    //    RN-04: records whose entryTime falls outside the logical window
    //    (06:55–18:03 Mexico) are never inserted; their ids are returned as
    //    `discardedRecordIds` so the client can drop them locally.
    //
    //    RN-03: exit_time is capped at entry_time + 3h. Closures are marked
    //    `auto_closed` so the cap is authoritative over later client pushes.
    //
    //    The additional `auto_closed = false` guard is critical: once the
    //    server-side cron closes a session, that decision is authoritative.
    //    A client coming online later (offline during the close, then
    //    registers a `createExit()`) must NOT be able to rewrite the
    //    auto-close timestamp. `duration_minutes` is a GENERATED column and
    //    must not appear in INSERT/UPDATE.
    const discardedRecordIds: string[] = [];
    if (body.records?.length) {
      for (const record of body.records) {
        if (
          !isUuid(record.id) ||
          !isUuid(record.sourceDeviceId) ||
          !isControlNumber(record.numeroControl)
        ) {
          continue;
        }
        const entryDate = new Date(record.entryTime);
        if (!isWithinLoginWindow(entryDate)) {
          discardedRecordIds.push(record.id);
          continue;
        }
        const deadline = new Date(
          entryDate.getTime() + LIBRARY_MAX_SESSION_MINUTES * 60 * 1000
        );
        const clientExit = record.exitTime ? new Date(record.exitTime) : null;
        let exitTime = clientExit;
        let autoClosed = false;
        if (clientExit && clientExit > deadline) {
          exitTime = deadline;
          autoClosed = true;
        } else if (!clientExit && new Date() > deadline) {
          exitTime = deadline;
          autoClosed = true;
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
              ${entryDate},
              ${exitTime},
              ${autoClosed},
              ${record.sourceDeviceId}::uuid,
              ${new Date(record.clientRecordedAt)},
              now()
            )
            ON CONFLICT ("id") DO UPDATE SET
              "exit_time"          = EXCLUDED."exit_time",
              "client_recorded_at" = EXCLUDED."client_recorded_at",
              "synced_at"          = now()
            WHERE EXCLUDED."client_recorded_at" >= "access_records"."client_recorded_at"
              AND "access_records"."auto_closed" = false
          `;
          syncedRecordIds.push(record.id);
        } catch (err) {
          console.error("[api/sync] record upsert failed", record.id, err);
        }
      }
    }

    // 4) Surveys: idempotent upsert. The (access_record_id) uniqueness is the
    //    real conflict target; `id` uniqueness lets the same client retry.
    //    Surveys pointing at discarded records are skipped (the client drops
    //    them when it processes `discardedRecordIds`).
    const discardedSet = new Set(discardedRecordIds);
    if (body.surveys?.length) {
      for (const survey of body.surveys) {
        if (
          !isUuid(survey.id) ||
          !isUuid(survey.accessRecordId) ||
          !isUuid(survey.sourceDeviceId) ||
          !isControlNumber(survey.numeroControl) ||
          discardedSet.has(survey.accessRecordId) ||
          ![
            survey.horarioConsulta,
            survey.apoyoAsignaturas,
            survey.disponibilidadBibliografia,
            survey.bibliografiaActualizada,
            survey.atencionBusqueda,
            survey.orientacionEquivalentes,
            survey.disposicionServicio,
            survey.amabilidadAtencion,
            survey.relacionAtenta,
          ].every(isRating)
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
              "horario_consulta",
              "apoyo_asignaturas",
              "disponibilidad_bibliografia",
              "bibliografia_actualizada",
              "atencion_busqueda",
              "orientacion_equivalentes",
              "disposicion_servicio",
              "amabilidad_atencion",
              "relacion_atenta",
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
              ${survey.horarioConsulta ?? null}::smallint,
              ${survey.apoyoAsignaturas ?? null}::smallint,
              ${survey.disponibilidadBibliografia ?? null}::smallint,
              ${survey.bibliografiaActualizada ?? null}::smallint,
              ${survey.atencionBusqueda ?? null}::smallint,
              ${survey.orientacionEquivalentes ?? null}::smallint,
              ${survey.disposicionServicio ?? null}::smallint,
              ${survey.amabilidadAtencion ?? null}::smallint,
              ${survey.relacionAtenta ?? null}::smallint,
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

    // 5) Survey campaign status for the student behind this sync. The PWA
    //    caches it to decide (even offline) whether a survey is pending:
    //    first-ever visit, or a launch that has not been answered yet.
    let surveyStatus: {
      launchedAt: string | null;
      everAnswered: boolean;
      answeredSinceLaunch: boolean;
    } | null = null;
    let surveyNumeroControl: string | null =
      body.student && isControlNumber(body.student.numeroControl)
        ? body.student.numeroControl
        : null;
    if (!surveyNumeroControl) {
      surveyNumeroControl =
        body.records?.find((r) => isControlNumber(r.numeroControl))
          ?.numeroControl ??
        body.surveys?.find((s) => isControlNumber(s.numeroControl))
          ?.numeroControl ??
        null;
    }
    if (
      !surveyNumeroControl &&
      body.device &&
      isUuid(body.device.id)
    ) {
      const owner = await prisma.student.findFirst({
        where: { currentDeviceId: body.device.id },
        select: { numeroControl: true },
      });
      surveyNumeroControl = owner?.numeroControl ?? null;
    }
    if (surveyNumeroControl) {
      const launch = await prisma.surveyLaunch.findFirst({
        orderBy: { launchedAt: "desc" },
        select: { launchedAt: true },
      });
      const [totalResponses, responsesSinceLaunch] = await Promise.all([
        prisma.surveyResponse.count({ where: { numeroControl: surveyNumeroControl } }),
        launch
          ? prisma.surveyResponse.count({
              where: {
                numeroControl: surveyNumeroControl,
                clientRecordedAt: { gte: launch.launchedAt },
              },
            })
          : Promise.resolve(0),
      ]);
      surveyStatus = {
        launchedAt: launch?.launchedAt.toISOString() ?? null,
        everAnswered: totalResponses > 0,
        answeredSinceLaunch: responsesSinceLaunch > 0,
      };
    }

    // 6) Reverse sync: return the authoritative server state for every UUID
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
      studentExists,
      syncedRecordIds,
      discardedRecordIds,
      syncedSurveyIds,
      serverRecords,
      surveyStatus,
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
