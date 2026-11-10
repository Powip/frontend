import { normalizePeruPhone, openWhatsApp } from "../types";

/**
 * B2 · el botón de WhatsApp de /operaciones/pedidos no debe anteponer 51 a un número extranjero.
 * Los peruanos siguen igual.
 */
describe("normalizePeruPhone / openWhatsApp · teléfonos internacionales", () => {
  it.each([
    ["999888777", "51999888777"],
    ["+51 999 888 777", "51999888777"],
    ["51999888777", "51999888777"],
    ["012345678", "5112345678"], // fijo de Lima con 0: conserva la regla de siempre
  ])("el peruano %s da %s", (phone, expected) => {
    expect(normalizePeruPhone(phone)).toBe(expected);
  });

  it.each([
    ["+54 9 11 2345-6789", "5491123456789"], // Argentina
    ["+1 (415) 555-2671", "14155552671"], // EE. UU.
    ["+34 612 345 678", "34612345678"], // España
    ["+57 300 1234567", "573001234567"], // Colombia
  ])("el extranjero %s da %s sin 51 delante", (phone, expected) => {
    expect(normalizePeruPhone(phone)).toBe(expected);
  });

  it("openWhatsApp abre wa.me con el número correcto", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    openWhatsApp("+54 9 11 2345-6789", "ORD-1", "Clienta");
    expect(open).toHaveBeenCalledTimes(1);
    expect(String(open.mock.calls[0][0])).toMatch(/^https:\/\/wa\.me\/5491123456789\?text=/);
    open.mockRestore();
  });
});
