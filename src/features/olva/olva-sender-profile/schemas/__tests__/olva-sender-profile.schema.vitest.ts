import { describe, expect, it } from "vitest";
import {
  createOlvaSenderProfileSchema,
  updateOlvaSenderProfileSchema,
} from "../olva-sender-profile.schema";

const validValues = {
  label: "Almacén principal",
  documentType: "ruc",
  documentNumber: "20616141971",
  email: "remitente@empresa.com",
  firstNames: "Maria Fernanda",
  lastName: "Quispe Rojas",
  phone: "",
  isDefault: false,
};

function errorsOf(values: Record<string, unknown>) {
  const result = createOlvaSenderProfileSchema.safeParse(values);

  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("createOlvaSenderProfileSchema", () => {
  it("accepts valid values", () => {
    expect(createOlvaSenderProfileSchema.safeParse(validValues).success).toBe(true);
  });

  it("trims text inputs", () => {
    const result = createOlvaSenderProfileSchema.parse({
      ...validValues,
      label: "  Almacén  ",
      email: " remitente@empresa.com ",
      documentNumber: " 20616141971 ",
    });

    expect(result.label).toBe("Almacén");
    expect(result.email).toBe("remitente@empresa.com");
    expect(result.documentNumber).toBe("20616141971");
  });

  it("reports one required message per empty field, not two", () => {
    const errors = errorsOf({
      ...validValues,
      label: "",
      documentNumber: "",
      email: "",
      firstNames: "",
      lastName: "",
    });

    expect(errors).toEqual({
      label: "El nombre del remitente es obligatorio",
      documentNumber: "El RUC es obligatorio",
      email: "El correo es obligatorio",
      firstNames: "Los nombres son obligatorios",
      lastName: "El apellido es obligatorio",
    });
  });

  it("rejects an RUC with a wrong check digit", () => {
    expect(errorsOf({ ...validValues, documentNumber: "20616141972" }).documentNumber).toBe(
      "El RUC no es válido",
    );
  });

  describe("DNI or RUC (FEAT-35)", () => {
    const dni = { ...validValues, documentType: "dni" };

    it("a DNI takes 8 digits", () => {
      expect(
        createOlvaSenderProfileSchema.safeParse({ ...dni, documentNumber: "45678912" }).success,
      ).toBe(true);
    });

    it("a DNI rejects 11 digits (that is a RUC)", () => {
      expect(errorsOf({ ...dni, documentNumber: "20616141971" }).documentNumber).toBe(
        "El DNI debe tener 8 dígitos",
      );
    });

    it("a RUC rejects 8 digits (that is a DNI)", () => {
      expect(errorsOf({ ...validValues, documentNumber: "45678912" }).documentNumber).toBe(
        "El RUC no es válido",
      );
    });

    it("an empty DNI says DNI", () => {
      expect(errorsOf({ ...dni, documentNumber: "" }).documentNumber).toBe("El DNI es obligatorio");
    });

    it("only DNI and RUC are document types", () => {
      expect(errorsOf({ ...validValues, documentType: "ce" }).documentType).toBe("Elige DNI o RUC");
    });
  });

  it("rejects a malformed email", () => {
    expect(errorsOf({ ...validValues, email: "no-es-correo" }).email).toBe(
      "El formato del correo no es válido",
    );
  });

  it("treats an empty phone as no phone", () => {
    expect(createOlvaSenderProfileSchema.safeParse({ ...validValues, phone: "   " }).success).toBe(
      true,
    );
  });

  it.each([
    ["too short", "12345", "El teléfono debe tener al menos 6 caracteres"],
    ["too long", "1".repeat(21), "El teléfono no puede superar los 20 caracteres"],
    ["bad characters", "987-abc-654", "El teléfono solo admite dígitos, espacios y + ( ) -"],
  ])("rejects a phone that is %s", (_label, phone, message) => {
    expect(errorsOf({ ...validValues, phone }).phone).toBe(message);
  });

  it("accepts a formatted phone", () => {
    expect(
      createOlvaSenderProfileSchema.safeParse({ ...validValues, phone: "+51 (987) 654-321" })
        .success,
    ).toBe(true);
  });
});

describe("updateOlvaSenderProfileSchema", () => {
  it("does not accept a document: it cannot be changed", () => {
    expect("documentNumber" in updateOlvaSenderProfileSchema.shape).toBe(false);
    expect("documentType" in updateOlvaSenderProfileSchema.shape).toBe(false);
  });
});
