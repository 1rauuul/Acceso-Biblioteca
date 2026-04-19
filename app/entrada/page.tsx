"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightCircle } from "lucide-react";
import { PageWrapper } from "@/components/page-wrapper";
import { LibraryHeader } from "@/components/library-header";
import { MassiveButton } from "@/components/massive-button";
import {
  getStudent,
  getCurrentSession,
  createEntry,
  getPendingRecords,
  syncWithServer,
} from "@/lib/idb";

export default function EntradaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [studentName, setStudentName] = useState("");

  useEffect(() => {
    async function init() {
      const student = await getStudent();
      if (!student) {
        router.replace("/registro");
        return;
      }
      setStudentName(student.nombre);

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

  const handleEntrar = useCallback(async () => {
    setLoading(true);
    try {
      await createEntry();

      if (navigator.onLine) {
        try {
          await syncWithServer();
        } catch {
          // Record is safe in IndexedDB; will sync later.
        }
      }

      router.push("/salida");
    } catch {
      setLoading(false);
    }
  }, [router]);

  return (
    <PageWrapper className="bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <LibraryHeader
        subtitle={
          studentName
            ? `¡Hola ${studentName}! Estás listo para estudiar`
            : "Estás listo para estudiar"
        }
      />

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
        <MassiveButton
          variant="success"
          icon={<ArrowRightCircle className="size-20" strokeWidth={1.5} />}
          title="ENTRAR A LA BIBLIOTECA"
          subtitle="Toca para registrar tu entrada"
          onClick={handleEntrar}
          loading={loading}
        />
      </div>

      <footer className="px-6 pb-6 text-center">
        <p
          className={`text-sm font-medium ${
            pendingCount > 0 ? "text-warning" : "text-muted-foreground"
          }`}
          aria-live="polite"
        >
          Registros pendientes: {pendingCount}
        </p>
      </footer>
    </PageWrapper>
  );
}
