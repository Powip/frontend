/** @jest-environment node */
import { createHash } from "node:crypto";
import {
  proxyMerchantMercadoPagoCallback,
  proxyMerchantMercadoPagoConnect,
} from "../merchantMercadoPagoProxy";

const STORE = "11111111-1111-4111-8111-111111111111";
const STATE = "a".repeat(43);
const NONCE = "b".repeat(43);
const COOKIE = `__Host-powip_merchant_mp_${createHash("sha256").update(STATE).digest("hex").slice(0, 16)}`;
const AUTHORIZATION = `https://auth.mercadopago.com/authorization?client_id=123&state=${STATE}`;
const RETURN = `https://app.example/configuracion/integraciones/mercadopago?mp=connected&storeId=${STORE}`;
const originalEnv = process.env;
const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    NODE_ENV: "production",
    NEXT_PUBLIC_API_VENTAS: "https://api.example/ventas",
  };
  delete process.env.MERCHANT_MERCADOPAGO_API_GATEWAY;
  global.fetch = fetchMock;
});
afterAll(() => {
  process.env = originalEnv;
  global.fetch = originalFetch;
});

function connect(
  body = JSON.stringify({ mode: "production" }),
  extra: Record<string, string> = {},
) {
  return new Request(
    `https://app.example/api/merchant-payments/stores/${STORE}/mercadopago/connect`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${"t".repeat(40)}`,
        origin: "https://app.example",
        "content-type": "application/json",
        ...extra,
      },
      body,
    },
  );
}
function upstreamConnect(
  url = AUTHORIZATION,
  cookie = `${COOKIE}=${NONCE}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
) {
  return new Response(
    JSON.stringify({ authorizationUrl: url, accessToken: "must-not-be-returned" }),
    { headers: { "set-cookie": cookie } },
  );
}
function callback(
  query = `state=${STATE}&code=one-use-code`,
  cookies = `${COOKIE}=${NONCE}; powip_refresh_token=never-forward-this`,
) {
  return new Request(
    `https://app.example/api/merchant-payments/mercadopago/oauth/callback?${query}`,
    { headers: { cookie: cookies } },
  );
}

test("connect uses the configured sales API, forwards only bearer/body and stores the nonce on the app origin", async () => {
  fetchMock.mockResolvedValue(upstreamConnect());
  const response = await proxyMerchantMercadoPagoConnect(
    connect(undefined, { cookie: "app-session=do-not-forward" }),
    STORE,
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ authorizationUrl: AUTHORIZATION });
  expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=${NONCE}`);
  expect(response.headers.get("cache-control")).toContain("no-store");
  const [url, options] = fetchMock.mock.calls[0];
  expect(url.toString()).toBe(
    `https://api.example/ventas/merchant-payments/stores/${STORE}/mercadopago/connect`,
  );
  expect(options).toMatchObject({
    method: "POST",
    body: '{"mode":"production"}',
    cache: "no-store",
    redirect: "manual",
  });
  expect(Object.keys(options.headers).sort()).toEqual(["Authorization", "Content-Type"]);
});

test("server override selects a fixed sales base and ignores request-selected destinations", async () => {
  process.env.MERCHANT_MERCADOPAGO_API_GATEWAY = "https://sales.example";
  fetchMock.mockResolvedValue(upstreamConnect());
  expect((await proxyMerchantMercadoPagoConnect(connect(), STORE)).status).toBe(200);
  expect(fetchMock.mock.calls[0][0].toString()).toBe(
    `https://sales.example/merchant-payments/stores/${STORE}/mercadopago/connect`,
  );
  expect(
    (
      await proxyMerchantMercadoPagoConnect(
        connect('{"mode":"production","url":"https://evil.example"}'),
        STORE,
      )
    ).status,
  ).toBe(400);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([
  "https://evil.example/authorization",
  "javascript:alert(1)",
  `https://auth.mercadopago.com.evil.example/authorization?state=${STATE}`,
  `https://user@auth.mercadopago.com/authorization?state=${STATE}`,
  `${AUTHORIZATION}&state=${STATE}`,
])("rejects unsafe authorization target %s", async (url) => {
  fetchMock.mockResolvedValue(upstreamConnect(url));
  expect((await proxyMerchantMercadoPagoConnect(connect(), STORE)).status).toBe(502);
});

test.each([
  "Path=/; Secure; SameSite=Lax",
  "Path=/; HttpOnly; SameSite=Lax",
  "Path=/other; HttpOnly; Secure; SameSite=Lax",
  "Path=/; HttpOnly; Secure; SameSite=None",
  "Path=/; HttpOnly; Secure; SameSite=Lax; Domain=app.example",
])("rejects invalid nonce cookie attributes %s", async (attributes) => {
  fetchMock.mockResolvedValue(upstreamConnect(AUTHORIZATION, `${COOKIE}=${NONCE}; ${attributes}`));
  const response = await proxyMerchantMercadoPagoConnect(connect(), STORE);
  expect(response.status).toBe(502);
  expect(response.headers.get("set-cookie")).toBeNull();
});

test("rejects missing bearer, foreign origin, invalid store and oversized streamed body without upstream calls", async () => {
  expect(
    (await proxyMerchantMercadoPagoConnect(connect(undefined, { authorization: "" }), STORE))
      .status,
  ).toBe(401);
  expect(
    (
      await proxyMerchantMercadoPagoConnect(
        connect(undefined, { origin: "https://evil.example" }),
        STORE,
      )
    ).status,
  ).toBe(403);
  expect((await proxyMerchantMercadoPagoConnect(connect(), "../secrets")).status).toBe(400);
  expect((await proxyMerchantMercadoPagoConnect(connect("x".repeat(4097)), STORE)).status).toBe(
    413,
  );
  expect((await proxyMerchantMercadoPagoConnect(connect('{"mode":"test"}'), STORE)).status).toBe(
    400,
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

test("fails closed for non-HTTPS production configuration", async () => {
  process.env.NEXT_PUBLIC_API_VENTAS = "http://sales.example";
  expect((await proxyMerchantMercadoPagoConnect(connect(), STORE)).status).toBe(502);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("preserves actionable status without exposing backend errors or credentials", async () => {
  fetchMock.mockResolvedValue(new Response("secret=never-return", { status: 503 }));
  const response = await proxyMerchantMercadoPagoConnect(connect(), STORE);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toMatch(/secret|never-return/);
});

test("callback forwards just its nonce and one-use query then clears the cookie and follows the approved return", async () => {
  fetchMock.mockResolvedValue(
    new Response(null, {
      status: 302,
      headers: { location: RETURN, "set-cookie": "unrelated=do-not-relay" },
    }),
  );
  const response = await proxyMerchantMercadoPagoCallback(callback());
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(RETURN);
  expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=; Path=/; Max-Age=0`);
  expect(response.headers.get("set-cookie")).not.toContain("unrelated");
  expect(fetchMock.mock.calls[0][0].toString()).toBe(
    `https://api.example/ventas/merchant-payments/mercadopago/oauth/callback?state=${STATE}&code=one-use-code`,
  );
  expect(fetchMock.mock.calls[0][1]).toMatchObject({
    headers: { Cookie: `${COOKIE}=${NONCE}` },
    cache: "no-store",
    redirect: "manual",
  });
});

test.each([
  `state=${STATE}&state=${STATE}&code=one`,
  `state=${STATE}&code=one&error=two`,
  `state=${STATE}&code=one&redirect=https://evil.example`,
  "state=bad&code=one",
])("rejects invalid callback query %s", async (query) => {
  expect((await proxyMerchantMercadoPagoCallback(callback(query))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test("rejects missing or duplicate callback nonce cookies", async () => {
  expect(
    (await proxyMerchantMercadoPagoCallback(callback(undefined, "unrelated=one"))).status,
  ).toBe(400);
  expect(
    (
      await proxyMerchantMercadoPagoCallback(
        callback(undefined, `${COOKIE}=${NONCE}; ${COOKIE}=${NONCE}`),
      )
    ).status,
  ).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  RETURN.replace("app.example", "evil.example"),
  RETURN.replace("/configuracion/integraciones/mercadopago", "/live"),
  `${RETURN}&token=do-not-expose`,
  `${RETURN}&mp=connected`,
  RETURN.replace("mp=connected", "mp=other"),
  RETURN.replace(STORE, "untrusted"),
])("rejects unapproved callback redirect %s and clears nonce", async (location) => {
  fetchMock.mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
  const response = await proxyMerchantMercadoPagoCallback(callback());
  expect(response.status).toBe(502);
  expect(response.headers.get("location")).toBeNull();
  expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
});
