import { describe, expect, it, vi } from "vitest";
import {
  buildAxiosError,
  buildBusinessError,
  buildValidationError,
} from "../../test-utils/axios-error";
import { applyOlvaSenderProfileServerErrors } from "../apply-olva-sender-profile-server-errors";

describe("applyOlvaSenderProfileServerErrors", () => {
  it.each([
    ["SENDER_PROFILE_DUPLICATE_RUC", 409, "Ya tienes un remitente registrado con ese RUC."],
    ["SENDER_PROFILE_INVALID_RUC", 422, "El RUC ingresado no es válido."],
    ["SENDER_PROFILE_INVALID_DNI", 422, "El DNI debe tener 8 dígitos."],
    ["SENDER_PROFILE_DUPLICATE_DNI", 409, "Ya tienes un remitente registrado con ese DNI."],
    [
      "SENDER_PROFILE_DNI_NOT_FOUND_IN_OLVA",
      422,
      "Olva no encontró ese DNI. Verifica el número e intenta nuevamente.",
    ],
    [
      "SENDER_PROFILE_RUC_NOT_FOUND_IN_OLVA",
      422,
      "Olva no encontró ese RUC. Verifica el número e intenta nuevamente.",
    ],
    [
      "SENDER_PROFILE_RUC_NOT_ACTIVE",
      422,
      "El RUC no está activo, por lo que Olva no lo acepta como remitente.",
    ],
  ])("pins %s to the document number field", (code, status, message) => {
    const setError = vi.fn();

    const applied = applyOlvaSenderProfileServerErrors(setError, buildBusinessError(status, code));

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledExactlyOnceWith("documentNumber", { type: "server", message });
  });

  it("leaves errors that do not belong to a field to the toast", () => {
    const setError = vi.fn();

    const applied = applyOlvaSenderProfileServerErrors(
      setError,
      buildBusinessError(409, "SENDER_PROFILE_LIMIT_REACHED"),
    );

    expect(applied).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("maps 400 validation errors to their fields and skips unknown ones", () => {
    const setError = vi.fn();

    const applied = applyOlvaSenderProfileServerErrors(
      setError,
      buildValidationError([
        { field: "email", message: "Invalid sender email format" },
        { field: "documentNumber", message: "Invalid DNI" },
        { field: "isArchived", message: "Not a form field" },
      ]),
    );

    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Invalid sender email format",
    });
    expect(setError).toHaveBeenCalledWith("documentNumber", {
      type: "server",
      message: "Invalid DNI",
    });
  });

  it("ignores errors that are not HTTP responses", () => {
    const setError = vi.fn();

    expect(applyOlvaSenderProfileServerErrors(setError, new Error("boom"))).toBe(false);
    expect(applyOlvaSenderProfileServerErrors(setError, buildAxiosError(500, {}))).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
