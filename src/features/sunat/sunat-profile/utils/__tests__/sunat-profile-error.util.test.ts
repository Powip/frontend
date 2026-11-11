import { AxiosError, type AxiosResponse } from "axios";
import { getSunatProfileErrorMessage } from "../sunat-profile-error.util";

function backendError(data: { code?: string; message?: string }, status = 400): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data,
  } as AxiosResponse);
}

describe("getSunatProfileErrorMessage", () => {
  it("explains a wrong certificate password", () => {
    expect(
      getSunatProfileErrorMessage(backendError({ code: "CERTIFICATE_PASSWORD_INVALID" })),
    ).toMatch(/contraseña/i);
  });

  it("tells the user to pick another default before deleting the default profile", () => {
    expect(
      getSunatProfileErrorMessage(
        backendError({ code: "SUNAT_PROFILE_DEFAULT_CANNOT_BE_DELETED" }, 409),
      ),
    ).toMatch(/predeterminado/i);
  });

  it("explains a profile that no longer exists", () => {
    expect(
      getSunatProfileErrorMessage(backendError({ code: "SUNAT_PROFILE_NOT_FOUND" }, 404)),
    ).toMatch(/ya no existe/i);
  });

  it("falls back to the backend message for unknown codes", () => {
    expect(
      getSunatProfileErrorMessage(backendError({ code: "OTHER", message: "Algo específico" })),
    ).toBe("Algo específico");
  });

  it("never leaks raw axios text for non-backend errors", () => {
    expect(getSunatProfileErrorMessage(new Error("Request failed with status code 500"))).toBe(
      "Ocurrió un error. Intenta de nuevo en unos momentos.",
    );
  });
});
