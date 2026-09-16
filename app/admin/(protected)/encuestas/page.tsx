"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Megaphone } from "lucide-react";
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

interface CampaignStatus {
  launchedAt: string | null;
  responsesSince: number;
}

function formatLaunchDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

export default function EncuestasPage() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilterState>(
    EMPTY_REPORT_FILTERS
  );
  const [campaign, setCampaign] = useState<CampaignStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [launching, setLaunching] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch("/api/surveys/status");
      if (res.ok) setCampaign(await res.json());
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    const request = window.setTimeout(() => void fetchCampaign(), 0);
    return () => window.clearTimeout(request);
  }, [fetchCampaign]);

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

  const handleLaunch = async () => {
    setConfirming(false);
    setLaunching(true);
    try {
      const res = await fetch("/api/surveys/launch", { method: "POST" });
      if (res.ok) {
        await fetchCampaign();
        fetchData();
      }
    } catch {
      // Silently fail
    }
    setLaunching(false);
  };

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

      {/* Campaign control */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Campaña de encuestas
          </h2>
          <p className="text-sm text-muted-foreground">
            {campaign?.launchedAt ? (
              <>
                Lanzada el {formatLaunchDate(campaign.launchedAt)} —{" "}
                {campaign.responsesSince} respuestas recibidas desde entonces
              </>
            ) : (
              "Sin encuesta lanzada. Solo se pedirá a quienes visiten la biblioteca por primera vez."
            )}
          </p>
        </div>
        {confirming ? (
          <div className="flex shrink-0 items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Se pedirá encuesta a todos de nuevo. ¿Confirmar?
            </p>
            <button
              onClick={handleLaunch}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sí, lanzar
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            disabled={launching}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Megaphone className="size-4" />
            {launching ? "Lanzando..." : "Lanzar encuesta"}
          </button>
        )}
      </section>

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
