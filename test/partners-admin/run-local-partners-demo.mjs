import assert from "node:assert/strict";
import { createInterface } from "node:readline";
import { launchBackend, launchFrontend, seedLocalFinancial } from "./local-financial-runtime.mjs";

assert.equal(process.env.PARTNERS_LOCAL_MANUAL_TEST, "true", "Explicit isolated manual demo opt-in required");
let backend; let frontend; let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try { if (frontend) await frontend.close(); }
  finally { if (backend) await backend.close(); }
  process.stdout.write("PARTNERS_LOCAL_DEMO_STOPPED owned fixtures cleaned; shared PostgreSQL preserved\n");
}
process.once("SIGINT", () => { void stop().finally(() => process.exit(0)); });
process.once("SIGTERM", () => { void stop().finally(() => process.exit(0)); });
try {
  backend = await launchBackend();
  const evidence = await seedLocalFinancial(backend);
  frontend = await launchFrontend(backend);
  process.stdout.write(`PARTNERS_LOCAL_DEMO ${JSON.stringify({ url: `${frontend.ready.baseUrl}/__partners-local`,
    partnersBaseUrl: `${backend.ready.baseUrl}/v1/partners`,
    auth: "EXPLICIT_SYNTHETIC_LOCAL_PROTOCOL", provider: "EXPLICIT_SYNTHETIC_FLOW_PROTOCOL",
    persistence: "REAL_ISOLATED_POSTGRESQL", postedLedgerBalance: evidence.postedLedgerBalance,
    settlementEligibility: "NOT_EVALUATED", envFilesRead: false, stop: "type stop or Ctrl-C" })}\n`);
  const input = createInterface({ input: process.stdin });
  for await (const command of input) { if (command === "stop") break; }
  input.close(); await stop();
} catch (failure) {
  process.stdout.write(`PARTNERS_LOCAL_DEMO_FAILED ${failure.constructor.name}\n`);
  await stop(); process.exitCode = 1;
}
