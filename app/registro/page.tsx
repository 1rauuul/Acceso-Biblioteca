"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageWrapper } from "@/components/page-wrapper";
import { LibraryHeader } from "@/components/library-header";
import { saveStudent, syncWithServer } from "@/lib/idb";
import { CARRERAS, SEMESTRES } from "@/lib/constants";

interface FormErrors {
  numeroControl?: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  sexo?: string;
  carrera?: string;
  semestre?: string;
}

function validate(form: Record<string, string>): FormErrors {
  const errors: FormErrors = {};
  if (!form.numeroControl?.trim()) {
    errors.numeroControl = "El número de control es obligatorio";
  } else if (!/^\d{8,10}$/.test(form.numeroControl.trim())) {
    errors.numeroControl = "Debe tener entre 8 y 10 dígitos";
  }
  if (!form.nombre?.trim()) errors.nombre = "El nombre es obligatorio";
  if (!form.apellidoPaterno?.trim())
    errors.apellidoPaterno = "El apellido paterno es obligatorio";
  if (!form.apellidoMaterno?.trim())
    errors.apellidoMaterno = "El apellido materno es obligatorio";
  if (!form.sexo) errors.sexo = "Selecciona tu sexo";
  if (!form.carrera) errors.carrera = "Selecciona tu carrera";
  if (!form.semestre) errors.semestre = "Selecciona tu semestre";
  return errors;
}

export default function RegistroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    numeroControl: "",
    nombre: "",
    apellidoPaterno: "",
    apellidoMaterno: "",
    sexo: "",
    carrera: "",
    semestre: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await saveStudent({
        numeroControl: form.numeroControl.trim(),
        nombre: form.nombre.trim(),
        apellidoPaterno: form.apellidoPaterno.trim(),
        apellidoMaterno: form.apellidoMaterno.trim(),
        sexo: form.sexo as "M" | "F",
        carrera: form.carrera,
        semestre: parseInt(form.semestre),
      });

      try {
        await syncWithServer();
      } catch {
        // Offline — will sync later
      }

      router.push("/entrada");
    } catch {
      setLoading(false);
    }
  };

  return (
    <PageWrapper className="bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <LibraryHeader subtitle="Registro de estudiante" />

      <form
        onSubmit={handleSubmit}
        className="flex flex-1 flex-col gap-5 px-6 py-6"
      >
        <div className="flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
          <UserPlus className="size-8 shrink-0 text-primary" strokeWidth={1.5} />
          <div>
            <p className="font-semibold text-foreground">Primera vez aquí</p>
            <p className="text-sm text-muted-foreground">
              Completa tus datos para registrarte
            </p>
          </div>
        </div>

        <FieldGroup
          label="Número de control"
          error={errors.numeroControl}
          htmlFor="numeroControl"
        >
          <Input
            id="numeroControl"
            inputMode="numeric"
            placeholder="Ej: 20210001"
            value={form.numeroControl}
            onChange={(e) => updateField("numeroControl", e.target.value)}
            aria-invalid={!!errors.numeroControl}
          />
        </FieldGroup>

        <FieldGroup label="Nombre(s)" error={errors.nombre} htmlFor="nombre">
          <Input
            id="nombre"
            placeholder="Ej: Juan Carlos"
            value={form.nombre}
            onChange={(e) => updateField("nombre", e.target.value)}
            aria-invalid={!!errors.nombre}
          />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup
            label="Apellido paterno"
            error={errors.apellidoPaterno}
            htmlFor="apellidoPaterno"
          >
            <Input
              id="apellidoPaterno"
              placeholder="Pérez"
              value={form.apellidoPaterno}
              onChange={(e) => updateField("apellidoPaterno", e.target.value)}
              aria-invalid={!!errors.apellidoPaterno}
            />
          </FieldGroup>
          <FieldGroup
            label="Apellido materno"
            error={errors.apellidoMaterno}
            htmlFor="apellidoMaterno"
          >
            <Input
              id="apellidoMaterno"
              placeholder="García"
              value={form.apellidoMaterno}
              onChange={(e) => updateField("apellidoMaterno", e.target.value)}
              aria-invalid={!!errors.apellidoMaterno}
            />
          </FieldGroup>
        </div>

        <FieldGroup label="Sexo" error={errors.sexo} htmlFor="sexo">
          <Select
            value={form.sexo}
            onValueChange={(v) => updateField("sexo", v)}
          >
            <SelectTrigger id="sexo" aria-invalid={!!errors.sexo}>
              <SelectValue placeholder="Seleccionar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="M">Masculino</SelectItem>
              <SelectItem value="F">Femenino</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="Carrera" error={errors.carrera} htmlFor="carrera">
          <Select
            value={form.carrera}
            onValueChange={(v) => updateField("carrera", v)}
          >
            <SelectTrigger id="carrera" aria-invalid={!!errors.carrera}>
              <SelectValue placeholder="Selecciona tu carrera" />
            </SelectTrigger>
            <SelectContent>
              {CARRERAS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup
          label="Semestre"
          error={errors.semestre}
          htmlFor="semestre"
        >
          <Select
            value={form.semestre}
            onValueChange={(v) => updateField("semestre", v)}
          >
            <SelectTrigger id="semestre" aria-invalid={!!errors.semestre}>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {SEMESTRES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}° semestre
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldGroup>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary p-4 text-lg font-bold text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            "REGISTRARME"
          )}
        </button>
      </form>
    </PageWrapper>
  );
}

function FieldGroup({
  label,
  error,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
