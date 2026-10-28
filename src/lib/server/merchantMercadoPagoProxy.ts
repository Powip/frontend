import { createHash } from "node:crypto";
import { GATEWAY } from "../gateway";
import {
  MERCHANT_MP_RETURN_PATH,
  MERCHANT_MP_STATE,
  MERCHANT_MP_UUID,
  merchantMercadoPagoAuthorizationUrl,
} from "../merchantMercadoPago";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const CALLBACK = "/merchant-payments/mercadopago/oauth/callback";
const cookieName = (state: string) =>
  `__Host-powip_merchant_mp_${createHash("sha256").update(state).digest("hex").slice(0, 16)}`;

function failure(status = 502): Response {
  return Response.json(
    {
      message:
        "No se pudo completar la conexión con Mercado Pago. Vuelve a POWIP e intenta nuevamente.",
    },
    { status, headers: PRIVATE_HEADERS },
  );
}

/** Both settings are fixed sales API bases, including /ventas when using the gateway. */
function salesEndpoint(path: string): URL {
  const base = new URL(
    process.env.MERCHANT_MERCADOPAGO_API_GATEWAY ||
      process.env.NEXT_PUBLIC_API_VENTAS ||
      GATEWAY.ventas,
  );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (
    base.username ||
    base.password ||
    base.hash ||
    base.search ||
    (process.env.NODE_ENV === "production" && local) ||
    (base.protocol !== "https:" &&
      !(local && base.protocol === "http:" && process.env.NODE_ENV !== "production"))
  ) {
    throw new Error("Sales API unavailable");
  }
  base.pathname = base.pathname.replace(/\/+$/, "") + path;
  return base;
}

class InvalidBody extends Error {}
class BodyTooLarge extends Error {}
async function readConnectBody(request: Request): Promise<void> {
  if (Number(request.headers.get("content-length") || 0) > 4096) throw new BodyTooLarge();
  if (!request.body) return;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > 4096) {
        await reader.cancel().catch(() => undefined);
        throw new BodyTooLarge();
      }
      chunks.push(result.value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      throw new InvalidBody();
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "mode") ||
      ((body as { mode?: unknown }).mode ?? "production") !== "production"
    )
      throw new InvalidBody();
  } finally {
    reader.releaseLock();
  }
}

/** Relays just the account-authorization nonce, never the application's session cookies. */
export async function proxyMerchantMercadoPagoConnect(
  request: Request,
  storeId: string,
): Promise<Response> {
  if (!MERCHANT_MP_UUID.test(storeId)) return failure(400);
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^Bearer [A-Za-z0-9_.~-]{20,8192}$/.test(authorization))
    return failure(401);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    (fetchSite && fetchSite !== "same-origin")
  )
    return failure(403);
  try {
    await readConnectBody(request);
    const upstream = await fetch(
      salesEndpoint(`/merchant-payments/stores/${storeId}/mercadopago/connect`),
      {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "production" }),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!upstream.ok)
      return failure(
        [400, 401, 403, 404, 409, 429, 503].includes(upstream.status) ? upstream.status : 502,
      );
    const data = await upstream.json();
    const authorizationUrl = merchantMercadoPagoAuthorizationUrl(data.authorizationUrl);
    if (!authorizationUrl) return failure();
    const name = cookieName(new URL(authorizationUrl).searchParams.get("state")!);
    const cookies = upstream.headers
      .getSetCookie()
      .filter((cookie) => cookie.startsWith(`${name}=`));
    if (
      cookies.length !== 1 ||
      !new RegExp(`^${name}=[A-Za-z0-9_-]{43};`).test(cookies[0]) ||
      !/;\s*HttpOnly(?:;|$)/i.test(cookies[0]) ||
      !/;\s*Secure(?:;|$)/i.test(cookies[0]) ||
      !/;\s*SameSite=Lax(?:;|$)/i.test(cookies[0]) ||
      !/;\s*Path=\/(?:;|$)/i.test(cookies[0]) ||
      /;\s*Domain=/i.test(cookies[0])
    )
      return failure();
    const response = Response.json({ authorizationUrl }, { headers: PRIVATE_HEADERS });
    response.headers.append("Set-Cookie", cookies[0]);
    return response;
  } catch (error) {
    return failure(error instanceof BodyTooLarge ? 413 : error instanceof InvalidBody ? 400 : 502);
  }
}

export async function proxyMerchantMercadoPagoCallback(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const query = incoming.searchParams;
  const state = query.get("state") || "";
  const allowed = new Set(["state", "code", "error", "error_description"]);
  if (
    incoming.search.length > 8192 ||
    !MERCHANT_MP_STATE.test(state) ||
    [...query.keys()].some((key) => !allowed.has(key) || query.getAll(key).length !== 1) ||
    query.has("code") === query.has("error")
  )
    return failure(400);
  const name = cookieName(state);
  const finish = (response: Response) => {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
    return response;
  };
  const cookies = (request.headers.get("cookie") || "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter((cookie) => cookie.startsWith(`${name}=`));
  if (cookies.length !== 1 || !MERCHANT_MP_STATE.test(cookies[0].slice(name.length + 1)))
    return finish(failure(400));
  try {
    const endpoint = salesEndpoint(CALLBACK);
    endpoint.search = query.toString();
    const upstream = await fetch(endpoint, {
      headers: { Cookie: cookies[0] },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const location = upstream.headers.get("location");
    if (![302, 303].includes(upstream.status) || !location)
      return finish(failure(upstream.status === 400 ? 400 : 502));
    const redirect = new URL(location);
    if (
      redirect.origin !== incoming.origin ||
      redirect.pathname !== MERCHANT_MP_RETURN_PATH ||
      redirect.username ||
      redirect.password ||
      redirect.hash ||
      [...redirect.searchParams.keys()].some(
        (key) => !["mp", "storeId"].includes(key) || redirect.searchParams.getAll(key).length !== 1,
      ) ||
      !["connected", "error"].includes(redirect.searchParams.get("mp") || "") ||
      !MERCHANT_MP_UUID.test(redirect.searchParams.get("storeId") || "")
    )
      return finish(failure());
    return finish(
      new Response(null, {
        status: 302,
        headers: { ...PRIVATE_HEADERS, Location: redirect.toString() },
      }),
    );
  } catch {
    return finish(failure());
  }
}
