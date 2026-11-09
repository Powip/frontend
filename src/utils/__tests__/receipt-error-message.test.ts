import { AxiosError, CanceledError, type AxiosResponse } from "axios";

import {
  describeReceiptError,
  summarizeReceiptFailures,
} from "@/utils/receipt-error-message";

function httpError(status: number, data: unknown = {}) {
  return new AxiosError(
    `Request failed with status code ${status}`,
    "ERR_BAD_RESPONSE",
    undefined,
    undefined,
    { status, data } as AxiosResponse,
  );
}

describe("describeReceiptError", () => {
  it.each([401, 403])(
    "explica que la sesión venció o falta permiso cuando el servidor responde %s",
    (status) => {
      expect(describeReceiptError(httpError(status))).toBe(
        "Tu sesión venció o no tienes permiso para ver este pedido. Vuelve a iniciar sesión.",
      );
    },
  );

  it("explica que el pedido no se encontró cuando responde 404", () => {
    expect(describeReceiptError(httpError(404))).toBe(
      "El pedido no se encontró (pudo eliminarse o ser de otra empresa).",
    );
  });

  it("muestra el mensaje del servidor en un rechazo 4xx", () => {
    expect(
      describeReceiptError(httpError(400, { message: "Falta el cliente" })),
    ).toBe("Falta el cliente");
  });

  it("une los mensajes cuando el servidor devuelve una lista", () => {
    expect(
      describeReceiptError(httpError(422, { message: ["Falta DNI", "Falta RUC"] })),
    ).toBe("Falta DNI. Falta RUC");
  });

  it("indica el código HTTP cuando un 4xx no trae mensaje", () => {
    expect(describeReceiptError(httpError(409))).toBe(
      "El servidor rechazó la solicitud (HTTP 409).",
    );
  });

  it.each([500, 502, 503])(
    "indica que el servidor falló con el código %s y sugiere reintentar",
    (status) => {
      expect(describeReceiptError(httpError(status))).toBe(
        `El servidor falló (HTTP ${status}). Reintenta en unos segundos; si sigue, avisa a soporte.`,
      );
    },
  );

  it("explica el timeout cuando el servidor tarda demasiado", () => {
    expect(
      describeReceiptError(new AxiosError("timeout of 0ms exceeded", "ECONNABORTED")),
    ).toBe("El servidor tardó demasiado en responder. Reintenta.");
  });

  it("explica la falta de conexión cuando no hay respuesta", () => {
    expect(
      describeReceiptError(new AxiosError("Network Error", "ERR_NETWORK")),
    ).toBe("No hubo conexión con el servidor. Revisa tu internet y reintenta.");
  });

  it("explica que la sesión se estaba actualizando cuando axiosAuth cancela la petición", () => {
    expect(
      describeReceiptError(
        new CanceledError("La sesión está cambiando. Reintenta cuando termine de iniciar sesión."),
      ),
    ).toBe("La sesión se estaba actualizando. Reintenta en unos segundos.");
  });

  it("muestra tal cual el texto de las validaciones propias, que ya están en español", () => {
    expect(
      describeReceiptError(new Error("Vuelve a cargar el pedido antes de imprimirlo.")),
    ).toBe("Vuelve a cargar el pedido antes de imprimirlo.");
  });

  it("marca como inesperado un error de programación e incluye su tipo", () => {
    expect(describeReceiptError(new TypeError("x is undefined"))).toBe(
      "Error inesperado (TypeError: x is undefined).",
    );
  });

  it("marca como inesperado un valor que no es un Error", () => {
    expect(describeReceiptError("boom")).toBe("Error inesperado.");
  });
});

describe("summarizeReceiptFailures", () => {
  it("nombra el pedido y su motivo cuando falló uno solo", () => {
    expect(
      summarizeReceiptFailures([{ orderNumber: "ORD-1", reason: "Motivo A." }]),
    ).toBe("ORD-1: Motivo A.");
  });

  it("agrupa los pedidos que fallaron por el mismo motivo", () => {
    expect(
      summarizeReceiptFailures([
        { orderNumber: "ORD-1", reason: "Motivo A." },
        { orderNumber: "ORD-2", reason: "Motivo A." },
      ]),
    ).toBe("ORD-1, ORD-2: Motivo A.");
  });

  it("separa los grupos cuando los motivos difieren", () => {
    expect(
      summarizeReceiptFailures([
        { orderNumber: "ORD-1", reason: "Motivo A." },
        { orderNumber: "ORD-2", reason: "Motivo B." },
        { orderNumber: "ORD-3", reason: "Motivo A." },
      ]),
    ).toBe("ORD-1, ORD-3: Motivo A. | ORD-2: Motivo B.");
  });
});
