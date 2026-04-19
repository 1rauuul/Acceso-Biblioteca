"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Download, Printer, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QrPage() {
  const [url, setUrl] = useState("");
  const [rendered, setRendered] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !url) {
      setUrl(window.location.origin);
    }
  }, [url]);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 420,
      color: { dark: "#1e40af", light: "#ffffff" },
    })
      .then(() => setRendered(url))
      .catch((err) => console.error("QR render error:", err));
  }, [url]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "biblioteca-pwa-qr.png";
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
              QR de instalación
            </h2>
            <p className="text-sm text-muted-foreground">
              Imprime este código y colócalo en la entrada de la biblioteca
            </p>
          </div>
        </div>

        <div className="no-print flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qr-url">URL de la PWA</Label>
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
              El QR apuntará a {rendered || "…"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
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

        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-white p-8 text-center shadow-sm print:border-0 print:shadow-none">
          <h3 className="text-2xl font-bold text-slate-900">
            Biblioteca Escolar
          </h3>
          <p className="max-w-md text-sm text-slate-600">
            Escanea con la cámara de tu celular para instalar la app y registrar
            tus entradas y salidas.
          </p>
          <canvas
            ref={canvasRef}
            className="rounded-lg border border-slate-200"
          />
          <p className="break-all text-xs text-slate-500">{rendered}</p>
        </div>
      </div>
    </>
  );
}
