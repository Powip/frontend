"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface AdvertisingCommercialStore {
  id: string;
  name: string;
  color?: string | null;
  is_legacy?: boolean;
  is_active?: boolean;
}
interface StoreFilter {
  storeId: string;
  defaultStoreId: string;
  setStoreId: (value: string) => void;
  stores: AdvertisingCommercialStore[];
}
const DEFAULT_FILTER: StoreFilter = {
  storeId: "all",
  defaultStoreId: "all",
  setStoreId: () => undefined,
  stores: [],
};
const Context = createContext<StoreFilter | null>(null);

export function AdvertisingStoreFilterProvider({
  stores,
  initialStoreId,
  children,
}: {
  stores: AdvertisingCommercialStore[];
  initialStoreId?: string | null;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState(initialStoreId ?? "all");
  const available = useMemo(
    () => stores.filter((store) => !store.is_legacy && store.is_active !== false),
    [stores],
  );
  const storeId =
    selected === "all" || selected === "none" || available.some((store) => store.id === selected)
      ? selected
      : "all";
  const defaultStoreId =
    initialStoreId && available.some((store) => store.id === initialStoreId)
      ? initialStoreId
      : "all";
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("storeId");
    setSelected(
      value === "all" || value === "none" || available.some((store) => store.id === value)
        ? (value ?? "all")
        : value === null
          ? defaultStoreId
          : "all",
    );
  }, [available, defaultStoreId]);
  const setStoreId = useCallback(
    (value: string) => {
      if (value !== "all" && value !== "none" && !available.some((store) => store.id === value))
        return;
      setSelected(value);
      const url = new URL(window.location.href);
      url.searchParams.set("storeId", value);
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`)
        window.history.replaceState(window.history.state, "", next);
    },
    [available],
  );
  return (
    <Context.Provider value={{ storeId, defaultStoreId, setStoreId, stores: available }}>
      {children}
    </Context.Provider>
  );
}

export function useAdvertisingStoreFilter() {
  return useContext(Context) ?? DEFAULT_FILTER;
}
