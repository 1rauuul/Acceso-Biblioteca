"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Printer, RefreshCw, KeyRound, Smartphone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIBRARY_QR_ACCESS_TOKEN } from "@/lib/constants";

type QrType = "access" | "install";

export default function QrPage() {
  const [qrType, setQrType] = useState<QrType>("access");
  const [url, setUrl] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );
  const [rendered, setRendered] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Compute the payload based on selected QR type
  const targetPayload =
    qrType === "access"
      ? (url ? `${url}/entrada?action=entry&token=${LIBRARY_QR_ACCESS_TOKEN}` : LIBRARY_QR_ACCESS_TOKEN)
      : url;

  useEffect(() => {
    if (!targetPayload || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, targetPayload, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 420,
      color: { dark: "#1e40af", light: "#ffffff" },
    })
      .then(() => setRendered(targetPayload))
      .catch((err) => console.error("QR render error:", err));
  }, [targetPayload]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download =
      qrType === "access"
        ? "biblioteca-qr-registro-entrada.png"
        : "biblioteca-pwa-qr-instalacion.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const resetToCurrent = () => {
    if (typeof window !== "undefined") {
      setUrl(window.location.origin);
    }
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          aside,
          header,
          .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            overflow: visible !important;
          }
          body,
          html {
            background: white !important;
          }
        }
      `}</style>

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="no-print flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
            <QrCode className="size-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Generador de códigos QR
            </h2>
            <p className="text-sm text-muted-foreground">
              Genera e imprime el código oficial para la entrada de la biblioteca
            </p>
          </div>
        </div>

        {/* Configuration Card */}
        <div className="no-print flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          {/* QR Type Selector */}
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de Código QR</Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setQrType("access")}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  qrType === "access"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Registro de Entrada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para escanear con la cámara y registrar acceso
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setQrType("install")}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  qrType === "install"
                    ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Smartphone className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Instalación PWA
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Para instalar la app por primera vez
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Base URL Input */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-url">URL base de la biblioteca</Label>
            <div className="flex gap-2">
              <Input
                id="qr-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://biblioteca.ejemplo.com"
              />
              <button
                type="button"
                onClick={resetToCurrent}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                title="Usar URL actual"
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Contenido codificado: <span className="font-mono">{rendered || "…"}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Download className="size-4" />
              Descargar PNG
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
            >
              <Printer className="size-4" />
              Imprimir
            </button>
          </div>
        </div>

        {/* Printable Card */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-white p-8 text-center shadow-sm print:border-0 print:shadow-none">
          <h3 className="text-2xl font-bold text-slate-900">
            Centro de Información
          </h3>
          <p className="max-w-md text-sm text-slate-600">
            {qrType === "access"
              ? "Abre tu aplicación de la biblioteca y toca «Escanear QR» para registrar tu entrada automáticamente."
              : "Escanea con la cámara de tu celular para instalar la app y registrar tus entradas y salidas."}
          </p>
          <canvas
            ref={canvasRef}
            className="rounded-lg border border-slate-200"
          />
          <p className="break-all font-mono text-xs text-slate-500">{rendered}</p>
        </div>
      </div>
    </>
  );
}
