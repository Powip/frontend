import { AxiosError, type AxiosResponse } from "axios";

/** An AxiosError with the given status and body, as ms-integrations would answer. */
export function buildOlvaAxiosError(status: number, data: unknown = {}): AxiosError {
  return new AxiosError("Request failed", String(status), undefined, undefined, {
    status,
    data,
    statusText: "",
    headers: {},
    config: {} as AxiosResponse["config"],
  } as AxiosResponse);
}
