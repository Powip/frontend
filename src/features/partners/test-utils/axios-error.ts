import { AxiosError, AxiosHeaders, type AxiosResponse } from "axios";

export function buildAxiosError(
  status?: number,
  data?: unknown,
  headers: Record<string, string> = {},
): AxiosError {
  const config = { headers: new AxiosHeaders() };
  const response =
    status === undefined
      ? undefined
      : ({
          status,
          statusText: "",
          headers: new AxiosHeaders(headers),
          config,
          data,
        } as AxiosResponse);

  return new AxiosError(
    status === undefined ? "Network Error" : `Request failed with status code ${status}`,
    status === undefined ? "ERR_NETWORK" : "ERR_BAD_RESPONSE",
    config,
    undefined,
    response,
  );
}
