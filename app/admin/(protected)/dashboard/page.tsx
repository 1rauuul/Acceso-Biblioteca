"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Clock, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatsCard } from "@/components/admin/stats-card";

interface DashboardData {
  currentlyInside: number;
  totalVisitsToday: number;
  avgDuration: number;
  peakHour: string;
  peakHourCount: number;
  hourlyData: { hour: string; entradas: number }[];
  careerDistribution: {
    carrera: string;
    visitas: number;
    porcentaje: number;
  }[];
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail, keep stale data
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-muted-foreground">
        Error al cargar datos
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Dentro ahora"
          value={data.currentlyInside}
          subtitle="estudiantes"
          icon={<Users className="size-5" />}
        />
        <StatsCard
          title="Visitas hoy"
          value={data.totalVisitsToday}
          subtitle="entradas registradas"
          icon={<TrendingUp className="size-5" />}
        />
        <StatsCard
          title="Promedio permanencia"
          value={formatDuration(data.avgDuration)}
          subtitle="visitas completadas"
          icon={<Clock className="size-5" />}
        />
        <StatsCard
          title="Hora pico"
          value={data.peakHour}
          subtitle={`${data.peakHourCount} entradas`}
          icon={<BarChart3 className="size-5" />}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Hourly distribution */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Distribución horaria
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.hourlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="hour"
                className="text-xs"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Line
                type="monotone"
                dataKey="entradas"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Career distribution */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-foreground">
            Uso por carrera
          </h2>
          {data.careerDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.careerDistribution} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="carrera"
                  width={100}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [`${value} visitas`, "Carrera"]}
                />
                <Bar dataKey="visitas" fill="var(--primary)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
              Sin datos disponibles
            </p>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Los datos se actualizan automáticamente cada 30 segundos
      </p>
    </div>
  );
}
