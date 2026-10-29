import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Test-only local process management. No .env, provider, production account or public bind.
export const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRoot = resolve(frontendRoot, "../ms-partners-partners-main-candidate");
const directory = "/private/tmp/powip-partners-auth-company-pg.qFnDIV/data";
const java = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java";
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");

export function fixtureToken(actor, permissions = []) {
  assert.ok(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "22222222-2222-4222-8222-222222222222"].includes(actor));
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: actor, sub: actor, type: "access",
    permissions, exp: Math.floor(Date.now() / 1000) + 900 })}`;
  return `${content}.${createHmac("sha256", key).update(content).digest("base64url")}`;
}

function launchMarked(command, args, options, prefix) {
  const child = spawn(command, args, { ...options, stdio: ["pipe", "pipe", "pipe"] });
  const messages = []; const waiters = new Set(); let buffer = ""; let exit;
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => {
    exit = { code, signal };
    for (const waiter of waiters) waiter.reject(new Error("Owned local fixture exited before its milestone"));
    waiters.clear(); resolveExit(exit);
  }));
  child.once("error", () => {
    for (const waiter of waiters) waiter.reject(new Error("Owned local fixture could not start"));
    waiters.clear();
  });
  child.stderr.resume(); // Do not print framework output that can include configuration or token-bearing errors.
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (let split; (split = buffer.indexOf("\n")) >= 0;) {
      const line = buffer.slice(0, split); buffer = buffer.slice(split + 1);
      if (!line.startsWith(prefix)) continue;
      const value = JSON.parse(line.slice(prefix.length));
      if (value.type === "fixture-error") {
        for (const waiter of waiters) waiter.reject(new Error(`Owned fixture failed: ${value.code}/${value.causeClass}`));
        waiters.clear(); continue;
      }
      const waiter = [...waiters].find((candidate) => candidate.type === value.type);
      if (waiter) { waiters.delete(waiter); waiter.resolve(value); } else messages.push(value);
    }
  });
  const waitFor = (type) => {
    const index = messages.findIndex((value) => value.type === type);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (exit) return Promise.reject(new Error("Owned fixture already stopped"));
    return new Promise((resolveWait, rejectWait) => {
      const waiter = { type, resolve: (value) => { clearTimeout(timeout); resolveWait(value); },
        reject: (failure) => { clearTimeout(timeout); rejectWait(failure); } };
      const timeout = setTimeout(() => { waiters.delete(waiter); rejectWait(new Error(`Owned fixture timeout: ${type}`)); }, 60_000);
      waiters.add(waiter);
    });
  };
  const send = (commandText, type) => { const pending = waitFor(type); child.stdin.write(`${commandText}\n`); return pending; };
  const close = async () => {
    if (!exit) assert.equal((await send("stop", "stopped")).cleaned, true);
    assert.equal((await exited).code, 0, "Owned fixture must exit with its cleanup confirmed");
  };
  const abort = async () => {
    child.stdin.end();
    if (!exit) await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))]);
    if (!exit) child.kill("SIGTERM");
    await Promise.race([exited, new Promise((done) => setTimeout(done, 5000))]);
  };
  return { waitFor, send, close, abort };
}

export async function launchBackend() {
  const file = resolve(backendRoot, "target/billing-fixture-classpath.txt");
  assert.ok(existsSync(file), "Compile the candidate fixture/classpath first");
  const classpath = [resolve(backendRoot, "target/test-classes"), resolve(backendRoot, "target/classes"), readFileSync(file, "utf8").trim()].join(":");
  const processFixture = launchMarked(java, ["-cp", classpath, "com.powip.partners.adminread.application.PartnerAdminLocalHttpFixture"], {
    cwd: backendRoot, env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_READ_LOCAL_TEST: "true",
      PARTNERS_ADMIN_FINANCIAL_LOCAL_TEST: "true", PARTNERS_TEST_POSTGRES_ISOLATED: "true",
      PARTNERS_TEST_POSTGRES_PORT: "55439", PARTNERS_TEST_POSTGRES_DATA_DIRECTORY: directory },
  }, "PARTNERS_ADMIN_FIXTURE ");
  try {
    const ready = await processFixture.waitFor("ready");
    assert.match(ready.database, /^partners_run_[a-f0-9]{16}_admin_read_test$/);
    assert.equal(new URL(ready.baseUrl).hostname, "127.0.0.1");
    return { ...processFixture, ready };
  } catch (failure) { await processFixture.abort(); throw failure; }
}

export async function launchFrontend(backend) {
  const processFixture = launchMarked(process.execPath, [resolve(frontendRoot, "test/partners-admin/local-next-server.cjs")], {
    cwd: frontendRoot, env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_BROWSER_LOCAL_TEST: "true",
      PARTNERS_LOCAL_MANUAL_TEST: "true", PARTNERS_ADMIN_BROWSER_DIST_ID: randomUUID().replaceAll("-", ""),
      PARTNERS_ADMIN_BROWSER_BACKEND_URL: backend.ready.baseUrl,
      NODE_OPTIONS: `--require=${resolve(frontendRoot, "test/partners-admin/local-env-guard.cjs")}` },
  }, "PARTNERS_BROWSER_SERVER ");
  try {
    const ready = await processFixture.waitFor("ready");
    assert.equal(ready.envGuard, true); assert.equal(new URL(ready.baseUrl).hostname, "127.0.0.1");
    return { ...processFixture, ready };
  } catch (failure) { await processFixture.abort(); throw failure; }
}

export async function seedLocalFinancial(backend) {
  await backend.send("seed", "seeded");
  await backend.send("auth:LOCAL_DEMO", "auth");
  const own = fixtureToken(backend.ready.partnerAuthSubject);
  const staff = fixtureToken(backend.ready.actorUserId, ["PARTNERS_CONFIGURE_POLICY"]);
  const post = async (path, token, body, keyValue) => {
    const response = await fetch(`${backend.ready.baseUrl}/v1/partners${path}`, { method: "POST", redirect: "error",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Idempotency-Key": keyValue }, body: JSON.stringify(body) });
    assert.ok(response.ok, `Actual local Partners write failed with HTTP${response.status}`);
    assert.equal(response.headers.get("cache-control"), "no-store");
    return response.json();
  };
  await post("/me/program-preferences", own, { optionCode: "C", discountPct: "0", expectedVersion: null,
    reason: "Explicit synthetic local test preference" }, "manual-fixture-program-c-zero");
  const policy = await post("/admin/commission-policy-versions", staff, { code: "LOCAL-ANNUAL-C", currency: "PEN",
    firstPaymentRate: "0.5", recurringPaymentRate: "0.08", recurringPaymentCount: 11,
    effectiveFrom: "2026-10-10T15:00:00Z", reason: "Synthetic fixture only; not an activated production policy" }, "manual-fixture-policy-c");
  assert.equal(policy.state, "DRAFT");
  const evidence = await backend.send(`seed-financial:${policy.id}`, "financial-seeded");
  assert.equal(evidence.postedLedgerBalance, "95.22");
  return evidence;
}
