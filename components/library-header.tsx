"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";

interface LibraryHeaderProps {
  subtitle?: string;
}

export function LibraryHeader({ subtitle }: LibraryHeaderProps) {
  const isOnline = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    () => navigator.onLine,
    () => true
  );

  return (
    <header className="relative flex flex-col items-center gap-2 px-4 pt-6 pb-2">
      <span
        role="status"
        aria-live="polite"
        title={isOnline ? "Conectado" : "Offline"}
        className={`absolute top-4 right-4 size-2.5 rounded-full ${
          isOnline ? "bg-success" : "bg-warning"
        }`}
      >
        <span className="sr-only">{isOnline ? "Conectado" : "Offline"}</span>
      </span>

      <div
        className="flex size-16 items-center justify-center rounded-2xl bg-primary/10"
        aria-hidden="true"
      >
        <Image
          src="/logo-itt.png"
          alt=""
          width={64}
          height={64}
          className="size-16 rounded-2xl object-contain"
        />
      </div>

      <h1 className="text-center text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        <span className="block">Tecnológico Nacional de México</span>
        <span className="block">Instituto Tecnológico de Tehuacán</span>
        <span className="block">Centro de Información</span>
      </h1>

      {subtitle && (
        <p className="text-center text-lg text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}
