import { historyActor, historyAuthor, isRawHistoryCode } from "../orderHistory";

// FEAT-33 A7: el historial nunca atribuye al equipo lo que hizo el cliente, ni muestra códigos internos.
const log = (extra: Record<string, unknown>) => ({
  comentarios: "x",
  isSystemGenerated: false,
  userName: null,
  data: null,
  ...extra,
});

describe("historyActor", () => {
  test.each([
    [log({ isSystemGenerated: true, userName: "Cliente", data: { actor: "CUSTOMER" } }), "Cliente"],
    [log({ isSystemGenerated: true, userName: "Sistema", data: { actor: "SYSTEM" } }), "Sistema"],
    [log({ isSystemGenerated: true }), "Sistema"],
    [log({ userName: "ana@negocio.pe", data: { actor: "USER" } }), null],
    [log({}), null],
  ])("%j → %p", (entry, actor) => {
    expect(historyActor(entry)).toBe(actor);
  });
});

describe("historyAuthor", () => {
  test("does not repeat the actor chip as the author", () => {
    expect(historyAuthor(log({ isSystemGenerated: true, userName: "Cliente", data: { actor: "CUSTOMER" } }))).toBeNull();
    expect(historyAuthor(log({ isSystemGenerated: true, userName: "Sistema" }))).toBeNull();
  });
  test("shows who did it", () => {
    expect(historyAuthor(log({ userName: "ana@negocio.pe" }))).toBe("ana@negocio.pe");
    expect(historyAuthor(log({ isSystemGenerated: true, userName: "Soporte Powip" }))).toBe("Soporte Powip");
  });
});

describe("isRawHistoryCode", () => {
  test("hides an internal action code written as the comment", () => {
    expect(
      isRawHistoryCode(log({ comentarios: "LIVE_ORDER_CANCELLED", data: { action: "LIVE_ORDER_CANCELLED" } })),
    ).toBe(true);
  });
  test("keeps real sentences, including capitalised ones", () => {
    expect(isRawHistoryCode(log({ comentarios: "Pedido anulado: Cliente no continuará", data: { action: "X" } }))).toBe(false);
    expect(isRawHistoryCode(log({ comentarios: "OK", data: null }))).toBe(false);
    expect(isRawHistoryCode(log({ comentarios: "Estado cambiado a EN_ENVIO" }))).toBe(false);
  });
});
