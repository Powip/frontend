import { playErrorBeep, playSuccessBeep } from "./errorBeep";

// FEAT-24 H6-D (H6-D2) — escáner del modo almacén. Con la cámara usa la API
// nativa `BarcodeDetector` cuando existe (Chrome en Android) y, si no,
// `@zxing/browser` (se carga solo cuando hace falta). Un lector USB/Bluetooth
// entra como teclado: lo atiende `ScanInput` con un campo que siempre tiene el
// foco y termina en Enter. Acá vive la lógica, sin React, para poder probarla.

/** Formatos que imprime o lee POWIP: EAN de POWIP, códigos de fábrica y QR. */
export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "codabar", "qr_code"] as const;

export const MAX_CODE_LENGTH = 128;

/** Limpia lo que manda un lector: espacios, Enter/Tab y caracteres de control (p. ej. el separador GS1). */
export function normalizeScannedCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const clean = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!clean || clean.length > MAX_CODE_LENGTH) return null;
  return clean;
}

/**
 * La cámara lee el mismo código muchas veces por segundo: solo se acepta de nuevo pasado `cooldownMs`
 * (o si en el medio se leyó otro). El lector por teclado no usa esto: cada Enter es un escaneo.
 */
export function createRepeatFilter(cooldownMs = 1500, now: () => number = Date.now) {
  let last: { code: string; at: number } | null = null;
  return (code: string): boolean => {
    const at = now();
    if (last && last.code === code && at - last.at < cooldownMs) {
      last = { code, at };
      return false;
    }
    last = { code, at };
    return true;
  };
}

/* ---------------------------------------------------------------------------
   Sonido y vibración
--------------------------------------------------------------------------- */

export type ScanFeedbackKind = "ok" | "error" | "queued";

const VIBRATION: Record<ScanFeedbackKind, number | number[]> = {
  ok: 60,
  queued: [40, 60, 40],
  error: [200, 100, 200],
};

/** Acierto: pitido agudo; error: dos graves y vibración larga; guardado sin señal: vibración corta doble. */
export function scanFeedback(kind: ScanFeedbackKind, nav: Pick<Navigator, "vibrate"> | undefined = typeof navigator === "undefined" ? undefined : navigator): void {
  if (kind === "error") playErrorBeep();
  else playSuccessBeep();
  try {
    if (typeof nav?.vibrate === "function") nav.vibrate(VIBRATION[kind]);
  } catch {
    // Sin vibración (p. ej. iOS): alcanza con el sonido y el aviso.
  }
}

/* ---------------------------------------------------------------------------
   Cámara
--------------------------------------------------------------------------- */

export type ScannerEngine = "native" | "zxing";

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}

export interface BarcodeDetectorCtor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

export interface ScannerControls {
  engine: ScannerEngine;
  stop(): void;
}

interface ZxingControls {
  stop(): void;
}

interface ZxingReader {
  decodeFromConstraints(
    constraints: MediaStreamConstraints,
    video: HTMLVideoElement,
    callback: (result: { getText(): string } | undefined, error?: unknown) => void,
  ): Promise<ZxingControls>;
}

export interface ScannerEnvironment {
  BarcodeDetector?: BarcodeDetectorCtor;
  getUserMedia?: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  loadZxing: () => Promise<{ new (): ZxingReader }>;
  setInterval: (handler: () => void, ms: number) => unknown;
  clearInterval: (id: unknown) => void;
}

/** El navegador real. */
export function browserScannerEnvironment(): ScannerEnvironment {
  const win = typeof window === "undefined" ? undefined : (window as Window & { BarcodeDetector?: BarcodeDetectorCtor });
  const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  return {
    BarcodeDetector: win?.BarcodeDetector,
    getUserMedia: media?.getUserMedia ? (constraints) => media.getUserMedia(constraints) : undefined,
    loadZxing: async () => (await import("@zxing/browser")).BrowserMultiFormatReader as unknown as { new (): ZxingReader },
    setInterval: (handler, ms) => window.setInterval(handler, ms),
    clearInterval: (id) => window.clearInterval(id as number),
  };
}

/** Cámara trasera, a buena resolución para leer códigos chicos. */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
};

/** `BarcodeDetector` solo sirve si lee códigos de barras de producto (algunos navegadores solo traen QR). */
export async function pickScannerEngine(env: Pick<ScannerEnvironment, "BarcodeDetector">): Promise<ScannerEngine> {
  const Detector = env.BarcodeDetector;
  if (!Detector) return "zxing";
  try {
    const formats = (await Detector.getSupportedFormats?.()) ?? [];
    return formats.some((format) => format === "ean_13" || format === "code_128") ? "native" : "zxing";
  } catch {
    return "zxing";
  }
}

export class CameraUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CameraUnavailableError";
  }
}

/** Mensaje para el usuario cuando la cámara no arranca. */
export function cameraErrorMessage(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return "No hay permiso para usar la cámara. Habilítalo en el navegador o usa el lector.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "Este equipo no tiene una cámara disponible.";
  if (name === "NotReadableError") return "La cámara está ocupada por otra app.";
  if (error instanceof CameraUnavailableError) return error.message;
  return "No se pudo abrir la cámara. Usa el lector o escribe el código.";
}

const NATIVE_INTERVAL_MS = 250;

/**
 * Abre la cámara en `video` y llama `onCode` con cada código leído (ya filtrado: sin repetir el mismo
 * seguido). Devuelve cómo detenerla. Lanza si no hay cámara o no hay permiso.
 */
export async function startCameraScanner(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  env: ScannerEnvironment = browserScannerEnvironment(),
  accept: (code: string) => boolean = createRepeatFilter(),
): Promise<ScannerControls> {
  const emit = (raw: unknown) => {
    const code = normalizeScannedCode(raw);
    if (code && accept(code)) onCode(code);
  };

  const engine = await pickScannerEngine(env);

  if (engine === "native" && env.BarcodeDetector) {
    if (!env.getUserMedia) throw new CameraUnavailableError("Este navegador no permite usar la cámara.");
    const stream = await env.getUserMedia(CAMERA_CONSTRAINTS);
    const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
    let detector: BarcodeDetectorLike;
    try {
      detector = new env.BarcodeDetector({ formats: [...SCAN_FORMATS] });
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
    } catch (error) {
      stopTracks();
      throw error;
    }
    let busy = false;
    let stopped = false;
    const timer = env.setInterval(() => {
      if (busy || stopped) return;
      busy = true;
      detector
        .detect(video)
        .then((codes) => {
          if (!stopped) for (const found of codes) emit(found.rawValue);
        })
        .catch(() => undefined)
        .finally(() => {
          busy = false;
        });
    }, NATIVE_INTERVAL_MS);
    return {
      engine,
      stop() {
        stopped = true;
        env.clearInterval(timer);
        stopTracks();
        video.srcObject = null;
      },
    };
  }

  const Reader = await env.loadZxing();
  const reader = new Reader();
  const controls = await reader.decodeFromConstraints(CAMERA_CONSTRAINTS, video, (result) => {
    if (result) emit(result.getText());
  });
  return { engine: "zxing", stop: () => controls.stop() };
}
