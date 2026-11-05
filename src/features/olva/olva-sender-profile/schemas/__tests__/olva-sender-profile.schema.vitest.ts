import { describe, expect, it } from "vitest";
import {
  createOlvaSenderProfileSchema,
  updateOlvaSenderProfileSchema,
} from "../olva-sender-profile.schema";

const validValues = {
  label: "Almacén principal",
  ruc: "20616141971",
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
      ruc: " 20616141971 ",
    });

    expect(result.label).toBe("Almacén");
    expect(result.email).toBe("remitente@empresa.com");
    expect(result.ruc).toBe("20616141971");
  });

  it("reports one required message per empty field, not two", () => {
    const errors = errorsOf({
      ...validValues,
      label: "",
      ruc: "",
      email: "",
      firstNames: "",
      lastName: "",
    });

    expect(errors).toEqual({
      label: "El nombre del remitente es obligatorio",
      ruc: "El RUC es obligatorio",
      email: "El correo es obligatorio",
      firstNames: "Los nombres son obligatorios",
      lastName: "El apellido es obligatorio",
    });
  });

  it("rejects an RUC with a wrong check digit", () => {
    expect(errorsOf({ ...validValues, ruc: "20616141972" }).ruc).toBe("El RUC no es válido");
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
  it("does not accept a RUC: it cannot be changed", () => {
    expect("ruc" in updateOlvaSenderProfileSchema.shape).toBe(false);
  });
});
