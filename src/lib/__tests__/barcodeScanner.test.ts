import {
  cameraErrorMessage,
  CameraUnavailableError,
  createRepeatFilter,
  normalizeScannedCode,
  pickScannerEngine,
  scanFeedback,
  startCameraScanner,
  type BarcodeDetectorCtor,
  type ScannerEnvironment,
} from "../barcodeScanner";
import { playErrorBeep, playSuccessBeep } from "../errorBeep";

// FEAT-24 H6-D (H6-D2) — escáner del modo almacén. La cámara se simula: nunca
// se abre una real en los tests.

jest.mock("../errorBeep", () => ({ playErrorBeep: jest.fn(), playSuccessBeep: jest.fn() }));

function fakeVideo() {
  return {
    srcObject: null as unknown,
    muted: false,
    setAttribute: jest.fn(),
    play: jest.fn().mockResolvedValue(undefined),
  } as unknown as HTMLVideoElement & { play: jest.Mock };
}

function fakeStream() {
  const track = { stop: jest.fn() };
  return { stream: { getTracks: () => [track] } as unknown as MediaStream, track };
}

/** Intervalo manual: `tick()` corre una lectura. */
function manualTimers() {
  let handler: (() => void) | null = null;
  return {
    setInterval: jest.fn((fn: () => void) => {
      handler = fn;
      return 7;
    }),
    clearInterval: jest.fn(),
    tick: async () => {
      handler?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

function nativeDetector(reads: string[][], formats = ["ean_13", "code_128", "qr_code"]) {
  const detect = jest.fn(async () => (reads.shift() ?? []).map((rawValue) => ({ rawValue })));
  const Ctor = jest.fn(() => ({ detect })) as unknown as BarcodeDetectorCtor & jest.Mock;
  (Ctor as unknown as { getSupportedFormats: () => Promise<string[]> }).getSupportedFormats = async () => formats;
  return { Ctor, detect };
}

describe("normalizeScannedCode", () => {
  it("quita espacios, Enter y el separador GS1", () => {
    expect(normalizeScannedCode("  7750000000016\r\n")).toBe("7750000000016");
    expect(normalizeScannedCode("01\u001d0775")).toBe("010775");
  });

  it("descarta lo vacío, lo que no es texto y lo demasiado largo", () => {
    expect(normalizeScannedCode("   ")).toBeNull();
    expect(normalizeScannedCode(42)).toBeNull();
    expect(normalizeScannedCode("x".repeat(129))).toBeNull();
  });
});

describe("createRepeatFilter", () => {
  it("ignora el mismo código seguido dentro de la pausa y acepta otro enseguida", () => {
    let now = 0;
    const accept = createRepeatFilter(1500, () => now);
    expect(accept("A")).toBe(true);
    now = 500;
    expect(accept("A")).toBe(false);
    expect(accept("B")).toBe(true);
    now = 600;
    expect(accept("A")).toBe(true);
  });

  it("mientras la cámara sigue viendo el mismo código, no lo vuelve a aceptar", () => {
    let now = 0;
    const accept = createRepeatFilter(1500, () => now);
    accept("A");
    for (now = 1000; now <= 5000; now += 1000) expect(accept("A")).toBe(false);
    now = 7000;
    expect(accept("A")).toBe(true);
  });
});

describe("scanFeedback", () => {
  beforeEach(() => jest.clearAllMocks());

  it("acierto: pitido agudo y vibración corta", () => {
    const vibrate = jest.fn();
    scanFeedback("ok", { vibrate });
    expect(playSuccessBeep).toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith(60);
  });

  it("error: pitidos graves y vibración larga", () => {
    const vibrate = jest.fn();
    scanFeedback("error", { vibrate });
    expect(playErrorBeep).toHaveBeenCalled();
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
  });

  it("sin vibración (iOS) solo suena", () => {
    expect(() => scanFeedback("queued", undefined)).not.toThrow();
    expect(() =>
      scanFeedback("queued", {
        vibrate: () => {
          throw new Error("no");
        },
      }),
    ).not.toThrow();
    expect(playSuccessBeep).toHaveBeenCalledTimes(2);
  });
});

describe("pickScannerEngine", () => {
  it("usa BarcodeDetector si lee códigos de producto", async () => {
    await expect(pickScannerEngine({ BarcodeDetector: nativeDetector([]).Ctor })).resolves.toBe("native");
  });

  it("usa zxing si no hay BarcodeDetector o si solo lee QR", async () => {
    await expect(pickScannerEngine({})).resolves.toBe("zxing");
    await expect(pickScannerEngine({ BarcodeDetector: nativeDetector([], ["qr_code"]).Ctor })).resolves.toBe("zxing");
  });
});

describe("startCameraScanner", () => {
  function env(overrides: Partial<ScannerEnvironment> = {}) {
    const timers = manualTimers();
    const base: ScannerEnvironment = {
      getUserMedia: jest.fn(),
      loadZxing: jest.fn(),
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      ...overrides,
    };
    return { env: base, timers };
  }

  it("con BarcodeDetector abre la cámara trasera, lee y avisa cada código una vez", async () => {
    const { stream, track } = fakeStream();
    const { Ctor } = nativeDetector([["7750000000016"], ["7750000000016"], [], ["ABC-1 "]]);
    const { env: environment, timers } = env({ BarcodeDetector: Ctor, getUserMedia: jest.fn().mockResolvedValue(stream) });
    const video = fakeVideo();
    const onCode = jest.fn();
    const controls = await startCameraScanner(video, onCode, environment);
    expect(controls.engine).toBe("native");
    expect(environment.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: { ideal: "environment" } }) }),
    );
    expect(video.play).toHaveBeenCalled();
    for (let i = 0; i < 4; i++) await timers.tick();
    expect(onCode.mock.calls).toEqual([["7750000000016"], ["ABC-1"]]);
    controls.stop();
    expect(track.stop).toHaveBeenCalled();
    expect(timers.clearInterval).toHaveBeenCalledWith(7);
    expect(environment.loadZxing).not.toHaveBeenCalled();
  });

  it("sin BarcodeDetector usa @zxing/browser", async () => {
    const stop = jest.fn();
    let callback: ((result: { getText(): string } | undefined) => void) | undefined;
    const decodeFromConstraints = jest.fn(async (_c: MediaStreamConstraints, _v: HTMLVideoElement, cb: typeof callback) => {
      callback = cb;
      return { stop };
    });
    const Reader = jest.fn(() => ({ decodeFromConstraints }));
    const { env: environment } = env({ loadZxing: jest.fn().mockResolvedValue(Reader) });
    const onCode = jest.fn();
    const controls = await startCameraScanner(fakeVideo(), onCode, environment);
    expect(controls.engine).toBe("zxing");
    callback?.(undefined);
    callback?.({ getText: () => "7750000000016" });
    callback?.({ getText: () => "7750000000016" });
    expect(onCode).toHaveBeenCalledTimes(1);
    controls.stop();
    expect(stop).toHaveBeenCalled();
  });

  it("si la cámara no arranca, suelta el stream y lanza el error", async () => {
    const { stream, track } = fakeStream();
    const { Ctor } = nativeDetector([]);
    const { env: environment } = env({ BarcodeDetector: Ctor, getUserMedia: jest.fn().mockResolvedValue(stream) });
    const video = fakeVideo();
    video.play.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    await expect(startCameraScanner(video, jest.fn(), environment)).rejects.toMatchObject({ name: "NotAllowedError" });
    expect(track.stop).toHaveBeenCalled();
  });

  it("sin getUserMedia avisa que el navegador no permite la cámara", async () => {
    const { env: environment } = env({ BarcodeDetector: nativeDetector([]).Ctor, getUserMedia: undefined });
    await expect(startCameraScanner(fakeVideo(), jest.fn(), environment)).rejects.toBeInstanceOf(CameraUnavailableError);
  });
});

describe("cameraErrorMessage", () => {
  it.each([
    ["NotAllowedError", /permiso/],
    ["NotFoundError", /no tiene una cámara/],
    ["NotReadableError", /ocupada/],
    ["Otro", /No se pudo abrir la cámara/],
  ])("%s", (name, expected) => {
    expect(cameraErrorMessage(Object.assign(new Error("x"), { name }))).toMatch(expected);
  });
});
