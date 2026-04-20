"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageWrapper } from "@/components/page-wrapper";
import { LibraryHeader } from "@/components/library-header";
import { MassiveButton } from "@/components/massive-button";
import {
  getStudent,
  getCurrentSession,
  createExit,
  shouldShowSurvey,
  syncWithServer,
} from "@/lib/idb";
import { LIBRARY_CLOSE_HOUR } from "@/lib/constants";

function useElapsedTime(entryIso: string | null) {
  const [elapsed, setElapsed] = useState("");
  const [entryDisplay, setEntryDisplay] = useState("");

  useEffect(() => {
    if (!entryIso) return;

    const entryDate = new Date(entryIso);
    setEntryDisplay(
      entryDate.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      })
    );

    function calculate() {
      const diff = Math.floor((Date.now() - entryDate.getTime()) / 60000);
      const hours = Math.floor(diff / 60);
      const minutes = diff % 60;
      setElapsed(hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`);
    }

    calculate();
    const interval = setInterval(calculate, 30000);
    return () => clearInterval(interval);
  }, [entryIso]);

  return { elapsed, entryDisplay };
}

export default function SalidaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entryTime, setEntryTime] = useState<string | null>(null);
  const { elapsed, entryDisplay } = useElapsedTime(entryTime);

  useEffect(() => {
    async function init() {
      const student = await getStudent();
      if (!student) {
        router.replace("/registro");
        return;
      }

      const session = await getCurrentSession();
      if (!session) {
        router.replace("/entrada");
        return;
      }
      setEntryTime(session.entryTime);
    }
    init();
  }, [router]);

  const handleSalir = useCallback(async () => {
    setLoading(true);
    try {
      await createExit();

      if (navigator.onLine) {
        try {
          await syncWithServer();
        } catch {
          // If sync fails we continue — the record is safe in IndexedDB
          // and will sync on the next opportunity.
        }
      }

      const showSurvey = await shouldShowSurvey();
      if (showSurvey) {
        router.push("/encuesta");
      } else {
        router.push("/entrada");
      }
    } catch {
      setLoading(false);
    }
  }, [router]);

  return (
    <PageWrapper className="bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-red-950/20">
      <LibraryHeader subtitle="¡Buen trabajo!" />

      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-8">
        {entryTime && (
          <div
            className="flex flex-col items-center gap-1 text-center"
            aria-label={`Dentro desde las ${entryDisplay}, ${elapsed}`}
          >
            <p className="text-lg text-muted-foreground">Dentro desde</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">
              {entryDisplay}
            </p>
            <p className="mt-1 text-3xl font-semibold text-primary">
              <span aria-hidden="true">⏱️</span> {elapsed}
            </p>
          </div>
        )}

        <MassiveButton
          variant="danger"
          icon={<LogOut className="size-20" strokeWidth={1.5} />}
          title="REGISTRAR SALIDA"
          subtitle="Toca para registrar tu salida"
          onClick={handleSalir}
          loading={loading}
        />
      </div>

      <footer className="flex items-center justify-center gap-2 px-6 pb-6">
        <Badge
          variant="outline"
          className="gap-1.5 border-muted-foreground/20 bg-muted px-3 py-1.5 text-xs text-muted-foreground"
        >
          <Clock className="size-3.5" aria-hidden="true" />
          Biblioteca cierra {LIBRARY_CLOSE_HOUR}:00
        </Badge>
      </footer>
    </PageWrapper>
  );
}
