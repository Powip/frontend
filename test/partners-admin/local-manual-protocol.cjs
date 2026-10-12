"use strict";

// Private loopback protocol for the manual demo only. This is not a login implementation
// or a production grant. Partners data and authorization are still served by the real backend.
const { createHmac } = require("node:crypto");
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PARTNER = "22222222-2222-4222-8222-222222222222";
const KEY = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");
const CAPABILITIES = ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES",
  "PARTNERS_MANAGE_PARTNERS", "PARTNERS_RESOLVE_REFERRAL"];
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

function access(actor) {
  if (!["partner", "admin"].includes(actor)) throw new Error("Only synthetic demo identities are allowed");
  const id = actor === "admin" ? ACTOR : PARTNER;
  const now = Math.floor(Date.now() / 1000);
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id, sub: id, type: "access",
    // The existing UI's superadmin gate is only a visual hint; the server validates capabilities independently.
    email: actor === "admin" ? "cuentaprueba@gmail.com" : "partner-local@example.test",
    name: "Prueba local", surname: "Sintética", role: actor === "admin" ? "ADMINISTRADOR" : "USUARIO",
    permissions: actor === "admin" ? CAPABILITIES : [], jti: `local-demo-${now}`, iat: now, exp: now + 900 })}`;
  return `${content}.${createHmac("sha256", KEY).update(content).digest("base64url")}`;
}

function createManualProtocol(origin) {
  const location = new URL(origin);
  if (location.protocol !== "http:" || location.hostname !== "127.0.0.1" || !location.port)
    throw new Error("A private loopback demo is required");
  let sequence = 0;
  const reply = (response, status, type, body) => {
    response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(body);
  };
  return async function manualProtocol(request, response) {
    const pathname = new URL(request.url, origin).pathname;
    if (!pathname.startsWith("/fixture-") && !pathname.startsWith("/__partners-local")) return false;
    if (request.headers.host !== location.host) { reply(response, 403, "text/plain", "Loopback host required"); return true; }
    if (request.method === "POST" && request.headers.origin !== origin) {
      reply(response, 403, "text/plain", "Same-origin local fixture required"); return true;
    }
    if (pathname === "/__partners-local" && request.method === "GET") {
      response.setHeader("Content-Security-Policy", "default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; style-src 'unsafe-inline'");
      reply(response, 200, "text/html; charset=utf-8", `<!doctype html><html lang="es"><meta charset="utf-8"><title>Partners prueba local</title><style>body{font:18px system-ui;max-width:760px;margin:48px auto;padding:24px}button{font:inherit;padding:12px;margin:8px}aside{background:#fff2cf;padding:16px}</style><h1>Partners prueba local</h1><aside>Auth y el cobro Flow son datos sintéticos explícitos. El cálculo, ledger, API y persistencia de Partners son reales en PostgreSQL local. No usar cuentas o datos de producción.</aside><p>El caso cargado usa plan C, cobro anual PEN 828 y produce PEN 95.22 contabilizados. No es dinero liquidable: no ejecuta transferencias, retenciones, reembolsos ni conciliación bancaria.</p><form action="/__partners-local/session" method="post"><button name="actor" value="partner">Entrar como partner de prueba</button><button name="actor" value="admin">Entrar como administrador de prueba</button></form><p>Partner: Mi Plan, Link, Referidos, Comisiones y Libro. Administrador: dashboard operativo, partners, recursos, borradores de reglas y cola. Las operaciones no implementadas siguen bloqueadas; esta demo no declara cerrado todo Partners v2.</p><p>Los cambios sólo afectan esta base desechable. Volvé a esta página para cambiar de identidad; una recarga completa reinicia la caché del navegador.</p></html>`);
      return true;
    }
    if (pathname === "/__partners-local/session" && request.method === "POST") {
      let body = "";
      for await (const chunk of request) {
        body += chunk.toString();
        if (Buffer.byteLength(body) > 128) { reply(response, 413, "text/plain", "Bounded fixture selection required"); return true; }
      }
      const form = new URLSearchParams(body);
      const actor = form.get("actor");
      if (form.size !== 1 || !["partner", "admin"].includes(actor)) { reply(response, 400, "text/plain", "Known synthetic actor required"); return true; }
      response.setHeader("Set-Cookie", `partners_local_fixture_actor=${actor}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`);
      response.writeHead(303, { Location: actor === "admin" ? "/partners/admin" : "/partners/comisiones/libro", "Cache-Control": "no-store" });
      response.end(); return true;
    }
    if (pathname === "/fixture-auth/api/v1/auth/refresh" && request.method === "POST") {
      const cookie = /(?:^|;\s*)partners_local_fixture_actor=(partner|admin)(?:;|$)/.exec(request.headers.cookie ?? "");
      if (!cookie) { reply(response, 401, "application/json", '{"code":"LOCAL_FIXTURE_SESSION_REQUIRED"}'); return true; }
      ++sequence;
      reply(response, 200, "application/json", JSON.stringify({ accessToken: access(cookie[1]) })); return true;
    }
    if (request.method === "GET" && ([ACTOR, PARTNER].some((id) => pathname === `/fixture-company/company/user/${id}`)
      || pathname === "/fixture-gateway/subscription/subscriptions/me")) {
      reply(response, 200, "application/json", "null"); return true;
    }
    reply(response, 501, "application/json", '{"code":"LOCAL_PROTOCOL_NOT_IMPLEMENTED"}'); return true;
  };
}

module.exports = { createManualProtocol, access };
