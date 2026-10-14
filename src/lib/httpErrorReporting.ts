import axios, { type AxiosInstance } from "axios";
import { captureAppError, reportHttpFailure } from "./observability";

const instances = new WeakSet<AxiosInstance>();
let installed = false;

export function instrumentAxiosInstance<T extends AxiosInstance>(instance: T): T {
  if (instances.has(instance)) return instance;
  instances.add(instance);
  instance.interceptors.response.use(undefined, (error) => {
    try {
      captureAppError(error, "http");
    } catch {
      /* Telemetry must preserve the request failure. */
    }
    return Promise.reject(error);
  });
  return instance;
}

/** Installed before the app imports its API clients. Covers raw axios, created clients and fetch. */
export function installErrorReporting(): void {
  if (installed) return;
  installed = true;
  instrumentAxiosInstance(axios);
  const create = axios.create.bind(axios);
  axios.create = (config) => instrumentAxiosInstance(create(config));

  if (typeof globalThis.fetch === "function") {
    globalThis.fetch = new Proxy(globalThis.fetch, {
      apply: async (fetch, thisArg, args) => {
        const [input, init] = args as Parameters<typeof globalThis.fetch>;
        const request =
          typeof Request !== "undefined" && input instanceof Request ? input : undefined;
        const url = request?.url ?? String(input);
        const method = init?.method ?? request?.method ?? "GET";
        try {
          const response: Response = await Reflect.apply(fetch, thisArg, args);
          if (response.status >= 400) {
            try {
              reportHttpFailure({ url, method, status: response.status });
            } catch {
              /* Preserve response. */
            }
          }
          return response;
        } catch (error) {
          try {
            reportHttpFailure({ url, method, error });
          } catch {
            /* Preserve original error. */
          }
          throw error;
        }
      },
    });
  }

  const log = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && /^\[?Sentry\b/.test(args[0])) {
      log(...args);
      return;
    }
    try {
      const error = args.find((arg) => arg instanceof Error);
      captureAppError(error ?? new Error("Application logged an error"), "console");
    } catch {
      /* Preserve logging even if telemetry is unavailable. */
    }
    log(...args);
  };
}

export function installBrowserErrorReporting(): void {
  if (typeof window !== "undefined") installErrorReporting();
}
