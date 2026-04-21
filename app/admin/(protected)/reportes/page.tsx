"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CARRERAS, SEMESTRES } from "@/lib/constants";

interface RecordRow {
  id: string;
  studentName: string;
  numeroControl: string;
  carrera: string;
  semestre: number;
  sexo: "M" | "F";
  entryTime: string;
  exitTime: string | null;
  durationMinutes: number | null;
  autoClosed: boolean;
}

interface ReportData {
  records: RecordRow[];
  total: number;
  page: number;
  totalPages: number;
  metrics: {
    totalVisits: number;
    avgDuration: number;
    careerDistribution: {
      carrera: string;
      visitas: number;
      porcentaje: number;
    }[];
    sexDistribution: {
      sexo: string;
      visitas: number;
      porcentaje: number;
    }[];
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Mexico_City",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Mexico_City",
  });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    carrera: "",
    semestre: "",
    sexo: "",
  });
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.carrera) params.set("carrera", filters.carrera);
    if (filters.semestre) params.set("semestre", filters.semestre);
    if (filters.sexo) params.set("sexo", filters.sexo);
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/reports?${params}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Silently fail
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = (format: "xlsx" | "pdf") => {
    const params = new URLSearchParams();
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.carrera) params.set("carrera", filters.carrera);
    if (filters.semestre) params.set("semestre", filters.semestre);
    if (filters.sexo) params.set("sexo", filters.sexo);
    params.set("format", format);
    window.open(`/api/export?${params}`, "_blank");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-8">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from" className="text-xs">
            Desde
          </Label>
          <Input
            id="from"
            type="date"
            value={filters.from}
            onChange={(e) =>
              setFilters((p) => ({ ...p, from: e.target.value }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to" className="text-xs">
            Hasta
          </Label>
          <Input
            id="to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <Label className="text-xs">Carrera</Label>
          <Select
            value={filters.carrera}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, carrera: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {CARRERAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Semestre</Label>
          <Select
            value={filters.semestre}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, semestre: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {SEMESTRES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}°
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Sexo</Label>
          <Select
            value={filters.sexo}
            onValueChange={(v) =>
              setFilters((p) => ({ ...p, sexo: v === "ALL" ? "" : v }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => {
              setPage(1);
              fetchData();
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Search className="size-4" />
            Buscar
          </button>
        </div>
      </div>

      {/* Metrics summary */}
      {data?.metrics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Total visitas</p>
            <p className="text-2xl font-bold">{data.metrics.totalVisits}</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Promedio permanencia
            </p>
            <p className="text-2xl font-bold">
              {formatDuration(data.metrics.avgDuration)}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">Top carrera</p>
            <p className="text-lg font-bold">
              {data.metrics.careerDistribution[0]?.carrera ?? "N/A"}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {data.metrics.careerDistribution[0]?.porcentaje ?? 0}%
              </span>
            </p>
          </div>
          {data.metrics.sexDistribution.map((s) => (
            <div
              key={s.sexo}
              className="rounded-lg border border-border bg-card px-4 py-3"
            >
              <p className="text-xs text-muted-foreground">{s.sexo}</p>
              <p className="text-2xl font-bold">
                {s.visitas}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {s.porcentaje}%
                </span>
              </p>
            </div>
          ))}
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

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudiante</TableHead>
              <TableHead>No. Control</TableHead>
              <TableHead className="hidden md:table-cell">Carrera</TableHead>
              <TableHead className="hidden lg:table-cell">Sexo</TableHead>
              <TableHead>Entrada</TableHead>
              <TableHead>Salida</TableHead>
              <TableHead className="hidden sm:table-cell">Duración</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="mx-auto size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </TableCell>
              </TableRow>
            ) : data?.records.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-muted-foreground"
                >
                  No se encontraron registros
                </TableCell>
              </TableRow>
            ) : (
              data?.records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.studentName}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.numeroControl}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.carrera}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {r.sexo === "M" ? "Masculino" : "Femenino"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(r.entryTime)} {formatTime(r.entryTime)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {r.exitTime ? (
                      formatTime(r.exitTime)
                    ) : (
                      <span className="text-success">Dentro</span>
                    )}
                    {r.autoClosed && (
                      <span className="ml-1 text-xs text-warning">(auto)</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {formatDuration(r.durationMinutes)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {data.page} de {data.totalPages} ({data.total} registros)
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-border p-2 transition-colors hover:bg-accent disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page >= data.totalPages}
              className="rounded-lg border border-border p-2 transition-colors hover:bg-accent disabled:opacity-50"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
