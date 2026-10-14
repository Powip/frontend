jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }));
import * as Sentry from "@sentry/nextjs";
import { captureAppError, reportHttpFailure, scrubEvent } from "../observability";

beforeEach(() => jest.clearAllMocks());

it("reports a handled 503 with operation/status without credentials or customer parameters", () => {
  const error = new Error("Request failed with status code 503");
  reportHttpFailure({
    url: "https://api.powip.tech/ventas/order-header/sale-context?token=private&phone=999999999",
    status: 503,
    error,
  });
  captureAppError(error, "query");
  expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  const [reported, context] = jest.mocked(Sentry.captureException).mock.calls[0];
  expect((reported as Error).message).toBe(
    "HTTP 503: GET https://api.powip.tech/ventas/order-header/sale-context",
  );
  expect(context).toEqual(
    expect.objectContaining({
      level: "error",
      tags: expect.objectContaining({ http_status: "503", source: "http" }),
    }),
  );
  expect(JSON.stringify(context)).not.toMatch(/private|999999999/);
});

it.each([408, 429])("reports operational HTTP %s as a warning", (status) => {
  reportHttpFailure({ url: "/ventas/orders", status });
  expect(Sentry.captureException).toHaveBeenCalledWith(
    expect.any(Error),
    expect.objectContaining({ level: "warning" }),
  );
});

it("keeps expected authentication failures as breadcrumbs and ignores intentional cancellations", () => {
  const error = Object.assign(new Error("Session expired"), {
    isAxiosError: true,
    config: { url: "/auth/refresh" },
    response: { status: 401 },
  });
  captureAppError(error, "query");
  captureAppError(new DOMException("Operation aborted", "AbortError"), "query");
  expect(Sentry.captureException).not.toHaveBeenCalled();
  expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
    expect.objectContaining({
      category: "http",
      data: expect.objectContaining({ status_code: 401 }),
    }),
  );
});

it("does not recursively report Sentry delivery failures", () => {
  reportHttpFailure({ url: "https://o1.ingest.us.sentry.io/api/123/envelope/", status: 503 });
  expect(Sentry.captureException).not.toHaveBeenCalled();
});

it("does not turn a telemetry failure into a new application failure", () => {
  jest.mocked(Sentry.captureException).mockImplementationOnce(() => {
    throw new Error("Telemetry unavailable");
  });
  expect(() => captureAppError(new Error("Original operation failed"), "query")).not.toThrow();
});

it("keeps provider response JSON and encoded phone parameters out of captured exceptions", () => {
  const error = new Error(
    'Error 503: {"fullName":"Synthetic Private Person","street":"Synthetic Street42","document":"AB1234"}',
  );
  captureAppError(error, "query");
  const result = scrubEvent({
    exception: { values: [{ type: "Error", value: error.message }] },
    request: { url: "https://api.powip.tech/clients/phone/%2B51999123456" },
  });
  const captured = jest.mocked(Sentry.captureException).mock.calls[0][0] as Error;
  expect(captured.message).toBe("Application operation failed");
  expect(JSON.stringify(result)).not.toMatch(/Private Person|Street42|AB1234|51999123456/);
  expect(result.request?.url).toBe("https://api.powip.tech/clients/phone/:id");
});

it("resolves relative Axios bases and reports the actual API path", () => {
  captureAppError(
    {
      isAxiosError: true,
      config: { baseURL: "/api", url: "/products" },
      response: { status: 503 },
    },
    "query",
  );
  expect((jest.mocked(Sentry.captureException).mock.calls[0][0] as Error).message).toBe(
    "HTTP 503: GET /api/products",
  );
});

it("strips credentials, request bodies, customer records and identifier-bearing URLs from SDK events", () => {
  const result = scrubEvent({
    message: "Failure for test@example.com password=supersecret Bearer a-secret",
    user: { email: "test@example.com", ip_address: "1.2.3.4" },
    request: {
      url: "https://user:password@api.powip.tech/clients/999999999?token=private",
      method: "POST",
      headers: { Authorization: "Bearer secret" },
      data: { fullName: "Private Person" },
      cookies: "session=secret",
    },
    extra: {
      config: { headers: { Authorization: "Bearer secret" }, data: { client: "Private Person" } },
    },
    contexts: {
      response: { status_code: 503, data: "Private Person" },
      arbitrary: { nested: "Private Person" },
    },
    breadcrumbs: [
      { category: "console", message: "Private Person", data: { arguments: ["Private Person"] } },
      { category: "fetch", data: { url: "/orders/14563?email=test@example.com", method: "POST" } },
    ],
  });
  const serialized = JSON.stringify(result);
  expect(serialized).not.toMatch(
    /supersecret|a-secret|test@example.com|Private Person|Bearer secret|session=secret|999999999|token=private|14563/,
  );
  expect(result.request).toEqual({ url: "https://api.powip.tech/clients/:id", method: "POST" });
  expect(result.contexts?.response?.status_code).toBe(503);
});
