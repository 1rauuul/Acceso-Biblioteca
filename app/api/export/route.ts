import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Carrera } from "@/lib/generated/prisma/enums";
import { formatMxDateTime, mxWallTimeToUtc } from "@/lib/datetime";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format") || "xlsx";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const carrera = searchParams.get("carrera");
  const semestre = searchParams.get("semestre");

  const where: Record<string, unknown> = {};
  const studentWhere: Record<string, unknown> = {};

  if (from || to) {
    where.entryTime = {};
    if (from) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
      const fromDate = m
        ? mxWallTimeToUtc(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0)
        : new Date(from);
      (where.entryTime as Record<string, unknown>).gte = fromDate;
    }
    if (to) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
      const toStart = m
        ? mxWallTimeToUtc(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0)
        : (() => {
            const d = new Date(to);
            return d;
          })();
      const toDate = new Date(toStart.getTime() + 24 * 60 * 60 * 1000);
      (where.entryTime as Record<string, unknown>).lt = toDate;
    }
  }

  if (carrera) studentWhere.carrera = carrera as Carrera;
  if (semestre) studentWhere.semestre = parseInt(semestre);
  if (Object.keys(studentWhere).length > 0) where.student = studentWhere;

  const records = await prisma.accessRecord.findMany({
    where,
    include: {
      student: {
        select: {
          nombre: true,
          apellidoPaterno: true,
          apellidoMaterno: true,
          numeroControl: true,
          carrera: true,
          semestre: true,
        },
      },
    },
    orderBy: { entryTime: "desc" },
    take: 5000,
  });

  const rows = records.map((r) => ({
    nombre: `${r.student.nombre} ${r.student.apellidoPaterno} ${r.student.apellidoMaterno}`,
    noControl: r.student.numeroControl,
    carrera: r.student.carrera,
    semestre: r.student.semestre,
    entrada: formatMxDateTime(r.entryTime),
    salida: r.exitTime ? formatMxDateTime(r.exitTime) : "Sin salida",
    duracion:
      r.durationMinutes !== null
        ? `${Math.floor(r.durationMinutes / 60)}h ${r.durationMinutes % 60}min`
        : "—",
    autoCierre: r.autoClosed ? "Sí" : "No",
  }));

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registros");

    sheet.columns = [
      { header: "Nombre", key: "nombre", width: 30 },
      { header: "No. Control", key: "noControl", width: 15 },
      { header: "Carrera", key: "carrera", width: 20 },
      { header: "Semestre", key: "semestre", width: 10 },
      { header: "Entrada", key: "entrada", width: 20 },
      { header: "Salida", key: "salida", width: 20 },
      { header: "Duración", key: "duracion", width: 12 },
      { header: "Auto-cierre", key: "autoCierre", width: 12 },
    ];

    // Header styling
    sheet.getRow(1).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E40AF" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    rows.forEach((row) => sheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=biblioteca-registros-${new Date().toISOString().slice(0, 10)}.xlsx`,
      },
    });
  }

  // PDF
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Biblioteca Escuela - Reporte de Registros", 14, 15);
  doc.setFontSize(10);
  doc.text(
    `Generado: ${formatMxDateTime(new Date())}`,
    14,
    22
  );

  autoTable(doc, {
    startY: 28,
    head: [
      [
        "Nombre",
        "No. Control",
        "Carrera",
        "Sem.",
        "Entrada",
        "Salida",
        "Duración",
      ],
    ],
    body: rows.map((r) => [
      r.nombre,
      r.noControl,
      r.carrera,
      String(r.semestre),
      r.entrada,
      r.salida,
      r.duracion,
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const pdfBuffer = doc.output("arraybuffer");
  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=biblioteca-registros-${new Date().toISOString().slice(0, 10)}.pdf`,
    },
  });
}
