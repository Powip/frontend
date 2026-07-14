"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pack } from "@/interfaces/IPack";
import { useAuth } from "@/contexts/AuthContext";

interface PacksContextValue {
  packs: Pack[];
  addPack: (pack: Pack) => void;
  updatePack: (id: string, pack: Pack) => void;
  togglePack: (id: string) => void;
  deletePack: (id: string) => void;
}

const PacksContext = createContext<PacksContextValue | undefined>(undefined);

function storageKey(companyId?: string) {
  return `powip.packs.${companyId ?? "default"}`;
}

export function PacksProvider({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const companyId = auth?.company?.id;
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Cargar desde localStorage cuando se conoce la empresa
  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey(companyId));
      setPacks(raw ? JSON.parse(raw) : []);
    } catch {
      setPacks([]);
    }
    setLoaded(true);
  }, [companyId]);

  // Persistir cambios
  useEffect(() => {
    if (!companyId || !loaded || typeof window === "undefined") return;
    window.localStorage.setItem(storageKey(companyId), JSON.stringify(packs));
  }, [packs, companyId, loaded]);

  const addPack = useCallback((pack: Pack) => {
    setPacks((prev) => [...prev, pack]);
  }, []);

  const updatePack = useCallback((id: string, pack: Pack) => {
    setPacks((prev) => prev.map((p) => (p.id === id ? pack : p)));
  }, []);

  const togglePack = useCallback((id: string) => {
    setPacks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
    );
  }, []);

  const deletePack = useCallback((id: string) => {
    setPacks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({ packs, addPack, updatePack, togglePack, deletePack }),
    [packs, addPack, updatePack, togglePack, deletePack],
  );

  return (
    <PacksContext.Provider value={value}>{children}</PacksContext.Provider>
  );
}

export function usePacks() {
  const ctx = useContext(PacksContext);
  if (!ctx) throw new Error("usePacks debe usarse dentro de PacksProvider");
  return ctx;
}
