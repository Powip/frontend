"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cameraErrorMessage, startCameraScanner, type ScannerControls } from "@/lib/barcodeScanner";

// FEAT-24 H6-D (H6-D2) — la cámara del celular como escáner. Queda abierta para
// leer seguido (cada código distinto, o el mismo pasada una pausa) hasta que
// se cierra.

interface Props {
  onCode: (code: string) => void;
  onClose: () => void;
}

export default function CameraScanner({ onCode, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let controls: ScannerControls | null = null;
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;
    startCameraScanner(video, (code) => onCodeRef.current(code))
      .then((started) => {
        if (cancelled) started.stop();
        else controls = started;
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(cameraErrorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setStarting(false);
      });
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="space-y-2 rounded-lg border bg-black/90 p-2" data-testid="camera-scanner">
      <div className="relative overflow-hidden rounded-md">
        <video ref={videoRef} className="aspect-[4/3] w-full bg-black object-cover" muted playsInline aria-label="Vista de la cámara" />
        {/* Guía para apuntar: una franja horizontal en el centro. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-6 top-1/2 h-16 -translate-y-1/2 rounded-md border-2 border-white/80" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-red-200">
          {error}
        </p>
      ) : (
        <p className="text-xs text-white/80">{starting ? "Abriendo la cámara…" : "Apunta al código de barras."}</p>
      )}
      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={onClose}>
        <X className="mr-1 h-4 w-4" aria-hidden="true" />
        Cerrar cámara
      </Button>
    </div>
  );
}
