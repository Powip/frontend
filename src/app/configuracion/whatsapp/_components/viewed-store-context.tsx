"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

type ViewedStore = [storeId: string | null, setStoreId: (storeId: string | null) => void];

const ViewedStoreContext = createContext<ViewedStore>([null, () => {}]);

/**
 * Tienda que está mirando una pestaña con selector propio (Conexión). La cabecera
 * la usa para mostrar el mismo estado y tipo de conexión que la pestaña.
 */
export function ViewedStoreProvider({ children }: { children: ReactNode }) {
  const value = useState<string | null>(null);
  return <ViewedStoreContext.Provider value={value}>{children}</ViewedStoreContext.Provider>;
}

export const useViewedStore = () => useContext(ViewedStoreContext);
