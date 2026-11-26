import { describe, expect, it } from "vitest";
import { toCreateOlvaShipmentRequestDto } from "../mappers/to-create-olva-shipment-request.dto";
import { createOlvaShipmentSchema } from "../schemas/olva-shipment.schema";

const valid = {
  recipient: {
    documentType: "dni",
    documentNumber: "12345678",
    fullName: "Juan Pérez",
    phone: "999888777",
    email: "",
  },
  origin: { headquarterId: "12", address: "" },
  destination: { agencyCode: "LIM01", address: "", reference: "" },
  package: { weightKg: "1.5", declaredValue: "80", lengthCm: "" },
  pin: "",
};

describe("createOlvaShipmentSchema", () => {
  it("turns blank inputs into undefined and text numbers into numbers", () => {
    const result = createOlvaShipmentSchema.safeParse(valid);

    expect(result.success).toBe(true);
    expect(result.data?.package.weightKg).toBe(1.5);
    expect(result.data?.package.declaredValue).toBe(80);
    expect(result.data?.package.lengthCm).toBeUndefined();
    expect(result.data?.recipient.email).toBeUndefined();
    expect(result.data?.pin).toBeUndefined();
  });

  it("its output feeds the request mapper directly", () => {
    const { data } = createOlvaShipmentSchema.safeParse(valid);

    const dto = toCreateOlvaShipmentRequestDto(data as NonNullable<typeof data>);

    expect(dto.package).toEqual({ weightKg: 1.5, declaredValue: 80 });
    expect(dto.destination).toEqual({ agencyCode: "LIM01" });
  });

  it("a home delivery's output feeds the request mapper and drops store-pickup leftovers", () => {
    const { data, success } = createOlvaShipmentSchema.safeParse({
      ...valid,
      deliveryType: "D",
      whoPays: "ONLINE",
      paymentMethod: "niubiz",
      destination: { agencyCode: "", ubigeoCode: "250202", address: "Av. 1", reference: "Parque" },
    });

    expect(success).toBe(true);

    const dto = toCreateOlvaShipmentRequestDto(data as NonNullable<typeof data>);

    expect(dto.destination).toEqual({
      ubigeoCode: "250202",
      address: "Av. 1",
      reference: "Parque",
    });
    expect(dto).not.toHaveProperty("pin");
  });

  it("reports required fields, the document length and the PIN", () => {
    const result = createOlvaShipmentSchema.safeParse({
      ...valid,
      recipient: { ...valid.recipient, documentNumber: "123", fullName: " " },
      origin: { headquarterId: "" },
      package: { weightKg: "0" },
      pin: "12a4",
    });

    const messages = result.error?.issues.map((issue) => issue.message);

    expect(messages).toContain("El DNI debe tener 8 dígitos");
    expect(messages).toContain("El nombre del destinatario es obligatorio");
    expect(messages).toContain("Elige la sede de origen");
    expect(messages).toContain("El peso mínimo es 0.01 kg");
    expect(messages).toContain("El PIN debe tener exactamente 4 dígitos");
  });

  it("does not stack two messages on an empty document", () => {
    const result = createOlvaShipmentSchema.safeParse({
      ...valid,
      recipient: { ...valid.recipient, documentNumber: "" },
    });

    expect(
      result.error?.issues.filter((i) => i.path.join(".") === "recipient.documentNumber"),
    ).toHaveLength(1);
  });

  it("rejects a malformed recipient email", () => {
    const result = createOlvaShipmentSchema.safeParse({
      ...valid,
      recipient: { ...valid.recipient, email: "nope" },
    });

    expect(result.success).toBe(false);
  });
});
