import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadE2EEnvFile } from "../load-env-file";

const KEYS = ["E2E_TEST_KEEP", "E2E_TEST_NEW", "E2E_TEST_QUOTED"];

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "e2e-env-"));
});

afterEach(() => {
  for (const key of KEYS) Reflect.deleteProperty(process.env, key);
  rmSync(dir, { recursive: true, force: true });
});

describe("loadE2EEnvFile", () => {
  it("returns false and changes nothing when the file does not exist", () => {
    expect(loadE2EEnvFile(path.join(dir, "missing.env"))).toBe(false);
    expect(process.env.E2E_TEST_NEW).toBeUndefined();
  });

  it("loads the file, supports quoted values, and never overrides the process env", () => {
    const file = path.join(dir, ".env.e2e");

    writeFileSync(
      file,
      "E2E_TEST_KEEP=from-file\nE2E_TEST_NEW=from-file\nE2E_TEST_QUOTED='a#b$c d'\n",
    );
    process.env.E2E_TEST_KEEP = "from-process";

    expect(loadE2EEnvFile(file)).toBe(true);
    expect(process.env.E2E_TEST_KEEP).toBe("from-process");
    expect(process.env.E2E_TEST_NEW).toBe("from-file");
    expect(process.env.E2E_TEST_QUOTED).toBe("a#b$c d");
  });
});
