import { findSunatError } from "../find-sunat-error";

// Texto real que devolvió SUNAT/OSE para B001-1501 (ORD-156099).
const DESCRIPCION_1033 =
  '1033 - El comprobante fue registrado previamente con otros datos - Detalle: value=\'ticket: 8c31b772-c24f-4565-8b14-f389eeb3e4e7, error: INFO: (nodo: "/Invoice/cbc:ID" valor: "B001-1501")\'';

describe("findSunatError", () => {
  it("encuentra el 1033 a partir del código de la falla SOAP", () => {
    const error = findSunatError("soap-env:Client.1033", DESCRIPCION_1033);

    expect(error?.code).toBe("1033");
  });

  it("encuentra el 1033 por el número inicial de la descripción cuando no hay código", () => {
    expect(findSunatError(null, DESCRIPCION_1033)?.code).toBe("1033");
  });

  it('NO confunde un 1033 con el código 0 ("comprobante válido") solo porque contiene un 0', () => {
    const error = findSunatError("soap-env:Client.1033", DESCRIPCION_1033);

    expect(error?.code).not.toBe("0");
    expect(error?.sol).not.toMatch(/comprobante válido/i);
  });

  it("no inventa una solución cuando la descripción solo contiene dígitos sueltos", () => {
    expect(findSunatError(null, "Error de conexión con el OSE (intento 10 de 50)")).toBeUndefined();
    expect(findSunatError(null, "La Factura F001-100 contiene datos inválidos")).toBeUndefined();
  });

  it("encuentra los códigos de un CDR por su código exacto", () => {
    expect(findSunatError("2335", "El RUC del receptor no es válido")?.code).toBe("2335");
    expect(findSunatError("0156", "fecha fuera de rango")?.code).toBe("0156");
  });

  it("devuelve undefined para códigos que no están en el catálogo", () => {
    expect(findSunatError("9999", "algo desconocido")).toBeUndefined();
    expect(findSunatError("soap-env:Client.9999", "9999 - algo desconocido")).toBeUndefined();
  });

  it("devuelve undefined sin código ni descripción", () => {
    expect(findSunatError(null, null)).toBeUndefined();
  });

  it("sigue reconociendo el código 0 cuando SUNAT realmente lo devuelve", () => {
    expect(findSunatError("0", "La Factura ha sido aceptada")?.code).toBe("0");
  });
});
