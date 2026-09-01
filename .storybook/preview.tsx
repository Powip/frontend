import type { Preview } from "@storybook/nextjs-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setupWorker } from "msw/browser";
import { mswLoader } from "msw-storybook-addon/csf3";
import { useState } from "react";
import { Toaster } from "sonner";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },

  // msw-storybook-addon v3 (required for Storybook 9+/10) dropped the old
  // top-level `initialize()` + `mswLoader` in favor of this: mswLoader is
  // now a factory that takes a setup function which creates and starts
  // the worker itself. See the package's MIGRATION.md (2.x -> 3.x).
  loaders: [
    mswLoader(async () => {
      const worker = setupWorker();
      await worker.start({ onUnhandledRequest: "bypass" });
      return worker;
    }),
  ],

  decorators: [
    (Story) => {
      // A fresh QueryClient per story avoids cache/mutation state leaking
      // between stories (e.g. a mutation staying "pending" or an error
      // from one story bleeding into the next).
      const [queryClient] = useState(
        () =>
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          }),
      );

      return (
        <QueryClientProvider client={queryClient}>
          <Story />
          <Toaster position="top-right" richColors />
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
