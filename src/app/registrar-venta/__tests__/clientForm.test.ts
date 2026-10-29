import type { Client } from "@/interfaces/ICliente";
import { buildClientUpdatePayload, clientToFormFields } from "../clientForm";

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
