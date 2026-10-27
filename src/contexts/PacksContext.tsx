"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  BundlePack,
  GiftOption,
  GiftPack,
  Pack,
  PackProductRef,
  VolumePack,
} from "@/interfaces/IPack";
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

// Older clients ignore variantId. Keeping restricted bundles out of their key
// prevents them from applying the same discount to every variant of a product.
function variantStorageKey(companyId: string) {
  return `powip.packs.variants.v1.${companyId}`;
}

function hasVariantRestriction(pack: LocalPack): pack is BundlePack {
  return pack.type === "BUNDLE" &&
    (pack.schemaVersion === 2 || pack.items.some((item) => item.variantId !== undefined));
}

function isPackProductRef(value: unknown): value is PackProductRef {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { productKey?: unknown }).productKey === "string"
  );
}

function isGiftOption(value: unknown): value is GiftOption {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.variantId === "string" &&
    typeof g.productName === "string" &&
    typeof g.value === "number"
  );
}

/** Valida el shape mínimo de un pack BUNDLE/GIFT leído de localStorage.
 *  Datos corruptos (ej. de una versión previa de esta feature con otro shape)
 *  no deben propagarse al resto del árbol que consume usePacks() — ver
 *  incidente de producción: TypeError en render sin Error Boundary. */
function isValidLocalPack(value: unknown): value is LocalPack {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== "string") return false;
  if (p.type !== "BUNDLE" && p.type !== "GIFT") return false;
  if (typeof p.active !== "boolean") return false;
  if (!Array.isArray(p.channels)) return false;
  if (p.type === "BUNDLE") {
    if (p.schemaVersion !== undefined && p.schemaVersion !== 2) return false;
    if (p.schemaVersion === 2) {
      if (!Array.isArray(p.items) || p.items.length < 2 || p.items.length > 10) return false;
      const validItems = p.items.every((item: unknown) => {
        if (!isPackProductRef(item)) return false;
        const ref = item as unknown as Record<string, unknown>;
        return typeof ref.variantId === "string" && ref.variantId.trim().length > 0 &&
          typeof ref.productId === "string" && ref.productId.trim().length > 0 &&
          typeof ref.productName === "string" &&
          typeof ref.price === "number" && Number.isFinite(ref.price) && ref.price >= 0 &&
          (ref.sku === undefined || typeof ref.sku === "string") &&
          (ref.attributes === undefined || (typeof ref.attributes === "object" && ref.attributes !== null &&
            !Array.isArray(ref.attributes) && Object.values(ref.attributes).every((value) => typeof value === "string")));
      });
      if (!validItems || new Set(p.items.map((item) => item.productId)).size !== p.items.length) return false;
    }
    return (
      typeof p.packPrice === "number" && Number.isFinite(p.packPrice) && p.packPrice >= 0 &&
      Array.isArray(p.items) &&
      p.items.length >= 1 &&
      p.items.every((item: unknown) =>
        isPackProductRef(item) &&
        (!("variantId" in item) || (typeof item.variantId === "string" && item.variantId.trim().length > 0)),
      )
    );
  }
  if (p.triggerBy !== "amount" && p.triggerBy !== "qty") return false;
  if (
    p.minAmount !== undefined &&
    p.minAmount !== null &&
    typeof p.minAmount !== "number"
  )
    return false;
  if (
    p.minQty !== undefined &&
    p.minQty !== null &&
    typeof p.minQty !== "number"
  )
    return false;
  return (
    Array.isArray(p.gifts) &&
    p.gifts.length >= 1 &&
    p.gifts.every(isGiftOption)
  );
}

function persistLocalPacks(companyId: string, packs: LocalPack[]) {
  const storage = window.localStorage;
  const entries = [
    [variantStorageKey(companyId), JSON.stringify(packs.filter(hasVariantRestriction))],
    [localStorageKey(companyId), JSON.stringify(packs.filter((pack) => !hasVariantRestriction(pack)))],
  ];
  const changed: Array<[string, string | null]> = [];
  try {
    for (const [key, value] of entries) {
      const previous = storage.getItem(key);
      if (previous === value) continue;
      storage.setItem(key, value);
      changed.push([key, previous]);
    }
  } catch (error) {
    // In particular, do not partially convert a legacy bundle if the second
    // write fails (e.g. the browser's localStorage quota is exhausted).
    for (const [key, previous] of changed.reverse()) {
      try {
        if (previous === null) storage.removeItem(key);
        else storage.setItem(key, previous);
      } catch { /* The caller still reports the persistence failure. */ }
    }
    throw error;
  }
}

export function PacksProvider({ children }: { children: React.ReactNode }) {
  const { auth, loading: authLoading } = useAuth();
  const companyId = auth?.company?.id;

  const companyRef = useRef(companyId);
  companyRef.current = companyId;
  const volumeRequest = useRef(0);
  const [volumeState, setVolumeState] = useState<{ companyId?: string; packs: VolumePack[] }>({ packs: [] });
  const [loading, setLoading] = useState(false);
  const [localState, setLocalState] = useState<{ companyId?: string; packs: LocalPack[] }>({ packs: [] });
  const localRef = useRef(localState);
  const volumePacks = volumeState.companyId === companyId ? volumeState.packs : [];
  const localPacks = localState.companyId === companyId ? localState.packs : [];

  const refreshVolumePacks = useCallback(async () => {
    if (!companyId) {
      ++volumeRequest.current;
      setLoading(false);
      return;
    }
    const request = ++volumeRequest.current;
    setLoading(true);
    try {
      const packs = await listVolumePromos({ companyId });
      if (companyRef.current === companyId && volumeRequest.current === request) {
        setVolumeState({ companyId, packs });
      }
    } catch {
      if (companyRef.current === companyId && volumeRequest.current === request) {
        toast.error("No se pudieron cargar los packs de volumen del servidor.");
      }
    } finally {
      if (companyRef.current === companyId && volumeRequest.current === request) setLoading(false);
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
    localRef.current = { packs: [] };
    if (!companyId || typeof window === "undefined") {
      setLocalState({ packs: [] });
      return;
    }
    try {
      let damagedJson = false;
      const read = (key: string): unknown[] => {
        const raw = window.localStorage.getItem(key);
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          damagedJson = true;
          return [];
        }
      };
      const legacy = read(localStorageKey(companyId));
      const restricted = read(variantStorageKey(companyId));
      const candidates = [...legacy, ...restricted];
      const valid = candidates.filter(isValidLocalPack);
      const validPacks = [...new Map(valid.map((pack) => [pack.id, pack])).values()];
      if (damagedJson || valid.length !== candidates.length) {
        toast.error(
          "Se encontró un pack dañado y fue eliminado automáticamente. Si era necesario, volvé a crearlo.",
        );
      }
      localRef.current = { companyId, packs: validPacks };
      setLocalState(localRef.current);
      try {
        persistLocalPacks(companyId, validPacks);
      } catch {
        toast.error("No se pudieron guardar los packs locales en este navegador.");
      }
    } catch {
      setLocalState({ packs: [] });
      toast.error("No se pudieron cargar los packs locales de este navegador.");
    }
  }, [companyId]);

  const mutateLocalPacks = useCallback((change: (packs: LocalPack[]) => LocalPack[]): boolean => {
    if (!companyId || companyRef.current !== companyId || localRef.current.companyId !== companyId) {
      toast.error("Espera a que se carguen los packs de la empresa.");
      return false;
    }
    const next = change(localRef.current.packs);
    if (!next.every(isValidLocalPack)) {
      toast.error("El pack contiene datos inválidos. Revisa sus productos y variantes.");
      return false;
    }
    try {
      persistLocalPacks(companyId, next);
      localRef.current = { companyId, packs: next };
      setLocalState(localRef.current);
      return true;
    } catch {
      toast.error("No se pudieron guardar los packs locales en este navegador.");
      return false;
    }
  }, [companyId]);

  const addPack = useCallback(
    async (pack: Pack): Promise<boolean> => {
      if (pack.type !== "VOLUME") {
        return mutateLocalPacks((prev) => [...prev, pack]);
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
    [companyId, refreshVolumePacks, mutateLocalPacks],
  );

  const updatePack = useCallback(
    async (id: string, pack: Pack): Promise<boolean> => {
      if (pack.type !== "VOLUME") {
        return mutateLocalPacks((prev) => prev.map((p) => (p.id === id ? pack : p)));
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
    [refreshVolumePacks, mutateLocalPacks],
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
      mutateLocalPacks((prev) =>
        prev.map((p) => (p.id === id ? { ...p, active: !p.active } : p)),
      );
    },
    [volumePacks, refreshVolumePacks, mutateLocalPacks],
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
      return mutateLocalPacks((prev) => prev.filter((p) => p.id !== id));
    },
    [volumePacks, refreshVolumePacks, mutateLocalPacks],
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
