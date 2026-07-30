"use client";

import { useEffect, useMemo, useState } from "react";
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

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

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
 *  que la Promos API necesita para packs de Volumen/Bundle. */
function useProductCatalog(companyId?: string) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<IGetProducts[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setProducts([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      // No se manda companyId: el backend lo infiere del JWT (mismo patrón
      // que useCatalogoProductos.tsx, que es el caller que sabemos que funciona).
      getProducts({ status: true, name: query || undefined })
        .then(setProducts)
        .catch((err) => {
          console.error("[packs-promos] getProducts falló:", err);
          setProducts([]);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [companyId, query]);

  return { query, setQuery, products, loading };
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

  // BUNDLE
  const [bunProductId1, setBunProductId1] = useState(
    editingPack?.type === "BUNDLE" ? editingPack.items[0]?.productId ?? "" : "",
  );
  const [bunProductId2, setBunProductId2] = useState(
    editingPack?.type === "BUNDLE" ? editingPack.items[1]?.productId ?? "" : "",
  );
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

  const productSearch = useProductCatalog(companyId);

  const productOptions = useMemo(
    () =>
      productSearch.products.map((p) => ({
        value: p.id,
        label: `${p.name} — ${fmt(p.priceVta)}`,
      })),
    [productSearch.products],
  );

  const findProduct = (id: string) => productSearch.products.find((p) => p.id === id);

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
      const product = findProduct(volProductId);
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
      if (!bunProductId1 || !bunProductId2 || bunProductId1 === bunProductId2) {
        setError("Un bundle requiere 2 productos distintos.");
        return;
      }
      const p1 = findProduct(bunProductId1);
      const p2 = findProduct(bunProductId2);
      const price = Number(bunPrice);
      if (!p1 || !p2) {
        setError("Selecciona ambos productos.");
        return;
      }
      if (!price || price >= p1.priceVta + p2.priceVta) {
        setError("El precio del bundle debe ser menor a la suma de PVP.");
        return;
      }
      const pack: BundlePack = {
        id: editingPack?.id ?? crypto.randomUUID(),
        type: "BUNDLE",
        name: name.trim(),
        active: editingPack?.active ?? true,
        channels,
        items: [
          { productId: p1.id, productKey: p1.name, productName: p1.name, price: p1.priceVta },
          { productId: p2.id, productKey: p2.name, productName: p2.name, price: p2.priceVta },
        ],
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
                  options={productOptions}
                  value={volProductId}
                  onValueChange={setVolProductId}
                  onSearchChange={productSearch.setQuery}
                  isLoading={productSearch.loading}
                  placeholder="Buscar producto..."
                  searchPlaceholder="Nombre del producto..."
                />
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
              <div className="space-y-1">
                <Label>Productos del bundle (mínimo 2)</Label>
                <Combobox
                  options={productOptions}
                  value={bunProductId1}
                  onValueChange={setBunProductId1}
                  onSearchChange={productSearch.setQuery}
                  isLoading={productSearch.loading}
                  placeholder="Producto 1..."
                  searchPlaceholder="Buscar producto..."
                />
                <Combobox
                  options={productOptions}
                  value={bunProductId2}
                  onValueChange={setBunProductId2}
                  onSearchChange={productSearch.setQuery}
                  isLoading={productSearch.loading}
                  placeholder="Producto 2..."
                  searchPlaceholder="Buscar producto..."
                />
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
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InventoryItemForSale[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inventoryId) return;
    setLoading(true);
    const timer = setTimeout(() => {
      searchInventoryItems({ inventoryId, companyId, q: query || undefined, page: 1, limit: 20 })
        .then((res) => setResults(res.data))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [inventoryId, companyId, query]);

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
