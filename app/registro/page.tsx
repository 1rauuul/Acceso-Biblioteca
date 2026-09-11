"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Loader2, Shield, CreditCard, Lock } from "lucide-react";
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
import {
  getDeviceId,
  restoreActiveSession,
  saveStudent,
  syncWithServer,
} from "@/lib/idb";
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

interface StudentFormData {
  numeroControl: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  sexo: string;
  carrera: string;
  semestre: string;
}

function validate(form: Record<string, string>): FormErrors {
  const errors: FormErrors = {};
  if (!form.numeroControl?.trim()) {
    errors.numeroControl = "El número de control es obligatorio";
  } else if (!/^\d{8}$/.test(form.numeroControl.trim())) {
    errors.numeroControl = "Debe tener exactamente 8 dígitos numéricos";
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
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [duplicateNotice, setDuplicateNotice] = useState(false);
  const [loginForm, setLoginForm] = useState({
    numeroControl: "",
    apellidoPaterno: "",
  });
  const [form, setForm] = useState<StudentFormData>({
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

  const switchMode = (nextMode: "register" | "login") => {
    setMode(nextMode);
    setLoginError("");
    setDuplicateNotice(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form as unknown as Record<string, string>);
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
        const result = await syncWithServer();
        if (result.studentExists) {
          setDuplicateNotice(true);
          setMode("login");
          setLoginForm({
            numeroControl: form.numeroControl.trim(),
            apellidoPaterno: form.apellidoPaterno.trim(),
          });
          setLoading(false);
          return;
        }
      } catch {
        // Offline — will sync later
      }

      router.push("/entrada");
    } catch {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeroControl = loginForm.numeroControl.trim();
    const apellidoPaterno = loginForm.apellidoPaterno.trim();
    if (!/^\d{8}$/.test(numeroControl)) {
      setLoginError("El número de control debe tener exactamente 8 dígitos numéricos");
      return;
    }
    if (!apellidoPaterno) {
      setLoginError("El apellido paterno es obligatorio");
      return;
    }

    setLoading(true);
    setLoginError("");
    try {
      const response = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numeroControl,
          apellidoPaterno,
          deviceId: getDeviceId(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión");

      await saveStudent(result.student);
      if (result.activeSession) await restoreActiveSession(result.activeSession);
      router.push(result.activeSession ? "/salida" : "/entrada");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "No se pudo iniciar sesión");
      setLoading(false);
    }
  };

  return (
    <PageWrapper className="bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <div className="px-6 pt-4">
        <div className="flex justify-end">
          <button
            type="button"
            aria-label="Acceso administrador"
            onClick={() => router.push("/admin/login")}
            className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-border/70 bg-background/80 p-2 text-muted-foreground shadow-sm transition-colors hover:bg-background hover:text-foreground focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none"
          >
            <Shield className="size-5" strokeWidth={1.7} />
          </button>
        </div>
      </div>
      <LibraryHeader subtitle={mode === "register" ? "Registro de estudiante" : "Acceso de estudiante"} />

      <div className="mx-6 mt-5 grid grid-cols-2 rounded-xl bg-background/70 p-1 shadow-sm">
        <button
          type="button"
          onClick={() => switchMode("register")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "register" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Registrarme
        </button>
        <button
          type="button"
          onClick={() => switchMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === "login" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"}`}
        >
          Ya estoy registrado
        </button>
      </div>

      {mode === "register" ? (
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5 px-6 py-6">
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
            placeholder="Ej: 22360962"
            value={form.numeroControl}
            maxLength={8}
            onChange={(e) =>
              updateField(
                "numeroControl",
                e.target.value.replace(/\D/g, "").slice(0, 8)
              )
            }
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
          <Select value={form.sexo} onValueChange={(v) => updateField("sexo", v)}>
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

        <FieldGroup label="Semestre" error={errors.semestre} htmlFor="semestre">
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
          {loading ? <Loader2 className="size-5 animate-spin" /> : "REGISTRARME"}
        </button>
      </form>
      ) : (
        <form onSubmit={handleLogin} className="flex flex-1 flex-col gap-5 px-6 py-6">
          <div className="flex items-center gap-3 rounded-2xl bg-primary/5 p-4">
            <Lock className="size-8 shrink-0 text-primary" strokeWidth={1.5} />
            <div>
              <p className="font-semibold text-foreground">Bienvenido de nuevo</p>
              <p className="text-sm text-muted-foreground">Recupera tu perfil en este dispositivo</p>
            </div>
          </div>

          {duplicateNotice && (
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-foreground" role="alert">
              Este número de control ya está registrado. Inicia sesión para continuar.
            </div>
          )}

          <FieldGroup label="Número de control" error={loginError} htmlFor="loginNumeroControl">
            <div className="relative flex items-center">
              <CreditCard className="pointer-events-none absolute left-3 size-5 text-muted-foreground" />
              <Input
                id="loginNumeroControl"
                inputMode="numeric"
                className="pl-10"
                placeholder="Ej: 22360962"
                value={loginForm.numeroControl}
                maxLength={8}
                onChange={(e) => {
                  setLoginForm((prev) => ({ ...prev, numeroControl: e.target.value.replace(/\D/g, "").slice(0, 8) }));
                  setLoginError("");
                }}
              />
            </div>
          </FieldGroup>

          <FieldGroup label="Apellido paterno" error={undefined} htmlFor="loginApellidoPaterno">
            <div className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 size-5 text-muted-foreground" />
              <Input
                id="loginApellidoPaterno"
                type="password"
                className="pl-10"
                placeholder="Pérez"
                value={loginForm.apellidoPaterno}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, apellidoPaterno: e.target.value }))}
              />
            </div>
          </FieldGroup>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary p-4 text-lg font-bold text-primary-foreground shadow-lg transition-all duration-300 hover:bg-primary/90 active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-5 animate-spin" /> : "INICIAR SESIÓN"}
          </button>
        </form>
      )}
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
