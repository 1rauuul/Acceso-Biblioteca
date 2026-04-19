"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getStudent, getCurrentSession, syncWithServer } from "@/lib/idb";

export default function Home() {
  const router = useRouter();
  const [, setReady] = useState(false);

  useEffect(() => {
    async function route() {
      try {
        const student = await getStudent();
        if (!student) {
          router.replace("/registro");
          return;
        }

        const session = await getCurrentSession();
        if (session) {
          router.replace("/salida");
        } else {
          router.replace("/entrada");
        }

        // Try to sync in the background
        if (navigator.onLine) {
          syncWithServer().catch(() => {});
        }
      } catch {
        router.replace("/registro");
      }
      setReady(true);
    }
    route();
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      <Loader2
        className="size-10 animate-spin text-primary"
        aria-label="Cargando"
      />
    </div>
  );
}
