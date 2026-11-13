import { isClientDocumentRequired, validateClientDocument } from "../clientDocumentValidation";

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
});
