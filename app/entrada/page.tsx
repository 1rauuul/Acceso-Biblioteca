"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  IdCardIcon,
    Lock,
  ArrowRight,
  ScanQrCode,
  Loader2,
  UserCheck,
} from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { LibraryHeader } from "@/components/library-header";
import { Input } from "@/components/ui/input";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import {
  getStudent,
  getCurrentSession,
  createEntry,
  getPendingRecords,
  syncWithServer,
  type StudentData,
} from "@/lib/idb";
import { isWithinServiceHours } from "@/lib/datetime";
import { LIBRARY_OPEN_HOUR, LIBRARY_CLOSE_HOUR } from "@/lib/constants";

export default function EntradaPage() {
  const router = useRouter();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [numeroControl, setNumeroControl] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [loading, setLoading] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showClosedNotice, setShowClosedNotice] = useState(false);

  useEffect(() => {
    async function init() {
      const currentStudent = await getStudent();
      if (!currentStudent) {
        router.replace("/registro");
        return;
      }
      setStudent(currentStudent);
      setNumeroControl(currentStudent.numeroControl);
      setApellidoPaterno(currentStudent.apellidoPaterno);

      const session = await getCurrentSession();
      if (session) {
        router.replace("/salida");
        return;
      }

      const pending = await getPendingRecords();
      setPendingCount(pending.filter((r) => r.exitTime !== null).length);

      if (navigator.onLine) {
        syncWithServer()
          .then(async () => {
            const p = await getPendingRecords();
            setPendingCount(p.filter((r) => r.exitTime !== null).length);
          })
          .catch(() => {});
      }
    }
    init();
  }, [router]);

  // Execute entry and redirect to /salida
  const executeEntry = useCallback(async () => {
    // RN-01: check-ins outside the service window (07:00–18:00 MX) are
    // rejected with a notice; no local record is created.
    if (!isWithinServiceHours()) {
      setShowClosedNotice(true);
      return;
    }
    setLoading(true);
    try {
      await createEntry();

      if (navigator.onLine) {
        try {
          await syncWithServer();
        } catch {
          // Safe in IndexedDB; will sync later
        }
      }

      router.push("/salida");
    } catch {
      setLoading(false);
    }
  }, [router]);

  // Option 1: Manual Button Click
  const handleEntrarManual = useCallback(async () => {
    await executeEntry();
  }, [executeEntry]);

  // Option 2: QR Scanner Success
  const handleQrSuccess = useCallback(async () => {
    setIsScannerOpen(false);
    await executeEntry();
  }, [executeEntry]);

  return (
    <PageWrapper className="bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <LibraryHeader
        subtitle={
          student
            ? `¡Hola ${student.nombre}! Estás listo para estudiar`
            : "Estás listo para estudiar"
        }
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
        <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card/95 p-6 shadow-xl backdrop-blur-sm transition-all sm:p-7">
          {/* Card Header */}
          <div className="mb-6 flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Acceso Estudiante
              </span>
              <h2 className="text-lg font-bold text-foreground">
                {student
                  ? `${student.nombre} ${student.apellidoPaterno}`
                  : "Identificación"}
              </h2>
              {student && (
                <p className="text-xs text-muted-foreground">
                  Semestre {student.semestre} · {student.carrera}
                </p>
              )}
            </div>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
              <UserCheck className="size-5" />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Field 1: NO. CONTROL */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="no-control"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                No. Control
              </label>
              <div className="relative flex items-center">
                <IdCardIcon className="pointer-events-none absolute left-3.5 size-5 text-muted-foreground/70" />
                <Input
                  id="no-control"
                  type="text"
                  value={numeroControl}
                  onChange={(e) => setNumeroControl(e.target.value)}
                  placeholder="Ej: 22360962"
                  className="h-12 rounded-xl bg-muted/50 pl-11 text-base font-semibold tracking-wide text-foreground shadow-xs"
                  readOnly={!!student}
                />
              </div>
            </div>

            {/* Field 2: APELLIDO PATERNO */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="apellido-paterno"
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
              >
                Apellido Paterno
              </label>
              <div className="relative flex items-center">
                <Lock className="pointer-events-none absolute left-3.5 size-5 text-muted-foreground/70" />
                <Input
                  id="apellido-paterno"
                  type="password"
                  value={apellidoPaterno}
                  onChange={(e) => setApellidoPaterno(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 rounded-xl bg-muted/50 pl-11 text-base font-semibold tracking-widest text-foreground shadow-xs"
                  readOnly={!!student}
                />
              </div>
            </div>

            {/* Option 1: Entrar Button */}
            <button
              type="button"
              onClick={handleEntrarManual}
              disabled={loading}
              className="mt-2 flex h-13 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-4 font-bold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 active:scale-95 focus-visible:ring-4 focus-visible:ring-primary/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <span className="text-base">Entrar</span>
                  <ArrowRight className="size-5" />
                </>
              )}
            </button>

            {/* Option 2: Escanear QR Button */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              disabled={loading}
              className="flex h-13 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border border-border bg-muted/50 px-4 font-semibold text-foreground shadow-xs transition-all duration-200 hover:bg-muted active:scale-95 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
            >
              <ScanQrCode className="size-5 text-primary" />
              <span className="text-base">Escanear QR</span>
            </button>

          </div>
        </div>
      </div>

      {pendingCount > 0 && (
        <footer className="flex items-center justify-center px-6 pb-6">
          <p
            className="text-sm font-medium text-warning"
            aria-live="polite"
          >
            Registros pendientes: {pendingCount}
          </p>
        </footer>
      )}

      {/* QR Scanner Camera Modal */}
      <QrScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleQrSuccess}
      />

      {/* RN-01: outside service hours notice */}
      {showClosedNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="closed-notice-title"
          onClick={() => setShowClosedNotice(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-border/80 bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="closed-notice-title"
              className="text-lg font-bold text-foreground"
            >
              No está en horario de atención
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              La biblioteca abre de {LIBRARY_OPEN_HOUR}:00 a {LIBRARY_CLOSE_HOUR}:00.
              Intenta de nuevo dentro de ese horario.
            </p>
            <button
              type="button"
              onClick={() => setShowClosedNotice(false)}
              className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
