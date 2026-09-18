"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "install-prompt-dismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [iosGuide, setIosGuide] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setIosGuide(false);
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };

    const onAppInstalled = () => {
      localStorage.setItem(DISMISS_KEY, "1");
      setOpen(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    const isIos =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // iOS Safari never fires beforeinstallprompt: fall back to manual
    // instructions. The delay lets Chromium browsers emit theirs first.
    const timer = window.setTimeout(() => {
      if (!cancelled && isIos) {
        setDeferred(null);
        setIosGuide(true);
        setOpen(true);
      }
    }, 2000);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
    setDeferred(null);
    setIosGuide(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
      setOpen(false);
    } else {
      dismiss();
    }
    setDeferred(null);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Instalar aplicación"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md animate-fade-slide-up rounded-2xl border border-border bg-card p-4 shadow-2xl"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="absolute top-3 right-3 cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-4" />
      </button>

      <div className="flex items-center gap-3 pr-6">
        <Image
          src="/logo-itt.png"
          alt=""
          width={44}
          height={44}
          className="size-11 rounded-xl object-contain"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Instala la app
          </p>
          <p className="text-xs text-muted-foreground">
            {iosGuide
              ? "En Safari, toca Compartir y luego «Agregar a inicio» para tenerla en tu teléfono."
              : "Accede al Centro de Información con un toque desde tu pantalla de inicio."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        {deferred && !iosGuide ? (
          <>
            <button
              type="button"
              onClick={install}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="size-4" />
              Instalar
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="cursor-pointer rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Ahora no
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Entendido
          </button>
        )}
      </div>
    </div>
  );
}
