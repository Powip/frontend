import { formatWait, initials, waitMinutes, waitTone } from "../conversationWait";

describe("conversationWait", () => {
  const now = new Date("2026-01-10T12:00:00Z").getTime();

  it("cuenta minutos solo si el último mensaje es del cliente", () => {
    const at = new Date(now - 12 * 60_000).toISOString();
    expect(waitMinutes({ lastMessageDirection: "in", lastInboundAt: at }, now)).toBe(12);
    expect(waitMinutes({ lastMessageDirection: "out", lastInboundAt: at }, now)).toBeNull();
    expect(waitMinutes({ lastMessageDirection: "in", lastInboundAt: null }, now)).toBeNull();
  });

  it("color según la meta: verde, ámbar desde 60 %, rojo al pasarla", () => {
    expect(waitTone(null, 15)).toBeNull();
    expect(waitTone(3, 15)).toBe("ok");
    expect(waitTone(9, 15)).toBe("warn");
    expect(waitTone(16, 15)).toBe("bad");
  });

  it("formatea minutos, horas y días", () => {
    expect(formatWait(12)).toBe("12 min");
    expect(formatWait(125)).toBe("2 h");
    expect(formatWait(3000)).toBe("2 d");
  });

  it("iniciales de hasta dos palabras", () => {
    expect(initials("Samuel Quispe Rojas")).toBe("SQ");
    expect(initials("  ")).toBe("?");
  });
});
