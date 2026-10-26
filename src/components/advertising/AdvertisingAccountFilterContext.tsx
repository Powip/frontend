"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { AdsSummary } from "@/services/advertisingV22Service";
import { adsGet } from "@/services/advertisingV22Service";
import { useAdsQuery } from "./v22/context";
export type AdvertisingAccount = NonNullable<AdsSummary["accounts"]>[number];
interface AccountFilter {
  accountId: string;
  setAccountId: (id: string) => void;
  accounts: AdvertisingAccount[];
  loading?: boolean;
  error?: unknown;
}
const fallback: AccountFilter = { accountId: "all", setAccountId: () => undefined, accounts: [] };
const Context = createContext<AccountFilter>(fallback);
const validId = (id: string | null) =>
  id === "all" ||
  (!!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
export function AdvertisingAccountFilterProvider({ children }: { children: ReactNode }) {
  const [accountId, setSelected] = useState("all");
  const query = useAdsQuery(["account-filter-metadata"], (identity, signal) =>
    adsGet<{ accounts: AdvertisingAccount[] }>(identity, "/v23/settings", undefined, signal),
  );
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      const selected = params.get("adAccountId") ?? params.get("accountId");
      setSelected(validId(selected) ? selected! : "all");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const setAccountId = useCallback((id: string) => {
    if (!validId(id)) return;
    setSelected(id);
    const url = new URL(window.location.href);
    if (id === "all") url.searchParams.delete("adAccountId");
    else url.searchParams.set("adAccountId", id);
    url.searchParams.delete("accountId");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, []);
  return (
    <Context.Provider
      value={{
        accountId,
        setAccountId,
        accounts: query.data?.accounts ?? [],
        loading: query.isPending,
        error: query.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useAdvertisingAccountFilter = () => useContext(Context);
