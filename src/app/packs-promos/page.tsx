"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Plus, Pencil, Trash2, PlayCircle, PauseCircle, PackageCheck, Sparkles, Gift, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { useAuth } from "@/contexts/AuthContext";
import { isSuperadmin, hasAdminAccess } from "@/config/permissions.config";
import { PacksProvider, usePacks } from "@/contexts/PacksContext";
import {
  Pack,
  PackType,
  BundlePack,
  GiftOption,
  GiftPack,
  PackProductRef,
  PROMO_CHANNELS,
  VolumePack,
} from "@/interfaces/IPack";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { searchInventoryItems } from "@/services/inventoryItems.service";
import { getProducts } from "@/api/Productos";
import { IGetProducts } from "@/api/Interfaces";
import { initials } from "@/utils/productGrouping";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fmt = (n: number) => `S/ ${(Number(n) || 0).toFixed(2)}`;

const PACK_TYPE_LABEL: Record<PackType, string> = {
  VOLUME: "Volumen",
  BUNDLE: "Bundle",
  GIFT: "Regalo",
};

const isDev = process.env.NODE_ENV === "development";

function PacksPromosContent() {
  const { auth, selectedStoreId, inventories } = useAuth();
  const realIsAdmin =
    isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const [devRole, setDevRole] = useState<"admin" | "vendedor" | null>(null);
  const isAdmin = isDev && devRole ? devRole === "admin" : realIsAdmin;
  const companyId = auth?.company?.id;

  const [selectedInventory, setSelectedInventory] = useState("");
  useEffect(() => {
    setSelectedInventory(inventories[0]?.id || "");
  }, [selectedStoreId, inventories]);

  const { packs, addPack, updatePack, togglePack, deletePack } = usePacks();

  const [filter, setFilter] = useState<"all" | PackType | "off">("all");
  const filteredPacks = useMemo(() => {
    if (filter === "off") return packs.filter((p) => !p.active);
    if (filter === "all") return packs;
    return packs.filter((p) => p.type === filter);
  }, [packs, filter]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingPack = editingId ? packs.find((p) => p.id === editingId) ?? null : null;

  return (
    <div className="flex h-screen w-full [--primary:#6D4FE0] [--primary-foreground:#ffffff] [--ring:#8067F0] dark:[--primary:#9B85FF] dark:[--ring:#8A72F5]">
      <main className="flex-1 overflow-auto bg-gradient-to-b from-muted/40 to-transparent">
        <div className="mx-auto max-w-[1400px] p-6 space-y-6 lg:p-8">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <HeaderConfig
            title="Packs & Promos"
            description="Configura descuentos por volumen y combos que se detectan solos al registrar la venta."
          />
          <div className="flex items-center gap-3">
            {isDev && (
              <div className="flex items-center gap-1.5 rounded-full border border-dashed border-orange-300 bg-orange-50 px-2 py-1 dark:border-orange-800 dark:bg-orange-500/10">
                <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400 pl-1">
                  Dev
                </span>
                {(["admin", "vendedor"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDevRole((prev) => (prev === r ? null : r))}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors",
                      isAdmin === (r === "admin")
                        ? "bg-orange-600 text-white"
                        : "text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-500/20",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && (
              <Button
                className="rounded-xl"
                onClick={() => {
                  setEditingId(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Nuevo pack
              </Button>
            )}
          </div>
        </div>

        {!isAdmin && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            👁 Estás como <b>Vendedor</b>: ves los packs en modo solo lectura. La
            configuración es exclusiva del Administrador.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "all", label: "Todos" },
              { key: "VOLUME", label: "Volumen" },
              { key: "BUNDLE", label: "Bundle" },
              { key: "GIFT", label: "Regalo" },
              { key: "off", label: "Inactivos" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filteredPacks.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-16 border border-dashed rounded-xl">
            Sin packs en este filtro.
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
          >
            {filteredPacks.map((p) => (
              <PackCard
                key={p.id}
                pack={p}
                isAdmin={isAdmin}
                onEdit={() => {
                  setEditingId(p.id);
                  setModalOpen(true);
                }}
                onToggle={() => togglePack(p.id)}
                onDelete={async () => {
                  if (window.confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) {
                    const ok = await deletePack(p.id);
                    if (ok) toast.success("Pack eliminado");
                  }
                }}
              />
            ))}
          </div>
        )}
        </div>
      </main>

      {modalOpen && (
        <PackFormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          editingPack={editingPack}
          inventoryId={selectedInventory}
          companyId={companyId}
          onSave={async (pack) => {
            const ok = editingPack
              ? await updatePack(editingPack.id, pack)
              : await addPack(pack);
            if (ok) {
              toast.success(editingPack ? "Pack actualizado" : "Pack creado");
              setModalOpen(false);
            }
          }}
        />
      )}
    </div>
  );
}

function PackCard({
  pack,
  isAdmin,
  onEdit,
  onToggle,
  onDelete,
}: {
  pack: Pack;
  isAdmin: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const typeClasses: Record<PackType, string> = {
    VOLUME: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    BUNDLE: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    GIFT: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
  const typeIcon: Record<PackType, React.ReactNode> = {
    VOLUME: <PackageCheck className="h-3 w-3" />,
    BUNDLE: <Sparkles className="h-3 w-3" />,
    GIFT: <Gift className="h-3 w-3" />,
  };

  let desc = "";
  if (pack.type === "BUNDLE") {
    desc = `${pack.items.map((i) => i.productName).join(" + ")} → ${fmt(pack.packPrice)} total`;
  } else if (pack.type === "GIFT") {
    const cond = pack.triggerBy === "qty" ? `${pack.minQty} prendas` : `de ${fmt(pack.minAmount || 0)}`;
    desc = `Compra ${cond} → regalo a elegir entre ${pack.gifts.length}: ${pack.gifts
      .map((g) => g.productName)
      .join(", ")}`;
  } else {
    desc = `${pack.minQty}+ u. de ${pack.product.productName} → ${fmt(pack.packPrice)} total (${fmt(
      pack.packPrice / pack.minQty,
    )} c/u)`;
  }

  return (
    <Card className={cn("rounded-2xl transition-shadow hover:shadow-md", !pack.active && "opacity-70")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">{pack.name}</div>
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] font-semibold mt-1",
                pack.active ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {pack.active ? "ACTIVO" : "INACTIVO"}
            </div>
          </div>
          <Badge className={cn("gap-1 uppercase text-[10px]", typeClasses[pack.type])}>
            {typeIcon[pack.type]}
            {PACK_TYPE_LABEL[pack.type]}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">{desc}</p>

        <div className="flex flex-wrap gap-1.5">
          {pack.channels.map((c) => (
            <span key={c} className="text-[10px] bg-muted rounded px-1.5 py-0.5 text-muted-foreground">
              {c.replace(/_/g, " ")}
            </span>
          ))}
        </div>

        {isAdmin && (
          <div className="flex gap-1.5 pt-1">
            <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onToggle}>
              {pack.active ? (
                <PauseCircle className="h-3.5 w-3.5 mr-1" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5 mr-1" />
              )}
              {pack.active ? "Desactivar" : "Activar"}
            </Button>
            <Button variant="outline" size="sm" onClick={onDelete} className="hover:border-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* -----------------------------------------
   Modal crear / editar pack
----------------------------------------- */

/** Busca en el catálogo real de productos (ms-products) — de ahí sale el productId
 *  que la Promos API necesita para packs de Volumen/Bundle.
 *
 *  Usa react-query (mismo patrón que useCatalogoProductos.tsx): la queryKey
 *  compartida `["packs-catalog", debouncedQuery]` hace que el buscador de Volumen
 *  y todas las filas del bundle con la misma búsqueda colapsen en una única
 *  request cacheada, sin dedupe manual ni race entre respuestas.
 *
 *  El backend deriva companyId del JWT validado en `GET /products/report`; el
 *  frontend no necesita mandarlo ni gatear por empresa.
 *
 *  `options.enabled` (default `true`) gatea la request. El modal monta dos
 *  instancias a este nivel: el buscador de Volumen (`enabled: type === "VOLUME"`)
 *  y una instancia mínima sin término (`enabled: VOLUME || BUNDLE`) que sólo
 *  deriva `errorReason` para la nota inline; ambas comparten queryKey con las
 *  filas del bundle, así que no agregan requests. GIFT no consume este catálogo
 *  (usa `GiftSearchPicker`, otro service). Con `enabled: false` react-query no
 *  dispara la query, por lo que `products` cae al default `[]`, `loading` queda
 *  `false`, `isError` queda `false` y `errorReason` queda `null`. */
function useProductCatalog(options?: { enabled?: boolean }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    data: products = [],
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: ["packs-catalog", debouncedQuery],
    queryFn: () =>
      getProducts({ status: true, name: debouncedQuery || undefined }),
    staleTime: 30_000,
    placeholderData: (prev) => prev, // evita el flicker a lista vacía entre búsquedas
    enabled: options?.enabled ?? true,
    // No reintentar 4xx de axios (incl. el 403 "sin empresa"): reintento inútil
    // que sólo demora el feedback. 1 reintento para el resto (5xx, errores JS).
    retry: (n, e) =>
      axios.isAxiosError(e) && (e.response?.status ?? 0) < 500 ? false : n < 1,
  });

  // `GET /products/report` responde 403 cuando la cuenta autenticada no tiene
  // empresa asignada en el JWT (en ms-products el único 403 de ese endpoint es
  // ForbiddenException por `!companyId`; token inválido/expirado da 401).
  // Distinguimos ese caso del error genérico para explicarlo en vez de mostrar
  // el confuso "no se pudo cargar". `errorReason` queda `null` si no hay error.
  const status = axios.isAxiosError(error) ? error.response?.status : undefined;
  const errorReason: "no-company" | "generic" | null = !isError
    ? null
    : status === 403
      ? "no-company"
      : "generic";

  useEffect(() => {
    if (!errorReason) return;
    // id por `errorReason` para que el aviso "sin empresa" y el genérico no se
    // pisen en sonner. Con id estable, aunque se monten ~11 instancias del hook
    // (Volumen + filas del bundle) el usuario ve un solo aviso por caso.
    toast.error(
      errorReason === "no-company"
        ? "No se pudo cargar el catálogo con esta cuenta. Suele pasar cuando la cuenta no tiene una empresa asignada — verificá con un administrador."
        : "No se pudo cargar el catálogo de productos.",
      { id: `packs-catalog-load-error-${errorReason}` },
    );
  }, [errorReason]);

  return {
    query,
    setQuery,
    products,
    loading: isFetching,
    isError,
    errorReason,
  };
}

const toOptions = (list: IGetProducts[]) =>
  list.map((p) => ({
    value: p.id,
    label: `${p.name} — ${fmt(p.priceVta)}`,
  }));

/** Una fila del selector de productos del bundle. Cada fila monta su propia
 *  instancia de useProductCatalog para que el buscador de una no pise los
 *  resultados de otra. Reporta hacia arriba el PackProductRef completo del
 *  producto elegido via onResolve para que el padre pueda armar el BundlePack. */
function BundleProductRow({
  value,
  onChange,
  onResolve,
  onRemove,
  index,
  resolvedRef,
}: {
  value: string;
  onChange: (id: string) => void;
  onResolve: (id: string, ref: PackProductRef) => void;
  onRemove?: () => void;
  index: number;
  resolvedRef?: PackProductRef;
}) {
  const search = useProductCatalog();

  const options = useMemo(() => {
    const opts = toOptions(search.products);
    // Al editar, el producto ya elegido puede no estar en la primera página de
    // resultados: lo inyectamos para que el Combobox muestre su nombre.
    if (value && resolvedRef && !opts.some((o) => o.value === value)) {
      opts.unshift({
        value,
        label: `${resolvedRef.productName} — ${fmt(resolvedRef.price)}`,
      });
    }
    return opts;
  }, [search.products, value, resolvedRef]);

  const handleSelect = (id: string) => {
    onChange(id);
    const product = search.products.find((p) => p.id === id);
    if (product) {
      onResolve(id, {
        productId: product.id,
        productKey: product.name,
        productName: product.name,
        price: product.priceVta,
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Combobox
        className="flex-1"
        options={options}
        value={value}
        onValueChange={handleSelect}
        onSearchChange={search.setQuery}
        isLoading={search.loading}
        placeholder={`Producto ${index + 1}...`}
        searchPlaceholder="Buscar producto..."
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar producto ${index + 1}`}
          className="shrink-0 px-2 text-lg font-bold leading-none text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}

function PackFormModal({
  open,
  onOpenChange,
  editingPack,
  inventoryId,
  companyId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editingPack: Pack | null;
  inventoryId: string;
  companyId?: string;
  onSave: (pack: Pack) => void | Promise<void>;
}) {
  const [type, setType] = useState<PackType>(editingPack?.type ?? "VOLUME");
  const [name, setName] = useState(editingPack?.name ?? "");
  const [channels, setChannels] = useState<string[]>(editingPack?.channels ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // VOLUME
  const [volProductId, setVolProductId] = useState(
    editingPack?.type === "VOLUME" ? editingPack.product.productId ?? "" : "",
  );
  const [volVariantFree, setVolVariantFree] = useState(
    editingPack?.type === "VOLUME" ? editingPack.variantFree : true,
  );
  const [volMin, setVolMin] = useState(
    editingPack?.type === "VOLUME" ? String(editingPack.minQty) : "3",
  );
  const [volMax, setVolMax] = useState(
    editingPack?.type === "VOLUME" && editingPack.maxQty ? String(editingPack.maxQty) : "",
  );
  const [volPrice, setVolPrice] = useState(
    editingPack?.type === "VOLUME" ? String(editingPack.packPrice) : "",
  );

  // BUNDLE — lista dinámica de 2 a 10 productos.
  // Bundles legacy pueden no tener `items[].productId` (ver IPack.ts): en ese
  // caso usamos `productKey` como identificador de la fila, así "Editar" muestra
  // los nombres y no obliga a re-elegir todo. El ref guardado conserva su
  // productId original (o undefined) sin regresión.
  const [bunProductIds, setBunProductIds] = useState<string[]>(() => {
    if (editingPack?.type === "BUNDLE") {
      const ids = editingPack.items.map((i) => i.productId || i.productKey || "");
      while (ids.length < 2) ids.push("");
      return ids;
    }
    return ["", ""];
  });
  const [bunItems, setBunItems] = useState<Record<string, PackProductRef>>(() => {
    if (editingPack?.type !== "BUNDLE") return {};
    const map: Record<string, PackProductRef> = {};
    for (const item of editingPack.items) {
      const key = item.productId || item.productKey;
      if (key) map[key] = item;
    }
    return map;
  });
  // Keys estables por fila del bundle: desacopla el estado de búsqueda efímero
  // de cada BundleProductRow del índice del slot (borrar una fila del medio no
  // debe hacer que las de abajo hereden el contexto de otra).
  const bunKeySeqRef = useRef(bunProductIds.length);
  const [bunRowKeys, setBunRowKeys] = useState<number[]>(() =>
    bunProductIds.map((_, i) => i),
  );
  const addBundleRow = () => {
    setBunProductIds((prev) => [...prev, ""]);
    setBunRowKeys((prev) => [...prev, bunKeySeqRef.current++]);
  };
  const removeBundleRow = (i: number) => {
    setBunProductIds((prev) => prev.filter((_, idx) => idx !== i));
    setBunRowKeys((prev) => prev.filter((_, idx) => idx !== i));
  };
  const [bunPrice, setBunPrice] = useState(
    editingPack?.type === "BUNDLE" ? String(editingPack.packPrice) : "",
  );

  // GIFT
  const [giftTrigger, setGiftTrigger] = useState<"amount" | "qty">(
    editingPack?.type === "GIFT" ? editingPack.triggerBy : "amount",
  );
  const [giftMinAmount, setGiftMinAmount] = useState(
    editingPack?.type === "GIFT" && editingPack.minAmount ? String(editingPack.minAmount) : "300",
  );
  const [giftMinQty, setGiftMinQty] = useState(
    editingPack?.type === "GIFT" && editingPack.minQty ? String(editingPack.minQty) : "5",
  );
  const [giftOptions, setGiftOptions] = useState<GiftOption[]>(
    editingPack?.type === "GIFT" ? editingPack.gifts : [],
  );

  // Instancia propia para el buscador de Volumen. Los selectores del bundle
  // montan su propia instancia dentro de cada BundleProductRow.
  // Gateado por tipo: GIFT/BUNDLE no consumen este catálogo, así que no
  // disparamos `GET /products/report` mientras el modal esté en esos tipos.
  const productSearchVolume = useProductCatalog({ enabled: type === "VOLUME" });

  const productOptionsVolume = useMemo(
    () => toOptions(productSearchVolume.products),
    [productSearchVolume.products],
  );

  // Instancia mínima sin término de búsqueda, sólo para derivar `errorReason` de
  // la nota inline en VOLUME y BUNDLE. Su queryKey es siempre
  // `["packs-catalog", ""]`, la misma que usan las filas del bundle vacías y el
  // buscador de Volumen antes de tipear: react-query dedupe y no agrega requests.
  const catalogError = useProductCatalog({
    enabled: type === "VOLUME" || type === "BUNDLE",
  });

  // Nota ámbar cuando el catálogo falla por cuenta sin empresa (403). Misma
  // paleta que el aviso de "Vendedor" de la página. Se reusa en VOLUME y BUNDLE;
  // no bloquea el resto del modal.
  const catalogNoCompanyNote =
    catalogError.errorReason === "no-company" ? (
      <p className="mt-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
        No se pudo cargar el catálogo con esta cuenta. Suele pasar cuando la
        cuenta no tiene una empresa asignada — verificá con un administrador.
      </p>
    ) : null;

  const findInList = (list: IGetProducts[], id: string) => list.find((p) => p.id === id);

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Ingresa un nombre.");
      return;
    }
    if (!channels.length) {
      setError("Selecciona al menos un canal.");
      return;
    }
    if (type === "VOLUME") {
      const product = findInList(productSearchVolume.products, volProductId);
      const min = Number(volMin);
      const price = Number(volPrice);
      if (!product) {
        setError("Selecciona un producto.");
        return;
      }
      if (min < 2) {
        setError("La cantidad mínima debe ser ≥ 2.");
        return;
      }
      if (!price || price >= product.priceVta * min) {
        setError("El precio del pack debe ser menor a la suma de PVP.");
        return;
      }
      const pack: VolumePack = {
        id: editingPack?.id ?? "",
        type: "VOLUME",
        name: name.trim(),
        active: editingPack?.active ?? true,
        channels,
        product: {
          productId: product.id,
          productKey: product.name,
          productName: product.name,
          price: product.priceVta,
        },
        variantFree: volVariantFree,
        minQty: min,
        maxQty: volMax ? Number(volMax) : null,
        packPrice: price,
        synced: true,
      };
      setSaving(true);
      await onSave(pack);
      setSaving(false);
      return;
    }

    if (type === "BUNDLE") {
      const ids = bunProductIds.map((s) => s.trim()).filter(Boolean);
      if (ids.length < 2) {
        setError("Un bundle requiere al menos 2 productos.");
        return;
      }
      if (new Set(ids).size !== ids.length) {
        setError("Los productos del bundle deben ser distintos.");
        return;
      }
      if (ids.length > 10) {
        setError("Un bundle admite máximo 10 productos.");
        return;
      }
      const items = ids.map((id) => bunItems[id]).filter(Boolean);
      if (items.length !== ids.length) {
        setError("Selecciona todos los productos.");
        return;
      }
      const price = Number(bunPrice);
      const pvpSum = items.reduce((s, it) => s + it.price, 0);
      if (!price || price >= pvpSum) {
        setError("El precio del bundle debe ser menor a la suma de PVP.");
        return;
      }
      const pack: BundlePack = {
        id: editingPack?.id ?? crypto.randomUUID(),
        type: "BUNDLE",
        name: name.trim(),
        active: editingPack?.active ?? true,
        channels,
        items,
        packPrice: price,
      };
      setSaving(true);
      await onSave(pack);
      setSaving(false);
      return;
    }

    // GIFT
    if (giftOptions.length < 2) {
      setError("Busca y agrega al menos 2 productos del inventario como opciones de regalo.");
      return;
    }
    if (giftTrigger === "amount") {
      const amount = Number(giftMinAmount);
      if (!amount || amount <= 0) {
        setError("Ingresa un monto mínimo válido.");
        return;
      }
      const pack: GiftPack = {
        id: editingPack?.id ?? crypto.randomUUID(),
        type: "GIFT",
        name: name.trim(),
        active: editingPack?.active ?? true,
        channels,
        triggerBy: "amount",
        minAmount: amount,
        minQty: null,
        gifts: giftOptions,
      };
      setSaving(true);
      await onSave(pack);
      setSaving(false);
    } else {
      const qty = Number(giftMinQty);
      if (qty < 2) {
        setError("La cantidad mínima debe ser ≥ 2.");
        return;
      }
      const pack: GiftPack = {
        id: editingPack?.id ?? crypto.randomUUID(),
        type: "GIFT",
        name: name.trim(),
        active: editingPack?.active ?? true,
        channels,
        triggerBy: "qty",
        minAmount: null,
        minQty: qty,
        gifts: giftOptions,
      };
      setSaving(true);
      await onSave(pack);
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPack ? "Editar pack" : "Nuevo pack"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Tipo de pack</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { t: "VOLUME" as const, label: "📦 Volumen" },
                  { t: "BUNDLE" as const, label: "🧩 Bundle" },
                  { t: "GIFT" as const, label: "🎁 Regalo" },
                ]
              ).map((opt) => (
                <button
                  key={opt.t}
                  type="button"
                  disabled={!!editingPack}
                  onClick={() => setType(opt.t)}
                  className={cn(
                    "border rounded-md py-2.5 text-sm font-medium",
                    type === opt.t
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground",
                    !!editingPack && "opacity-60 cursor-not-allowed",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Nombre del pack</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Pack ×3 Pantalón Denim" />
          </div>

          {type === "VOLUME" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Producto</Label>
                <Combobox
                  options={productOptionsVolume}
                  value={volProductId}
                  onValueChange={setVolProductId}
                  onSearchChange={productSearchVolume.setQuery}
                  isLoading={productSearchVolume.loading}
                  placeholder="Buscar producto..."
                  searchPlaceholder="Nombre del producto..."
                />
                {catalogNoCompanyNote}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={volVariantFree} onCheckedChange={(v) => setVolVariantFree(!!v)} />
                Variantes libres (el vendedor elige las tallas/colores)
              </label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label>Cant. mínima</Label>
                  <Input type="number" value={volMin} onChange={(e) => setVolMin(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Cant. máxima (opc)</Label>
                  <Input type="number" value={volMax} onChange={(e) => setVolMax(e.target.value)} placeholder="Sin límite" />
                </div>
                <div className="space-y-1">
                  <Label>Precio pack total (S/)</Label>
                  <Input type="number" value={volPrice} onChange={(e) => setVolPrice(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {type === "BUNDLE" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Productos del bundle (mínimo 2, máximo 10)</Label>
                {catalogNoCompanyNote}
                {bunProductIds.map((id, i) => (
                  <BundleProductRow
                    key={bunRowKeys[i]}
                    index={i}
                    value={id}
                    resolvedRef={id ? bunItems[id] : undefined}
                    onChange={(newId) =>
                      setBunProductIds((prev) =>
                        prev.map((v, idx) => (idx === i ? newId : v)),
                      )
                    }
                    onResolve={(resolvedId, ref) =>
                      setBunItems((prev) => ({ ...prev, [resolvedId]: ref }))
                    }
                    onRemove={
                      bunProductIds.length > 2
                        ? () => removeBundleRow(i)
                        : undefined
                    }
                  />
                ))}
                {bunProductIds.length < 10 && (
                  <button
                    type="button"
                    onClick={addBundleRow}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    ＋ Agregar producto
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <Label>Precio bundle total (S/)</Label>
                <Input type="number" value={bunPrice} onChange={(e) => setBunPrice(e.target.value)} />
              </div>
            </div>
          )}

          {type === "GIFT" && (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block">Condición para desbloquear el regalo</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGiftTrigger("amount")}
                    className={cn(
                      "border rounded-md py-2.5 text-sm font-medium",
                      giftTrigger === "amount" ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground",
                    )}
                  >
                    💰 Por monto de compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setGiftTrigger("qty")}
                    className={cn(
                      "border rounded-md py-2.5 text-sm font-medium",
                      giftTrigger === "qty" ? "border-primary bg-primary/10 text-primary" : "bg-background text-muted-foreground",
                    )}
                  >
                    🔢 Por cantidad de prendas
                  </button>
                </div>
              </div>
              {giftTrigger === "amount" ? (
                <div className="space-y-1">
                  <Label>Monto mínimo de compra (S/)</Label>
                  <Input type="number" value={giftMinAmount} onChange={(e) => setGiftMinAmount(e.target.value)} />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label>Cantidad mínima de prendas</Label>
                  <Input type="number" value={giftMinQty} onChange={(e) => setGiftMinQty(e.target.value)} />
                </div>
              )}
              <GiftSearchPicker
                inventoryId={inventoryId}
                companyId={companyId}
                selected={giftOptions}
                onChange={setGiftOptions}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Canales de venta — elige en cuáles sí aplica</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {PROMO_CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} />
                  {c.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">⚠ {error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar pack"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Busca en el inventario real (ms-logistics `GET /inventory-item/search`) los
 *  items que pueden ofrecerse como regalo en un pack GIFT. Espejo de
 *  `useProductCatalog`, pero contra el service de inventario: necesita
 *  `inventoryId` (y opcionalmente `companyId`) porque el regalo sale de un
 *  almacén concreto, no del catálogo global de ms-products.
 *
 *  Mismo patrón react-query que `useProductCatalog` / `useCatalogoProductos.tsx`:
 *  debounce del término a 350ms para alinear con el otro buscador, `staleTime`
 *  de 30s y `placeholderData` para no parpadear a lista vacía entre búsquedas.
 *  `enabled: !!inventoryId` gatea la request hasta que el modal resuelve el
 *  inventario seleccionado; mientras tanto `results` cae al default `[]`,
 *  `loading` queda `false` e `isError` queda `false`.
 *
 *  Ante error mostramos `toast.error` con id estable (igual que el hermano
 *  `useProductCatalog`): antes este buscador tragaba el error en silencio
 *  (`.catch(() => setResults([]))`), ahora lo avisamos como el otro. */
function useGiftInventorySearch({
  inventoryId,
  companyId,
}: {
  inventoryId: string;
  companyId?: string;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isFetching, isError } = useQuery({
    queryKey: ["gift-inventory", inventoryId, companyId ?? null, debouncedQuery],
    queryFn: () =>
      searchInventoryItems({
        inventoryId,
        companyId,
        q: debouncedQuery || undefined,
        page: 1,
        limit: 20,
      }),
    enabled: !!inventoryId,
    staleTime: 30_000,
    placeholderData: (prev) => prev, // evita el flicker a lista vacía entre búsquedas
  });

  useEffect(() => {
    if (isError) {
      toast.error("No se pudo cargar el inventario para regalos.", {
        id: "gift-inventory-load-error",
      });
    }
  }, [isError]);

  return {
    query,
    setQuery,
    results: data?.data ?? [],
    loading: isFetching,
    isError,
  };
}

function GiftSearchPicker({
  inventoryId,
  companyId,
  selected,
  onChange,
}: {
  inventoryId: string;
  companyId?: string;
  selected: GiftOption[];
  onChange: (opts: GiftOption[]) => void;
}) {
  const { query, setQuery, results, loading } = useGiftInventorySearch({
    inventoryId,
    companyId,
  });
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(selected.map((s) => s.variantId));
  const filtered = results.filter((r) => !selectedIds.has(r.variantId));

  const addOption = (item: InventoryItemForSale) => {
    onChange([
      ...selected,
      {
        variantId: item.variantId,
        inventoryItemId: item.inventoryItemId,
        sku: item.sku,
        productName: item.productName,
        attributes: item.attributes,
        value: item.price,
      },
    ]);
    setQuery("");
    setOpen(false);
  };

  const removeOption = (variantId: string) => {
    onChange(selected.filter((s) => s.variantId !== variantId));
  };

  return (
    <div className="space-y-1.5">
      <Label>
        Opciones de regalo — búscalas en tu inventario · el cliente elige 1 (mínimo 2)
      </Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar producto del almacén por nombre o SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
        />
        {open && (query || filtered.length > 0) && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-56 overflow-y-auto rounded-md border bg-popover shadow-lg">
            {loading ? (
              <div className="p-3 text-center text-xs text-muted-foreground">Buscando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">Sin resultados.</div>
            ) : (
              filtered.slice(0, 8).map((item) => (
                <button
                  key={item.variantId}
                  type="button"
                  onClick={() => addOption(item)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted border-b last:border-0"
                >
                  <div className="w-7 h-7 rounded-md bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {initials(item.productName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold truncate">{item.productName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {item.attributes ? Object.values(item.attributes).join(" · ") : item.sku}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-amber-600">{fmt(item.price)}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {selected.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            Aún no agregas opciones. Busca productos arriba (mínimo 2).
          </p>
        ) : (
          selected.map((g) => (
            <span
              key={g.variantId}
              className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              🎁 {g.productName} <span className="text-amber-500">{fmt(g.value)}</span>
              <button type="button" onClick={() => removeOption(g.variantId)} className="text-amber-500 font-bold">
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function PacksPromosPage() {
  return (
    <PacksProvider>
      <PacksPromosContent />
    </PacksProvider>
  );
}
