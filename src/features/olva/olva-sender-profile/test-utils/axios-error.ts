import { AxiosError, type AxiosResponse } from "axios";

/** Builds the AxiosError the services would throw for a given backend response body. */
export function buildAxiosError(status: number, data: unknown): AxiosError {
  const response = {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: {} },
  } as AxiosResponse;

  return new AxiosError(
    "Request failed",
    AxiosError.ERR_BAD_REQUEST,
    response.config,
    null,
    response,
  );
}

export function buildBusinessError(status: number, code: string): AxiosError {
  return buildAxiosError(status, {
    statusCode: status,
    error: "Backend message",
    source: "olva",
    details: { code },
  });
}

export function buildValidationError(errors: { field: string; message: string }[]): AxiosError {
  return buildAxiosError(400, { statusCode: 400, message: "Validation failed", errors });
}
