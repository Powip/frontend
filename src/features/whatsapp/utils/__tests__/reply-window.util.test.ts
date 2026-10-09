import {
  describeReplyWindow,
  formatReplyWindowRemaining,
  resolveReplyWindow,
} from "../reply-window.util";

const now = new Date("2026-10-08T15:00:00.000Z");

describe("resolveReplyWindow", () => {
  it("está abierta solo si backend la autoriza y su vencimiento es futuro", () => {
    const result = resolveReplyWindow(
      { open: true, expiresAt: new Date("2026-10-09T12:00:00.000Z") },
      now,
    );
    expect(result.state).toBe("open");
    expect(result.remainingMs).toBe(21 * 60 * 60 * 1000);
  });

  it("se cierra al llegar al vencimiento aunque backend la haya informado abierta", () => {
    const expiresAt = new Date("2026-10-08T15:00:00.000Z");
    expect(resolveReplyWindow({ open: true, expiresAt }, now)).toEqual({
      state: "closed",
      expiresAt,
      remainingMs: 0,
    });
  });

  it("respeta el cierre informado por backend aunque el vencimiento sea futuro", () => {
    const result = resolveReplyWindow(
      { open: false, expiresAt: new Date("2026-10-09T12:00:00.000Z") },
      now,
    );
    expect(result.state).toBe("closed");
  });

  it.each([
    ["sin datos de ventana", null],
    ["sin autorización de backend", { open: null, expiresAt: new Date("2026-10-09T00:00:00Z") }],
    ["abierta sin vencimiento", { open: true, expiresAt: null }],
    ["vencimiento inválido", { open: true, expiresAt: new Date("no-es-fecha") }],
  ])("queda desconocida %s", (_label, info) => {
    expect(resolveReplyWindow(info, now).state).toBe("unknown");
  });
});

describe("describeReplyWindow", () => {
  it("describe los tres estados", () => {
    expect(
      describeReplyWindow({ state: "open", expiresAt: now, remainingMs: 21 * 3600000 }),
    ).toEqual({
      title: "Ventana abierta",
      detail: "Quedan 21 h para responder con texto libre",
    });
    expect(describeReplyWindow({ state: "closed", expiresAt: null, remainingMs: 0 }).detail).toBe(
      "Solo puedes enviar una plantilla aprobada",
    );
    expect(describeReplyWindow({ state: "unknown", expiresAt: null, remainingMs: 0 }).title).toBe(
      "Ventana sin confirmar",
    );
  });
});

describe("formatReplyWindowRemaining", () => {
  it.each([
    [21 * 60 * 60 * 1000, "21 h"],
    [(2 * 60 + 15) * 60 * 1000, "2 h 15 min"],
    [45 * 60 * 1000, "45 min"],
    [20 * 1000, "1 min"],
    [0, "0 min"],
  ])("formatea %p ms como %p", (ms, expected) => {
    expect(formatReplyWindowRemaining(ms)).toBe(expected);
  });
});
