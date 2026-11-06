import { PanelAccesoDenegadoError } from "../../data/panel-identidad";
import { estadoHttp, mensajeDeError } from "../panel-errors";

/** Lo que construye axios ante una respuesta HTTP con error. */
function errorHttp(status: number, message?: unknown) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: message === undefined ? {} : { message } },
  });
}

describe("estadoHttp", () => {
  it("lee el estado de la respuesta del servidor", () => {
    expect(estadoHttp(errorHttp(503))).toBe(503);
    expect(estadoHttp(errorHttp(403))).toBe(403);
    expect(estadoHttp(errorHttp(404))).toBe(404);
  });

  it("un rechazo local por rol (PanelAccesoDenegadoError) cuenta como 403", () => {
    expect(estadoHttp(new PanelAccesoDenegadoError("el rol no puede"))).toBe(403);
  });

  it("sin respuesta del servidor (red caída, error de código, valores raros) es null", () => {
    expect(estadoHttp(new Error("Network Error"))).toBeNull();
    expect(estadoHttp(null)).toBeNull();
    expect(estadoHttp(undefined)).toBeNull();
    expect(estadoHttp("503")).toBeNull();
    expect(estadoHttp({ response: { status: "503" } })).toBeNull();
  });
});

describe("mensajeDeError", () => {
  it("403: mensaje claro de permiso, sin el texto técnico de axios", () => {
    const mensaje = mensajeDeError(errorHttp(403, "Forbidden resource"));
    expect(mensaje).toBe("Tu rol no tiene acceso a esta información.");
    expect(mensaje).not.toMatch(/status code/);
  });

  it("503: avisa que el servicio no está disponible y que se puede reintentar", () => {
    expect(mensajeDeError(errorHttp(503, "Inventario no disponible"))).toBe(
      "El servicio no está disponible por ahora. Reintenta en unos minutos.",
    );
  });

  it("404 y 400 muestran el texto en español que manda el backend", () => {
    expect(
      mensajeDeError(errorHttp(404, "Ese producto no está en el inventario de tu empresa.")),
    ).toBe("Ese producto no está en el inventario de tu empresa.");
    expect(
      mensajeDeError(
        errorHttp(
          400,
          "El grupo «primera_llamada_tardia» todavía no está conectado a datos reales en el backend.",
        ),
      ),
    ).toBe(
      "El grupo «primera_llamada_tardia» todavía no está conectado a datos reales en el backend.",
    );
  });

  it("404 sin texto del backend usa un mensaje genérico en español", () => {
    expect(mensajeDeError(errorHttp(404))).toBe(
      "Ya no existe lo que intentas ver. Actualiza la pantalla.",
    );
  });

  it("400 con una lista de errores de validación o sin texto cae al mensaje del error", () => {
    expect(mensajeDeError(errorHttp(400, ["sub must be one of the following values"]))).toBe(
      "Request failed with status code 400",
    );
    expect(mensajeDeError(errorHttp(400))).toBe("Request failed with status code 400");
  });

  it("cualquier otro error conserva su mensaje; lo desconocido no rompe", () => {
    expect(mensajeDeError(new Error("Network Error"))).toBe("Network Error");
    expect(mensajeDeError(errorHttp(500))).toBe("Request failed with status code 500");
    expect(mensajeDeError(null)).toBe("Error desconocido");
    expect(mensajeDeError("algo")).toBe("Error desconocido");
  });
});
