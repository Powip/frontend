import {
  COUNTRIES,
  DEFAULT_DIAL,
  composePhone,
  isValidPhone,
  normalizePhone,
  parsePhone,
  toWhatsAppDigits,
} from "../phone";

/**
 * B2 · teléfonos internacionales (E.164: "+" + hasta 15 dígitos).
 * El celular peruano de 9 dígitos sin prefijo sigue valiendo exactamente igual.
 */
describe("phone · isValidPhone", () => {
  it.each([
    ["999888777"],
    ["+51999888777"],
    ["51999888777"],
    ["999 888 777"],
    ["+54 9 11 2345-6789"],
    ["+5491123456789"],
    ["+1 (415) 555-2671"],
    ["+14155552671"],
    ["+34 612 345 678"],
    ["+57 300 1234567"],
    ["+56 9 8765 4321"],
    ["+123456789012345"],
  ])("acepta %s", (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });

  it.each([[""], ["   "], ["abc123"], ["+"], ["+51"], ["+1234"], ["+1234567890123456"], ["12"], ["++51999888777"], ["51+999888777"]])(
    "rechaza %j",
    (phone) => {
      expect(isValidPhone(phone)).toBe(false);
    },
  );
});

describe("phone · normalizePhone", () => {
  it.each([
    ["+54 9 11 2345-6789", "+5491123456789"],
    ["+1 (415) 555-2671", "+14155552671"],
    ["+34 612 345 678", "+34612345678"],
    ["999 888 777", "999888777"],
    ["999888777", "999888777"],
    ["", ""],
  ])("%s → %s", (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });
});

describe("phone · parsePhone / composePhone", () => {
  it("Perú es el país por defecto", () => {
    expect(DEFAULT_DIAL).toBe("51");
    expect(COUNTRIES[0].dial).toBe("51");
  });

  it("un peruano sin prefijo queda como Perú con sus 9 dígitos", () => {
    expect(parsePhone("999888777")).toEqual({ dial: "51", national: "999888777" });
    expect(parsePhone("")).toEqual({ dial: "51", national: "" });
  });

  it("un peruano guardado con 51 o con +51 se muestra sin el prefijo", () => {
    expect(parsePhone("51999888777")).toEqual({ dial: "51", national: "999888777" });
    expect(parsePhone("+51999888777")).toEqual({ dial: "51", national: "999888777" });
  });

  it.each([
    ["+5491123456789", "54", "91123456789"],
    ["+14155552671", "1", "4155552671"],
    ["+34612345678", "34", "612345678"],
    ["+573001234567", "57", "3001234567"],
    ["+56987654321", "56", "987654321"],
  ])("reconoce el país de %s", (phone, dial, national) => {
    expect(parsePhone(phone)).toEqual({ dial, national });
  });

  it("un código de país que no está en la lista queda como 'otro'", () => {
    expect(parsePhone("+998901234567")).toEqual({ dial: "", national: "998901234567" });
  });

  it("componer Perú deja los 9 dígitos sin prefijo, como siempre", () => {
    expect(composePhone("51", "999 888 777")).toBe("999888777");
  });

  it.each([
    ["54", "9 11 2345-6789", "+5491123456789"],
    ["1", "(415) 555-2671", "+14155552671"],
    ["34", "612 345 678", "+34612345678"],
    ["", "998 90 123 45 67", "+998901234567"],
  ])("componer +%s %s → %s", (dial, national, expected) => {
    expect(composePhone(dial, national)).toBe(expected);
  });

  it("sin dígitos no hay número", () => {
    expect(composePhone("54", "")).toBe("");
    expect(composePhone("51", "abc")).toBe("");
  });

  it("parse y compose son inversos", () => {
    for (const value of ["999888777", "+5491123456789", "+14155552671", "+34612345678", "+998901234567"]) {
      const { dial, national } = parsePhone(value);
      expect(composePhone(dial, national)).toBe(value);
    }
  });
});

describe("phone · toWhatsAppDigits", () => {
  it.each([
    ["999888777", "51999888777"],
    ["999 888 777", "51999888777"],
    ["51999888777", "51999888777"],
    ["+51999888777", "51999888777"],
    ["+51 999 888 777", "51999888777"],
  ])("el peruano %s sigue dando %s", (phone, expected) => {
    expect(toWhatsAppDigits(phone)).toBe(expected);
  });

  it.each([
    ["+5491123456789", "5491123456789"],
    ["+54 9 11 2345-6789", "5491123456789"],
    ["+14155552671", "14155552671"],
    ["+1 (415) 555-2671", "14155552671"],
    ["+34 612 345 678", "34612345678"],
    ["+573001234567", "573001234567"],
  ])("el extranjero %s no recibe un 51 delante: %s", (phone, expected) => {
    expect(toWhatsAppDigits(phone)).toBe(expected);
  });

  it("un extranjero guardado sin '+' pero con código de país tampoco recibe 51", () => {
    expect(toWhatsAppDigits("5491123456789")).toBe("5491123456789");
    expect(toWhatsAppDigits("34612345678")).toBe("34612345678");
  });

  it("un fijo de Lima con 0 inicial conserva la regla de siempre (sin el 0, con 51)", () => {
    expect(toWhatsAppDigits("012345678")).toBe("5112345678");
    expect(toWhatsAppDigits("01 234 5678")).toBe("5112345678");
  });

  it("el prefijo internacional 00 se interpreta como '+'", () => {
    expect(toWhatsAppDigits("0054 9 11 2345 6789")).toBe("5491123456789");
  });

  it("devuelve cadena vacía si no hay dígitos", () => {
    expect(toWhatsAppDigits("")).toBe("");
    expect(toWhatsAppDigits(null)).toBe("");
    expect(toWhatsAppDigits(undefined)).toBe("");
  });
});
