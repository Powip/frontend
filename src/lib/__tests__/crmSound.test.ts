/** @jest-environment jsdom */
import {
  SOUND_EVENT_NAME,
  SOUND_EVENTS,
  emitSound,
  insideShift,
  shouldPlay,
  tabTitle,
  type SoundPrefs,
} from "../crmSound";

const prefs = (over: Partial<SoundPrefs> = {}): SoundPrefs => ({
  on: true,
  vol: 0.6,
  turno: false,
  tab: true,
  vibrate: false,
  events: Object.fromEntries(SOUND_EVENTS.map((e) => [e, { on: true, tone: "ding" }])) as SoundPrefs["events"],
  ...over,
});

const base = { event: "msg" as const, tabVisible: true, inShift: true };

describe("shouldPlay", () => {
  it("suena con todo encendido", () => {
    expect(shouldPlay({ ...base, prefs: prefs() })).toBe(true);
  });
  it("no suena con el interruptor general apagado", () => {
    expect(shouldPlay({ ...base, prefs: prefs({ on: false }) })).toBe(false);
  });
  it("no suena si el evento está apagado", () => {
    const p = prefs();
    p.events.msg.on = false;
    expect(shouldPlay({ ...base, prefs: p })).toBe(false);
  });
  it("no suena en el chat abierto con la pestaña visible", () => {
    expect(
      shouldPlay({ ...base, prefs: prefs(), conversationId: "c1", openConversationId: "c1" }),
    ).toBe(false);
  });
  it("suena en el chat abierto si la pestaña está oculta", () => {
    expect(
      shouldPlay({ ...base, tabVisible: false, prefs: prefs(), conversationId: "c1", openConversationId: "c1" }),
    ).toBe(true);
  });
  it("silencio fuera de turno solo si turno está activo", () => {
    expect(shouldPlay({ ...base, inShift: false, prefs: prefs({ turno: true }) })).toBe(false);
    expect(shouldPlay({ ...base, inShift: false, prefs: prefs({ turno: false }) })).toBe(true);
  });
});

describe("insideShift", () => {
  const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m);
  it("sin turno definido siempre está dentro", () => {
    expect(insideShift(at(3), null)).toBe(true);
    expect(insideShift(at(3), { start: "09:00" })).toBe(true);
  });
  it("turno normal", () => {
    expect(insideShift(at(10), { start: "09:00", end: "18:00" })).toBe(true);
    expect(insideShift(at(19), { start: "09:00", end: "18:00" })).toBe(false);
  });
  it("turno que cruza medianoche", () => {
    expect(insideShift(at(23), { start: "22:00", end: "06:00" })).toBe(true);
    expect(insideShift(at(12), { start: "22:00", end: "06:00" })).toBe(false);
  });
});

describe("tabTitle", () => {
  it("antepone el contador", () => {
    expect(tabTitle("POWIP", 3)).toBe("(3) POWIP");
  });
  it("no duplica el contador previo", () => {
    expect(tabTitle("(2) POWIP", 5)).toBe("(5) POWIP");
  });
  it("con 0 deja el título limpio", () => {
    expect(tabTitle("(2) POWIP", 0)).toBe("POWIP");
  });
});

describe("emitSound", () => {
  it("dispara el evento crm:sound con el detalle", () => {
    const fn = jest.fn();
    window.addEventListener(SOUND_EVENT_NAME, fn);
    emitSound({ event: "msg", conversationId: "c9" });
    window.removeEventListener(SOUND_EVENT_NAME, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect((fn.mock.calls[0][0] as CustomEvent).detail).toEqual({ event: "msg", conversationId: "c9" });
  });
});
