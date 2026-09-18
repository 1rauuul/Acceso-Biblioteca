"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { sessionDeadlineUtc } from "@/lib/datetime";

function useElapsedTime(entryIso: string | null) {
  // `now` only advances via the interval tick below; `elapsed` and
  // `entryDisplay` are derived from it instead of being extra state, so no
  // setState runs synchronously inside the effect.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!entryIso) return;
    const interval = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(interval);
  }, [entryIso]);

  const entryDisplay = useMemo(() => {
    if (!entryIso) return "";
    return new Date(entryIso).toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Mexico_City",
    });
  }, [entryIso]);

  const elapsed = useMemo(() => {
    if (!entryIso) return "";
    const diff = Math.floor((now - new Date(entryIso).getTime()) / 60000);
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return hours > 0 ? `${hours}h ${minutes} min` : `${minutes} min`;
  }, [entryIso, now]);

  return { elapsed, entryDisplay };
}

export default function SalidaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entryTime, setEntryTime] = useState<string | null>(null);
  const { elapsed, entryDisplay } = useElapsedTime(entryTime);

  useEffect(() => {
    let cancelled = false;

    // Reconcile the local session against the server (and the wall clock)
    // so we detect cron-driven auto-closes, enforce the 3h max session
    // (RN-03) and the end-of-day close (RN-02), and push the PWA off this
    // page once the session must end.
    async function reconcile(): Promise<boolean> {
      const student = await getStudent();
      if (!student) {
        if (!cancelled) router.replace("/registro");
        return true;
      }

      const now = new Date();

      // If the session is at/past its deadline, try to pull the server's
      // state first (the cron may have already closed this session).
      const session = await getCurrentSession();
      const deadline = session
        ? sessionDeadlineUtc(session.entryTime, now)
        : null;
      if (deadline && now >= deadline && navigator.onLine) {
        try {
          await syncWithServer();
        } catch {
          // Offline or server error: fall through to the local fallback.
        }
      }

      const freshSession = await getCurrentSession();
      if (!freshSession) {
        if (!cancelled) router.replace("/entrada");
        return true;
      }

      // Local fallback: if the session hit its deadline — the 3h cap (RN-03)
      // or today's 18:00 close (RN-02), whichever comes first — and it is
      // still open locally (cron didn't run, device was offline, etc.),
      // close it locally so the UI stops claiming the student is inside.
      // We seal `exitTime` with the deadline, not "now", so the local row
      // matches the value the server-side cron will (or did) use. This
      // keeps local and server consistent even when the device eventually
      // comes online and the server's auto-close decision supersedes the
      // client's `createExit()` push.
      const freshDeadline = sessionDeadlineUtc(freshSession.entryTime, now);
      if (now >= freshDeadline) {
        await createExit({ exitTime: freshDeadline.toISOString() });
        if (!cancelled) router.replace("/entrada");
        return true;
      }

      if (!cancelled) setEntryTime(freshSession.entryTime);
      return false;
    }

    reconcile();
    const interval = setInterval(() => {
      reconcile();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  const handleSalir = useCallback(async () => {
    setLoading(true);
    try {
      const closedSession = await createExit();

      // A session under 9 minutes is discarded locally by createExit().
      // Treat that as a normal flow and do not sync or open a survey for it.
      if (!closedSession) {
        router.push("/entrada");
        return;
      }

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
            aria-label={`Entas dentro desde ${entryDisplay}, ${elapsed}`}
          >
            <p className="text-lg text-muted-foreground">Dentro desde</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">
              {entryDisplay}
            </p>
            <p className="mt-1 text-3xl font-semibold text-primary">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-6" aria-hidden="true" />
                {elapsed}
              </span>
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
          El Centro de Información cierra a las {LIBRARY_CLOSE_HOUR}:00
        </Badge>
      </footer>
    </PageWrapper>
  );
}
