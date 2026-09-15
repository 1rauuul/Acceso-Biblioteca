import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMxDateTime } from "@/lib/datetime";
import { parseReportFilters } from "@/lib/report-filters";
import {
  SURVEY_ANSWER_SELECT,
  buildSurveySummary,
  type SurveySummary,
} from "@/lib/survey-stats";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

function attachment(
  body: Buffer | ArrayBuffer,
  contentType: string,
  filename: string
): NextResponse {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}

function surveyPeriodLabel(summary: SurveySummary): string {
  return `Periodo: ${summary.from ?? "Inicio"} a ${
    summary.to ?? "actualidad"
  }  |  Muestra: ${summary.sampleSize} encuestas`;
}

async function exportSurveys(
  format: "xlsx" | "pdf",
  where: Record<string, unknown>,
  from: string | null,
  to: string | null
): Promise<NextResponse> {
  const responses = await prisma.surveyResponse.findMany({
    where: { accessRecord: where },
    select: SURVEY_ANSWER_SELECT,
  });
  const summary = buildSurveySummary(responses, from, to);

  if (format === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Encuestas");
    sheet.getColumn(1).width = 60;
    sheet.getColumn(2).width = 15;
    sheet.getColumn(3).width = 12;

    sheet.addRow([surveyPeriodLabel(summary)]);
    sheet.addRow([]);
    const header = sheet.addRow(["Pregunta", "Promedio", "Respuestas"]);
    for (const question of summary.questions) {
      sheet.addRow([
        question.label,
        question.average === null
          ? "Sin datos"
          : `${question.average.toFixed(2)} / 5`,
        question.responses,
      ]);
    }

    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E40AF" },
      };
      cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return attachment(
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `biblioteca-encuestas-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Centro de Información - Reporte de Encuestas", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado: ${formatMxDateTime(new Date())}`, 14, 22);
  doc.text(surveyPeriodLabel(summary), 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [["Pregunta", "Promedio", "Respuestas"]],
    body: summary.questions.map((question) => [
      question.label,
      question.average === null
        ? "Sin datos"
        : `${question.average.toFixed(2)} / 5`,
      String(question.responses),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 64, 175] },
  });

  const pdfBuffer = doc.output("arraybuffer");
  return attachment(
    pdfBuffer,
    "application/pdf",
    `biblioteca-encuestas-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

async function exportRecords(
  format: "xlsx" | "pdf",
  where: Record<string, unknown>
): Promise<NextResponse> {
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
    return attachment(
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `biblioteca-registros-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  }

  // PDF
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Centro de Información - Reporte de Registros", 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado: ${formatMxDateTime(new Date())}`, 14, 22);

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
  return attachment(
    pdfBuffer,
    "application/pdf",
    `biblioteca-registros-${new Date().toISOString().slice(0, 10)}.pdf`
  );
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const formatRaw = searchParams.get("format") || "xlsx";
  // Whitelist the export format. Anything else falls back to xlsx so a
  // crafted query string can't be used to probe or surprise the renderer.
  const format = formatRaw === "pdf" ? "pdf" : "xlsx";
  const section =
    searchParams.get("section") === "encuestas" ? "encuestas" : "registros";

  const { from, to, where } = parseReportFilters(searchParams);

  if (section === "encuestas") {
    return exportSurveys(format, where, from, to);
  }
  return exportRecords(format, where);
}
