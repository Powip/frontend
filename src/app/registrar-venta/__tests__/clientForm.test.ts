import type { Client } from "@/interfaces/ICliente";
import {
  buildClientUpdatePayload,
  clientToFormFields,
  normalizeGoogleMapsUrl,
  splitOrderClientChanges,
} from "../clientForm";

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    companyId: "company-1",
    fullName: "Cliente de prueba",
    phoneNumber: "987654321",
    clientType: "TRADICIONAL",
    province: "Lima",
    city: "Lima",
    district: "Miraflores",
    address: "Av. Principal 123",
    isActive: true,
    ...overrides,
  };
}

describe("cambios del cliente al registrar una venta", () => {
  it("sends snapshot-order delivery changes only to the order and preserves identity updates separately", () => {
    const changes = {
      fullName: "Cliente corregido",
      city: "Arequipa",
      province: "Arequipa",
      district: "Cayma",
      address: "Av. Nueva 789",
      reference: null,
      latitude: null,
      longitude: null,
      googleMapsUrl: null,
    };
    expect(splitOrderClientChanges(changes, true)).toEqual({
      sharedClientChanges: { fullName: "Cliente corregido" },
      deliveryChanges: {
        department: "Arequipa",
        province: "Arequipa",
        district: "Cayma",
        address: "Av. Nueva 789",
        reference: null,
        latitude: null,
        longitude: null,
        googleMapsUrl: null,
      },
    });
    expect(changes.city).toBe("Arequipa");
  });

  it("keeps historical customer edits unchanged and omits a delivery patch if no destination was edited", () => {
    expect(splitOrderClientChanges({ address: "Av. Nueva 789" }, false)).toEqual({
      sharedClientChanges: { address: "Av. Nueva 789" },
      deliveryChanges: undefined,
    });
    expect(splitOrderClientChanges({ phoneNumber: "987654321" }, true)).toEqual({
      sharedClientChanges: { phoneNumber: "987654321" },
      deliveryChanges: undefined,
    });
  });
  it("no reenvía campos sin cambios ni el companyId", () => {
    const original = client();

    expect(buildClientUpdatePayload(original, clientToFormFields(original))).toEqual({});
  });

  it("guarda la dirección sin revalidar ubicación, teléfono o mapa heredados", () => {
    const original = client({
      province: "",
      city: "",
      district: "",
      phoneNumber: "+51-987-654-321",
      googleMapsUrl: "ubicación antigua sin enlace",
    });
    const form = { ...clientToFormFields(original), address: "Av. Nueva 456" };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      address: "Av. Nueva 456",
    });
  });

  it("normaliza los null de la API sin inventar cambios", () => {
    // Las columnas nullable del backend llegan como null aunque Client las
    // declare opcionales, incluido documentType.
    const original = {
      ...client(),
      phoneNumber: null,
      documentType: null,
      documentNumber: null,
      reference: null,
      latitude: null,
      longitude: null,
      googleMapsUrl: null,
    } as unknown as Client;
    const form = clientToFormFields(original);

    expect(form.documentType).toBeUndefined();
    expect(form.phoneNumber).toBe("");
    expect(form.documentNumber).toBe("");
    expect(buildClientUpdatePayload(original, form)).toEqual({});
  });

  it("envía el departamento modificado con el nombre city del API", () => {
    const original = client();
    const form = { ...clientToFormFields(original), department: "Arequipa" };

    expect(buildClientUpdatePayload(original, form)).toEqual({ city: "Arequipa" });
  });

  it("incluye el tipo al cambiar solo el número de documento", () => {
    const original = client({ documentType: "DNI", documentNumber: "12345678" });
    const form = { ...clientToFormFields(original), documentNumber: "87654321" };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      documentType: "DNI",
      documentNumber: "87654321",
    });
  });

  it("incluye el número al cambiar solo el tipo de documento", () => {
    const original = client({ documentType: "DNI", documentNumber: "12345678" });
    const form = {
      ...clientToFormFields(original),
      documentType: "PASAPORTE" as const,
    };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      documentType: "PASAPORTE",
      documentNumber: "12345678",
    });
  });

  it("borra ambos campos del documento al seleccionar sin documento", () => {
    const original = client({ documentType: "DNI", documentNumber: "12345678" });
    const form = {
      ...clientToFormFields(original),
      documentType: undefined,
      documentNumber: "",
    };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      documentType: null,
      documentNumber: null,
    });
  });

  it("conserva el número vacío editado para que se pueda validar", () => {
    const original = client({ documentType: "DNI", documentNumber: "12345678" });
    const form = { ...clientToFormFields(original), documentNumber: "" };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      documentType: "DNI",
      documentNumber: "",
    });
  });

  it("envía null para borrar referencia, mapa y coordenadas", () => {
    const original = client({
      reference: "Frente al parque",
      googleMapsUrl: "https://maps.google.com/?q=-12.1,-77.1",
      latitude: -12.1,
      longitude: -77.1,
    });
    const form = {
      ...clientToFormFields(original),
      reference: "",
      googleMapsUrl: "",
      latitude: "",
      longitude: "",
    };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      reference: null,
      googleMapsUrl: null,
      latitude: null,
      longitude: null,
    });
  });

  it("envía las coordenadas editadas como números, incluido cero", () => {
    const original = client({ latitude: -12.1, longitude: -77.1 });
    const form = {
      ...clientToFormFields(original),
      latitude: "0",
      longitude: "-77.25",
    };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      latitude: 0,
      longitude: -77.25,
    });
  });

  it("omite un teléfono vacío heredado al modificar otro campo", () => {
    const original = client({ phoneNumber: "" });
    const form = { ...clientToFormFields(original), fullName: "Nombre corregido" };

    expect(buildClientUpdatePayload(original, form)).toEqual({ fullName: "Nombre corregido" });
  });

  it("mantiene el teléfono vacío editado para que falle la validación", () => {
    const original = client();
    const form = { ...clientToFormFields(original), phoneNumber: "" };

    expect(buildClientUpdatePayload(original, form)).toEqual({ phoneNumber: "" });
  });
});

describe("correo y RUC del cliente", () => {
  it("carga el correo guardado (null del API como vacío)", () => {
    expect(clientToFormFields(client({ email: "compras@drasanvi.pe" })).email).toBe("compras@drasanvi.pe");
    expect(clientToFormFields(client({ email: null })).email).toBe("");
  });

  it("envía el correo recortado solo si cambió, y null al borrarlo", () => {
    const original = client({ email: "viejo@drasanvi.pe" });
    const base = clientToFormFields(original);

    expect(buildClientUpdatePayload(original, base)).toEqual({});
    expect(buildClientUpdatePayload(original, { ...base, email: " nuevo@drasanvi.pe " })).toEqual({
      email: "nuevo@drasanvi.pe",
    });
    expect(buildClientUpdatePayload(original, { ...base, email: "" })).toEqual({ email: null });
  });

  it("envía RUC con su número juntos", () => {
    const original = client();
    const form = { ...clientToFormFields(original), documentType: "RUC" as const, documentNumber: "20100070970" };

    expect(buildClientUpdatePayload(original, form)).toEqual({
      documentType: "RUC",
      documentNumber: "20100070970",
    });
  });

  it("el correo es dato del cliente, no de la entrega: nunca va al parche del pedido", () => {
    expect(splitOrderClientChanges({ email: "x@y.pe", address: "Av. 1" }, true)).toEqual({
      sharedClientChanges: { email: "x@y.pe" },
      deliveryChanges: { address: "Av. 1" },
    });
  });
});

describe("link de Google Maps del cliente", () => {
  it("agrega https:// solo cuando falta el protocolo", () => {
    expect(normalizeGoogleMapsUrl("maps.app.goo.gl/abc123")).toEqual({
      valid: true,
      url: "https://maps.app.goo.gl/abc123",
    });
    expect(normalizeGoogleMapsUrl("  www.google.com/maps?q=-12.1,-77.1  ")).toEqual({
      valid: true,
      url: "https://www.google.com/maps?q=-12.1,-77.1",
    });
    expect(normalizeGoogleMapsUrl("https://maps.app.goo.gl/abc123")).toEqual({
      valid: true,
      url: "https://maps.app.goo.gl/abc123",
    });
    expect(normalizeGoogleMapsUrl("HTTP://maps.google.com/?q=1,2")).toEqual({
      valid: true,
      url: "HTTP://maps.google.com/?q=1,2",
    });
  });

  it("permite el campo vacío", () => {
    expect(normalizeGoogleMapsUrl("")).toEqual({ valid: true, url: null });
    expect(normalizeGoogleMapsUrl("   ")).toEqual({ valid: true, url: null });
    expect(normalizeGoogleMapsUrl(null)).toEqual({ valid: true, url: null });
    expect(normalizeGoogleMapsUrl(undefined)).toEqual({ valid: true, url: null });
  });

  it.each([
    "frente al parque",
    "casa",
    "ftp://maps.google.com/x",
    "=HYPERLINK(\"https://evil.test\")",
    "https://",
    "javascript:alert(1)",
    `maps.google.com/${"a".repeat(500)}`,
  ])("rechaza %s porque no queda como URL válida", (value) => {
    expect(normalizeGoogleMapsUrl(value)).toEqual({ valid: false });
  });

  it("al editar un cliente envía el link corregido y no toca uno antiguo sin modificar", () => {
    const original = client({ googleMapsUrl: "ubicación antigua sin enlace" });
    const form = clientToFormFields(original);

    expect(buildClientUpdatePayload(original, form)).not.toHaveProperty("googleMapsUrl");
    expect(
      buildClientUpdatePayload(original, { ...form, googleMapsUrl: "maps.app.goo.gl/abc123" }),
    ).toEqual({ googleMapsUrl: "https://maps.app.goo.gl/abc123" });
    expect(buildClientUpdatePayload(original, { ...form, googleMapsUrl: "" })).toEqual({
      googleMapsUrl: null,
    });
  });
});
