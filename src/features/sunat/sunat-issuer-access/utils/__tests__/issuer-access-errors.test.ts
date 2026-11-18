import {
  getDocumentTypePlural,
  getIssuerAccessError,
  getIssuerAccessSteps,
  isIssuerAccessCode,
} from "../issuer-access-errors";

describe("isIssuerAccessCode", () => {
  it.each(["0102", "0103", "0105", "0106", "0110", "0111", "0112", "0113", "0154"])(
    "%s es un rechazo al emisor, no al comprobante",
    (code) => {
      expect(isIssuerAccessCode(code)).toBe(true);
    },
  );

  it("reconoce el código aunque venga con el prefijo de SUNAT", () => {
    expect(isIssuerAccessCode("soap-env:Client.0111")).toBe(true);
    expect(isIssuerAccessCode("a:Client.0113")).toBe(true);
  });

  it.each(["2800", "1033", "0", null, undefined, "soap-env:Client.2801"])(
    "%s no lo es: son errores del comprobante o no hay código",
    (code) => {
      expect(isIssuerAccessCode(code)).toBe(false);
    },
  );
});

describe("getIssuerAccessError", () => {
  it("0111: falta el perfil de envío, y se corrige en SUNAT", () => {
    const error = getIssuerAccessError("0111");

    expect(error?.title).toMatch(/no tiene permiso para enviar comprobantes electrónicos/);
    expect(error?.fixedIn).toBe("SUNAT");
  });

  it("0113: el RUC no está afiliado a la emisión electrónica", () => {
    expect(getIssuerAccessError("0113")?.title).toMatch(/no está afiliado/);
  });

  it("0102: usuario o clave SOL incorrectos, y se corrige volviendo a registrar el RUC en Powip", () => {
    const error = getIssuerAccessError("0102");

    expect(error?.title).toMatch(/usuario o la clave SOL son incorrectos/);
    expect(error?.fixedIn).toBe("POWIP");
  });

  it("no inventa una explicación para un código que no conoce", () => {
    expect(getIssuerAccessError("9999")).toBeUndefined();
  });
});

describe("getIssuerAccessSteps", () => {
  const error = getIssuerAccessError("0111");

  it("nombra el usuario SOL con el que se envía", () => {
    expect(error && getIssuerAccessSteps(error, "FACTURA1").join(" ")).toContain(
      "el usuario FACTURA1",
    );
  });

  it("sin usuario conocido no deja el marcador a la vista", () => {
    const steps = error ? getIssuerAccessSteps(error, null).join(" ") : "";

    expect(steps).not.toContain("{solUser}");
  });
});

describe("getDocumentTypePlural", () => {
  it("nombra cada tipo de comprobante", () => {
    expect(getDocumentTypePlural("01")).toBe("facturas");
    expect(getDocumentTypePlural("03")).toBe("boletas");
    expect(getDocumentTypePlural("07")).toBe("notas de crédito");
  });
});
