import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONTROL_NUMBER_RE = /^\d{8}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeString(str: string): string {
  return str
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { numeroControl, apellidoPaterno, deviceId } = body;

    // 1. Validation
    if (!numeroControl || !CONTROL_NUMBER_RE.test(String(numeroControl).trim())) {
      return NextResponse.json(
        { error: "El número de control debe tener exactamente 8 dígitos numéricos" },
        { status: 400 }
      );
    }

    if (!apellidoPaterno || typeof apellidoPaterno !== "string" || !apellidoPaterno.trim()) {
      return NextResponse.json(
        { error: "El apellido paterno es obligatorio" },
        { status: 400 }
      );
    }

    if (typeof deviceId !== "string" || !UUID_RE.test(deviceId)) {
      return NextResponse.json(
        { error: "El identificador del dispositivo no es válido" },
        { status: 400 }
      );
    }

    const cleanNumeroControl = String(numeroControl).trim();
    const cleanApellido = normalizeString(apellidoPaterno);

    // 2. Lookup student in database
    const student = await prisma.student.findUnique({
      where: { numeroControl: cleanNumeroControl },
    });

    if (!student) {
      return NextResponse.json(
        {
          error:
            "No se encontró ningún estudiante con ese número de control. Regístrate si es tu primera vez.",
        },
        { status: 404 }
      );
    }

    // 3. Verify apellido paterno
    if (normalizeString(student.apellidoPaterno) !== cleanApellido) {
      return NextResponse.json(
        {
          error:
            "El apellido paterno no coincide con los datos registrados para este número de control.",
        },
        { status: 401 }
      );
    }

    // 4. Update device ownership if deviceId is valid
    const validDeviceId = deviceId;

    // Ensure device row exists before referencing it.
    await prisma.$executeRaw`
      INSERT INTO "devices" ("id", "platform", "first_seen_at", "last_seen_at")
      VALUES (${validDeviceId}::uuid, 'unknown'::"DevicePlatform", now(), now())
      ON CONFLICT ("id") DO UPDATE SET "last_seen_at" = now()
    `;

    await prisma.student.update({
      where: { numeroControl: cleanNumeroControl },
      data: { currentDeviceId: validDeviceId },
    });

    // 5. Check if there is an active session in progress (entered but not exited)
    const activeSession = await prisma.accessRecord.findFirst({
      where: {
        numeroControl: cleanNumeroControl,
        exitTime: null,
        autoClosed: false,
      },
      orderBy: { entryTime: "desc" },
    });

    return NextResponse.json({
      success: true,
      student: {
        numeroControl: student.numeroControl,
        nombre: student.nombre,
        apellidoPaterno: student.apellidoPaterno,
        apellidoMaterno: student.apellidoMaterno,
        sexo: student.sexo,
        carrera: student.carrera,
        semestre: student.semestre,
        currentDeviceId: validDeviceId ?? student.currentDeviceId,
        synced: true,
      },
      activeSession: activeSession
        ? {
            id: activeSession.id,
            numeroControl: activeSession.numeroControl,
            entryTime: activeSession.entryTime.toISOString(),
            exitTime: null,
            clientRecordedAt: activeSession.clientRecordedAt.toISOString(),
            sourceDeviceId: activeSession.sourceDeviceId,
            synced: true,
          }
        : null,
    });
  } catch (error) {
    console.error("[api/auth/student-login] error", error);
    return NextResponse.json(
      { error: "Error interno del servidor al procesar el inicio de sesión" },
      { status: 500 }
    );
  }
}
