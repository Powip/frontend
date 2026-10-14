jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));
import * as Sentry from "@sentry/nextjs";
import axios, { AxiosError, CanceledError } from "axios";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { installBrowserErrorReporting, instrumentAxiosInstance } from "../httpErrorReporting";
import { captureAppError } from "../observability";

const fetchMock = jest.fn();
const originalFetch = window.fetch;
const originalCreate = axios.create;
const originalConsole = console.error;

beforeAll(() => {
  Reflect.set(fetchMock, "__nextPatched", true);
  window.fetch = fetchMock;
  installBrowserErrorReporting();
});

it("preserves Next.js patched fetch metadata", () => {
  expect(Reflect.get(window.fetch, "__nextPatched")).toBe(true);
});
afterAll(() => {
  window.fetch = originalFetch;
  axios.create = originalCreate;
  console.error = originalConsole;
});
beforeEach(() => {
  jest.clearAllMocks();
});

it("records a swallowed fetch 503 and preserves the exact response for the application", async () => {
  const response = { status: 503, body: "sensitive" } as unknown as Response;
  fetchMock.mockResolvedValue(response);
  expect(await window.fetch("https://api.powip.tech/ventas/order-header/sale-context")).toBe(
    response,
  );
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ tags: expect.objectContaining({ http_status: "503" }) }),
  );
});

it("records offline fetch failure without changing the error, and preserves intentional aborts", async () => {
  const offline = new TypeError("Failed to fetch");
  fetchMock.mockRejectedValueOnce(offline);
  await expect(window.fetch("/products/report")).rejects.toBe(offline);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  const abort = new DOMException("Cancelled", "AbortError");
  fetchMock.mockRejectedValueOnce(abort);
  await expect(window.fetch("/products/report")).rejects.toBe(abort);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
});

it("captures raw axios-created clients before a caught query error, without double reporting", async () => {
  const api = axios.create();
  instrumentAxiosInstance(api);
  const query = new QueryClient({
    queryCache: new QueryCache({ onError: (error) => captureAppError(error, "query") }),
    defaultOptions: { queries: { retry: false } },
  });
  let failure: AxiosError;
  const request = () =>
    api.get("https://api.powip.tech/ventas/order-header/sale-context", {
      adapter: async (config) => {
        failure = new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, undefined, {
          status: 503,
          statusText: "Unavailable",
          data: { secret: "private" },
          headers: {},
          config,
        });
        throw failure;
      },
    });
  await expect(
    query.fetchQuery({ queryKey: ["sale-context"], queryFn: request }),
  ).rejects.toBeInstanceOf(AxiosError);
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  expect((jest.mocked(Sentry.captureException).mock.calls[0][0] as Error).message).toContain(
    "HTTP 503",
  );
  query.clear();
});

it("leaves successful axios responses and cancellations unchanged", async () => {
  const api = axios.create();
  await expect(
    api.get("/success", {
      adapter: async (config) => ({
        status: 200,
        statusText: "OK",
        data: "ok",
        headers: {},
        config,
      }),
    }),
  ).resolves.toEqual(expect.objectContaining({ data: "ok" }));
  const cancellation = new CanceledError();
  await expect(
    api.get("/cancelled", {
      adapter: async () => {
        throw cancellation;
      },
    }),
  ).rejects.toBe(cancellation);
  expect(Sentry.captureException).not.toHaveBeenCalled();
});
