import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";

// Actual TypeScript adapters → actual Partners HTTP/transactions/kernel/ledger → owned PostgreSQL.
// Auth and the provider charge protocol are explicit synthetic fixtures. No live provider, tax or payout runs.
const frontendRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRoot = resolve(frontendRoot, "../ms-partners-partners-main-candidate");
const nativeRequire = createRequire(resolve(frontendRoot, "package.json"));
const typescript = nativeRequire("typescript");
const java = "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home/bin/java";
const directory = "/private/tmp/powip-partners-auth-company-pg.qFnDIV/data";
const key = Buffer.from("MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=", "base64");
const reason = "Explicit synthetic local financial verification";

function loadActualTypeScript(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const source = typescript.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: typescript.ModuleKind.CommonJS, target: typescript.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: file,
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

function signedAccess(actor, permissions = [], expiry = 3600) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: actor, sub: actor, type: "access", role: "ADMINISTRADOR",
    permissions, exp: Math.floor(Date.now() / 1000) + expiry })}`;
  return `${content}.${createHmac("sha256", key).update(content).digest("base64url")}`;
}

// Never expose Axios Authorization/configuration or arbitrary upstream errors in test output.
async function safely(action) {
  try { return await action(); } catch (failure) {
    const status = failure?.response?.status ?? failure?.status ?? null;
    const code = failure?.response?.data?.code ?? failure?.code ?? failure?.constructor?.name ?? "UNKNOWN";
    const safe = new Error(`Local financial contract failed: ${status ?? "transport"}/${code}`);
    safe.status = status; safe.code = code; throw safe;
  }
}
const statusError = (status) => (failure) => failure.status === status;
const exact = (value) => value.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");

async function fixture() {
  assert.equal(process.env.PARTNERS_ADMIN_FINANCIAL_LOCAL_TEST, "true", "Explicit financial local opt-in required");
  const classpathFile = resolve(backendRoot, "target/billing-fixture-classpath.txt");
  assert.ok(existsSync(classpathFile), "Stable compiled real Java fixture/classpath required");
  const classpath = [resolve(backendRoot, "target/test-classes"), resolve(backendRoot, "target/classes"), readFileSync(classpathFile, "utf8").trim()].join(":");
  const child = spawn(java, ["-cp", classpath, "com.powip.partners.adminread.application.PartnerAdminLocalHttpFixture"], {
    cwd: backendRoot,
    env: { PATH: process.env.PATH, TMPDIR: "/private/tmp", PARTNERS_ADMIN_READ_LOCAL_TEST: "true", PARTNERS_ADMIN_FINANCIAL_LOCAL_TEST: "true",
      PARTNERS_TEST_POSTGRES_ISOLATED: "true", PARTNERS_TEST_POSTGRES_PORT: "55439", PARTNERS_TEST_POSTGRES_DATA_DIRECTORY: directory },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const messages = []; const waiters = new Set(); let buffer = ""; let exit;
  const exited = new Promise((resolveExit) => child.once("exit", (code, signal) => {
    exit = { code, signal };
    for (const waiter of waiters) waiter.reject(new Error("Local financial fixture exited before its milestone"));
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
        for (const waiter of waiters) waiter.reject(new Error(`Local financial fixture failed: ${value.code}/${value.causeClass}`));
        waiters.clear(); continue;
      }
      const waiter = [...waiters].find((candidate) => candidate.type === value.type);
      if (waiter) { waiters.delete(waiter); waiter.resolve(value); } else messages.push(value);
    }
  });
  const waitFor = (type) => {
    const index = messages.findIndex((message) => message.type === type);
    if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]);
    if (exit) return Promise.reject(new Error("Local financial fixture is no longer running"));
    return new Promise((resolveWait, rejectWait) => {
      const waiter = { type, resolve: (value) => { clearTimeout(timeout); resolveWait(value); }, reject: (failure) => { clearTimeout(timeout); rejectWait(failure); } };
      const timeout = setTimeout(() => { waiters.delete(waiter); rejectWait(new Error(`Local financial milestone timeout: ${type}`)); }, 60_000);
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
    assert.equal(ready.financialOptIn, true);
    return { ready, command, close };
  } catch (failure) {
    child.stdin.end();
    if (!exit) await Promise.race([exited, new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5000))]);
    if (!exit) child.kill("SIGTERM"); throw failure;
  }
}

test("actual positive annual financial adapters/HTTP/PostgreSQL and durable internal receipts", { timeout: 180_000 }, async (context) => {
  const running = await fixture(); context.after(running.close);
  const previous = process.env.NEXT_PUBLIC_API_PARTNERS;
  process.env.NEXT_PUBLIC_API_PARTNERS = `${running.ready.baseUrl}/v1/partners`;
  context.after(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_API_PARTNERS; else process.env.NEXT_PUBLIC_API_PARTNERS = previous; });
  const cache = new Map();
  const policy = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/admin-commission-policy.api.ts"), cache);
  const preferences = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/program-preferences.api.ts"), cache);
  const commissions = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/commission-read.api.ts"), cache);
  const ledger = loadActualTypeScript(resolve(frontendRoot, "src/features/partners/api/financial-ledger.api.ts"), cache);
  for (const client of [policy.adminCommissionPolicyClient, preferences.programPreferencesClient, commissions.commissionReadClient, ledger.financialLedgerClient]) {
    client.defaults.proxy = false;
    client.defaults.headers.common.Authorization = "Bearer invalid-local-default";
    client.interceptors.request.use((request) => {
      assert.equal(new URL(request.url).origin, running.ready.baseUrl, "Financial adapters must stay on the owned loopback server");
      return request;
    });
  }
  const staff = { accessToken: signedAccess(running.ready.actorUserId, ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY"]) };
  const own = { accessToken: signedAccess(running.ready.partnerAuthSubject) };
  const stats = () => running.command("write-status", "write-status");
  const call = (action) => safely(action);
  const raw = (path, token, body) => fetch(`${running.ready.baseUrl}/v1/partners${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json", "Idempotency-Key": "local-forbidden-money-write" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const step = async (name, action) => {
    let broken = false;
    await context.test(name, async () => { try { await action(); } catch (failure) { broken = true; throw failure; } });
    if (broken) throw new Error("Financial verification stopped at its first broken boundary");
  };
  const balance = () => call(() => ledger.requestOwnFinancialBalance(own));
  let savedPreferences; let draft; let financial;
  await running.command("seed", "seeded");
  await running.command("auth:LOCAL_DEMO", "auth");
  process.stdout.write(`PARTNERS_FINANCIAL_EVIDENCE ${JSON.stringify({ backend: running.ready.baseUrl, database: running.ready.database,
    auth: "EXPLICIT_LOCAL_PROTOCOL_FIXTURE", charge: "EXPLICIT_SYNTHETIC_PROVIDER_PROTOCOL_FIXTURE", envFilesRead: false })}\n`);

  await step("real Bearer validation rejects missing, expired, invalid and other synthetic identities", async () => {
    for (const path of ["/me/financial-ledger", "/me/financial-balance", "/me/commissions", "/admin/financial-ledger"]) {
      const response = await raw(path); assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "no-store");
    }
    for (const token of [signedAccess(running.ready.partnerAuthSubject, [], -60), "invalid-local-not-a-jwt",
      signedAccess("33333333-3333-4333-8333-333333333333", ["PARTNERS_VIEW", "PARTNERS_CONFIGURE_POLICY"])]) {
      const response = await raw("/me/financial-balance", token);
      assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const denied = await raw("/admin/financial-ledger", signedAccess(running.ready.partnerAuthSubject, ["PARTNERS_VIEW"]));
    assert.equal(denied.status, 403); assert.equal(denied.headers.get("cache-control"), "no-store");
  });
  await step("empty real ledger does not invent payable money and own C/0 preference persists without activation", async () => {
    const empty = await balance();
    assert.equal(empty.partnerId, running.ready.partnerId); assert.equal(empty.postedLedgerBalance, "0");
    assert.equal(empty.postedEntryCount, 0); assert.equal(empty.availability, "NO_POSTED_ENTRIES");
    assert.equal(empty.settlementEligibility, "NOT_EVALUATED");
    assert.deepEqual((await call(() => ledger.requestOwnFinancialLedger({ ...own, limit: 1 }))).items, []);
    assert.deepEqual((await call(() => commissions.requestOwnCommissionItems({ ...own, limit: 1 }))).items, []);
    const command = { optionCode: "C", discountPct: "0", expectedVersion: null, reason };
    savedPreferences = await call(() => preferences.requestUpdateProgramPreferences({ ...own, command, idempotencyKey: "local-financial-c-zero" }));
    assert.equal(savedPreferences.settings.optionCode, "C"); assert.equal(savedPreferences.settings.discountPct, "0");
    assert.equal(savedPreferences.settings.version, 0); assert.equal(savedPreferences.effectiveTerms.status, "NOT_CONFIGURED");
    assert.deepEqual(await call(() => preferences.requestUpdateProgramPreferences({ ...own, command, idempotencyKey: "local-financial-c-zero" })), savedPreferences);
    assert.equal((await stats()).commissionItems, 0);
  });
  await step("forged signed capabilities cannot create policy without current fixture grants", async () => {
    await running.command("auth:DENY", "auth");
    const command = { code: "LOCAL-FINANCIAL-DENIED", currency: "PEN", firstPaymentRate: "0.5", recurringPaymentRate: "0.08",
      recurringPaymentCount: 11, effectiveFrom: savedPreferences.settings.updatedAt, reason };
    await assert.rejects(call(() => policy.requestCreateAdminCommissionPolicyDraft({ ...staff, command, idempotencyKey: "local-denied-financial-policy" })), statusError(403));
    const denied = await raw(`/admin/financial-balance?partnerId=${running.ready.partnerId}`, staff.accessToken);
    assert.equal(denied.status, 403); assert.equal(denied.headers.get("cache-control"), "no-store");
    assert.equal((await stats()).policyDrafts, 0);
    await running.command("auth:LOCAL_DEMO", "auth");
  });
  await step("existing HTTP creates only a DRAFT; preferences and proposal alone produce no ledger entries", async () => {
    const command = { code: "LOCAL-SYNTHETIC-C-ANNUAL", currency: "PEN", firstPaymentRate: "0.5", recurringPaymentRate: "0.08",
      recurringPaymentCount: 11, effectiveFrom: savedPreferences.settings.updatedAt, reason };
    draft = await call(() => policy.requestCreateAdminCommissionPolicyDraft({ ...staff, command, idempotencyKey: "local-synthetic-c-policy" }));
    assert.equal(draft.state, "DRAFT"); assert.equal(draft.recurringPaymentCount, 11);
    assert.equal((await call(() => policy.requestAdminCommissionPolicyVersions(staff))).items[0].id, draft.id);
    const before = await stats(); assert.equal(before.nonDraftPolicies, 0); assert.equal(before.commissionApprovals, 0);
    assert.equal(before.commissionApprovalEvidence, 0); assert.equal(before.financialLedgerEntries, 0);
    assert.equal((await balance()).postedLedgerBalance, "0");
  });
  await step("explicit synthetic annual828 source uses real trusted writer, kernel and ledger to record95.22", async () => {
    financial = await running.command(`seed-financial:${draft.id}`, "financial-seeded");
    assert.equal(financial.source, "EXPLICIT_SYNTHETIC_PROVIDER_PROTOCOL_FIXTURE"); assert.equal(financial.provenance, "LOCAL_SYNTHETIC");
    assert.equal(financial.policyVersionId, draft.id); assert.equal(financial.partnerId, running.ready.partnerId);
    const page = await call(() => commissions.requestOwnCommissionItems({ ...own, limit: 1 }));
    assert.equal(page.items.length, 1); const item = page.items[0];
    assert.equal(item.id, financial.itemId); assert.equal(item.observationId, financial.observationId);
    assert.equal(item.paymentId, financial.paymentId); assert.equal(item.subscriptionId, financial.subscriptionId);
    assert.equal(item.partnerId, running.ready.partnerId); assert.equal(item.kind, "ANNUAL");
    assert.equal(exact(item.initialBase), "69"); assert.equal(exact(item.recurringBase), "69");
    assert.equal(exact(item.firstRate), "0.5"); assert.equal(exact(item.recurringRate), "0.08"); assert.equal(exact(item.residualRate), "0");
    assert.equal(item.grossAmount, "95.22"); assert.equal(exact(item.partnerFundedAmount), "0"); assert.equal(item.netAmount, "95.22");
    const recorded = await balance();
    assert.equal(recorded.postedLedgerBalance, "95.22"); assert.equal(recorded.postedEntryCount, 1);
    assert.equal(recorded.availability, "POSTED_ENTRIES"); assert.equal(recorded.settlementEligibility, "NOT_EVALUATED");
    assert.ok(!Object.hasOwn(recorded, "payableBalance") && !Object.hasOwn(recorded, "withholdingRate"));
    const persisted = await stats();
    for (const field of ["commissionItems", "commissionApprovals", "commissionContexts", "commissionApprovalEvidence", "commissionApprovalReceipts",
      "financialLedgerPostings", "financialLedgerEntries", "financialLedgerGrossEntries", "financialLedgerAudit"]) assert.equal(persisted[field], 1, field);
    assert.equal(persisted.financialLedgerFundedEntries, 0); assert.equal(persisted.nonDraftPolicies, 0); assert.equal(persisted.payoutSettings, 0);
    assert.equal(financial.postedLedgerBalance, recorded.postedLedgerBalance);
  });
  await step("actual bounded keyset pages and no-store projection preserve exact provenance without private evidence", async () => {
    const page = await call(() => ledger.requestOwnFinancialLedger({ ...own, limit: 1 }));
    assert.equal(page.limit, 1); assert.equal(page.items.length, 1); assert.equal(page.hasMore, false); assert.equal(page.nextCursor, null);
    const entry = page.items[0];
    assert.equal(entry.postingId, financial.postingId); assert.equal(entry.calculationItemId, financial.itemId);
    assert.equal(entry.kind, "GROSS_COMMISSION"); assert.equal(entry.signedAmount, "95.22"); assert.equal(entry.sourceItemKind, "ANNUAL");
    const cursor = Buffer.from(`1|financial-ledger:${running.ready.partnerId}:PEN|${entry.postedAt}|${entry.id}`).toString("base64url");
    const after = await call(() => ledger.requestOwnFinancialLedger({ ...own, limit: 1, cursor }));
    assert.deepEqual(after.items, []); assert.equal(after.hasMore, false); assert.equal(after.nextCursor, null);
    for (const path of ["/me/financial-ledger?limit=1", "/me/financial-balance", "/me/commissions?limit=1", "/me/commission-evaluations?limit=1"]) {
      const response = await raw(path, own.accessToken); assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
      const body = await response.json(); const serialized = JSON.stringify(body);
      for (const privateField of ["reason", "email", "ciphertext", "approvalReference", "providerEvidence", "bankAccount", "rawProvider", "taxAmount", "payoutAmount"]) assert.ok(!serialized.includes(`"${privateField}":`));
    }
    for (const path of ["/me/financial-ledger?ownerUserId=client-controlled", `/me/financial-balance?partnerId=${running.ready.partnerId}`,
      "/me/financial-ledger?limit=1&limit=2", "/me/financial-ledger?limit=0", "/me/financial-ledger?currency=USD",
      `/me/commissions?partnerId=${running.ready.partnerId}`, `/admin/financial-ledger?cursor=${cursor}`]) {
      const response = await raw(path, path.startsWith("/admin") ? staff.accessToken : own.accessToken);
      assert.equal(response.status, 400); assert.equal(response.headers.get("cache-control"), "no-store");
    }
  });
  await step("same source command replays permanent approval and posting receipts without duplicate money", async () => {
    const before = await stats();
    assert.deepEqual(await running.command(`seed-financial:${draft.id}`, "financial-seeded"), financial);
    assert.deepEqual(await running.command(`seed-financial:${draft.id}`, "financial-seeded"), financial);
    const after = await stats();
    for (const field of ["commissionItems", "commissionApprovals", "commissionContexts", "commissionApprovalEvidence", "commissionApprovalReceipts",
      "financialLedgerPostings", "financialLedgerEntries", "financialLedgerAudit", "postedLedgerBalance"]) assert.equal(after[field], before[field], field);
    assert.equal((await balance()).postedLedgerBalance, "95.22");
  });
  await step("HTTP never accepts browser money, owner or financial approval commands", async () => {
    const before = await stats();
    const rejected = await raw("/me/financial-ledger", own.accessToken, { partnerId: running.ready.partnerId, amount: "999999", approved: true });
    assert.equal(rejected.status, 405); assert.equal(rejected.headers.get("cache-control"), "no-store");
    const absent = await raw("/admin/financial-ledger", staff.accessToken, { observationId: financial.observationId, rule: { firstRate: "1" }, amount: "999999" });
    assert.equal(absent.status, 405); assert.equal(absent.headers.get("cache-control"), "no-store");
    const after = await stats(); assert.equal(after.financialLedgerEntries, before.financialLedgerEntries);
    assert.equal(after.postedLedgerBalance, before.postedLedgerBalance); assert.equal(after.nonDraftPolicies, 0);
  });
  process.stdout.write(`PARTNERS_FINANCIAL_EVIDENCE ${JSON.stringify({ status: "VERIFIED", boundary: "actual-adapters-http-postgresql",
    postedLedgerBalance: "95.22", source: "LOCAL_SYNTHETIC", settlementEligibility: "NOT_EVALUATED", taxOrPayoutExecuted: false })}\n`);
});
