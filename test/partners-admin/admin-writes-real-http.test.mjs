import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

// Actual candidate TypeScript adapters → actual HTTP handlers/audit/receipts → owned PostgreSQL.
// Only Auth protocol is an explicit fixture. The loopback proxy forwards actual responses;
// It can discard a completed response to verify durable recovery without fabricating a Partners DTO.
const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRoot = resolve(frontendRoot, "../ms-partners-partners-main-candidate");
const nativeRequire = createRequire(resolve(frontendRoot, "package.json"));
const typescript = nativeRequire("typescript");
const java = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java";
const directory = "/private/tmp/powip-partners-auth-company-pg.qFnDIV/data";
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");
const reason = "Synthetic local write verification";

function loadActualTypeScript(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const source = typescript.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, esModuleInterop: true }, fileName: file,
  }).outputText;
  const localRequire = (specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return nativeRequire(specifier);
    const target = specifier.startsWith("@/") ? resolve(frontendRoot, "src", specifier.slice(2)) : resolve(dirname(file), specifier);
    const found = [target, `${target}.ts`, `${target}.tsx`, resolve(target, "index.ts")].find(existsSync);
    if (!found) throw new Error("Actual adapter dependency is missing");
    return loadActualTypeScript(found, cache);
  };
  runInThisContext(`(function(require,module,exports,__filename,__dirname){${source}\n})`, { filename: file })
    (localRequire, module, module.exports, file, dirname(file));
  return module.exports;
}

function signedAccess(actor, permissions = ["PARTNERS_VIEW"], expiry = 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: actor, sub: actor, type: "access", role: "ADMINISTRADOR",
    permissions, exp: Math.floor(Date.now() / 1000) + expiry })}`;
  return `${content}.${createHmac("sha256", key).update(content).digest("base64url")}`;
}

// Axios errors contain Authorization headers. Preserve only public status/code in test failures.
async function safely(action) {
  try { return await action(); } catch (failure) {
    const status = failure?.response?.status ?? failure?.status ?? null;
    const code = failure?.response?.data?.code ?? failure?.code ?? failure?.constructor?.name ?? "UNKNOWN";
    const safe = new Error(`Local contract request failed: ${status ?? "transport"}/${code}`);
    safe.status = status; safe.code = code; throw safe;
  }
}
const statusError = (status, code) => (failure) => failure.status === status && (!code || failure.code === code);

async function fixture() {
  assert.equal(process.env.PARTNERS_ADMIN_WRITES_CONTRACT_LOCAL_TEST, "true", "Explicit local writes opt-in required");
  const classpathFile = resolve(backendRoot, "target/billing-fixture-classpath.txt");
  assert.ok(existsSync(classpathFile), "Stable compiled real Java fixture/classpath required");
  const classpath = [resolve(backendRoot, "target/test-classes"), resolve(backendRoot, "target/classes"), readFileSync(classpathFile, "utf8").trim()].join(":");
  const child = spawn(java, ["-cp", classpath, "com.powip.partners.adminread.application.PartnerAdminLocalHttpFixture"], {
    cwd: backendRoot, env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_READ_LOCAL_TEST: "true",
      PARTNERS_TEST_POSTGRES_ISOLATED: "true", PARTNERS_TEST_POSTGRES_PORT: "55439", PARTNERS_TEST_POSTGRES_DATA_DIRECTORY: directory },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = []; const waiters = new Set(); let buffer = ""; let exit;
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => {
    exit = { code, signal }; for (const waiter of waiters) waiter.reject(new Error("Local Java fixture exited before its milestone"));
    waiters.clear(); resolveExit(exit);
  }));
  child.stderr.resume();
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    for (let separator; (separator = buffer.indexOf("\n")) >= 0;) {
      const line = buffer.slice(0, separator); buffer = buffer.slice(separator + 1);
      if (!line.startsWith("PARTNERS_ADMIN_FIXTURE ")) continue;
      const value = JSON.parse(line.slice("PARTNERS_ADMIN_FIXTURE ".length));
      if (value.type === "fixture-error") {
        for (const waiter of waiters) waiter.reject(new Error(`Local Java fixture failed: ${value.code}/${value.causeClass}`));
        waiters.clear(); continue;
      }
      const waiter = [...waiters].find((candidate) => candidate.type === value.type);
      if (waiter) { waiters.delete(waiter); waiter.resolve(value); } else messages.push(value);
    }
  });
  const waitFor = (type) => {
    const index = messages.findIndex((message) => message.type === type);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (exit) return Promise.reject(new Error("Local Java fixture is no longer running"));
    return new Promise((resolveWait, rejectWait) => {
      const waiter = { type, resolve: (value) => { clearTimeout(timeout); resolveWait(value); }, reject: (error) => { clearTimeout(timeout); rejectWait(error); } };
      const timeout = setTimeout(() => { waiters.delete(waiter); rejectWait(new Error(`Local Java milestone timeout: ${type}`)); }, 60_000);
      waiters.add(waiter);
    });
  };
  const command = (value, type) => { const pending = waitFor(type); child.stdin.write(`${value}\n`); return pending; };
  const close = async () => {
    if (!exit) { const stopped = await command("stop", "stopped"); assert.equal(stopped.cleaned, true); }
    assert.equal((await exited).code, 0, "Owned fixture must exit and clean successfully");
  };
  try {
    const ready = await waitFor("ready");
    assert.match(ready.database, /^partners_run_[a-f0-9]{16}_admin_read_test$/);
    assert.equal(new URL(ready.baseUrl).hostname, "127.0.0.1"); assert.equal(new URL(ready.baseUrl).protocol, "http:");
    return { ready, command, close };
  } catch (failure) {
    child.stdin.end();
    if (!exit) await Promise.race([exited, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5000))]);
    if (!exit) child.kill("SIGTERM"); throw failure;
  }
}

async function realTransport(backendOrigin) {
  const origin = new URL(backendOrigin); assert.equal(origin.hostname, "127.0.0.1");
  const records = []; const sockets = new Set(); let dropped = 0; let nextDrop;
  const server = http.createServer((request, response) => {
    if (!request.url?.startsWith("/v1/partners/")) { response.destroy(); return; }
    const upstream = http.request({ hostname: "127.0.0.1", port: origin.port, path: request.url, method: request.method,
      headers: { ...request.headers, host: origin.host }, agent: false }, (actual) => {
      const mustDrop = nextDrop && request.method === "POST" && request.url === nextDrop.path &&
        request.headers["idempotency-key"] === nextDrop.key && actual.statusCode === nextDrop.status;
      records.push({ path: request.url.split("?")[0], method: request.method, status: actual.statusCode, discardedAfterCommit: Boolean(mustDrop) });
      if (mustDrop) {
        nextDrop = undefined; actual.resume(); actual.once("end", () => { ++dropped; response.destroy(); });
      } else { response.writeHead(actual.statusCode, actual.headers); actual.pipe(response); }
    });
    upstream.once("error", () => response.destroy()); upstream.setTimeout(10_000, () => upstream.destroy()); request.pipe(upstream);
  });
  server.on("connection", (socket) => { sockets.add(socket); socket.once("close", () => sockets.delete(socket)); });
  await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, records, drops: () => dropped,
    discardNext201: (path, idempotencyKey) => { assert.equal(nextDrop, undefined); nextDrop = { path, key: idempotencyKey, status: 201 }; },
    discardNext200: (path, idempotencyKey) => { assert.equal(nextDrop, undefined); nextDrop = { path, key: idempotencyKey, status: 200 }; },
    close: () => new Promise((closed) => { for (const socket of sockets) socket.destroy(); server.close(closed); }),
  };
}

test("actual administrative writes adapters/HTTP/PostgreSQL preserve authorization and durable receipts", { timeout: 240_000 }, async (context) => {
  const running = await fixture(); context.after(running.close);
  const transport = await realTransport(running.ready.baseUrl); context.after(transport.close);
  const previous = process.env.NEXT_PUBLIC_API_PARTNERS;
  process.env.NEXT_PUBLIC_API_PARTNERS = `${transport.baseUrl}/v1/partners`;
  context.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_API_PARTNERS; else process.env.NEXT_PUBLIC_API_PARTNERS = previous; });
  const cache = new Map();
  const policy = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-commission-policy.api.ts"), cache);
  const resources = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-resources.api.ts"), cache);
  const portal = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/partner-resources.api.ts"), cache);
  const statusApi = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-partner-status.api.ts"), cache);
  const reads = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-partners.api.ts"), cache);
  const payout = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/payout-settings.api.ts"), cache);
  const preferences = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/program-preferences.api.ts"), cache);
  const metrics = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/partner-referral-metrics.api.ts"), cache);
  const review = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/referral-rejection.api.ts"), cache);
  const commission = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/commission-read.api.ts"), cache);
  // Keep the actual clients/serializers, but prohibit inherited system proxies from leaving loopback.
  for (const client of [policy.adminCommissionPolicyClient, resources.adminResourcesClient, portal.partnerResourcesClient,
    statusApi.adminPartnerStatusClient, reads.adminPartnersClient, payout.payoutSettingsClient,
    preferences.programPreferencesClient, metrics.partnerReferralMetricsClient, review.referralRejectionClient, commission.commissionReadClient]) {
    client.defaults.proxy = false;
    // An invalid mutable default must never replace the captured caller's per-request Bearer.
    // Successful real JWT validation below proves all actual adapters override this deliberately bad default.
    client.defaults.headers.common.Authorization = "Bearer invalid-local-default-not-a-jwt";
  }
  const accessToken = signedAccess(running.ready.actorUserId); const auth = { accessToken };
  const forged = signedAccess(running.ready.actorUserId, ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY", "PARTNERS_MANAGE_RESOURCES"]);
  const policyCommand = { code: "LOCAL-DRAFT-A", currency: "PEN", firstPaymentRate: "0.4", recurringPaymentRate: "0.06",
    recurringPaymentCount: null, effectiveFrom: null, reason };
  const resourceCommand = { country: "PE", kind: "PDF", category: "LOCAL-TEST", title: "Synthetic local resource",
    description: null, publicUrl: "https://resources.example.com/local-guide.pdf", sortOrder: 1, reason };
  const stats = () => running.command("write-status", "write-status");
  const call = (fn) => safely(fn);
  const createPolicy = (command, idempotencyKey, credentials = auth) => call(() => policy.requestCreateAdminCommissionPolicyDraft({ ...credentials, command, idempotencyKey }));
  const createResource = (command, idempotencyKey, credentials = auth) => call(() => resources.requestCreateAdminResource({ ...credentials, command, idempotencyKey }));
  const transition = (resourceId, name, version, idempotencyKey) => call(() => resources.requestTransitionAdminResource({ ...auth,
    resourceId, transition: name, command: { expectedVersion: version, reason }, idempotencyKey }));
  const raw = (path, token, body, idempotencyKey) => fetch(`${running.ready.baseUrl}/v1/partners${path}`, {
    method: body === undefined ? "GET" : "POST", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const step = async (name, action) => {
    let broken = false;
    await context.test(name, async () => { try { await action(); } catch (failure) { broken = true; throw failure; } });
    if (broken) throw new Error("Administrative writes verification stopped at its first broken boundary");
  };
  process.stdout.write(`PARTNERS_WRITES_EVIDENCE ${JSON.stringify({ backend: running.ready.baseUrl, proxy: transport.baseUrl, auth: "EXPLICIT_LOCAL_PROTOCOL_FIXTURE", envFilesRead: false })}\n`);

  await step("VIEW-only grants do not allow policy or resource writes, even with forged signed hints", async () => {
    await running.command("auth:VIEW_ONLY", "auth");
    await assert.rejects(createPolicy(policyCommand, "view-denied-policy", { accessToken: forged }), statusError(403));
    await assert.rejects(createResource(resourceCommand, "view-denied-resource", { accessToken: forged }), statusError(403));
    for (const path of ["/admin/resources", "/admin/commission-policy-versions"]) {
      const missing = await raw(path); assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
      const denied = await raw(path, forged); assert.equal(denied.status, 403); assert.equal(denied.headers.get("cache-control"), "no-store");
    }
    const state = await stats(); assert.equal(state.resources, 0); assert.equal(state.policyDrafts, 0);
  });

  await step("separate current capabilities authorize only their own operation without VIEW inheritance", async () => {
    await running.command("auth:POLICY_ONLY", "auth");
    assert.equal((await call(() => policy.requestAdminCommissionPolicyVersions(auth))).items.length, 0);
    await assert.rejects(call(() => resources.requestAdminResources(auth)), statusError(403));
    await running.command("auth:RESOURCES_ONLY", "auth");
    assert.equal((await call(() => resources.requestAdminResources(auth))).items.length, 0);
    await assert.rejects(call(() => policy.requestAdminCommissionPolicyVersions(auth)), statusError(403));
    await running.command("auth:WRITE_BOTH", "auth");
  });

  let draft; let created;
  await step("lost policy201 commits exactly one immutable DRAFT/audit and replays the same key", async () => {
    transport.discardNext201("/v1/partners/admin/commission-policy-versions", "lost-policy-create");
    await assert.rejects(createPolicy(policyCommand, "lost-policy-create"), (failure) => failure.status === null);
    const committed = await stats(); assert.equal(committed.policyDrafts, 1); assert.equal(committed.policyAudit, 1);
    draft = await createPolicy(policyCommand, "lost-policy-create");
    assert.equal(draft.state, "DRAFT"); assert.equal(draft.firstPaymentRate, "0.4"); assert.equal(draft.recurringPaymentRate, "0.06");
    assert.equal(draft.recurringPaymentCount, null); assert.equal(draft.effectiveFrom, null); assert.ok(!Object.hasOwn(draft, "reason"));
    assert.deepEqual(await createPolicy(policyCommand, "lost-policy-create"), draft);
    assert.equal((await stats()).policyDrafts, 1); assert.equal((await stats()).policyAudit, 1);
  });

  await step("policy conflict, persisted pagination and explicit blocked activation never apply financial rules", async () => {
    await assert.rejects(createPolicy({ ...policyCommand, firstPaymentRate: "0.5" }, "lost-policy-create"), statusError(409, "IDEMPOTENCY_CONFLICT"));
    await createPolicy({ ...policyCommand, code: "LOCAL-DRAFT-B" }, "other-policy-draft");
    const page = await call(() => policy.requestAdminCommissionPolicyVersions({ ...auth, limit: 1 }));
    assert.equal(page.items.length, 1); assert.ok(page.nextCursor);
    const next = await call(() => policy.requestAdminCommissionPolicyVersions({ ...auth, limit: 1, cursor: page.nextCursor }));
    assert.equal(next.items.length, 1); assert.equal(next.nextCursor, null); assert.notEqual(next.items[0].id, page.items[0].id);
    const blocked = await raw(`/admin/commission-policy-versions/${draft.id}/activate`, accessToken, {}, "never-activate-draft");
    assert.equal(blocked.status, 501); assert.equal((await blocked.json()).code, "COMMISSION_POLICY_ACTIVATION_NOT_IMPLEMENTED");
    const state = await stats(); assert.equal(state.policyDrafts, 2); assert.equal(state.policyAudit, 2); assert.equal(state.nonDraftPolicies, 0);
  });

  await step("lost resource201 commits one row/revision/receipt/audit and replays immutable metadata", async () => {
    transport.discardNext201("/v1/partners/admin/resources", "lost-resource-create");
    await assert.rejects(createResource(resourceCommand, "lost-resource-create"), (failure) => failure.status === null);
    const committed = await stats();
    for (const field of ["resources", "resourceRevisions", "resourceReceipts", "resourceAudit"]) assert.equal(committed[field], 1);
    created = await createResource(resourceCommand, "lost-resource-create");
    assert.equal(created.state, "DRAFT"); assert.equal(created.version, 0); assert.equal(created.publicUrl, resourceCommand.publicUrl);
    assert.deepEqual(await createResource(resourceCommand, "lost-resource-create"), created);
    const replayed = await stats();
    for (const field of ["resources", "resourceRevisions", "resourceReceipts", "resourceAudit"]) assert.equal(replayed[field], 1);
  });

  await step("changed resource payload with the original key conflicts without overwriting history", async () => {
    await assert.rejects(createResource({ ...resourceCommand, title: "Different synthetic proposal" }, "lost-resource-create"), statusError(409, "IDEMPOTENCY_CONFLICT"));
    const state = await stats(); assert.equal(state.resources, 1); assert.equal(state.resourceRevisions, 1); assert.equal(state.resourceReceipts, 1);
  });

  let revised;
  await step("revision requires expectedVersion and retains the original creation receipt", async () => {
    revised = await call(() => resources.requestReviseAdminResource({ ...auth, resourceId: created.id,
      command: { ...resourceCommand, title: "Synthetic revised resource", expectedVersion: 0 }, idempotencyKey: "resource-first-revision" }));
    assert.equal(revised.version, 1); assert.equal(revised.state, "DRAFT");
    await assert.rejects(call(() => resources.requestReviseAdminResource({ ...auth, resourceId: created.id,
      command: { ...resourceCommand, expectedVersion: 0 }, idempotencyKey: "resource-stale-revision" })), statusError(409, "RESOURCE_VERSION_CONFLICT"));
    assert.deepEqual(await createResource(resourceCommand, "lost-resource-create"), created);
    const state = await stats(); assert.equal(state.resourceRevisions, 2); assert.equal(state.resourceReceipts, 2); assert.equal(state.resourceAudit, 2);
  });

  await step("concurrent revisions with the same expectedVersion produce one durable winner", async () => {
    const before = await stats();
    const outcomes = await Promise.allSettled(["left", "right"].map((side) => call(() => resources.requestReviseAdminResource({ ...auth,
      resourceId: created.id, command: { ...resourceCommand, title: `Synthetic concurrent ${side}`, expectedVersion: 1 },
      idempotencyKey: `concurrent-resource-${side}` }))));
    assert.equal(outcomes.filter((result) => result.status === "fulfilled").length, 1);
    const loser = outcomes.find((result) => result.status === "rejected"); assert.equal(loser.reason.status, 409); assert.equal(loser.reason.code, "RESOURCE_VERSION_CONFLICT");
    revised = outcomes.find((result) => result.status === "fulfilled").value; assert.equal(revised.version, 2);
    const after = await stats();
    for (const field of ["resourceRevisions", "resourceReceipts", "resourceAudit"]) assert.equal(after[field], before[field] + 1);
  });

  await running.command("seed", "seeded");
  const portalToken = signedAccess(running.ready.partnerAuthSubject, []);
  const portalCatalog = async () => {
    await running.command("auth:PORTAL", "auth");
    try { return await call(() => portal.getPartnerResourcesApi(portalToken)); }
    finally { await running.command("auth:WRITE_BOTH", "auth"); }
  };

  let published;
  await step("published catalog visibility derives country from the actual persisted Partner profile", async () => {
    assert.equal((await portalCatalog()).items.length, 0);
    published = await transition(created.id, "publish", 2, "publish-local-resource");
    assert.equal(published.state, "PUBLISHED"); assert.equal(published.version, 3);
    const countryOther = await createResource({ ...resourceCommand, country: "CL", title: "Synthetic CL resource" }, "create-cl-resource");
    await transition(countryOther.id, "publish", 0, "publish-cl-resource");
    const page = await portalCatalog(); assert.equal(page.items.length, 1); assert.equal(page.items[0].id, created.id);
    assert.equal(page.items[0].downloadUrl, resourceCommand.publicUrl); assert.ok(!Object.hasOwn(page.items[0], "version"));
    const admin = await call(() => resources.requestAdminResources({ ...auth, limit: 1 }));
    assert.equal(admin.items.length, 1); assert.equal(admin.hasMore, true); assert.ok(admin.nextCursor);
    const next = await call(() => resources.requestAdminResources({ ...auth, limit: 1, cursor: admin.nextCursor }));
    assert.equal(next.items.length, 1); assert.equal(next.hasMore, false); assert.notEqual(admin.items[0].id, next.items[0].id);
  });

  await step("unpublish hides the portal resource and archive is terminal without deleting receipts", async () => {
    const unpublished = await transition(created.id, "unpublish", 3, "unpublish-local-resource");
    assert.equal(unpublished.state, "DRAFT"); assert.equal(unpublished.version, 4); assert.equal((await portalCatalog()).items.length, 0);
    const archived = await transition(created.id, "archive", 4, "archive-local-resource");
    assert.equal(archived.state, "ARCHIVED"); assert.equal(archived.version, 5); assert.ok(archived.archivedAt);
    await assert.rejects(transition(created.id, "publish", 5, "republish-archived-resource"), statusError(409, "RESOURCE_STATE_CONFLICT"));
    assert.deepEqual(await createResource(resourceCommand, "lost-resource-create"), created);
    const state = await stats(); assert.equal(state.resources, 2); assert.equal(state.resourceRevisions, 8); assert.equal(state.resourceReceipts, 8); assert.equal(state.resourceAudit, 8);
  });

  await step("unsafe URLs, client identity hints and unknown resources fail in actual backend without writes", async () => {
    const before = await stats();
    for (const [index, publicUrl] of ["http://resources.example.com/x", "https://resources.example.com/x?token=fake", "https://unlisted.example.com/x", "https://127.0.0.1/x"].entries()) {
      const rejected = await raw("/admin/resources", accessToken, { ...resourceCommand, publicUrl }, `invalid-resource-url-${index}`);
      assert.equal(rejected.status, 400); assert.equal(rejected.headers.get("cache-control"), "no-store");
    }
    const hints = await raw("/admin/resources", accessToken, { ...resourceCommand, ownerUserId: running.ready.actorUserId }, "reject-identity-hints");
    assert.equal(hints.status, 400);
    await assert.rejects(transition("99999999-9999-4999-8999-999999999999", "archive", 0, "missing-resource-archive"), statusError(404, "RESOURCE_NOT_FOUND"));
    const after = await stats();
    for (const field of ["resources", "resourceRevisions", "resourceReceipts", "resourceAudit"]) assert.equal(after[field], before[field]);
  });

  await step("current capability revocation is immediate despite signed write hints and recovers without cache", async () => {
    await running.command("auth:VIEW_ONLY", "auth");
    await assert.rejects(createResource(resourceCommand, "revoked-write-resource", { accessToken: forged }), statusError(403));
    await assert.rejects(createPolicy(policyCommand, "revoked-write-policy", { accessToken: forged }), statusError(403));
    await running.command("auth:REVOKED", "auth");
    for (const path of ["/admin/resources", "/admin/commission-policy-versions"]) {
      const result = await raw(path, forged); assert.equal(result.status, 401); assert.equal(result.headers.get("cache-control"), "no-store");
    }
    await running.command("auth:WRITE_BOTH", "auth");
    assert.equal((await call(() => resources.requestAdminResources(auth))).items.length, 2);
    assert.equal((await call(() => policy.requestAdminCommissionPolicyVersions(auth))).items.length, 2);
    const expired = await raw("/admin/resources", signedAccess(running.ready.actorUserId, [], -60)); assert.equal(expired.status, 401);
    assert.equal((await stats()).policyDrafts, 2); assert.equal((await stats()).resources, 2);
  });

  const changeStatus = (operation, expectedVersion, idempotencyKey, credentials = auth, partnerId = running.ready.partnerId, proposedReason = reason) =>
    call(() => statusApi.requestAdminPartnerStatus({ ...credentials, partnerId, operation,
      command: { expectedVersion, reason: proposedReason }, idempotencyKey }));
  const detail = () => call(() => reads.requestAdminPartner({ ...auth, partnerId: running.ready.partnerId }));
  const getPayout = (token = portalToken) => call(() => payout.requestPayoutSettings(token));
  const savePayout = (command, idempotencyKey, token = portalToken) => call(() => payout.requestUpdatePayoutSettings({
    accessToken: token, command, idempotencyKey,
  }));
  const payoutCommand = { expectedVersion: null, method: "yape", accountNumber: "LOCAL-SYNTHETIC-001",
    accountHolder: "Synthetic local holder", reason };
  const payoutCounts = async (expected) => {
    const state = await stats(); assert.equal(state.payoutSettings, expected === 0 ? 0 : 1);
    for (const field of ["payoutSettingsHistory", "payoutSettingsReceipts", "payoutSettingsAudit"]) assert.equal(state[field], expected);
    assert.ok(!JSON.stringify(state).includes(payoutCommand.accountNumber));
  };
  let initialPayout; let currentPayout;

  await step("own payout settings are actually absent and require a current session without fabricated defaults", async () => {
    await running.command("auth:PORTAL", "auth");
    const profileResponse = await raw("/me", portalToken); assert.equal(profileResponse.status, 200);
    const profile = await profileResponse.json();
    assert.equal(profile.id, running.ready.partnerId); assert.equal(profile.status, "ACTIVE");
    assert.equal(profile.country, "PE"); assert.equal(profile.currency, "PEN");
    assert.equal(profile.referralCode, "admin-read-fixture-code");
    assert.equal(profile.referralLink, "https://registration.example.com/r/admin-read-fixture-code");
    assert.deepEqual([...profile.permissions].sort(), ["REFERRALS_READ", "REFERRALS_CREATE", "COMMISSIONS_READ", "PAYOUTS_READ"].sort());
    assert.deepEqual(Object.keys(profile).sort(), ["id", "status", "displayName", "country", "currency", "referralLink", "referralCode", "permissions"].sort());
    assert.equal(await getPayout(), null);
    const actual = await raw("/me/payout-settings", portalToken); assert.equal(actual.status, 200);
    assert.equal(actual.headers.get("cache-control"), "no-store"); assert.deepEqual(await actual.json(), { settings: null });
    const missing = await raw("/me/payout-settings"); assert.equal(missing.status, 401);
    assert.equal(missing.headers.get("cache-control"), "no-store"); await payoutCounts(0);
  });

  await step("lost committed own payout200 with expectedVersion null replays one durable encrypted settings revision", async () => {
    transport.discardNext200("/v1/partners/me/payout-settings", "lost-own-payout-create");
    await assert.rejects(savePayout(payoutCommand, "lost-own-payout-create"), (failure) => failure.status === null);
    await payoutCounts(1);
    initialPayout = await savePayout(payoutCommand, "lost-own-payout-create");
    assert.equal(initialPayout.version, 0); assert.equal(initialPayout.method, payoutCommand.method);
    assert.equal(initialPayout.accountNumber, payoutCommand.accountNumber); assert.equal(initialPayout.accountHolder, payoutCommand.accountHolder);
    assert.deepEqual(Object.keys(initialPayout).sort(), ["method", "accountNumber", "accountHolder", "version", "updatedAt"].sort());
    assert.deepEqual(await savePayout(payoutCommand, "lost-own-payout-create"), initialPayout);
    assert.deepEqual(await getPayout(), initialPayout); await payoutCounts(1);
  });

  await step("changed payout proposal conflicts with its old key and null version cannot overwrite existing settings", async () => {
    await assert.rejects(savePayout({ ...payoutCommand, accountNumber: "LOCAL-SYNTHETIC-CHANGED" }, "lost-own-payout-create"), statusError(409, "IDEMPOTENCY_CONFLICT"));
    await assert.rejects(savePayout(payoutCommand, "cannot-recreate-own-payout"), statusError(409, "PAYOUT_SETTINGS_VERSION_CONFLICT"));
    assert.deepEqual(await getPayout(), initialPayout); await payoutCounts(1);
  });

  await step("two actual own payout updates on version zero have one winner and preserve the original receipt", async () => {
    const outcomes = await Promise.allSettled(["left", "right"].map((side) => savePayout({ ...payoutCommand,
      expectedVersion: 0, accountNumber: `LOCAL-SYNTHETIC-${side.toUpperCase()}` }, `own-payout-concurrent-${side}`)));
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const loser = outcomes.find((outcome) => outcome.status === "rejected");
    assert.equal(loser.reason.status, 409); assert.equal(loser.reason.code, "PAYOUT_SETTINGS_VERSION_CONFLICT");
    currentPayout = outcomes.find((outcome) => outcome.status === "fulfilled").value; assert.equal(currentPayout.version, 1);
    assert.deepEqual(await getPayout(), currentPayout);
    assert.deepEqual(await savePayout(payoutCommand, "lost-own-payout-create"), initialPayout); await payoutCounts(2);
  });

  await step("payout endpoint rejects owner expansion and other-user query parameters without exposing or changing settings", async () => {
    for (const query of [`?partnerId=${running.ready.partnerId}`, `?userId=${running.ready.actorUserId}`]) {
      const rejected = await raw(`/me/payout-settings${query}`, portalToken); assert.equal(rejected.status, 400);
      assert.equal(rejected.headers.get("cache-control"), "no-store"); assert.equal((await rejected.json()).code, "INVALID_PAYOUT_SETTINGS_QUERY");
    }
    for (const owner of ["ownerUserId", "partnerId"]) {
      const rejected = await raw("/me/payout-settings", portalToken, { ...payoutCommand, expectedVersion: 1,
        [owner]: running.ready.actorUserId }, `reject-payout-owner-${owner}`);
      assert.equal(rejected.status, 400); assert.equal(rejected.headers.get("cache-control"), "no-store");
    }
    assert.deepEqual(await getPayout(), currentPayout); await payoutCounts(2);
  });

  await step("another current Auth actor cannot access the owner and revoked sessions cannot replay payout receipts", async () => {
    await running.command("auth:ALLOW", "auth");
    await assert.rejects(getPayout(accessToken), statusError(404, "PARTNER_PROFILE_NOT_FOUND"));
    await assert.rejects(savePayout(payoutCommand, "other-actor-own-payout", accessToken), statusError(404, "PARTNER_PROFILE_NOT_FOUND"));
    await running.command("auth:REVOKED", "auth");
    await assert.rejects(getPayout(), statusError(401));
    await assert.rejects(savePayout(payoutCommand, "lost-own-payout-create"), statusError(401));
    await running.command("auth:PORTAL", "auth");
    assert.deepEqual(await getPayout(), currentPayout);
    assert.deepEqual(await savePayout(payoutCommand, "lost-own-payout-create"), initialPayout); await payoutCounts(2);
  });

  let originalPartner; let suspended;
  await step("only dedicated current capability can change partner status; VIEW and approval hints cannot", async () => {
    await running.command("auth:VIEW_ONLY", "auth");
    originalPartner = await detail(); assert.equal(originalPartner.status, "ACTIVE"); assert.equal(originalPartner.version, 0);
    const signedHints = { accessToken: signedAccess(running.ready.actorUserId, ["PARTNERS_VIEW", "PARTNERS_APPROVE", "PARTNERS_MANAGE_PARTNERS"]) };
    await assert.rejects(changeStatus("suspend", 0, "view-cannot-suspend", signedHints), statusError(403));
    await running.command("auth:PARTNERS_ONLY", "auth");
    await assert.rejects(detail(), statusError(403));
    const missing = await raw(`/admin/partners/${running.ready.partnerId}/suspend`, null, { expectedVersion: 0, reason }, "missing-status-session");
    assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal((await stats()).partnerStatusHistory, 0);
  });

  await step("lost committed suspend200 replays immutable receipt before later resume state and blocks actual portal", async () => {
    transport.discardNext200(`/v1/partners/admin/partners/${running.ready.partnerId}/suspend`, "lost-partner-suspend");
    await assert.rejects(changeStatus("suspend", 0, "lost-partner-suspend"), (failure) => failure.status === null);
    const committed = await stats();
    for (const field of ["partnerStatusHistory", "partnerStatusReceipts", "partnerStatusAudit"]) assert.equal(committed[field], 1);
    suspended = await changeStatus("suspend", 0, "lost-partner-suspend"); assert.equal(suspended.status, "SUSPENDED"); assert.equal(suspended.version, 1);
    assert.deepEqual(await changeStatus("suspend", 0, "lost-partner-suspend"), suspended);
    await running.command("auth:PORTAL", "auth");
    const deniedProfile = await raw("/me", portalToken); assert.equal(deniedProfile.status, 403);
    assert.equal((await deniedProfile.json()).code, "PARTNER_NOT_ACTIVE");
    await assert.rejects(call(() => portal.getPartnerResourcesApi(portalToken)), statusError(403, "PARTNER_NOT_ACTIVE"));
    await assert.rejects(getPayout(), statusError(403, "PARTNER_NOT_ACTIVE"));
    await assert.rejects(savePayout({ ...payoutCommand, expectedVersion: 1 }, "suspended-own-payout"), statusError(403, "PARTNER_NOT_ACTIVE"));
    await assert.rejects(savePayout(payoutCommand, "lost-own-payout-create"), statusError(403, "PARTNER_NOT_ACTIVE"));
    await payoutCounts(2);
    await running.command("auth:PARTNERS_ONLY", "auth");
    await assert.rejects(changeStatus("suspend", 1, "repeat-current-suspend"), statusError(409, "PARTNER_STATE_CONFLICT"));
    await assert.rejects(changeStatus("resume", 0, "stale-partner-resume"), statusError(409, "PARTNER_VERSION_CONFLICT"));
    const resumed = await changeStatus("resume", 1, "resume-approved-partner"); assert.equal(resumed.status, "ACTIVE"); assert.equal(resumed.version, 2);
    assert.deepEqual(await changeStatus("suspend", 0, "lost-partner-suspend"), suspended);
    await assert.rejects(changeStatus("suspend", 0, "lost-partner-suspend", auth, running.ready.partnerId, "Changed reason"), statusError(409, "IDEMPOTENCY_CONFLICT"));
    await running.command("auth:PORTAL", "auth");
    const restoredProfile = await raw("/me", portalToken); assert.equal(restoredProfile.status, 200);
    assert.equal((await restoredProfile.json()).id, running.ready.partnerId);
    assert.equal((await call(() => portal.getPartnerResourcesApi(portalToken))).items.length, 0);
    assert.deepEqual(await getPayout(), currentPayout);
    assert.deepEqual(await savePayout(payoutCommand, "lost-own-payout-create"), initialPayout); await payoutCounts(2);
    await running.command("auth:VIEW_PARTNERS", "auth");
    const current = await detail(); assert.equal(current.status, "ACTIVE"); assert.equal(current.version, 2);
    for (const field of ["id", "displayName", "country", "currency", "applicationReference", "appliedAt", "activatedAt", "createdAt", "referralCode", "manualReferralsCount", "linkAttributionsCount"])
      assert.deepEqual(current[field], originalPartner[field]);
    for (const field of ["partnerStatusHistory", "partnerStatusReceipts", "partnerStatusAudit"]) assert.equal((await stats())[field], 2);
  });

  await step("applied and rejected partners cannot be resumed; one explicit version has one concurrent winner", async () => {
    const page = await call(() => reads.requestAdminPartners({ ...auth, limit: 100 }));
    for (const partner of page.items.filter((candidate) => ["APPLIED", "REJECTED"].includes(candidate.status)))
      await assert.rejects(changeStatus("resume", partner.version, `cannot-resume-${partner.id}`, auth, partner.id), statusError(409, "PARTNER_STATE_CONFLICT"));
    const outcomes = await Promise.allSettled(["left", "right"].map((side) => changeStatus("suspend", 2, `status-concurrent-${side}`)));
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const loser = outcomes.find((outcome) => outcome.status === "rejected"); assert.equal(loser.reason.status, 409); assert.equal(loser.reason.code, "PARTNER_VERSION_CONFLICT");
    const winner = outcomes.find((outcome) => outcome.status === "fulfilled").value; assert.equal(winner.version, 3);
    await changeStatus("resume", 3, "resume-after-status-race");
    const immutable = await stats();
    for (const field of ["partnerStatusHistory", "partnerStatusReceipts", "partnerStatusAudit"]) assert.equal(immutable[field], 4);
    assert.equal((await detail()).status, "ACTIVE");
  });

  await step("revoked management permission denies permanent replay and backend rejects strict malformed commands", async () => {
    for (const body of [{ expectedVersion: 4, reason, ownerUserId: running.ready.actorUserId }, { expectedVersion: "4", reason }, { expectedVersion: 4, reason: " " }]) {
      const bad = await raw(`/admin/partners/${running.ready.partnerId}/suspend`, accessToken, body, "malformed-status-command");
      assert.equal(bad.status, 400); assert.equal(bad.headers.get("cache-control"), "no-store");
    }
    await running.command("auth:VIEW_ONLY", "auth");
    await assert.rejects(changeStatus("suspend", 0, "lost-partner-suspend"), statusError(403));
    await running.command("auth:REVOKED", "auth");
    await assert.rejects(changeStatus("suspend", 0, "lost-partner-suspend"), statusError(401));
    await running.command("auth:PARTNERS_ONLY", "auth");
    assert.deepEqual(await changeStatus("suspend", 0, "lost-partner-suspend"), suspended);
    for (const field of ["partnerStatusHistory", "partnerStatusReceipts", "partnerStatusAudit"]) assert.equal((await stats())[field], 4);
  });

  const getPreferences = () => call(() => preferences.requestProgramPreferences({ accessToken: portalToken }));
  const preferenceCommand = { optionCode: "C", discountPct: "5", expectedVersion: null, reason };
  const savePreferences = (command, idempotencyKey) => call(() => preferences.requestUpdateProgramPreferences({ accessToken: portalToken, command, idempotencyKey }));
  const preferenceCounts = async (expected) => {
    const state = await stats(); assert.equal(state.programPreferences, expected === 0 ? 0 : 1);
    for (const field of ["programPreferencesHistory", "programPreferencesReceipts", "programPreferencesAudit"]) assert.equal(state[field], expected);
    assert.equal(state.nonDraftPolicies, 0);
  };
  let initialPreference;
  await step("own documented catalog has no effective financial policy or default preference", async () => {
    await running.command("auth:PORTAL", "auth");
    const actual = await getPreferences(); assert.equal(actual.settings, null);
    assert.equal(actual.effectiveTerms.status, "NOT_CONFIGURED"); assert.equal(actual.effectiveTerms.policyVersion, null);
    assert.deepEqual(actual.catalog.options.map((option) => option.code), ["A", "B", "C"]); await preferenceCounts(0);
    const missing = await raw("/me/program-preferences"); assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
  });
  await step("lost committed preferences200 replays an explicit choice once and never activates rates", async () => {
    transport.discardNext200("/v1/partners/me/program-preferences", "lost-own-program-preferences");
    await assert.rejects(savePreferences(preferenceCommand, "lost-own-program-preferences"), (failure) => failure.status === null);
    await preferenceCounts(1); initialPreference = await savePreferences(preferenceCommand, "lost-own-program-preferences");
    assert.equal(initialPreference.settings.optionCode, "C"); assert.equal(initialPreference.settings.discountPct, "5");
    assert.equal(initialPreference.settings.version, 0); assert.equal(initialPreference.effectiveTerms.firstPaymentRate, null);
    assert.deepEqual(await savePreferences(preferenceCommand, "lost-own-program-preferences"), initialPreference);
    assert.deepEqual(await getPreferences(), initialPreference); await preferenceCounts(1);
  });
  await step("program choice is frozen and two discount updates have one winner without overwriting original receipt", async () => {
    await assert.rejects(savePreferences({ ...preferenceCommand, optionCode: "A", expectedVersion: 0 }, "cannot-change-own-option"), statusError(409, "PROGRAM_PREFERENCES_OPTION_LOCKED"));
    const outcomes = await Promise.allSettled(["0", "10"].map((discountPct) => savePreferences({ ...preferenceCommand, discountPct, expectedVersion: 0 }, `own-discount-race-${discountPct}`)));
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const loser = outcomes.find((outcome) => outcome.status === "rejected"); assert.equal(loser.reason.status, 409);
    assert.equal(loser.reason.code, "PROGRAM_PREFERENCES_VERSION_CONFLICT");
    assert.equal((await getPreferences()).settings.version, 1);
    assert.deepEqual(await savePreferences(preferenceCommand, "lost-own-program-preferences"), initialPreference); await preferenceCounts(2);
    const expansion = await raw("/me/program-preferences", portalToken, { ...preferenceCommand, ownerUserId: running.ready.actorUserId }, "reject-program-owner");
    assert.equal(expansion.status, 400); assert.equal(expansion.headers.get("cache-control"), "no-store");
  });
  await step("Link metrics are actual captured attached and attributed counts rather than visits or payments", async () => {
    const actual = await call(() => metrics.requestPartnerReferralMetrics({ accessToken: portalToken }));
    assert.equal(actual.claimCaptures, 1); assert.equal(actual.attachedClaims, 1); assert.equal(actual.attributedCompanies, 1);
    assert.deepEqual(Object.keys(actual).sort(), ["claimCaptures", "attachedClaims", "attributedCompanies", "asOf"].sort());
    const current = await raw("/me/referral-metrics", portalToken); assert.equal(current.status, 200); assert.equal(current.headers.get("cache-control"), "no-store");
    const expansion = await raw(`/me/referral-metrics?partnerId=${running.ready.partnerId}`, portalToken); assert.equal(expansion.status, 400);
    const missing = await raw("/me/referral-metrics"); assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
    await running.command("auth:ALLOW", "auth");
    await assert.rejects(call(() => metrics.requestPartnerReferralMetrics({ accessToken })), statusError(404, "PARTNER_PROFILE_NOT_FOUND"));
    await running.command("auth:REVOKED", "auth");
    await assert.rejects(getPreferences(), statusError(401)); await assert.rejects(savePreferences(preferenceCommand, "lost-own-program-preferences"), statusError(401));
    await assert.rejects(call(() => metrics.requestPartnerReferralMetrics({ accessToken: portalToken })), statusError(401));
    await running.command("auth:PORTAL", "auth");
    assert.deepEqual(await savePreferences(preferenceCommand, "lost-own-program-preferences"), initialPreference); await preferenceCounts(2);
  });

  const queue = () => call(() => reads.requestAdminReviewQueue({ ...auth, limit: 100 }));
  const rejectReferral = (target, idempotencyKey, proposedReason = reason, credentials = auth) => call(() => review.requestReferralRejection({
    ...credentials, referralId: target.id, command: { expectedVersion: target.version, reason: proposedReason }, idempotencyKey,
  }));
  let manualReferral; let codeReferral; let rejectedManual;
  await step("actual pending review rows have real versions and VIEW cannot reject with a signed capability hint", async () => {
    await running.command("auth:VIEW_ONLY", "auth");
    const pending = await queue(); assert.equal(pending.items.length, 2);
    manualReferral = pending.items.find((item) => item.origin === "MANUAL"); codeReferral = pending.items.find((item) => item.origin === "CODE");
    assert.equal(manualReferral.version, 0); assert.equal(codeReferral.version, 0);
    const hints = { accessToken: signedAccess(running.ready.actorUserId, ["PARTNERS_VIEW", "PARTNERS_RESOLVE_REFERRAL"]) };
    await assert.rejects(rejectReferral(manualReferral, "view-cannot-reject-referral", reason, hints), statusError(403));
    const missing = await raw(`/admin/review-queue/${manualReferral.id}/reject`, null, { expectedVersion: 0, reason }, "reject-missing-session");
    assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
    assert.equal((await stats()).referralReviewDecisions, 0);
  });
  await step("lost committed referral rejection200 replays immutable receipt after its row leaves the queue", async () => {
    await running.command("auth:VIEW_REVIEW", "auth");
    transport.discardNext200(`/v1/partners/admin/review-queue/${manualReferral.id}/reject`, "lost-manual-referral-reject");
    await assert.rejects(rejectReferral(manualReferral, "lost-manual-referral-reject"), (failure) => failure.status === null);
    for (const field of ["referralReviewDecisions", "referralReviewReceipts", "referralReviewAudit"]) assert.equal((await stats())[field], 1);
    assert.ok(!(await queue()).items.some((item) => item.id === manualReferral.id));
    rejectedManual = await rejectReferral(manualReferral, "lost-manual-referral-reject");
    assert.equal(rejectedManual.id, manualReferral.id); assert.equal(rejectedManual.state, "CANCELLED");
    assert.equal(rejectedManual.decision, "REJECTED"); assert.equal(rejectedManual.version, 1);
    assert.equal(Object.hasOwn(rejectedManual, "reason"), false);
    assert.deepEqual(await rejectReferral(manualReferral, "lost-manual-referral-reject"), rejectedManual);
    await assert.rejects(rejectReferral(manualReferral, "lost-manual-referral-reject", "Different reason"), statusError(409, "IDEMPOTENCY_CONFLICT"));
    await assert.rejects(rejectReferral(manualReferral, "new-stale-manual-rejection"), statusError(409, "REFERRAL_VERSION_CONFLICT"));
  });
  await step("concurrent pending CODE rejections create one winner and revoked permission cannot replay a receipt", async () => {
    const outcomes = await Promise.allSettled(["left", "right"].map((side) => rejectReferral(codeReferral, `code-review-race-${side}`)));
    assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
    const loser = outcomes.find((outcome) => outcome.status === "rejected"); assert.equal(loser.reason.status, 409);
    assert.equal(loser.reason.code, "REFERRAL_VERSION_CONFLICT"); assert.equal((await queue()).items.length, 0);
    for (const field of ["referralReviewDecisions", "referralReviewReceipts", "referralReviewAudit"]) assert.equal((await stats())[field], 2);
    await running.command("auth:VIEW_ONLY", "auth"); await assert.rejects(rejectReferral(manualReferral, "lost-manual-referral-reject"), statusError(403));
    await running.command("auth:REVOKED", "auth"); await assert.rejects(rejectReferral(manualReferral, "lost-manual-referral-reject"), statusError(401));
    await running.command("auth:REVIEW_ONLY", "auth");
    assert.deepEqual(await rejectReferral(manualReferral, "lost-manual-referral-reject"), rejectedManual);
    await assert.rejects(queue(), statusError(403));
    for (const field of ["commissionItems", "commissionApprovals", "commissionContexts"]) assert.equal((await stats())[field], 0);
  });

  await running.command("seed-billing", "billing-seeded");
  await step("actual own commission APIs expose a blocked persisted evaluation and no fabricated income", async () => {
    await running.command("auth:PORTAL", "auth");
    const actualItems = await call(() => commission.requestOwnCommissionItems({ accessToken: portalToken, limit: 20 }));
    assert.equal(actualItems.items.length, 0); assert.equal(actualItems.hasMore, false); assert.equal(actualItems.nextCursor, null);
    const actualEvaluations = await call(() => commission.requestOwnCommissionEvaluations({ accessToken: portalToken, limit: 20 }));
    assert.equal(actualEvaluations.items.length, 1); assert.equal(actualEvaluations.items[0].state, "BLOCKED");
    assert.deepEqual(actualEvaluations.items[0].reasons, ["APPROVED_FINANCIAL_CONTEXT_MISSING"]); assert.equal(actualEvaluations.items[0].itemId, null);
    assert.equal(actualEvaluations.items[0].companyId, running.ready.companyId);
    for (const path of ["/me/commissions", "/me/commission-evaluations"]) {
      const actual = await raw(path, portalToken); assert.equal(actual.status, 200); assert.equal(actual.headers.get("cache-control"), "no-store");
      const missing = await raw(path); assert.equal(missing.status, 401); assert.equal(missing.headers.get("cache-control"), "no-store");
      const owner = await raw(`${path}?partnerId=${running.ready.partnerId}`, portalToken); assert.equal(owner.status, 400);
    }
    for (const field of ["commissionItems", "commissionApprovals", "commissionContexts"]) assert.equal((await stats())[field], 0);
    await running.command("auth:REVOKED", "auth");
    await assert.rejects(call(() => commission.requestOwnCommissionEvaluations({ accessToken: portalToken })), statusError(401));
    await running.command("auth:VIEW_ONLY", "auth");
    const admin = await raw("/admin/commission-evaluations", accessToken); assert.equal(admin.status, 200);
    assert.equal((await admin.json()).items.length, 1); const adminItems = await raw("/admin/commissions", accessToken); assert.equal(adminItems.status, 200);
    assert.equal((await adminItems.json()).items.length, 0);
  });

  assert.equal(transport.drops(), 6, "Two actual committed201 and four committed200 responses were discarded");
  assert.equal(transport.records.filter((record) => record.discardedAfterCommit).length, 6);
  process.stdout.write(`PARTNERS_WRITES_VERIFIED ${JSON.stringify({ boundary: "ACTUAL_TS_ADAPTER_HTTP_POSTGRES", lostCommitted201: 2,
    proxyHttpStatuses: Object.fromEntries([200, 201, 403, 404, 409].map((status) => [status, transport.records.filter((record) => record.status === status).length])),
    lostCommitted200: 4, persisted: await stats(), auth: "EXPLICIT_LOCAL_PROTOCOL_FIXTURE", flow: "NOT_TESTED", envFilesRead: false })}\n`);
});
