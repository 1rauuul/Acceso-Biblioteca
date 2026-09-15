"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARRERAS, SEMESTRES } from "@/lib/constants";

export interface ReportFilterState {
  from: string;
  to: string;
  carrera: string;
  semestre: string;
  sexo: string;
}

export const EMPTY_REPORT_FILTERS: ReportFilterState = {
  from: "",
  to: "",
  carrera: "",
  semestre: "",
  sexo: "",
};

export function reportFilterParams(
  filters: ReportFilterState
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.carrera) params.set("carrera", filters.carrera);
  if (filters.semestre) params.set("semestre", filters.semestre);
  if (filters.sexo) params.set("sexo", filters.sexo);
  return params;
}

interface ReportFilterBarProps {
  filters: ReportFilterState;
  onChange: (filters: ReportFilterState) => void;
  onSearch: () => void;
}

export function ReportFilterBar({
  filters,
  onChange,
  onSearch,
}: ReportFilterBarProps) {
  const set = (patch: Partial<ReportFilterState>) =>
    onChange({ ...filters, ...patch });

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-8">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from" className="text-xs">
          Desde
        </Label>
        <Input
          id="from"
          type="date"
          value={filters.from}
          onChange={(e) => set({ from: e.target.value })}
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
          onChange={(e) => set({ to: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5 lg:col-span-3">
        <Label className="text-xs">Carrera</Label>
        <Select
          value={filters.carrera}
          onValueChange={(v) => set({ carrera: v === "ALL" ? "" : v })}
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
          onValueChange={(v) => set({ semestre: v === "ALL" ? "" : v })}
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
          onValueChange={(v) => set({ sexo: v === "ALL" ? "" : v })}
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
          onClick={onSearch}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="size-4" />
          Buscar
        </button>
      </div>
    </div>
  );
}
