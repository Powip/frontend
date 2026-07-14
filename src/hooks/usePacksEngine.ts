import { useCallback, useEffect, useMemo, useState } from "react";
import { CartItem } from "@/interfaces/IOrder";
import { AppliedPack, GiftOption, Pack, VolumePack, BundlePack } from "@/interfaces/IPack";
import { InventoryItemForSale } from "@/interfaces/IProduct";

export function packNetUnit(p: VolumePack): number {
  return p.packPrice / p.minQty;
}

function bundleNetPerItem(p: BundlePack): Record<string, number> {
  const sumPvp = p.items.reduce((a, i) => a + i.price, 0);
  const perItem: Record<string, number> = {};
  p.items.forEach((i) => {
    perItem[i.productKey] =
      sumPvp > 0
        ? Math.round((i.price / sumPvp) * p.packPrice * 100) / 100
        : 0;
  });
  return perItem;
}

interface PvsState {
  packId: string;
  productKey: string;
  variants: InventoryItemForSale[];
  dist: Record<string, number>; // variantId -> qty
}

interface UsePacksEngineArgs {
  packs: Pack[];
  channel?: string;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  getVariantsForProduct: (productName: string) => Promise<InventoryItemForSale[]>;
}

export function usePacksEngine({
  packs,
  channel,
  cart,
  setCart,
  getVariantsForProduct,
}: UsePacksEngineArgs) {
  const [appliedPacks, setAppliedPacks] = useState<Record<string, AppliedPack>>({});
  const [pvsOpen, setPvsOpen] = useState<PvsState | null>(null);
  const [pvsLoading, setPvsLoading] = useState(false);
  const [giftOpen, setGiftOpen] = useState<string | null>(null);

  const modelQtyInCart = useCallback(
    (productKey: string) =>
      cart
        .filter((l) => l.productName === productKey && !l.isGift)
        .reduce((a, l) => a + l.quantity, 0),
    [cart],
  );

  const subtotalPayable = useMemo(
    () => cart.filter((l) => !l.isGift).reduce((a, l) => a + l.price * l.quantity, 0),
    [cart],
  );

  const totalUnits = useMemo(
    () => cart.filter((l) => !l.isGift).reduce((a, l) => a + l.quantity, 0),
    [cart],
  );

  const packTriggered = useCallback(
    (p: Pack): boolean => {
      if (p.type === "VOLUME") {
        const q = modelQtyInCart(p.product.productKey);
        return q >= p.minQty && q <= (p.maxQty || Infinity);
      }
      if (p.type === "BUNDLE") {
        return p.items.every((i) => modelQtyInCart(i.productKey) > 0);
      }
      if (p.type === "GIFT") {
        return p.triggerBy === "qty"
          ? totalUnits >= (p.minQty || 0)
          : subtotalPayable >= (p.minAmount || 0);
      }
      return false;
    },
    [modelQtyInCart, totalUnits, subtotalPayable],
  );

  const activePacksForChannel = useMemo(
    () =>
      packs.filter((p) => p.active && (!channel || p.channels.includes(channel))),
    [packs, channel],
  );

  const activePacksForProduct = useCallback(
    (productKey: string) =>
      activePacksForChannel.filter(
        (p) =>
          (p.type === "VOLUME" && p.product.productKey === productKey) ||
          (p.type === "BUNDLE" && p.items.some((i) => i.productKey === productKey)),
      ),
    [activePacksForChannel],
  );

  const pendingHints = useMemo(
    () =>
      activePacksForChannel.filter(
        (p) => !appliedPacks[p.id] && packTriggered(p),
      ),
    [activePacksForChannel, appliedPacks, packTriggered],
  );

  const undoPack = useCallback(
    (pid: string) => {
      setCart((prev) =>
        prev
          .filter((l) => !(l.packId === pid && l.isGift))
          .map((l) =>
            l.packId === pid && !l.isGift
              ? { ...l, packId: null, price: l.pvp ?? l.price }
              : l,
          ),
      );
      setAppliedPacks((prev) => {
        const next = { ...prev };
        delete next[pid];
        return next;
      });
      setPvsOpen((prev) => (prev?.packId === pid ? null : prev));
      setGiftOpen((prev) => (prev === pid ? null : prev));
    },
    [setCart],
  );

  // Limpia packs cuyo trigger dejó de cumplirse (cambios de cantidad/canal)
  useEffect(() => {
    Object.keys(appliedPacks).forEach((pid) => {
      const p = packs.find((x) => x.id === pid);
      const stillValid =
        p && p.active && (!channel || p.channels.includes(channel)) && packTriggered(p);
      if (!stillValid) undoPack(pid);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, channel, packs]);

  const doApplyVolume = useCallback(
    (p: VolumePack) => {
      const net = packNetUnit(p);
      setCart((prev) =>
        prev.map((l) =>
          l.productName === p.product.productKey && !l.isGift
            ? { ...l, pvp: l.pvp ?? l.price, price: net, packId: p.id, discount: 0 }
            : l,
        ),
      );
      setAppliedPacks((prev) => ({ ...prev, [p.id]: { type: "VOLUME" } }));
    },
    [setCart],
  );

  const doApplyBundle = useCallback(
    (p: BundlePack) => {
      const perItem = bundleNetPerItem(p);
      setCart((prev) =>
        prev.map((l) => {
          const match = p.items.find((i) => i.productKey === l.productName);
          if (!match || l.isGift) return l;
          return {
            ...l,
            pvp: l.pvp ?? l.price,
            price: perItem[match.productKey],
            packId: p.id,
            discount: 0,
          };
        }),
      );
      setAppliedPacks((prev) => ({ ...prev, [p.id]: { type: "BUNDLE" } }));
    },
    [setCart],
  );

  const openPVS = useCallback(
    async (p: VolumePack) => {
      setPvsLoading(true);
      try {
        const variants = await getVariantsForProduct(p.product.productKey);
        const dist: Record<string, number> = {};
        cart
          .filter((l) => l.productName === p.product.productKey && !l.isGift)
          .forEach((l) => {
            dist[l.variantId] = (dist[l.variantId] || 0) + l.quantity;
          });
        setPvsOpen({ packId: p.id, productKey: p.product.productKey, variants, dist });
      } finally {
        setPvsLoading(false);
      }
    },
    [cart, getVariantsForProduct],
  );

  const pvsTotal = useCallback(
    (state: PvsState) => Object.values(state.dist).reduce((a, b) => a + b, 0),
    [],
  );

  const pvsChg = useCallback(
    (variantId: string, d: number) => {
      setPvsOpen((prev) => {
        if (!prev) return prev;
        const pack = packs.find((x) => x.id === prev.packId) as VolumePack | undefined;
        if (!pack) return prev;
        const cur = prev.dist[variantId] || 0;
        const total = pvsTotal(prev);
        if (d > 0 && total >= pack.minQty) return prev;
        const variant = prev.variants.find((v) => v.variantId === variantId);
        if (d > 0 && variant && cur >= Math.max(0, variant.availableStock)) return prev;
        return { ...prev, dist: { ...prev.dist, [variantId]: Math.max(0, cur + d) } };
      });
    },
    [packs, pvsTotal],
  );

  const pvsConfirm = useCallback(() => {
    if (!pvsOpen) return;
    const pack = packs.find((x) => x.id === pvsOpen.packId) as VolumePack | undefined;
    if (!pack) return;
    const total = pvsTotal(pvsOpen);
    if (total !== pack.minQty) return false;

    const net = packNetUnit(pack);
    setCart((prev) => {
      const withoutModel = prev.filter((l) => l.productName !== pvsOpen.productKey);
      const newLines: CartItem[] = Object.entries(pvsOpen.dist)
        .filter(([, qty]) => qty > 0)
        .map(([variantId, qty]) => {
          const variant = pvsOpen.variants.find((v) => v.variantId === variantId)!;
          return {
            id: crypto.randomUUID(),
            inventoryItemId: variant.inventoryItemId,
            variantId: variant.variantId,
            productName: variant.productName,
            sku: variant.sku,
            attributes: variant.attributes,
            quantity: qty,
            price: net,
            pvp: variant.price,
            discount: 0,
            packId: pack.id,
          };
        });
      return [...withoutModel, ...newLines];
    });
    setAppliedPacks((prev) => ({ ...prev, [pack.id]: { type: "VOLUME" } }));
    setPvsOpen(null);
    return true;
  }, [pvsOpen, packs, pvsTotal, setCart]);

  const pvsCancel = useCallback(() => setPvsOpen(null), []);

  const applyPack = useCallback(
    (p: Pack) => {
      if (p.type === "VOLUME" && p.variantFree) {
        openPVS(p);
        return;
      }
      if (p.type === "VOLUME") doApplyVolume(p);
      if (p.type === "BUNDLE") doApplyBundle(p);
      if (p.type === "GIFT") setGiftOpen(p.id);
    },
    [openPVS, doApplyVolume, doApplyBundle],
  );

  const chooseGift = useCallback(
    (pid: string, gift: GiftOption) => {
      setCart((prev) => {
        const withoutThisGift = prev.filter((l) => !(l.packId === pid && l.isGift));
        const line: CartItem = {
          id: crypto.randomUUID(),
          inventoryItemId: gift.inventoryItemId,
          variantId: gift.variantId,
          productName: gift.productName,
          sku: gift.sku,
          attributes: gift.attributes,
          quantity: 1,
          price: 0,
          pvp: 0,
          discount: 0,
          packId: pid,
          isGift: true,
          giftValue: gift.value,
        };
        return [...withoutThisGift, line];
      });
      setAppliedPacks((prev) => ({
        ...prev,
        [pid]: { type: "GIFT", giftProductKey: gift.variantId },
      }));
      setGiftOpen(null);
    },
    [setCart],
  );

  const changeGift = useCallback((pid: string) => setGiftOpen(pid), []);
  const giftCancel = useCallback(() => setGiftOpen(null), []);

  return {
    appliedPacks,
    pendingHints,
    activePacksForProduct,
    modelQtyInCart,
    subtotalPayable,
    totalUnits,
    applyPack,
    undoPack,
    pvsOpen,
    pvsLoading,
    pvsTotal: pvsOpen ? pvsTotal(pvsOpen) : 0,
    pvsChg,
    pvsConfirm,
    pvsCancel,
    giftOpen,
    chooseGift,
    changeGift,
    giftCancel,
  };
}
