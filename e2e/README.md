# e2e

End-to-end tests for the Olva feature (`src/features/olva`, `src/components/olva/send-to-olva`),
run against a **real backend** with Playwright Test. Vitest covers the support code and a
node-only contract layer. (Work in progress: sections marked TODO are filled in as phases land.)

## Safety first

The backend services are shared with production, so the isolation boundary is a dedicated test
company. Every write goes through guards in `e2e/config`:

- Only hosts listed in the active profile can be called.
- The logged-in company must equal `E2E_COMPANY_ID`, or the run aborts before writing.
- Specs tagged `@writes-olva` create real Olva shipments and only run with
  `E2E_ALLOW_REAL_SHIPMENTS=true`.

## Setup

1. `npm install` (Playwright is pinned to an exact version, `1.64.1`).
2. `npm run e2e:install` to download the Chromium build.
3. `cp e2e/.env.e2e.example e2e/.env.e2e` and fill it in.
4. Run everything from the repo root.

## Conventions

| Kind | Suffix | Runner | Command |
| --- | --- | --- | --- |
| Browser specs | `*.e2e.ts` | Playwright Test | TODO (Phase 7) |
| Support-code tests | `*.vitest.ts` | Vitest `e2e-support` | `npm run vitest:e2e-support` |
| Contract tests (real backend) | `*.contract.vitest.ts` | Vitest `contract` | `npm run vitest:contract` |

Never use `*.test.ts` or `*.spec.ts` here: Jest owns those suffixes.

Checks: `npm run e2e:check` (Biome) and `npm run e2e:typecheck`.

## Environment profiles

A profile (`e2e/config/environments/<name>.ts`) names the frontend and every API the suite may
touch. To target a new environment, add a profile file and register it in
`environments/index.ts`; no spec changes.

## TODO

Layout of the folders, how to add a feature (page object + test-id registry entry + spec), tags,
and CI. Finalized in Phase 10.
