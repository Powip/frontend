import { playErrorBeep, playSuccessBeep, resetErrorBeepForTests } from "../errorBeep";

type WindowWithAudio = Window & { AudioContext?: unknown; webkitAudioContext?: unknown };

function fakeAudio(state: AudioContextState = "running") {
  const node = () => ({
    connect: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    type: "",
    frequency: { setValueAtTime: jest.fn() },
    gain: { setValueAtTime: jest.fn(), exponentialRampToValueAtTime: jest.fn() },
  });
  const ctx = {
    state,
    currentTime: 0,
    destination: {},
    resume: jest.fn().mockResolvedValue(undefined),
    createOscillator: jest.fn(node),
    createGain: jest.fn(node),
  };
  const Ctor = jest.fn(() => ctx);
  return { ctx, Ctor };
}

describe("sonido de error del escaneo (FEAT-24 H2-F)", () => {
  const win = window as WindowWithAudio;
  const original = win.AudioContext;

  afterEach(() => {
    resetErrorBeepForTests();
    win.AudioContext = original;
    delete win.webkitAudioContext;
  });

  it("toca dos pitidos cortos con Web Audio y reusa el contexto", () => {
    const { ctx, Ctor } = fakeAudio();
    win.AudioContext = Ctor;
    playErrorBeep();
    playErrorBeep();
    expect(Ctor).toHaveBeenCalledTimes(1);
    expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
  });

  it("despierta un contexto suspendido", () => {
    const { ctx, Ctor } = fakeAudio("suspended");
    win.AudioContext = Ctor;
    playErrorBeep();
    expect(ctx.resume).toHaveBeenCalled();
  });

  it("sin Web Audio (o si falla) no hace nada", () => {
    win.AudioContext = undefined;
    expect(() => playErrorBeep()).not.toThrow();
    win.AudioContext = jest.fn(() => {
      throw new Error("bloqueado");
    });
    expect(() => playErrorBeep()).not.toThrow();
  });
});

describe("sonido de acierto del escaneo (FEAT-24 H6-D)", () => {
  const win = window as WindowWithAudio;
  const original = win.AudioContext;

  afterEach(() => {
    resetErrorBeepForTests();
    win.AudioContext = original;
  });

  it("toca un pitido corto y agudo, distinto del de error", () => {
    const { ctx, Ctor } = fakeAudio();
    win.AudioContext = Ctor;
    playSuccessBeep();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    const oscillator = ctx.createOscillator.mock.results[0].value;
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(1320, 0);
  });

  it("sin Web Audio no hace nada", () => {
    win.AudioContext = undefined;
    expect(() => playSuccessBeep()).not.toThrow();
  });
});
