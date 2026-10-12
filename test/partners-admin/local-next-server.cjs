"use strict";

require("./local-env-guard.cjs");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const readline = require("node:readline");
const { createRequire } = require("node:module");

const root = path.resolve(__dirname, "../..");
const id = process.env.PARTNERS_ADMIN_BROWSER_DIST_ID;
const backend = new URL(process.env.PARTNERS_ADMIN_BROWSER_BACKEND_URL ?? "http://invalid");
if (!/^[a-f0-9]{32}$/.test(id ?? "") || backend.protocol !== "http:" || backend.hostname !== "127.0.0.1" || !backend.port) {
  throw new Error("PARTNERS_ADMIN_BROWSER_LOCAL_CONFIG_INVALID");
}
const distRelative = `test/partners-admin/.next-browser-${id}`;
const dist = path.resolve(root, distRelative);
// Only a unique directory created exclusively by this process can be removed.
fs.mkdirSync(dist);
let owned = true;
let app;
let stopping = false;
let handler = (_request, response) => { response.statusCode = 503; response.end(); };
const sockets = new Set();
const server = http.createServer((request, response) => handler(request, response));
server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
const emit = (metadata) => { process.stdout.write(`PARTNERS_BROWSER_SERVER ${JSON.stringify(metadata)}\n`); };
const stop = async () => {
  if (stopping) return;
  stopping = true;
  for (const socket of sockets) socket.destroy();
  await new Promise((resolve) => server.close(resolve));
  if (app) await app.close();
  if (owned && path.dirname(dist) === __dirname && path.basename(dist) === `.next-browser-${id}`) {
    fs.rmSync(dist, { recursive: true }); owned = false;
  }
  emit({ type: "stopped", cleaned: !owned, envFilesRead: false });
};
process.once("SIGTERM", () => { void stop().finally(() => process.exit(0)); });
process.once("SIGINT", () => { void stop().finally(() => process.exit(0)); });

(async () => {
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    Object.assign(process.env, {
      NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_API_PARTNERS: `${backend.origin}/v1/partners`,
      NEXT_PUBLIC_API_USERS: `${origin}/fixture-auth/api/v1`, NEXT_PUBLIC_API_COMPANY: `${origin}/fixture-company`,
      NEXT_PUBLIC_API_GATEWAY: `${origin}/fixture-gateway`, NEXT_PUBLIC_API_SUBS: `${origin}/fixture-subscription`,
      NEXT_PUBLIC_API_INVENTORY: `${origin}/fixture-inventory`, NEXT_PUBLIC_FRONTEND_URL: origin,
      NEXT_PUBLIC_LANDING_URL: origin, NEXT_PUBLIC_RUNTIME_ENV: "isolated-browser-fixture",
      NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.join(__dirname, "local-font-assets.cjs"),
    });
    const localRequire = createRequire(path.join(root, "package.json"));
    // Next 15's custom-server router does not pass options.conf into initialize().
    // Resolve the test config once and share it with its render worker; never edit next.config.ts.
    const loadConfig = localRequire("next/dist/server/config").default;
    const { PHASE_DEVELOPMENT_SERVER } = localRequire("next/constants");
    const config = await loadConfig(PHASE_DEVELOPMENT_SERVER, root, {
      customConfig: { distDir: distRelative, output: undefined }, silent: true,
    });
    process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
    const next = localRequire("next");
    app = next({ dev: true, dir: root, hostname: "127.0.0.1", port: server.address().port,
      conf: { distDir: distRelative, output: undefined } });
    await app.prepare();
    const nextHandler = app.getRequestHandler();
    if (process.env.PARTNERS_LOCAL_MANUAL_TEST === "true") {
      const protocol = require("./local-manual-protocol.cjs").createManualProtocol(origin);
      handler = (request, response) => {
        // Keep the manual browser isolated too: no remote avatars, APIs, payment hosts or fonts.
        response.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${backend.origin} ws://127.0.0.1:${server.address().port}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
        void protocol(request, response).then((handled) => {
          if (!handled) return nextHandler(request, response);
        }).catch(() => { response.statusCode = 500; response.end("LOCAL_PROTOCOL_FAILED"); });
      };
    } else handler = nextHandler;
    const upgrade = app.getUpgradeHandler();
    server.on("upgrade", (request, socket, head) => { void upgrade(request, socket, head); });
    emit({ type: "ready", baseUrl: origin, envGuard: globalThis.__PARTNERS_TEST_ENV_FILE_GUARD === true });
    const input = readline.createInterface({ input: process.stdin });
    for await (const command of input) { if (command === "stop") break; }
    input.close();
    await stop();
    process.exit(0);
  } catch (error) {
    const errorCode = /^[A-Z_]{1,64}$/.test(error?.code ?? "") ? error.code : null;
    const stackFunction = error?.stack?.split("\n").map((line) => /^\s+at ([A-Za-z0-9_.$]+)\s/.exec(line)?.[1]).find(Boolean) ?? null;
    const fixtureFile = /^[A-Za-z0-9_./-]{1,200}$/.test(error?.fixtureFile ?? "") ? error.fixtureFile : null;
    emit({ type: "fixture-error", code: "PARTNERS_LOCAL_NEXT_FAILED", causeClass: error?.constructor?.name ?? "Error", errorCode, stackFunction, fixtureFile });
    await stop(); process.exit(1);
  }
})();
