import { toFieldErrors } from "../to-field-errors";

const FIELDS = ["email", "phone", "country"] as const;

describe("toFieldErrors", () => {
  it("lee details.fields del VALIDATION_ERROR real de ms-partners", () => {
    expect(
      toFieldErrors(
        {
          fields: { phone: "must match phone pattern", country: "must be ISO", unknown: "ignored" },
        },
        FIELDS,
      ),
    ).toEqual({ phone: "must match phone pattern", country: "must be ISO" });
  });

  it("toma mensajes indexados por nombre de campo", () => {
    expect(
      toFieldErrors({ phone: "must be valid", country: ["must be ISO", "required"] }, FIELDS),
    ).toEqual({ phone: "must be valid", country: "must be ISO required" });
  });

  it("toma listas de { field, message }", () => {
    expect(
      toFieldErrors({ fieldErrors: [{ field: "email", message: "already applied" }] }, FIELDS),
    ).toEqual({ email: "already applied" });
  });

  it("ignora campos que el formulario no tiene y formas desconocidas", () => {
    expect(
      toFieldErrors(
        { other: "x", errors: [{ field: "legalName", message: "y" }], violations: "z" },
        FIELDS,
      ),
    ).toEqual({});
  });
});
