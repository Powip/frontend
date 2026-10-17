import { clientSaveErrorMessage } from "../clientSaveError";

function validationError(message: unknown, status = 400) {
  return { isAxiosError: true, response: { status, data: { message } } };
}

describe("client save feedback", () => {
  it("identifies rejected fields in Spanish without exposing the server response", () => {
    const result = clientSaveErrorMessage(validationError([
      "address must be longer than or equal to 1 characters",
      "googleMapsUrl must be a URL address",
      "googleMapsUrl must be shorter than or equal to 500 characters",
    ]));
    expect(result).toContain("Revisa dirección, enlace de Google Maps");
    expect(result).toContain("Los datos de la venta se conservan en el formulario");
    expect(result.match(/Google Maps/g)).toHaveLength(1);
    expect(result).not.toContain("googleMapsUrl");
    expect(result).not.toContain("must be");
  });

  it("recognizes the document validator's custom message", () => {
    expect(clientSaveErrorMessage(validationError("El número de documento no es válido para el tipo seleccionado")))
      .toContain("Revisa número de documento");
  });

  it.each([undefined, null, {}, [null, { unexpected: true }]])("handles an unexpected validation body: %p", (message) => {
    expect(clientSaveErrorMessage(validationError(message))).toContain("Revisa los datos del cliente");
  });

  it.each([new Error("Network Error"), validationError("private database details", 500)])("allows retry without showing internal errors", (error) => {
    const result = clientSaveErrorMessage(error);
    expect(result).toContain("Vuelve a confirmar para reintentar");
    expect(result).toContain("Los datos de la venta se conservan en el formulario");
    expect(result).not.toContain("private database details");
  });
});
