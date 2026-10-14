import * as Sentry from "@sentry/nextjs";
import type { Breadcrumb, Event, EventHint } from "@sentry/nextjs";
import axios, { type AxiosRequestConfig } from "axios";

const reported = new WeakSet<object>();
const sensitive =
  /authorization|cookie|password|token|secret|credential|body|payload|email|phone|address|customer|client|user/i;

export function safeText(value: string): string {
  return value
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/((?:password|token|secret|authorization|cookie)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .replace(/https?:\/\/[^\s)"']+/g, (url) => safeUrl(url))
    .replace(/\b\d{7,}\b/g, "[number]")
    .slice(0, 2000);
}

/** Keep the operation, without query values, credentials or resource identifiers. */
export function safeUrl(value: string): string {
  try {
    const url = new URL(value, "https://powip.invalid");
    const path = url.pathname
      .split("/")
      .map((segment) => {
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch {
          return ":id";
        }
        if (
          /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(segment) ||
          /^\d+(?:\.\d+)?$/.test(segment) ||
          /^[0-9a-f]{24,}$/i.test(segment) ||
          /@|%40/i.test(segment) ||
          /^\+?\d{5,}$/.test(decoded)
        )
          return ":id";
        return segment;
      })
      .join("/");
    return url.origin === "https://powip.invalid" ? path : `${url.protocol}//${url.host}${path}`;
  } catch {
    return "[invalid-url]";
  }
}

function safeExceptionMessage(message: string, type?: string): string {
  if (type === "HttpRequestError" || type === "NetworkRequestError") return safeText(message);
  if (/^(?:Application operation failed|Application logged an error)$/.test(message))
    return message;
  if (
    type === "TypeError" &&
    /^Cannot read properties of (?:undefined|null) \(reading '[\w$]+'\)$/.test(message)
  )
    return message;
  if (
    [
      "Connection refused",
      "Connection reset",
      "Read timed out",
      "Failed to fetch",
      "Network Error",
    ].includes(message)
  )
    return message;
  return "Application operation failed";
}

function wasReported(error: unknown): boolean {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return false;
  if (reported.has(error)) return true;
  reported.add(error);
  return false;
}

export function isCancellation(error: unknown): boolean {
  const value = error as { name?: string; code?: string; __CANCEL__?: boolean } | null;
  return (
    value?.name === "AbortError" || value?.code === "ERR_CANCELED" || value?.__CANCEL__ === true
  );
}

function httpLevel(status?: number) {
  if (status === 408 || status === 429) return "warning" as const;
  if (!status || status >= 500) return "error" as const;
  return undefined;
}

export function reportHttpFailure({
  url,
  method = "GET",
  status,
  error,
}: {
  url: string;
  method?: string;
  status?: number;
  error?: unknown;
}): void {
  if (isCancellation(error) || /(?:\.sentry\.io|\/api\/[^/]+\/envelope)(?:[/:]|$)/i.test(url))
    return;
  const endpoint = safeUrl(url);
  const verb = method.toUpperCase();
  const level = httpLevel(status);
  if (!level) {
    Sentry.addBreadcrumb({
      category: "http",
      level: "warning",
      data: { method: verb, url: endpoint, status_code: status },
    });
    if (error && typeof error === "object") reported.add(error);
    return;
  }
  if (wasReported(error)) return;
  const message = `${status ? `HTTP ${status}` : "Network failure"}: ${verb} ${endpoint}`;
  const exception = new Error(message);
  exception.name = status ? "HttpRequestError" : "NetworkRequestError";
  const original = error as { stack?: unknown } | undefined;
  if (typeof original?.stack === "string")
    exception.stack = `${exception.name}: ${message}\n${original.stack.split("\n").slice(1).join("\n")}`;
  Sentry.captureException(exception, {
    level,
    tags: {
      service: "frontend",
      source: "http",
      http_method: verb,
      http_status: String(status ?? 0),
      endpoint,
    },
    fingerprint: ["powip-http", verb, endpoint, String(status ?? 0)],
  });
}

/** Report handled failures once, including values swallowed by queries or callbacks. */
export function captureAppError(error: unknown, source: string, section?: string): void {
  try {
    if (isCancellation(error)) return;
    const http = error as {
      isAxiosError?: boolean;
      config?: AxiosRequestConfig;
      response?: { status?: number };
    } | null;
    if (http?.isAxiosError) {
      const url = http.config ? axios.getUri(http.config) : "[unknown]";
      reportHttpFailure({ url, method: http.config?.method, status: http.response?.status, error });
      return;
    }
    const wrappedStatus =
      error instanceof Error
        ? error.message.match(/^(?:Error (\d{3}):|Request failed with status code (\d{3}))/)
        : undefined;
    const status = Number(wrappedStatus?.[1] ?? wrappedStatus?.[2]);
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      if (!wasReported(error))
        Sentry.addBreadcrumb({ category: "http", level: "warning", data: { status_code: status } });
      return;
    }
    if (wasReported(error)) return;
    const exception = new Error(
      safeExceptionMessage(
        error instanceof Error ? error.message : "",
        error instanceof Error ? error.name : "Error",
      ),
    );
    exception.name =
      error instanceof Error && /^[A-Za-z][\w.]{0,100}$/.test(error.name) ? error.name : "Error";
    if (error instanceof Error && error.stack)
      exception.stack = `${exception.name}: ${exception.message}\n${error.stack
        .split("\n")
        .slice(1)
        .filter((line) => /^\s*at |^[^\s]+@/.test(line))
        .join("\n")}`;
    Sentry.captureException(exception, {
      tags: { service: "frontend", source, ...(section ? { section: safeText(section) } : {}) },
    });
  } catch {
    /* Reporting must never change application or QueryCache behavior. */
  }
}

export function safeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  if (breadcrumb.category?.startsWith("ui."))
    return { ...breadcrumb, message: "UI interaction", data: undefined };
  const data = breadcrumb.data;
  return {
    ...breadcrumb,
    message:
      breadcrumb.category === "console"
        ? "Console diagnostic"
        : breadcrumb.message
          ? safeText(breadcrumb.message)
          : undefined,
    data: data
      ? Object.fromEntries(
          Object.entries(data)
            .filter(([key]) => ["url", "from", "to", "method", "status_code"].includes(key))
            .map(([key, value]) => [
              key,
              typeof value === "string"
                ? ["url", "from", "to"].includes(key)
                  ? safeUrl(value)
                  : safeText(value)
                : value,
            ]),
        )
      : undefined,
  };
}

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (typeof value === "string") return safeText(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !sensitive.test(key))
        .map(([key, item]) => [
          key,
          /url|filename|path|^to$|^from$/.test(key) && typeof item === "string"
            ? safeUrl(item)
            : scrub(item, depth + 1),
        ]),
    );
  return value;
}

/** Axios configs and logged objects can contain credentials and customer records. */
export function scrubEvent<T extends Event>(event: T, _hint?: EventHint): T {
  const result = scrub(event) as T;
  if (result.message)
    result.message = safeExceptionMessage(result.message, result.exception?.values?.[0]?.type);
  delete result.server_name;
  delete result.user;
  delete result.extra;
  result.request = event.request
    ? {
        url: event.request.url ? safeUrl(event.request.url) : undefined,
        method: event.request.method,
      }
    : undefined;
  result.breadcrumbs = event.breadcrumbs?.map(safeBreadcrumb);
  result.contexts = Object.fromEntries(
    Object.entries(result.contexts ?? {}).filter(([key]) =>
      [
        "trace",
        "runtime",
        "browser",
        "os",
        "device",
        "response",
        "nextjs",
        "react",
        "app",
      ].includes(key),
    ),
  );
  if (result.contexts?.response)
    result.contexts.response = { status_code: result.contexts.response.status_code };
  for (const exception of result.exception?.values ?? []) {
    exception.value = safeExceptionMessage(exception.value ?? "", exception.type);
  }
  return result;
}
