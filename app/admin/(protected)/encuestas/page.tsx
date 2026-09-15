"use client";

import { useEffect, useState, useCallback } from "react";
import { Download } from "lucide-react";
import {
  ReportFilterBar,
  reportFilterParams,
  EMPTY_REPORT_FILTERS,
  type ReportFilterState,
} from "@/components/admin/report-filter-bar";

interface SurveyData {
  from: string | null;
  to: string | null;
  sampleSize: number;
  questions: {
    key: string;
    label: string;
    average: number | null;
    responses: number;
  }[];
}

export default function EncuestasPage() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(
    EMPTY_REPORT_FILTERS
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = reportFilterParams(filters);

    try {
      const res = await fetch(`/api/surveys?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    const request = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(request);
  }, [fetchData]);

  const handleExport = (format: "xlsx" | "pdf") => {
    const params = reportFilterParams(filters);
    params.set("section", "encuestas");
    params.set("format", format);
    window.open(`/api/export?${params}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <ReportFilterBar
        filters={filters}
        onChange={setFilters}
        onSearch={fetchData}
      />

      {/* Summary cards */}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Encuestas recibidas</p>
            <p className="text-2xl font-bold">{data.sampleSize}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Periodo</p>
            <p className="text-lg font-bold">
              {data.from ?? "Inicio"} a {data.to ?? "actualidad"}
            </p>
          </div>
        </div>
      )}

      {/* Export buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleExport("xlsx")}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Download className="size-4" />
          Exportar Excel
        </button>
        <button
          onClick={() => handleExport("pdf")}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
        >
          <Download className="size-4" />
          Exportar PDF
        </button>
      </div>

      {/* Question results */}
      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-card">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data && data.sampleSize === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-border text-muted-foreground">
          No se encontraron encuestas
        </div>
      ) : (
        data && (
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              Resultados por pregunta
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {data.questions.map((question) => (
                <div
                  key={question.key}
                  className="flex items-start justify-between gap-4 border-t border-border pt-3"
                >
                  <p className="text-sm text-foreground">{question.label}</p>
                  <p className="shrink-0 text-right text-sm font-semibold">
                    {question.average === null
                      ? "Sin datos"
                      : `${question.average.toFixed(2)} / 5`}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {question.responses} respuestas
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>
        )
      )}
    </div>
  );
}
