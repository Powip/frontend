import { z } from "zod";
import { DEFAULT_PROFILE_NAME, PROFILE_NAMES } from "./environments";
import { E2EConfigError } from "./errors";

const E2EEnvSchema = z.object({
  E2E_PROFILE: z.enum(PROFILE_NAMES).default(DEFAULT_PROFILE_NAME),
  E2E_BASE_URL: z.url().optional(),
  E2E_USER_EMAIL: z.email(),
  E2E_USER_PASSWORD: z.string().min(1),
  E2E_COMPANY_ID: z.string().min(1),
  E2E_ALLOW_REAL_SHIPMENTS: z.stringbool().default(false),
});

export type E2EEnv = z.output<typeof E2EEnvSchema>;

/**
 * Validates the raw environment. Only `E2E_*` keys are read, and empty values count as unset
 * (so a copied `.env.e2e.example` behaves). The error lists variable names and reasons, never
 * values: the password must not end up in a log.
 */
export function parseEnv(raw: NodeJS.ProcessEnv): E2EEnv {
  const present = Object.fromEntries(
    Object.entries(raw).filter(
      ([key, value]) => key.startsWith("E2E_") && typeof value === "string" && value.trim() !== "",
    ),
  );
  const result = E2EEnvSchema.safeParse(present);

  if (result.success) return result.data;

  const issues = result.error.issues.map(
    (issue) => ` - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );

  throw new E2EConfigError(
    `Invalid e2e environment. Check e2e/.env.e2e (see .env.e2e.example):\n${issues.join("\n")}`,
  );
}
