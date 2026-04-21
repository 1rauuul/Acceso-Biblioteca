"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Clock, TrendingUp, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
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
  sexDistribution: {
    sexo: string;
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
            <LineChart
              data={data.hourlyData}
              margin={{ top: 10, right: 16, bottom: 8, left: 16 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="hour"
                interval={0}
                tickFormatter={(h: string) => {
                  const num = parseInt(h);
                  if (num === 12) return "12pm";
                  return num < 12 ? `${num}am` : `${num - 12}pm`;
                }}
                tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
                tickLine={false}
                label={{
                  value: "Hora del día",
                  position: "insideBottom",
                  offset: -4,
                  style: { fill: "var(--muted-foreground)", fontSize: 11 },
                }}
                height={48}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
                formatter={(value) => [value, "Entradas"]}
                labelFormatter={(h) => {
                  const num = parseInt(String(h));
                  if (isNaN(num)) return String(h);
                  if (num === 12) return "12:00 pm";
                  return num < 12 ? `${num}:00 am` : `${num - 12}:00 pm`;
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

      {/* Sex distribution */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">
          Distribución por sexo
        </h2>
        {data.sexDistribution.some((s) => s.visitas > 0) ? (
          <div className="flex flex-col items-center sm:flex-row sm:items-center sm:justify-around gap-4">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.sexDistribution}
                  dataKey="visitas"
                  nameKey="sexo"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                >
                  <Cell fill="var(--primary)" />
                  <Cell fill="hsl(280 65% 60%)" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                  formatter={(value, name, props) => [
                    `${value} visitas (${props.payload.porcentaje}%)`,
                    props.payload.sexo,
                  ]}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 13, color: "var(--foreground)" }}>
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex gap-6 sm:flex-col sm:gap-3">
              {data.sexDistribution.map((s) => (
                <div key={s.sexo} className="text-center">
                  <p className="text-2xl font-bold text-foreground">
                    {s.visitas}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.sexo}</p>
                  <p className="text-xs font-medium text-foreground">
                    {s.porcentaje}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
            Sin datos disponibles
          </p>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Los datos se actualizan automáticamente cada 30 segundos
      </p>
    </div>
  );
}
