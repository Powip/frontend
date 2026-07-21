"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";
import { NotFoundException, type Exception, type Result } from "@zxing/library";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CameraScannerProps {
  /** Solo se enciende la cámara mientras esto es true (drawer abierto + modo cámara elegido). */
  active: boolean;
  onDecode: (code: string) => void;
  /** Igual al `busy` del padre: ignora nuevas lecturas mientras hay una acción en curso. */
  disabled?: boolean;
}

type Status = "starting" | "running" | "error";

const COOLDOWN_MS = 1500;

function classifyStartError(name: string | undefined): string {
  switch (name) {
    case "NotAllowedError":
      return "Permiso de cámara denegado. Habilítalo en la configuración del navegador.";
    case "NotFoundError":
      return "No se encontró una cámara en este dispositivo.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación.";
    default:
      return "No se pudo iniciar la cámara. Intenta de nuevo.";
  }
}

export default function CameraScanner({
  active,
  onDecode,
  disabled = false,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  const onDecodeRef = useRef(onDecode);
  const disabledRef = useRef(disabled);
  // Serializa arranque/parada: todas las sesiones (incluida la doble
  // invocación de efectos que React hace en desarrollo) se encadenan sobre
  // esta promesa para que nunca haya dos decodeFromConstraints en curso a
  // la vez sobre el mismo <video> — si se solapan, la sesión vieja puede
  // limpiar el srcObject de la nueva justo después de que esta arrancó.
  const sessionRef = useRef<Promise<void>>(Promise.resolve());

  const [status, setStatus] = useState<Status>("starting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  // Único efecto de arranque/parada: cubre cierre del drawer, cambio a modo
  // manual y unmount, porque las 3 situaciones colapsan en que `active`
  // pasa a false (el padre deriva `active` de open && inputMethod==="camara").
  useEffect(() => {
    let cancelled = false;
    let sessionControls: IScannerControls | null = null;

    const onResult = (result: Result | undefined, err: Exception | undefined) => {
      if (cancelled || disabledRef.current) return;

      if (result) {
        const text = result.getText();
        const now = Date.now();
        const last = lastCodeRef.current;
        if (last && last.code === text && now - last.at < COOLDOWN_MS) {
          return; // mismo código todavía en cuadro, evita disparos repetidos
        }
        lastCodeRef.current = { code: text, at: now };
        setPulse(true);
        setTimeout(() => setPulse(false), 400);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(80);
        }
        onDecodeRef.current(text);
        return;
      }

      // NotFoundException se dispara en casi todos los frames ("nada en
      // cuadro todavía") — es el comportamiento normal, no un error real.
      if (err && !(err instanceof NotFoundException)) {
        setStatus("error");
        setErrorMessage("No se pudo leer el código. Intenta de nuevo.");
      }
    };

    const start = async (constraints: MediaStreamConstraints) => {
      const reader = readerRef.current ?? new BrowserMultiFormatReader();
      readerRef.current = reader;
      try {
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current ?? undefined,
          onResult,
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        sessionControls = controls;
        controlsRef.current = controls;
        setStatus("running");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string } | undefined)?.name;
        const hasFacingMode =
          typeof constraints.video === "object" &&
          constraints.video !== null &&
          "facingMode" in constraints.video;
        if (name === "OverconstrainedError" && hasFacingMode) {
          // Sin cámara trasera disponible (típico en desktop): reintenta
          // con cualquier cámara antes de mostrar un error.
          await start({ video: true });
          return;
        }
        setStatus("error");
        setErrorMessage(classifyStartError(name));
      }
    };

    // Encadena esta sesión sobre la anterior: no arranca una cámara nueva
    // en el <video> compartido hasta que la sesión previa terminó de
    // pararse (evita que una parada tardía borre el stream recién puesto).
    const previousSession = sessionRef.current;
    const thisSession = previousSession.then(async () => {
      if (cancelled) return;
      if (!active) return;
      setStatus("starting");
      setErrorMessage(null);
      await start({ video: { facingMode: "environment" } });
    });
    sessionRef.current = thisSession.catch(() => {});

    return () => {
      cancelled = true;
      sessionRef.current = thisSession.catch(() => {}).then(() => {
        sessionControls?.stop();
        if (controlsRef.current === sessionControls) {
          controlsRef.current = null;
        }
      });
    };
  }, [active]);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "relative w-full aspect-video rounded-lg overflow-hidden bg-black transition-shadow duration-200",
          pulse && "ring-4 ring-green-400",
        )}
      >
        {/* playsInline + muted son obligatorios en iOS Safari para que el
            stream reproduzca inline en vez de forzar pantalla completa. */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm text-center px-4">
            Solicitando acceso a la cámara…
          </div>
        )}
      </div>

      {status === "running" && (
        <p className="text-xs text-muted-foreground text-center">
          Apunta la cámara al código QR o de barras del paquete
        </p>
      )}

      {status === "error" && errorMessage && (
        <div className="flex items-start gap-2.5 rounded-lg border p-3 text-sm bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-900">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
