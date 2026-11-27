import { describe, expect, it } from "vitest";
import type { CreateOlvaSenderProfileFormValues } from "../../schemas/olva-sender-profile.schema";
import { buildOlvaSenderProfileResponse } from "../../test-utils/olva-sender-profile.fixtures";
import { toCreateOlvaSenderProfileRequestDto } from "../to-create-olva-sender-profile-request.dto";
import { toOlvaSenderProfile } from "../to-olva-sender-profile";

const values: CreateOlvaSenderProfileFormValues = {
  label: "Almacén principal",
  documentType: "ruc",
  documentNumber: "20616141971",
  email: "remitente@empresa.com",
  firstNames: "Maria Fernanda",
  lastName: "Quispe Rojas",
  phone: "987654321",
  isDefault: true,
};

describe("toCreateOlvaSenderProfileRequestDto", () => {
  it("sends the document as documentType + documentNumber (FEAT-35), the rest as is", () => {
    expect(toCreateOlvaSenderProfileRequestDto(values)).toEqual(values);
  });

  it("a person ships by DNI", () => {
    const dto = toCreateOlvaSenderProfileRequestDto({
      ...values,
      documentType: "dni",
      documentNumber: "45678912",
    });

    expect(dto).toMatchObject({ documentType: "dni", documentNumber: "45678912" });
  });

  it("omits an empty phone, because the backend validates it when present", () => {
    const dto = toCreateOlvaSenderProfileRequestDto({ ...values, phone: "" });

    expect(dto.phone).toBeUndefined();
  });
});

describe("toOlvaSenderProfile (FEAT-35)", () => {
  it("keeps the sender's document type and number", () => {
    const profile = toOlvaSenderProfile(
      buildOlvaSenderProfileResponse({ documentType: "dni", documentNumber: "45678912" }),
    );

    expect(profile.documentType).toBe("dni");
    expect(profile.documentNumber).toBe("45678912");
  });
});
