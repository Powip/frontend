import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = import.meta.dirname;

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    isolate: false,
    projects: [
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, ".storybook") }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: "chromium" }],
          },
        },
      },

      // Fast unit tests (jsdom). Files use the `.vitest.ts(x)` suffix so they never collide with
      // the legacy Jest suite, which owns every `*.test.ts(x)` in the repo.
      {
        resolve: {
          alias: { "@": path.join(dirname, "src") },
        },
        // tsconfig keeps `jsx: "preserve"` for Next, so tell the transformer to compile JSX
        oxc: {
          jsx: { runtime: "automatic" },
        },
        test: {
          name: "unit",
          // The root `isolate: false` shares one module registry across files. These tests mock
          // the same modules (services, sonner) with different spies, so each file needs its own.
          // `vmThreads` keeps that per-file isolation but creates the jsdom environment once per
          // worker instead of once per file.
          pool: "vmThreads",
          isolate: true,
          environment: "jsdom",
          include: ["src/**/*.vitest.{ts,tsx}"],
          setupFiles: ["./vitest.unit.setup.ts"],
          clearMocks: true,
          restoreMocks: true,
          // Dialog/form tests mount Radix portals and type into several inputs. On slow disks
          // (OneDrive, antivirus) the first render alone can pass 5s, the default.
          testTimeout: 20_000,
          hookTimeout: 20_000,
        },
      },

      // Unit tests of the e2e support code (config, factories, API clients). Pure node, no browser.
      {
        resolve: {
          alias: { "@": path.join(dirname, "src") },
        },
        test: {
          name: "e2e-support",
          environment: "node",
          isolate: true,
          include: ["e2e/**/*.vitest.ts"],
          exclude: ["e2e/contract/**", "**/node_modules/**"],
          clearMocks: true,
          restoreMocks: true,
        },
      },

      // Contract tests call the REAL backend, so the project only exists when asked for
      // (`npm run vitest:contract`): a bare `vitest run` must never reach it.
      ...(process.env.E2E_CONTRACT === "1"
        ? [
            {
              resolve: {
                alias: { "@": path.join(dirname, "src") },
              },
              test: {
                name: "contract",
                environment: "node" as const,
                isolate: true,
                include: ["e2e/contract/**/*.contract.vitest.ts"],
                // Railway services can be cold: allow for it, and keep the load on them sequential
                testTimeout: 30_000,
                hookTimeout: 30_000,
                fileParallelism: false,
              },
            },
          ]
        : []),
    ],
  },
});
