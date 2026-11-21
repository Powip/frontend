import { clientCreateErrorMessage, clientSaveErrorMessage } from "../clientSaveError";

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

  it("names the email field when the backend rejects its format", () => {
    expect(clientSaveErrorMessage(validationError(["email debe ser un correo electrónico válido"])))
      .toContain("Revisa correo electrónico");
  });

  it("explains a duplicated email (409) instead of asking to retry", () => {
    const result = clientSaveErrorMessage(
      validationError("Ya existe otro cliente con ese correo en esta empresa", 409),
    );
    expect(result).toContain("Ya existe otro cliente con ese correo en esta empresa");
    expect(result).toContain("Los datos de la venta se conservan en el formulario");
    expect(result).not.toContain("Vuelve a confirmar para reintentar");
  });

  it.each([undefined, null, {},[null, { unexpected: true }]])("handles an unexpected validation body: %p", (message) => {
    expect(clientSaveErrorMessage(validationError(message))).toContain("Revisa los datos del cliente");
  });

  it.each([new Error("Network Error"), validationError("private database details", 500)])("allows retry without showing internal errors", (error) => {
    const result = clientSaveErrorMessage(error);
    expect(result).toContain("Vuelve a confirmar para reintentar");
    expect(result).toContain("Los datos de la venta se conservan en el formulario");
    expect(result).not.toContain("private database details");
  });
});

describe("motivo al fallar la creación del cliente", () => {
  it("explica el link de Google Maps rechazado sin mostrar la respuesta del servidor", () => {
    const result = clientCreateErrorMessage(validationError(["googleMapsUrl must be a URL address"]));
    expect(result).toBe("No se pudo crear el cliente. El link de Google Maps no es válido.");
  });

  it("nombra en español los demás campos rechazados", () => {
    const result = clientCreateErrorMessage(validationError([
      "address must be longer than or equal to 1 characters",
      "googleMapsUrl must be a URL address",
    ]));
    expect(result).toContain("El link de Google Maps no es válido.");
    expect(result).toContain("Revisa dirección.");
    expect(result).not.toContain("must be");
  });

  it("muestra el motivo del backend cuando el teléfono o el correo ya existen", () => {
    expect(clientCreateErrorMessage(
      validationError("Ya existe un cliente con ese teléfono en esta empresa", 409),
    )).toBe("No se pudo crear el cliente. Ya existe un cliente con ese teléfono en esta empresa.");
    expect(clientCreateErrorMessage(
      validationError("Ya existe otro cliente con ese correo en esta empresa", 409),
    )).toBe("No se pudo crear el cliente. Ya existe otro cliente con ese correo en esta empresa.");
  });

  it("usa un mensaje de respaldo cuando el backend no da un motivo legible", () => {
    const fallback = "No se pudo crear el cliente. Revisa los datos del cliente e intenta de nuevo.";
    expect(clientCreateErrorMessage(validationError("Bad Request Exception"))).toBe(fallback);
    expect(clientCreateErrorMessage(new Error("boom"))).toBe(fallback);
    expect(clientCreateErrorMessage(validationError("duplicate key value", 409)))
      .toBe("No se pudo crear el cliente: ya existe un cliente con esos datos en esta empresa.");
    expect(clientCreateErrorMessage(validationError("relation clients does not exist", 500)))
      .not.toContain("relation");
  });

  it("distingue sesión vencida, permisos y falta de conexión", () => {
    expect(clientCreateErrorMessage(validationError("Token inválido o expirado", 401))).toContain("tu sesión venció");
    expect(clientCreateErrorMessage(validationError("x", 403))).toContain("no tiene permiso");
    expect(clientCreateErrorMessage({ isAxiosError: true })).toContain("no hay conexión");
  });
});
