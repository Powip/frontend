"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Trash2, Gift, PackageCheck, Sparkles, ShoppingBag } from "lucide-react";
import { CartItem } from "@/interfaces/IOrder";
import { AppliedPack, BundlePack, GiftOption, GiftPack, Pack, VolumePack } from "@/interfaces/IPack";
import { packNetUnit } from "@/hooks/usePacksEngine";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import { initials } from "@/utils/productGrouping";

const fmt = (n: number) => `S/ ${n.toFixed(2)}`;

interface PvsState {
  packId: string;
  productKey: string;
  variants: InventoryItemForSale[];
  dist: Record<string, number>;
}

interface CartLinesProps {
  cart: CartItem[];
  packs: Pack[];
  appliedPacks: Record<string, AppliedPack>;
  pendingHints: Pack[];
  isAdmin: boolean;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onSetPrice: (id: string, price: number) => void;
  onApplyDiscount: (id: string, mode: "pct" | "amt", value: number) => void;
  onClearDiscount: (id: string) => void;
  onBulkPrice: (price: number) => void;
  onBulkDiscount: (pct: number) => void;
  onRestorePvp: () => void;
  onApplyPack: (pack: Pack) => void;
  onUndoPack: (packId: string) => void;
  pvsOpen: PvsState | null;
  pvsLoading: boolean;
  pvsTotal: number;
  onPvsChg: (variantId: string, delta: number) => void;
  onPvsConfirm: () => void;
  onPvsCancel: () => void;
  giftOpen: string | null;
  onChooseGift: (packId: string, gift: GiftOption) => void;
  onChangeGift: (packId: string) => void;
  onGiftCancel: () => void;
}

export default function CartLines({
  cart,
  packs,
  appliedPacks,
  pendingHints,
  isAdmin,
  onQtyChange,
  onRemove,
  onSetPrice,
  onApplyDiscount,
  onClearDiscount,
  onBulkPrice,
  onBulkDiscount,
  onRestorePvp,
  onApplyPack,
  onUndoPack,
  pvsOpen,
  pvsLoading,
  pvsTotal,
  onPvsChg,
  onPvsConfirm,
  onPvsCancel,
  giftOpen,
  onChooseGift,
  onChangeGift,
  onGiftCancel,
}: CartLinesProps) {
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkDisc, setBulkDisc] = useState("");

  const editableLines = cart.filter((l) => !l.packId && !l.isGift);
  const bundlePackIds = new Set(
    packs.filter((p): p is BundlePack => p.type === "BUNDLE").map((p) => p.id),
  );

  const handledBundles = new Set<string>();
  const rows: React.ReactNode[] = [];

  cart
    .filter((l) => !l.isGift)
    .forEach((line) => {
      if (line.packId && bundlePackIds.has(line.packId)) {
        if (handledBundles.has(line.packId)) return;
        handledBundles.add(line.packId);
        const pack = packs.find((p) => p.id === line.packId) as BundlePack | undefined;
        if (pack) {
          rows.push(
            <BundleBlock
              key={"bundle-" + pack.id}
              pack={pack}
              lines={cart.filter((l) => l.packId === pack.id && !l.isGift)}
              onQtyChange={onQtyChange}
              onUndo={() => onUndoPack(pack.id)}
            />,
          );
        }
        return;
      }
      rows.push(
        <LineRow
          key={line.id}
          line={line}
          packName={line.packId ? packs.find((p) => p.id === line.packId)?.name : undefined}
          isAdmin={isAdmin}
          onQtyChange={onQtyChange}
          onRemove={onRemove}
          onSetPrice={onSetPrice}
          onApplyDiscount={onApplyDiscount}
          onClearDiscount={onClearDiscount}
          onUndoPack={line.packId ? () => onUndoPack(line.packId!) : undefined}
        />,
      );
    });

  const giftLines = cart.filter((l) => l.isGift);

  return (
    <div className="space-y-3">
      {editableLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/40 p-2.5 text-xs">
          <span className="font-semibold">Precio general:</span>
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground">S/</span>
            <Input
              className="h-8 w-24"
              type="number"
              placeholder="0.00"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              const v = parseFloat(bulkPrice);
              if (!isNaN(v) && v >= 0) onBulkPrice(v);
            }}
          >
            Aplicar a todos
          </Button>
          <div className="h-5 w-px bg-border" />
          <Input
            className="h-8 w-20"
            type="number"
            placeholder="% desc"
            value={bulkDisc}
            onChange={(e) => setBulkDisc(e.target.value)}
          />
          <Button
            size="sm"
            className="h-8"
            onClick={() => {
              const v = parseFloat(bulkDisc);
              if (!isNaN(v) && v >= 0 && v <= 100) onBulkDiscount(v);
            }}
          >
            Aplicar %
          </Button>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => {
              setBulkPrice("");
              setBulkDisc("");
              onRestorePvp();
            }}
          >
            Restaurar PVP
          </Button>
        </div>
      )}

      {cart.length === 0 ? (
        <div className="rounded-xl border-[1.5px] border-dashed bg-muted/20 py-9 px-5 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Aún no agregas productos</p>
          <span className="text-xs text-muted-foreground">
            Busca un modelo arriba y elige sus variantes
          </span>
        </div>
      ) : (
        rows
      )}

      {giftLines.map((line) => (
        <GiftLineRow
          key={line.id}
          line={line}
          packName={packs.find((p) => p.id === line.packId)?.name}
          isAdmin={isAdmin}
          onChange={() => line.packId && onChangeGift(line.packId)}
          onUndo={() => line.packId && onUndoPack(line.packId)}
        />
      ))}

      {pvsOpen && (
        <PvsPanel
          state={pvsOpen}
          pack={packs.find((p) => p.id === pvsOpen.packId) as VolumePack}
          loading={pvsLoading}
          total={pvsTotal}
          onChg={onPvsChg}
          onConfirm={onPvsConfirm}
          onCancel={onPvsCancel}
        />
      )}

      {giftOpen && (
        <GiftPanel
          pack={packs.find((p) => p.id === giftOpen) as GiftPack}
          chosen={appliedPacks[giftOpen]?.giftProductKey}
          isAdmin={isAdmin}
          onChoose={(gift) => onChooseGift(giftOpen, gift)}
          onCancel={onGiftCancel}
        />
      )}

      {pendingHints
        .filter((p) => !(pvsOpen && pvsOpen.packId === p.id) && giftOpen !== p.id)
        .map((p) => (
          <HintRow key={p.id} pack={p} isAdmin={isAdmin} onApply={() => onApplyPack(p)} />
        ))}
    </div>
  );
}

function LineRow({
  line,
  packName,
  isAdmin,
  onQtyChange,
  onRemove,
  onSetPrice,
  onApplyDiscount,
  onClearDiscount,
  onUndoPack,
}: {
  line: CartItem;
  packName?: string;
  isAdmin: boolean;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onSetPrice: (id: string, price: number) => void;
  onApplyDiscount: (id: string, mode: "pct" | "amt", value: number) => void;
  onClearDiscount: (id: string) => void;
  onUndoPack?: () => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const pvp = line.pvp ?? line.price;
  const discounted = line.price < pvp - 0.001;
  const isPack = !!line.packId;

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        isPack
          ? "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-800"
          : "bg-card",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-violet-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
          {initials(line.productName) || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm truncate">{line.productName}</span>
            {isPack && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1">
                <PackageCheck className="h-3 w-3" />
                {packName ?? "Pack"}
                {isAdmin ? ` · ${fmt(line.price)} neto` : ""}
                <button
                  type="button"
                  className="underline ml-1"
                  onClick={onUndoPack}
                >
                  deshacer
                </button>
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap text-[11px] text-muted-foreground">
            {line.attributes &&
              Object.entries(line.attributes).map(([k, v]) => (
                <span key={k} className="bg-muted rounded px-1.5 py-0.5">
                  {k}: {v}
                </span>
              ))}
            <span>{line.sku}</span>
          </div>
        </div>

        <div className="flex items-center border rounded-md overflow-hidden shrink-0">
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center hover:bg-muted"
            onClick={() => onQtyChange(line.id, -1)}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
          <button
            type="button"
            className="w-7 h-7 flex items-center justify-center hover:bg-muted"
            onClick={() => onQtyChange(line.id, 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="text-right min-w-[92px] shrink-0">
          {discounted && (
            <div className="text-[11px] text-muted-foreground line-through">{fmt(pvp)}</div>
          )}
          <div className={cn("font-bold text-sm flex items-center justify-end gap-1", discounted && "text-emerald-600")}>
            {fmt(line.price)}
            {!isPack && (
              <button
                type="button"
                className="text-muted-foreground hover:text-violet-600"
                onClick={() => setEditorOpen((v) => !v)}
              >
                ✎
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={() => onRemove(line.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {!isPack && editorOpen && (
        <DiscountEditor
          line={line}
          onApply={(mode, value) => onApplyDiscount(line.id, mode, value)}
          onSetPrice={(v) => onSetPrice(line.id, v)}
          onClear={() => onClearDiscount(line.id)}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

function DiscountEditor({
  line,
  onApply,
  onSetPrice,
  onClear,
  onClose,
}: {
  line: CartItem;
  onApply: (mode: "pct" | "amt", value: number) => void;
  onSetPrice: (v: number) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"pct" | "amt" | "man">("pct");
  const [value, setValue] = useState("");
  const pvp = line.pvp ?? line.price;

  return (
    <div className="mt-2 border border-dashed rounded-md p-2.5 bg-background">
      <div className="flex gap-1.5 mb-2">
        {(["pct", "amt", "man"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-md border",
              mode === m ? "bg-violet-600 text-white border-violet-600" : "bg-background",
            )}
          >
            {m === "pct" ? "% descuento" : m === "amt" ? "S/ descuento" : "Precio manual"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {mode === "man" ? (
          <>
            <span className="text-xs text-muted-foreground">Nuevo precio c/u:</span>
            <Input
              className="h-8 w-24"
              type="number"
              placeholder={String(pvp)}
              defaultValue={line.price}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                const v = parseFloat(value);
                if (!isNaN(v) && v >= 0) onSetPrice(v);
              }}
            >
              Aplicar
            </Button>
          </>
        ) : (
          <>
            <Input
              className="h-8 w-20"
              type="number"
              placeholder={mode === "pct" ? "10" : "20"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {mode === "pct" ? "%" : "S/"} sobre {fmt(pvp)}
            </span>
            {mode === "pct" &&
              [10, 15, 20].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="text-[11px] border rounded-md px-2 py-1 hover:border-violet-500"
                  onClick={() => setValue(String(p))}
                >
                  {p}%
                </button>
              ))}
            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                const v = parseFloat(value);
                if (!isNaN(v) && v >= 0) onApply(mode, v);
              }}
            >
              Aplicar
            </Button>
            <Button size="sm" variant="outline" className="h-8" onClick={onClose}>
              Cerrar
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-[11px] text-muted-foreground">
          El descuento ajusta el precio de cierre.
        </p>
        {line.price < pvp - 0.001 && (
          <button type="button" className="text-[11px] underline text-muted-foreground" onClick={onClear}>
            quitar descuento
          </button>
        )}
      </div>
    </div>
  );
}

function BundleBlock({
  pack,
  lines,
  onQtyChange,
  onUndo,
}: {
  pack: BundlePack;
  lines: CartItem[];
  onQtyChange: (id: string, delta: number) => void;
  onUndo: () => void;
}) {
  const save = pack.items.reduce((a, i) => a + i.price, 0) - pack.packPrice;
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-800 dark:bg-violet-500/10">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> {pack.name}
        </span>
        <button type="button" className="text-xs text-violet-700 dark:text-violet-300 underline" onClick={onUndo}>
          Quitar bundle
        </button>
      </div>
      <div className="space-y-2">
        {lines.map((line) => (
          <div key={line.id} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials(line.productName)}
            </div>
            <span className="text-sm flex-1 truncate">{line.productName}</span>
            <div className="flex items-center border rounded-md overflow-hidden shrink-0 bg-background">
              <button type="button" className="w-6 h-6 flex items-center justify-center" onClick={() => onQtyChange(line.id, -1)}>
                <Minus className="h-3 w-3" />
              </button>
              <span className="w-6 text-center text-xs font-semibold">{line.quantity}</span>
              <button type="button" className="w-6 h-6 flex items-center justify-center" onClick={() => onQtyChange(line.id, 1)}>
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400 w-16 text-right">{fmt(line.price)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-violet-200 dark:border-violet-800 mt-2.5 pt-2.5 text-sm">
        <span className="font-semibold text-violet-700 dark:text-violet-300">Total bundle: {fmt(pack.packPrice)}</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">✓ Ahorras {fmt(Math.max(0, save))}</span>
      </div>
    </div>
  );
}

function GiftLineRow({
  line,
  packName,
  isAdmin,
  onChange,
  onUndo,
}: {
  line: CartItem;
  packName?: string;
  isAdmin: boolean;
  onChange: () => void;
  onUndo: () => void;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-500/10">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
          <Gift className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{line.productName}</span>
            <Badge className="bg-amber-500 hover:bg-amber-500 text-white gap-1">
              <Gift className="h-3 w-3" /> Regalo
              {isAdmin && line.giftValue ? ` · valor ${fmt(line.giftValue)}` : ""}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {packName}
            {" · "}
            <button type="button" className="underline" onClick={onChange}>
              cambiar regalo
            </button>
            {" · "}
            <button type="button" className="underline" onClick={onUndo}>
              quitar
            </button>
          </div>
        </div>
        <span className="font-semibold text-sm text-amber-600 dark:text-amber-400">Gratis</span>
      </div>
    </div>
  );
}

function HintRow({ pack, isAdmin, onApply }: { pack: Pack; isAdmin: boolean; onApply: () => void }) {
  if (pack.type === "GIFT") {
    const cond = pack.triggerBy === "qty" ? `${pack.minQty} prendas` : `compra de ${fmt(pack.minAmount || 0)}`;
    return (
      <div className="flex items-center gap-3 flex-wrap rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-500/10">
        <div className="flex-1 min-w-[180px] text-sm">
          <Gift className="inline h-3.5 w-3.5 mr-1 text-amber-600 dark:text-amber-400" />
          <b>{pack.name}</b> desbloqueado · el cliente elige 1 de {pack.gifts.length} regalos ({cond})
        </div>
        <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" onClick={onApply}>
          Elegir regalo
        </Button>
      </div>
    );
  }
  if (pack.type === "BUNDLE") {
    const save = pack.items.reduce((a, i) => a + i.price, 0) - pack.packPrice;
    return (
      <div className="flex items-center gap-3 flex-wrap rounded-xl border border-violet-200 bg-violet-50/70 p-3 dark:border-violet-800 dark:bg-violet-500/10">
        <div className="flex-1 min-w-[180px] text-sm">
          <Sparkles className="inline h-3.5 w-3.5 mr-1 text-violet-600 dark:text-violet-400" />
          <b>{pack.name}</b> · {fmt(pack.packPrice)} total ·{" "}
          <span className="font-semibold text-violet-700 dark:text-violet-300">ahorras {fmt(Math.max(0, save))}</span>
        </div>
        <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={onApply}>
          Aplicar bundle
        </Button>
      </div>
    );
  }
  const save = Math.max(0, pack.product.price * pack.minQty - pack.packPrice);
  return (
    <div className="flex items-center gap-3 flex-wrap rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800 dark:bg-emerald-500/10">
      <div className="flex-1 min-w-[180px] text-sm">
        <PackageCheck className="inline h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
        <b>{pack.name}</b> disponible · {fmt(pack.packPrice)} total
        {isAdmin ? ` · ${fmt(packNetUnit(pack))} c/u neto` : ""} ·{" "}
        <span className="font-semibold text-emerald-700 dark:text-emerald-300">ahorras {fmt(save)}</span>
      </div>
      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApply}>
        {pack.variantFree ? "Elegir tallas y aplicar" : "Aplicar pack"}
      </Button>
    </div>
  );
}

function PvsPanel({
  state,
  pack,
  loading,
  total,
  onChg,
  onConfirm,
  onCancel,
}: {
  state: PvsState;
  pack: VolumePack;
  loading: boolean;
  total: number;
  onChg: (variantId: string, delta: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!pack) return null;
  const done = total === pack.minQty;
  const pct = Math.min(100, (total / pack.minQty) * 100);

  return (
    <div className="rounded-xl border-2 border-emerald-500 p-3.5 bg-card">
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">
          🎁 {pack.name} — elige {pack.minQty} unidades
        </span>
        <Badge
          className={cn(
            done
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
              : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
          )}
        >
          {done ? "✓ " : ""}
          {total}/{pack.minQty} elegidas
        </Badge>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Cargando variantes...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.variants
            .filter((v) => v.availableStock > 0)
            .map((v) => {
              const q = state.dist[v.variantId] || 0;
              const label = v.attributes
                ? Object.values(v.attributes).join(" ")
                : v.sku;
              return (
                <div key={v.variantId} className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 bg-background">
                  <div className="text-xs">
                    <div className="font-semibold">{label}</div>
                    <div className="text-muted-foreground text-[10px]">{v.availableStock} u.</div>
                  </div>
                  <div className="flex items-center border rounded-md overflow-hidden">
                    <button type="button" className="w-6 h-6 flex items-center justify-center" onClick={() => onChg(v.variantId, -1)}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold">{q}</span>
                    <button type="button" className="w-6 h-6 flex items-center justify-center" onClick={() => onChg(v.variantId, 1)}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-3">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" disabled={!done} onClick={onConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          ✓ Confirmar pack
        </Button>
      </div>
    </div>
  );
}

function GiftPanel({
  pack,
  chosen,
  isAdmin,
  onChoose,
  onCancel,
}: {
  pack: GiftPack;
  chosen?: string;
  isAdmin: boolean;
  onChoose: (gift: GiftOption) => void;
  onCancel: () => void;
}) {
  if (!pack) return null;
  const cond = pack.triggerBy === "qty" ? `por ${pack.minQty} prendas` : `por compra de ${fmt(pack.minAmount || 0)}`;
  return (
    <div className="rounded-xl border-2 border-amber-400 p-3.5 bg-card">
      <div className="font-semibold text-sm text-amber-600 dark:text-amber-400 mb-0.5">🎁 {pack.name} — el cliente elige 1 regalo</div>
      <p className="text-xs text-muted-foreground mb-3">
        Desbloqueado {cond}. Toca la opción que eligió el cliente.
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
        {pack.gifts.map((g) => (
          <button
            key={g.variantId}
            type="button"
            onClick={() => onChoose(g)}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
              chosen === g.variantId
                ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10"
                : "hover:border-amber-400 hover:bg-amber-50/60 dark:hover:bg-amber-500/10",
            )}
          >
            <div className="w-8 h-8 rounded-md bg-amber-500 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
              {initials(g.productName)}
            </div>
            <div>
              <div className="text-xs font-semibold">{g.productName}</div>
              <div className="text-[10px] text-muted-foreground">{isAdmin ? `valor ${fmt(g.value)}` : "regalo"}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="flex justify-end mt-3">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Ahora no
        </Button>
      </div>
    </div>
  );
}
