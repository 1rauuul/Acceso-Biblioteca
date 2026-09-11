"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import {
  X,
  Camera,
  Zap,
  ZapOff,
  SwitchCamera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { isValidLibraryQr } from "@/lib/qr";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

interface BarcodeDetectorInterface {
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): BarcodeDetectorInterface;
      getSupportedFormats?(): Promise<string[]>;
    };
  }
}

export function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: QrScannerModalProps) {
  if (!isOpen) return null;

  return <QrScannerView onClose={onClose} onScanSuccess={onScanSuccess} />;
}

interface QrScannerViewProps {
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

function QrScannerView({ onClose, onScanSuccess }: QrScannerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isProcessingRef = useRef<boolean>(false);

  const [loadingCamera, setLoadingCamera] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [invalidBanner, setInvalidBanner] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Stop all media tracks safely
  const stopTracks = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Handle successful code detection
  const handleCodeFound = useCallback(
    (codeText: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      if (isValidLibraryQr(codeText)) {
        // Haptic feedback if available
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([80, 40, 80]);
          } catch {
            // ignore
          }
        }

        setSuccessCode(codeText);
        stopTracks();

        // Brief delay for visual confirmation before navigating
        setTimeout(() => {
          onScanSuccess(codeText);
        }, 600);
      } else {
        setInvalidBanner("Código QR no válido. Escanea el código oficial.");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(200);
          } catch {
            // ignore
          }
        }

        // Resume scanning after 1.8 seconds
        setTimeout(() => {
          setInvalidBanner(null);
          isProcessingRef.current = false;
        }, 1800);
      }
    },
    [onScanSuccess, stopTracks]
  );

  // Start video stream & scanner loop on mount or camera switch
  useEffect(() => {
    let active = true;

    async function startCamera() {
      stopTracks();

      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        if (active) {
          setCameraError(
            "Tu navegador no soporta el acceso a la cámara. Usa la opción manual."
          );
          setLoadingCamera(false);
        }
        return;
      }

      try {
        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((d) => d.kind === "videoinput");
            if (active) {
              setHasMultipleCameras(videoInputs.length > 1);
            }
          } catch {
            // ignore
          }
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // Check if track supports torch
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (
            track.getCapabilities ? track.getCapabilities() : {}
          ) as { torch?: boolean };
          setTorchAvailable(!!capabilities.torch);
          setTorchOn(false);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          await videoRef.current.play();
        }

        if (active) {
          setLoadingCamera(false);
          startScanLoop();
        }
      } catch (err: unknown) {
        if (!active) return;
        setLoadingCamera(false);
        const error = err as Error;
        if (
          error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError"
        ) {
          setCameraError(
            "Acceso a la cámara denegado. Concede permisos a la aplicación o usa la entrada manual."
          );
        } else if (
          error.name === "NotFoundError" ||
          error.name === "DevicesNotFoundError"
        ) {
          setCameraError("No se encontró ninguna cámara en este dispositivo.");
        } else {
          setCameraError(
            "No se pudo iniciar la cámara. Por favor intenta de nuevo o usa la entrada manual."
          );
        }
      }
    }

    function startScanLoop() {
      let barcodeDetector: BarcodeDetectorInterface | null = null;
      if (typeof window !== "undefined" && window.BarcodeDetector) {
        try {
          barcodeDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
        } catch {
          barcodeDetector = null;
        }
      }

      async function scanFrame() {
        if (!active || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        if (
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          if (!isProcessingRef.current) {
            // Try native BarcodeDetector first
            if (barcodeDetector) {
              try {
                const barcodes = await barcodeDetector.detect(video);
                if (barcodes.length > 0 && barcodes[0].rawValue) {
                  handleCodeFound(barcodes[0].rawValue);
                  return;
                }
              } catch {
                // Fall back to jsQR
              }
            }

            // jsQR fallback
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

              const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height
              );
              const qrResult = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                { inversionAttempts: "dontInvert" }
              );

              if (qrResult && qrResult.data) {
                handleCodeFound(qrResult.data);
                return;
              }
            }
          }
        }

        if (active) {
          animFrameIdRef.current = requestAnimationFrame(scanFrame);
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    }

    startCamera();

    return () => {
      active = false;
      stopTracks();
    };
  }, [facingMode, handleCodeFound, stopTracks]);

  // Toggle torch / flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const targetState = !torchOn;
      await (
        track as MediaStreamTrack & {
          applyConstraints: (c: unknown) => Promise<void>;
        }
      ).applyConstraints({
        advanced: [{ torch: targetState }],
      });
      setTorchOn(targetState);
    } catch {
      // ignore
    }
  }, [torchOn]);

  // Flip camera
  const toggleCameraFacing = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escáner de código QR"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/95 text-white animate-fade-in"
    >
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Top action bar */}
      <header className="relative z-10 flex w-full max-w-md items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
            <Camera className="size-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">
              Escanear código QR
            </h2>
            <p className="text-xs text-white/70">
              Apunta al código en la entrada
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar escáner"
          className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all hover:bg-white/20 active:scale-95"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* Viewfinder area */}
      <div className="relative flex size-full max-w-md flex-1 items-center justify-center overflow-hidden px-4">
        {/* Live video feed */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 size-full object-cover"
        />

        {/* Shading overlay around the reticle */}
        <div className="pointer-events-none absolute inset-0 bg-black/40" />

        {/* Loading indicator */}
        {loadingCamera && (
          <div className="relative z-20 flex flex-col items-center gap-3 rounded-2xl bg-black/60 p-6 text-center backdrop-blur">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-white">Iniciando cámara...</p>
          </div>
        )}

        {/* Camera error state */}
        {cameraError && (
          <div className="relative z-20 mx-4 flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-slate-900/90 p-6 text-center backdrop-blur">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/20 text-destructive">
              <AlertTriangle className="size-6" />
            </div>
            <p className="text-sm text-slate-200">{cameraError}</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Usar entrada manual
            </button>
          </div>
        )}

        {/* Scanner reticle box */}
        {!cameraError && !loadingCamera && (
          <div className="relative z-10 flex size-64 items-center justify-center sm:size-72">
            {/* Cutout / clear area */}
            <div
              className={`relative size-full rounded-3xl border-2 transition-colors duration-300 ${
                successCode
                  ? "border-emerald-400 bg-emerald-500/20 shadow-[0_0_30px_rgba(52,211,153,0.6)]"
                  : invalidBanner
                    ? "border-destructive bg-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.6)]"
                    : "border-white/80 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
              }`}
            >
              {/* Corner brackets */}
              <span className="absolute -top-1 -left-1 size-6 rounded-tl-xl border-t-4 border-l-4 border-primary" />
              <span className="absolute -top-1 -right-1 size-6 rounded-tr-xl border-t-4 border-r-4 border-primary" />
              <span className="absolute -bottom-1 -left-1 size-6 rounded-bl-xl border-b-4 border-l-4 border-primary" />
              <span className="absolute -bottom-1 -right-1 size-6 rounded-br-xl border-b-4 border-r-4 border-primary" />

              {/* Animated laser line */}
              {!successCode && !invalidBanner && (
                <div className="absolute inset-x-3 h-0.5 animate-scan-beam rounded-full bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_8px_hsl(var(--primary))]" />
              )}

              {/* Success confirmation */}
              {successCode && (
                <div className="flex size-full flex-col items-center justify-center gap-2 text-center animate-fade-in">
                  <CheckCircle2 className="size-16 text-emerald-400 drop-shadow-md" />
                  <p className="text-sm font-bold text-emerald-300">
                    ¡Código verificado!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom notifications & controls */}
      <footer className="relative z-10 flex w-full max-w-md flex-col items-center gap-4 px-6 pb-8 pt-2">
        {/* Invalid banner message */}
        {invalidBanner && (
          <div
            role="alert"
            className="flex w-full items-center gap-2 rounded-xl bg-destructive/90 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-lg backdrop-blur animate-fade-in"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <p className="flex-1">{invalidBanner}</p>
          </div>
        )}

        {/* Camera controls (Torch & Switch) */}
        <div className="flex items-center gap-4">
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label={torchOn ? "Apagar linterna" : "Encender linterna"}
              className={`flex size-12 items-center justify-center rounded-full transition-all ${
                torchOn
                  ? "bg-amber-400 text-slate-900 shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              {torchOn ? (
                <ZapOff className="size-5" />
              ) : (
                <Zap className="size-5" />
              )}
            </button>
          )}

          {hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleCameraFacing}
              aria-label="Cambiar cámara"
              className="flex size-12 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/25 active:scale-95"
            >
              <SwitchCamera className="size-5" />
            </button>
          )}
        </div>

        {/* Instructions and fallback button */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-white/70">
            Centra el código QR dentro del recuadro para registrar tu entrada
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-white/90 underline-offset-4 hover:underline"
          >
            Cancelar y entrar manualmente
          </button>
        </div>
      </footer>
    </div>
  );
}
