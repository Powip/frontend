import { type NextRequest, NextResponse } from "next/server";

type AuthAction = "login" | "refresh" | "logout";
type SessionTokens = { accessToken: string; refreshToken: string };

const REFRESH_COOKIE = "powip_refresh_token";
const COOKIE_PATH = "/api/auth";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BYTES = 16_384;
const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

function json(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_CACHE_HEADERS });
}

function error(status: number, code: string, message: string): NextResponse {
  return json({ code, message }, status);
}

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || new URL(request.url).protocol === "https:",
    sameSite: "lax" as const,
    path: COOKIE_PATH,
    maxAge: COOKIE_MAX_AGE,
  };
}

function clearSessionCookie(response: NextResponse, request: NextRequest) {
  response.cookies.set(REFRESH_COOKIE, "", {
    ...cookieOptions(request),
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

function requestOrigin(request: NextRequest): string | null {
  const url = new URL(request.url);
  // Next can normalize loopback URLs or construct them with its internal server
  // hostname. Host preserves the browser's authority; forwarded hosts are ignored.
  const host = request.headers.get("host") ?? url.host;
  if (!/^[a-zA-Z0-9.:[\]-]+$/.test(host)) return null;
  try {
    const protocol = process.env.NODE_ENV === "production" ? "https:" : url.protocol;
    return new URL(`${protocol}//${host}`).origin;
  } catch {
    return null;
  }
}

function validateRequest(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    origin === null ||
    origin !== requestOrigin(request) ||
    (fetchSite !== null && fetchSite !== "same-origin")
  ) {
    return error(403, "AUTH_CSRF_REJECTED", "La solicitud de sesión no es válida.");
  }
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return error(415, "AUTH_INVALID_CONTENT_TYPE", "La solicitud debe usar JSON.");
  }
  return null;
}

function authEndpoint(action: AuthAction): URL | null {
  const configuredBase =
    process.env.AUTH_API_BASE_URL?.trim() || process.env.NEXT_PUBLIC_API_USERS?.trim();
  if (!configuredBase) return null;

  try {
    const base = new URL(configuredBase);
    const isLocal = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      (process.env.NODE_ENV === "production" && isLocal) ||
      (base.protocol !== "https:" &&
        !(base.protocol === "http:" && isLocal && process.env.NODE_ENV !== "production"))
    ) {
      return null;
    }

    const path = base.pathname.replace(/\/+$/, "");
    if (path !== "" && path !== "/api/v1") return null;
    // Only these three fixed auth routes can receive credentials.
    return new URL(`/api/v1/auth/${action}`, base.origin);
  } catch {
    return null;
  }
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.text();
    if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) return null;
    const parsed: unknown = JSON.parse(body);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isToken(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    /^[!-~]+$/.test(value)
  );
}

function isSessionTokens(value: unknown): value is SessionTokens {
  if (value === null || typeof value !== "object") return false;
  const tokens = value as Record<string, unknown>;
  return isToken(tokens.accessToken, 32_768) && isToken(tokens.refreshToken, 4_096);
}

function upstreamError(status: number, action: AuthAction): NextResponse {
  if (status === 429) {
    return error(429, "AUTH_RATE_LIMITED", "Demasiados intentos. Intenta nuevamente más tarde.");
  }
  if (action !== "logout" && [400, 401, 403].includes(status)) {
    return action === "login"
      ? error(401, "AUTH_LOGIN_FAILED", "El correo o la contraseña no son correctos.")
      : error(401, "AUTH_SESSION_REQUIRED", "Tu sesión venció. Inicia sesión nuevamente.");
  }
  if (status === 409) {
    return error(409, "AUTH_RETRY_REQUIRED", "No pudimos actualizar tu sesión. Vuelve a intentar.");
  }
  return error(
    502,
    "AUTH_UNAVAILABLE",
    "No pudimos contactar al servicio de sesión. Vuelve a intentar.",
  );
}

export async function proxyAuthRequest(
  request: NextRequest,
  action: AuthAction,
): Promise<NextResponse> {
  const invalidRequest = validateRequest(request);
  if (invalidRequest) return invalidRequest;

  const body = await readBody(request);
  if (!body) {
    return error(400, "AUTH_INVALID_REQUEST", "La solicitud de sesión no es válida.");
  }

  let upstreamBody: Record<string, unknown> = {};
  if (action === "login") {
    if (
      typeof body.email !== "string" ||
      body.email.trim().length === 0 ||
      body.email.length > 254 ||
      typeof body.password !== "string" ||
      body.password.length === 0 ||
      body.password.length > 4_096
    ) {
      return error(400, "AUTH_INVALID_REQUEST", "Ingresa tu correo y contraseña.");
    }
    upstreamBody = { email: body.email.trim(), password: body.password };
  } else if (action === "refresh") {
    // Never accept a refresh token supplied by browser JavaScript in the body.
    const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
    if (!isToken(refreshToken, 4_096)) {
      return clearSessionCookie(
        error(401, "AUTH_SESSION_REQUIRED", "Inicia sesión nuevamente para continuar."),
        request,
      );
    }
    upstreamBody = { refreshToken };
  }

  const authorization = request.headers.get("authorization");
  if (action === "logout" && !authorization) {
    return clearSessionCookie(json({ message: "Sesión cerrada." }), request);
  }
  if (
    action === "logout" &&
    (!authorization?.startsWith("Bearer ") || !isToken(authorization.slice(7), 32_768))
  ) {
    return clearSessionCookie(
      error(400, "AUTH_INVALID_REQUEST", "La solicitud de sesión no es válida."),
      request,
    );
  }

  const endpoint = authEndpoint(action);
  if (!endpoint) {
    const response = error(
      503,
      "AUTH_CONFIGURATION_ERROR",
      "El servicio de sesión no está disponible.",
    );
    return action === "logout" ? clearSessionCookie(response, request) : response;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(action === "logout" && authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: controller.signal,
    });

    if (!upstream.ok) {
      const response = upstreamError(upstream.status, action);
      return action === "logout" || (action === "refresh" && response.status === 401)
        ? clearSessionCookie(response, request)
        : response;
    }

    if (action === "logout") {
      return clearSessionCookie(json({ message: "Sesión cerrada." }), request);
    }

    const tokens: unknown = await upstream.json();
    if (!isSessionTokens(tokens)) {
      return upstreamError(502, action);
    }

    const response = json({ accessToken: tokens.accessToken });
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(request));
    return response;
  } catch {
    const response = controller.signal.aborted
      ? error(504, "AUTH_TIMEOUT", "El servicio de sesión demoró demasiado. Vuelve a intentar.")
      : upstreamError(502, action);
    return action === "logout" ? clearSessionCookie(response, request) : response;
  } finally {
    clearTimeout(timeout);
  }
}
