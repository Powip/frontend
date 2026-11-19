import {
  isClientDocumentRequired,
  validateClientDocument,
  validateClientEmail,
} from "../clientDocumentValidation";

/**
 * El documento solo es obligatorio en ventas de provincia (el courier lo pide para entregar). En un pedido
 * Shopify COD que Gestión CC está editando NO: el DNI se exige recién al confirmar el despacho, y pedirlo
 * al guardar obligaba a inventar uno (00000000 / 00000001) para corregir el cliente de un pedido de provincia.
 */
describe("isClientDocumentRequired", () => {
  it("es obligatorio en una venta de provincia", () => {
    expect(isClientDocumentRequired("PROVINCIA", false)).toBe(true);
  });

  it("no es obligatorio en una venta de Lima", () => {
    expect(isClientDocumentRequired("LIMA", false)).toBe(false);
  });

  it("no es obligatorio al editar un pedido Shopify COD, ni siquiera en provincia", () => {
    expect(isClientDocumentRequired("PROVINCIA", true)).toBe(false);
    expect(isClientDocumentRequired("LIMA", true)).toBe(false);
  });
});

describe("validateClientDocument", () => {
  it("sin tipo de documento: error si es obligatorio, sin error si no", () => {
    expect(validateClientDocument(undefined, "", true)).toEqual({
      documentType: "El documento de identidad es obligatorio para ventas de provincia.",
    });
    expect(validateClientDocument(undefined, "", false)).toEqual({});
  });

  it("si se informa un documento, su formato se valida siempre (aunque no sea obligatorio)", () => {
    expect(validateClientDocument("DNI", "123", false)).toEqual({ documentNumber: "DNI debe tener 7 u 8 dígitos." });
    expect(validateClientDocument("DNI", "45678912", false)).toEqual({});
  });

  it("acepta un RUC válido (empresa o persona con negocio)", () => {
    expect(validateClientDocument("RUC", "20100070970", false)).toEqual({});
    expect(validateClientDocument("RUC", "10467793549", true)).toEqual({});
  });

  it.each([
    ["10 dígitos", "2010007097"],
    ["letras", "2010007097A"],
    ["prefijo inválido", "30100070970"],
    ["dígito verificador incorrecto", "20100070971"],
  ])("rechaza un RUC con %s", (_caso, ruc) => {
    expect(validateClientDocument("RUC", ruc, false)).toEqual({
      documentNumber: "RUC no válido: 11 dígitos que empiecen con 10, 15, 16, 17 o 20.",
    });
  });
});

describe("validateClientEmail", () => {
  it("el correo es opcional", () => {
    expect(validateClientEmail("")).toBeUndefined();
    expect(validateClientEmail("   ")).toBeUndefined();
  });

  it("acepta un correo con formato válido (con espacios alrededor)", () => {
    expect(validateClientEmail(" compras@drasanvi.pe ")).toBeUndefined();
  });

  it.each(["compras", "compras@", "compras@drasanvi", "a b@c.pe"])("rechaza %s", (email) => {
    expect(validateClientEmail(email)).toBe("Ingresa un correo válido (ej. nombre@empresa.com).");
  });
});
