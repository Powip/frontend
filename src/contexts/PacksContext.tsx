"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import { BundlePack, GiftPack, Pack, VolumePack } from "@/interfaces/IPack";
import { useAuth } from "@/contexts/AuthContext";
import {
  createVolumePromo,
  deletePromo,
  listVolumePromos,
  updatePromo,
} from "@/services/promos.service";

/* -----------------------------------------
   VOLUME vive en el backend real (Promos API).
   BUNDLE / GIFT siguen en localStorage hasta que el backend confirme su shape
   (ver comentario en src/interfaces/IPack.ts).
----------------------------------------- */

type LocalPack = BundlePack | GiftPack;

interface PacksContextValue {
  packs: Pack[];
  loading: boolean;
  /** Devuelve true si se guardó correctamente (false = error ya notificado con toast) */
  addPack: (pack: Pack) => Promise<boolean>;
  updatePack: (id: string, pack: Pack) => Promise<boolean>;
  togglePack: (id: string) => Promise<void>;
  deletePack: (id: string) => Promise<boolean>;
}

const PacksContext = createContext<PacksContextValue | undefined>(undefined);

function localStorageKey(companyId?: string) {
  return `powip.packs.local.${companyId ?? "default"}`;
}

export function PacksProvider({ children }: { children: React.ReactNode }) {
  const { auth, loading: authLoading } = useAuth();
  const companyId = auth?.company?.id;

  const [volumePacks, setVolumePacks] = useState<VolumePack[]>([]);
  const [loading, setLoading] = useState(false);
  const [localPacks, setLocalPacks] = useState<LocalPack[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);

  const refreshVolumePacks = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const packs = await listVolumePromos({ companyId });
      setVolumePacks(packs);
    } catch {
      toast.error("No se pudieron cargar los packs de volumen del servidor.");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    // Esperar a que AuthContext termine de restaurar la sesión (token en
    // tokenStore) antes de pegarle al backend — evita pedir /promos sin
    // Authorization header todavía si el efecto se dispara muy temprano
    // (hard refresh / navegación directa a esta página).
    if (authLoading) return;
    refreshVolumePacks();
  }, [refreshVolumePacks, authLoading]);

  // BUNDLE / GIFT: local por empresa, mientras no hay backend para esos tipos.
  useEffect(() => {
    if (!companyId || typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(localStorageKey(companyId));
      setLocalPacks(raw ? JSON.parse(raw) : []);
    } catch {
      setLocalPacks([]);
    }
    setLocalLoaded(true);
  }, [companyId]);

  useEffect(() => {
    if (!companyId || !localLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(
      localStorageKey(companyId),
      JSON.stringify(localPacks),
    );
  }, [localPacks, companyId, localLoaded]);

  const addPack = useCallback(
    async (pack: Pack): Promise<boolean> => {
      if (pack.type !== "VOLUME") {
        setLocalPacks((prev) => [...prev, pack]);
        return true;
      }
      if (!companyId) return false;
      if (!pack.product.productId) {
        toast.error("Selecciona un producto del catálogo para crear el pack.");
        return false;
      }
      try {
        await createVolumePromo({
          companyId,
          name: pack.name,
          type: "VOLUME",
          productId: pack.product.productId,
          minQty: pack.minQty,
          maxQty: pack.maxQty ?? undefined,
          packPrice: pack.packPrice,
          channels: pack.channels,
        });
        await refreshVolumePacks();
        return true;
      } catch {
        toast.error("No se pudo crear el pack en el servidor.");
        return false;
      }
    },
    [companyId, refreshVolumePacks],
  );

  const updatePack = useCallback(
    async (id: string, pack: Pack): Promise<boolean> => {
      if (pack.type !== "VOLUME" || !pack.synced) {
        setLocalPacks((prev) =>
          prev.map((p) => (p.id === id ? (pack as LocalPack) : p)),
        );
        return true;
      }
      if (!pack.product.productId) {
        toast.error("Selecciona un producto del catálogo para guardar el pack.");
        return false;
      }
      try {
        await updatePromo(id, {
          name: pack.name,
          productId: pack.product.productId,
          minQty: pack.minQty,
          maxQty: pack.maxQty ?? undefined,
          packPrice: pack.packPrice,
          channels: pack.channels,
        });
        await refreshVolumePacks();
        return true;
      } catch {
        toast.error("No se pudo actualizar el pack en el servidor.");
        return false;
      }
    },
    [refreshVolumePacks],
  );

  const togglePack = useCallback(
    async (id: string) => {
      const current = volumePacks.find((p) => p.id === id);
      if (current) {
        try {
          await updatePromo(id, { isActive: !current.active });
          await refreshVolumePacks();
        } catch {
          toast.error("No se pudo actualizar el estado del pack.");
        }
        return;
      }
      setLocalPacks((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
      );
    },
    [volumePacks, refreshVolumePacks],
  );

  const deletePack = useCallback(
    async (id: string): Promise<boolean> => {
      const current = volumePacks.find((p) => p.id === id);
      if (current) {
        try {
          await deletePromo(id);
          await refreshVolumePacks();
          return true;
        } catch {
          toast.error("No se pudo eliminar el pack en el servidor.");
          return false;
        }
      }
      setLocalPacks((prev) => prev.filter((p) => p.id !== id));
      return true;
    },
    [volumePacks, refreshVolumePacks],
  );

  const packs = useMemo<Pack[]>(
    () => [...volumePacks, ...localPacks],
    [volumePacks, localPacks],
  );

  const value = useMemo(
    () => ({ packs, loading, addPack, updatePack, togglePack, deletePack }),
    [packs, loading, addPack, updatePack, togglePack, deletePack],
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
