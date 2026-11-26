import { describe, expect, it } from "vitest";
import type { CreateOlvaSenderProfileFormValues } from "../../schemas/olva-sender-profile.schema";
import { toCreateOlvaSenderProfileRequestDto } from "../to-create-olva-sender-profile-request.dto";

const values: CreateOlvaSenderProfileFormValues = {
  label: "Almacén principal",
  ruc: "20616141971",
  email: "remitente@empresa.com",
  firstNames: "Maria Fernanda",
  lastName: "Quispe Rojas",
  phone: "987654321",
  isDefault: true,
};

describe("toCreateOlvaSenderProfileRequestDto", () => {
  it("copies every field", () => {
    expect(toCreateOlvaSenderProfileRequestDto(values)).toEqual(values);
  });

  it("omits an empty phone, because the backend validates it when present", () => {
    const dto = toCreateOlvaSenderProfileRequestDto({ ...values, phone: "" });

    expect(dto.phone).toBeUndefined();
  });
});
