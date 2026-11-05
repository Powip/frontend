import { existsSync } from "node:fs";
import path from "node:path";

/** Relative to the working directory: every e2e command runs from the repo root. */
const DEFAULT_ENV_FILE = path.resolve(process.cwd(), "e2e/.env.e2e");

/**
 * Loads the e2e env file into `process.env`. Variables already set in the process are never
 * overridden, so CI secrets always win over a file. A missing file is fine (CI has none).
 *
 * @returns whether a file was loaded
 */
export function loadE2EEnvFile(
  filePath: string = process.env.E2E_ENV_FILE
    ? path.resolve(process.cwd(), process.env.E2E_ENV_FILE)
    : DEFAULT_ENV_FILE,
): boolean {
  if (!existsSync(filePath)) return false;

  process.loadEnvFile(filePath);

  return true;
}
