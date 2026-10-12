import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import http from "node:http";
import { createRequire } from "node:module";
import { test } from "node:test";

const { createManualProtocol, access } = createRequire(import.meta.url)("./local-manual-protocol.cjs");
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");

test("manual protocol binds only loopback and creates only the two synthetic identities", () => {
  for (const origin of ["https://127.0.0.1:1000", "http://localhost:1000", "http://example.com:1000", "http://127.0.0.1"])
    assert.throws(() => createManualProtocol(origin));
  assert.throws(() => access("owner-from-browser"));
  for (const actor of ["partner", "admin"]) {
    const token = access(actor); const [header, content, signature] = token.split(".");
    assert.equal(signature, createHmac("sha256", key).update(`${header}.${content}`).digest("base64url"));
    const payload = JSON.parse(Buffer.from(content, "base64url").toString());
    assert.equal(payload.id, actor === "admin" ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : "22222222-2222-4222-8222-222222222222");
    assert.equal(payload.exp - payload.iat, 900);
    if (actor === "partner") assert.deepEqual(payload.permissions, []);
  }
});

test("manual protocol rejects unauthenticated and cross-origin fixture calls without implementing finance", async (context) => {
  let protocol;
  const server = http.createServer((request, response) => {
    void protocol(request, response).then((handled) => { if (!handled) { response.statusCode = 404; response.end(); } });
  });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  context.after(() => new Promise((done) => server.close(done)));
  const origin = `http://127.0.0.1:${server.address().port}`; protocol = createManualProtocol(origin);
  const post = (path, body, headers = {}) => fetch(`${origin}${path}`, { method: "POST", redirect: "manual",
    headers: { Origin: origin, ...headers }, body });
  const landing = await fetch(`${origin}/__partners-local`);
  assert.equal(landing.status, 200); assert.equal(landing.headers.get("cache-control"), "no-store");
  assert.match(await landing.text(), /datos sintéticos explícitos/);
  assert.equal((await post("/__partners-local/session", "actor=admin", { Origin: "https://example.com" })).status, 403);
  assert.equal((await post("/__partners-local/session", "actor=partner&ownerUserId=arbitrary")).status, 400);
  assert.equal((await post("/__partners-local/session", "actor=unknown")).status, 400);
  assert.equal((await post("/__partners-local/session", "x".repeat(129))).status, 413);
  assert.equal((await post("/fixture-auth/api/v1/auth/refresh")).status, 401);
  const selected = await post("/__partners-local/session", "actor=partner");
  assert.equal(selected.status, 303); assert.equal(selected.headers.get("location"), "/partners/comisiones/libro");
  const cookie = selected.headers.get("set-cookie"); assert.match(cookie, /HttpOnly; SameSite=Strict/);
  const refreshed = await post("/fixture-auth/api/v1/auth/refresh", undefined, { Cookie: cookie.split(";")[0] });
  assert.equal(refreshed.status, 200); assert.equal(refreshed.headers.get("cache-control"), "no-store");
  assert.deepEqual(Object.keys(await refreshed.json()), ["accessToken"]);
  assert.equal((await fetch(`${origin}/fixture-gateway/subscription/subscriptions/me`)).status, 200);
  assert.equal((await post("/fixture-subscription/flow/pay", "amount=100")).status, 501);
  assert.equal((await fetch(`${origin}/v1/partners/me/financial-balance`)).status, 404);
});
