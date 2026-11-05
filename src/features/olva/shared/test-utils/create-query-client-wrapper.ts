import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

/**
 * Wrapper for `renderHook` with a throwaway QueryClient (no retries, no cache between tests).
 * It uses createElement so the file needs no JSX and stays a plain `.ts`.
 */
export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  return { queryClient, wrapper };
}
