"use client";

import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface LibraryHeaderProps {
  subtitle?: string;
}

export function LibraryHeader({ subtitle }: LibraryHeaderProps) {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <header className="relative flex flex-col items-center gap-2 px-4 pt-6 pb-2">
      <Badge
        variant="outline"
        className={`absolute top-4 right-4 animate-pulse-slow gap-1.5 border-0 px-2.5 py-1 text-xs font-medium ${
          isOnline
            ? "bg-success/10 text-success"
            : "bg-warning/10 text-warning"
        }`}
        aria-live="polite"
      >
        <span aria-hidden="true">{isOnline ? "📡" : "🌐"}</span>
        {isOnline ? "Conectado" : "Offline"}
      </Badge>

      <div
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10"
        aria-hidden="true"
      >
        <BookOpen className="size-9 text-primary" strokeWidth={1.5} />
      </div>

      <h1 className="text-center text-4xl font-bold tracking-tight text-foreground">
        Biblioteca Escuela
      </h1>

      {subtitle && (
        <p className="text-center text-lg text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}
