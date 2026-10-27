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
import { tokenStore } from "@/lib/tokenStore";
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

import {
  createBundlePromo,
  deleteBundlePromo,
  getBundleCapabilities,
  importBundlePromos,
  listBundlePromos,
  updateBundlePromo,
} from "@/services/bundlePromos.service";

// Volumen usa /promos; los bundles se comparten en /bundle-promos.
// Las copias locales anteriores se importan sin alterar regalos ni precios.

type LocalPack = BundlePack | GiftPack;

interface PacksContextValue {
  packs: Pack[];
  loading: boolean;
  canManageBundles: boolean;
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
  const userId = auth?.user?.id;
  const sessionToken = auth?.accessToken;
  const sessionEpoch = tokenStore.snapshot().epoch;
  const sessionScope = companyId && userId ? `${companyId}:${userId}` : undefined;
  const scopeRef = useRef(sessionScope);
  const scopeEpoch = useRef(0);
  if (scopeRef.current !== sessionScope) ++scopeEpoch.current;
  scopeRef.current = sessionScope;
  const bundleRequest = useRef(0);
  const [bundleState, setBundleState] = useState<{
    scope?: string;
    epoch?: number;
    packs: BundlePack[];
    acceptedIds: string[];
    canManage: boolean;
  }>({ packs: [], acceptedIds: [], canManage: false });
  const [bundlesLoading, setBundlesLoading] = useState(false);
  const bundleStateIsCurrent = bundleState.scope === sessionScope && bundleState.epoch === sessionEpoch;
  const sharedBundles = bundleStateIsCurrent ? bundleState.packs : [];
  const canManageBundles = !authLoading && !!sessionScope && bundleStateIsCurrent && bundleState.canManage;

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

  // Load the previous browser source before attempting a shared-bundle import.
  const loadLocalPacks = useCallback(() => {
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
  useEffect(loadLocalPacks, [loadLocalPacks]);

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

  const refreshBundlePacks = useCallback(async () => {
    const request = ++bundleRequest.current;
    const session = tokenStore.snapshot();
    if (!companyId || !sessionScope || !session.active || session.token !== sessionToken) {
      setBundlesLoading(false);
      return;
    }
    const isCurrent = () => scopeRef.current === sessionScope && bundleRequest.current === request && tokenStore.isCurrent(session);
    loadLocalPacks();
    setBundlesLoading(true);
    // A failed capabilities check must not prevent sellers from reading bundles.
    const [listed, capability] = await Promise.allSettled([
      listBundlePromos(sessionToken),
      getBundleCapabilities(sessionToken),
    ]);
    if (!isCurrent()) return;
    const canManage = capability.status === "fulfilled" && capability.value.canManage === true;
    if (listed.status === "rejected") {
      setBundleState((previous) => ({
        scope: sessionScope, epoch: sessionEpoch,
        packs: previous.scope === sessionScope && previous.epoch === sessionEpoch ? previous.packs : [],
        acceptedIds: previous.scope === sessionScope && previous.epoch === sessionEpoch ? previous.acceptedIds : [],
        canManage,
      }));
      setBundlesLoading(false);
      toast.error("No se pudieron cargar los bundles compartidos de la empresa.");
      return;
    }
    let remote = listed.value.bundles;
    let acceptedIds = listed.value.deletedIds;
    const candidates = localRef.current.companyId === companyId
      ? localRef.current.packs.filter((pack): pack is BundlePack => pack.type === "BUNDLE")
      : [];
    if (canManage && candidates.length) {
      try {
        // Keep a scoped recovery copy before the first server write.
        const backupKey = `powip.packs.shared-backup.v1.${companyId}`;
        const rawBackup = window.localStorage.getItem(backupKey);
        const priorBackup: unknown = rawBackup ? JSON.parse(rawBackup) : [];
        if (!Array.isArray(priorBackup)) throw new Error("Copia local inválida");
        const backup = new Map(priorBackup.filter(isValidLocalPack).map((pack) => [pack.id, pack]));
        for (const pack of candidates) if (!backup.has(pack.id)) backup.set(pack.id, pack);
        window.localStorage.setItem(backupKey, JSON.stringify([...backup.values()]));
        if (!isCurrent()) return;
        // Match the server's 100-bundle / 1 MiB import limit. Each confirmed
        // chunk is retained even if a later chunk cannot be imported.
        const batches: BundlePack[][] = [];
        let batch: BundlePack[] = [];
        let bytes = 0;
        for (const pack of candidates) {
          const size = new Blob([JSON.stringify(pack)]).size;
          if (batch.length && (batch.length >= 100 || bytes + size > 900_000)) {
            batches.push(batch); batch = []; bytes = 0;
          }
          batch.push(pack); bytes += size;
        }
        if (batch.length) batches.push(batch);
        let rejected = false;
        const importChunk = async (chunk: BundlePack[]) => {
          const imported = await importBundlePromos(chunk, sessionToken);
          if (!isCurrent()) return;
          acceptedIds = [...new Set([...acceptedIds, ...imported.acceptedIds])];
          const accepted = new Set(imported.acceptedIds);
          // Existing server rows win; tombstones are acknowledged without a row.
          remote = imported.bundles;
          // Only remove the source after confirmation, keeping the backup.
          // A storage failure keeps originals for an idempotent retry.
          mutateLocalPacks((packs) => packs.filter((pack) => pack.type !== "BUNDLE" || !accepted.has(pack.id)));
        };
        for (const chunk of batches) {
          if (!isCurrent()) return;
          try {
            await importChunk(chunk);
          } catch (error) {
            const status = (error as { response?: { status?: number } } | null)?.response?.status;
            if (chunk.length === 1 || ![400, 404, 413, 422].includes(status ?? 0)) throw error;
            // A removed product in one old bundle must not keep every other
            // bundle private. Reject only the individual invalid sources.
            for (const pack of chunk) {
              if (!isCurrent()) return;
              try { await importChunk([pack]); } catch { rejected = true; }
            }
          }
        }
        if (rejected) throw new Error("Hay bundles que requieren revisión.");
      } catch {
        if (isCurrent()) toast.error("No se pudieron compartir los bundles guardados en este navegador. Se conserva la copia local.");
      }
    }
    if (!isCurrent()) return;
    setBundleState((previous) => ({
      scope: sessionScope, epoch: sessionEpoch, packs: remote, canManage,
      acceptedIds: [...new Set([...(previous.scope === sessionScope && previous.epoch === sessionEpoch ? previous.acceptedIds : []), ...acceptedIds])],
    }));
    setBundlesLoading(false);
  }, [companyId, sessionScope, sessionToken, sessionEpoch, loadLocalPacks, mutateLocalPacks]);

  useEffect(() => {
    if (authLoading) return;
    void refreshBundlePacks();
    const refresh = () => { void refreshBundlePacks(); };
    const storageChanged = (event: StorageEvent) => {
      if (companyId && (event.key === null || event.key === localStorageKey(companyId) || event.key === variantStorageKey(companyId))) refresh();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", storageChanged);
    return () => {
      ++bundleRequest.current;
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", storageChanged);
    };
  }, [authLoading, companyId, refreshBundlePacks]);

  const saveSharedBundle = useCallback(async (pack: BundlePack, existingId?: string): Promise<boolean> => {
    const session = tokenStore.snapshot();
    if (!sessionScope || scopeRef.current !== sessionScope || !canManageBundles || !session.active || session.token !== sessionToken) {
      toast.error("Solo Administración puede configurar los bundles de la empresa.");
      return false;
    }
    const epoch = scopeEpoch.current;
    ++bundleRequest.current;
    setBundlesLoading(false);
    try {
      const saved = existingId
        ? await updateBundlePromo(existingId, pack, sessionToken)
        : await createBundlePromo(pack, sessionToken);
      if (scopeRef.current !== sessionScope || scopeEpoch.current !== epoch || !tokenStore.isCurrent(session)) return false;
      ++bundleRequest.current;
      setBundlesLoading(false);
      setBundleState((previous) => ({
        ...previous,
        scope: sessionScope, epoch: sessionEpoch,
        packs: [...(previous.scope === sessionScope ? previous.packs : []).filter((value) => value.id !== saved.id), saved],
      }));
      return true;
    } catch {
      if (scopeRef.current === sessionScope && scopeEpoch.current === epoch && tokenStore.isCurrent(session)) toast.error("No se pudo guardar el bundle en el servidor.");
      return false;
    }
  }, [sessionScope, sessionToken, sessionEpoch, canManageBundles]);

  const addPack = useCallback(
    async (pack: Pack): Promise<boolean> => {
      if (pack.type === "BUNDLE") return saveSharedBundle(pack);
      if (pack.type === "GIFT") return mutateLocalPacks((prev) => [...prev, pack]);
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
    [companyId, refreshVolumePacks, mutateLocalPacks, saveSharedBundle],
  );

  const updatePack = useCallback(
    async (id: string, pack: Pack): Promise<boolean> => {
      if (pack.type === "BUNDLE") {
        if (sharedBundles.some((bundle) => bundle.id === id)) return saveSharedBundle(pack, id);
        const saved = await saveSharedBundle(pack);
        if (saved && scopeRef.current === sessionScope) mutateLocalPacks((prev) => prev.filter((value) => value.id !== id));
        return saved;
      }
      if (pack.type === "GIFT") return mutateLocalPacks((prev) => prev.map((p) => (p.id === id ? pack : p)));
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
    [refreshVolumePacks, mutateLocalPacks, saveSharedBundle, sessionScope, sharedBundles],
  );

  const togglePack = useCallback(
    async (id: string) => {
      const bundle = sharedBundles.find((pack) => pack.id === id) ?? localPacks.find((pack) => pack.type === "BUNDLE" && pack.id === id);
      if (bundle?.type === "BUNDLE") {
        await saveSharedBundle({ ...bundle, active: !bundle.active }, bundle.shared ? id : undefined);
        return;
      }
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
    [volumePacks, refreshVolumePacks, mutateLocalPacks, sharedBundles, localPacks, saveSharedBundle],
  );

  const deletePack = useCallback(
    async (id: string): Promise<boolean> => {
      const bundle = sharedBundles.find((pack) => pack.id === id) ?? localPacks.find((pack) => pack.type === "BUNDLE" && pack.id === id);
      if (bundle?.type === "BUNDLE") {
        const session = tokenStore.snapshot();
        if (!sessionScope || scopeRef.current !== sessionScope || !canManageBundles || !session.active || session.token !== sessionToken) {
          toast.error("Solo Administración puede configurar los bundles de la empresa.");
          return false;
        }
        const epoch = scopeEpoch.current;
        ++bundleRequest.current;
        setBundlesLoading(false);
        try {
          await deleteBundlePromo(id, sessionToken);
          if (scopeRef.current !== sessionScope || scopeEpoch.current !== epoch || !tokenStore.isCurrent(session)) return false;
          ++bundleRequest.current;
          setBundlesLoading(false);
          setBundleState((previous) => ({ ...previous, packs: previous.packs.filter((pack) => pack.id !== id), acceptedIds: [...previous.acceptedIds, id] }));
          mutateLocalPacks((packs) => packs.filter((pack) => pack.id !== id));
          return true;
        } catch {
          if (scopeRef.current === sessionScope && scopeEpoch.current === epoch && tokenStore.isCurrent(session)) toast.error("No se pudo eliminar el bundle en el servidor.");
          return false;
        }
      }
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
    [volumePacks, refreshVolumePacks, mutateLocalPacks, sharedBundles, localPacks, sessionScope, sessionToken, canManageBundles],
  );

  const packs = useMemo<Pack[]>(() => {
    const accepted = new Set(bundleStateIsCurrent ? bundleState.acceptedIds : []);
    const local = localPacks.filter((pack) => pack.type !== "BUNDLE" || !accepted.has(pack.id));
    // A server snapshot replaces a browser copy with the same ID.
    return [...new Map([...volumePacks, ...local, ...sharedBundles].map((pack) => [pack.id, pack])).values()];
  }, [volumePacks, localPacks, sharedBundles, bundleState, bundleStateIsCurrent]);

  const value = useMemo(
    () => ({ packs, loading: loading || bundlesLoading, canManageBundles, addPack, updatePack, togglePack, deletePack }),
    [packs, loading, bundlesLoading, canManageBundles, addPack, updatePack, togglePack, deletePack],
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
