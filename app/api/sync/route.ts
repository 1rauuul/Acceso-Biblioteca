import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Carrera, Sexo } from "@/lib/generated/prisma/enums";

interface SyncPayload {
  student?: {
    id: string;
    numeroControl: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    sexo: Sexo;
    carrera: string;
    semestre: number;
    deviceId: string;
  } | null;
  studentNumeroControl?: string | null;
  records?: {
    localId: string;
    studentId: string;
    entryTime: string;
    exitTime: string | null;
  }[];
  surveys?: {
    localId: string;
    accessRecordLocalId: string;
    studentId: string;
    stars: number;
    limpieza: number;
    mesas: number;
    silencio: number;
    comment: string;
    createdAt: string;
  }[];
  source?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncPayload = await request.json();
    let studentSynced = false;
    const syncedRecordIds: string[] = [];
    const syncedSurveyIds: string[] = [];
    let serverStudentId: string | null = null;

    // Sync student
    if (body.student) {
      const existing = await prisma.student.findUnique({
        where: { numeroControl: body.student.numeroControl },
      });

      if (existing) {
        serverStudentId = existing.id;
        await prisma.student.update({
          where: { id: existing.id },
          data: { deviceId: body.student.deviceId },
        });
      } else {
        const created = await prisma.student.create({
          data: {
            numeroControl: body.student.numeroControl,
            nombre: body.student.nombre,
            apellidoPaterno: body.student.apellidoPaterno,
            apellidoMaterno: body.student.apellidoMaterno,
            sexo: body.student.sexo,
            carrera: body.student.carrera as Carrera,
            semestre: body.student.semestre,
            deviceId: body.student.deviceId,
          },
        });
        serverStudentId = created.id;
      }
      studentSynced = true;
    }

    // Resolve server student id via numeroControl when the student record
    // itself is not in the payload (already synced on a previous request).
    if (!serverStudentId && body.studentNumeroControl) {
      const owner = await prisma.student.findUnique({
        where: { numeroControl: body.studentNumeroControl },
        select: { id: true },
      });
      if (owner) serverStudentId = owner.id;
    }

    // If we still cannot identify the student but there are records/surveys
    // to sync, bail out: the client will retry after the student is synced.
    if (
      !serverStudentId &&
      ((body.records?.length ?? 0) > 0 || (body.surveys?.length ?? 0) > 0)
    ) {
      return NextResponse.json({
        studentSynced,
        syncedRecordIds,
        syncedSurveyIds,
        message: "Student must sync first",
      });
    }

    // Sync records
    if (body.records?.length && serverStudentId) {
      for (const record of body.records) {
        const existing = await prisma.accessRecord.findUnique({
          where: { localId: record.localId },
        });

        if (existing) {
          if (record.exitTime && !existing.exitTime) {
            const exitTime = new Date(record.exitTime);
            const duration = Math.floor(
              (exitTime.getTime() - existing.entryTime.getTime()) / 60000
            );
            await prisma.accessRecord.update({
              where: { id: existing.id },
              data: {
                exitTime,
                durationMinutes: duration,
                syncedAt: new Date(),
              },
            });
          }
        } else {
          const entryTime = new Date(record.entryTime);
          const exitTime = record.exitTime
            ? new Date(record.exitTime)
            : null;
          const duration =
            exitTime
              ? Math.floor(
                  (exitTime.getTime() - entryTime.getTime()) / 60000
                )
              : null;

          await prisma.accessRecord.create({
            data: {
              studentId: serverStudentId,
              localId: record.localId,
              entryTime,
              exitTime,
              durationMinutes: duration,
              syncedAt: new Date(),
            },
          });
        }
        syncedRecordIds.push(record.localId);
      }
    }

    // Sync surveys
    if (body.surveys?.length && serverStudentId) {
      for (const survey of body.surveys) {
        const accessRecord = await prisma.accessRecord.findUnique({
          where: { localId: survey.accessRecordLocalId },
        });

        if (!accessRecord) continue;

        const existingSurvey = await prisma.surveyResponse.findUnique({
          where: { accessRecordId: accessRecord.id },
        });

        if (!existingSurvey) {
          await prisma.surveyResponse.create({
            data: {
              studentId: serverStudentId,
              accessRecordId: accessRecord.id,
              stars: survey.stars,
              limpieza: survey.limpieza,
              mesas: survey.mesas,
              silencio: survey.silencio,
              comment: survey.comment || null,
            },
          });
        }
        syncedSurveyIds.push(survey.localId);
      }
    }

    return NextResponse.json({
      studentSynced,
      syncedRecordIds,
      syncedSurveyIds,
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
