"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, Package, Percent, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/components/quotations/quotationHelpers";
import { crmError } from "@/services/crmService";
import { buildAiCart, evaluatePromos } from "@/services/crmOrderPanelService";
import {
  useConversationDiscounts,
  useDiscountMutations,
  useStorePolicy,
} from "@/hooks/useCrmOrderPanel";
import type { AiCartResult, EvaluateResponse, StorePolicy } from "@/types/crmOrderPanel";
import { cartLineFromAi, type CartLine } from "./chatQuote";

interface Props {
  conversationId: string;
  storeId: string;
  inventoryId: string;
  cart: CartLine[];
  setCart: (update: (prev: CartLine[]) => CartLine[]) => void;
  /** Deja un texto en la caja del chat (sin enviarlo). */
  onInsertMessage?: (text: string) => void;
  /** Se llama una vez cuando llega la política de la tienda (para precargar el tipo de pago). */
  onPolicy?: (policy: StorePolicy) => void;
  /** «Armar pedido leyendo el chat»: corre «Armar con IA» una vez al tener tienda y almacén. */
  autoAi?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Stock desconocido (combo agregado desde la promo): Core lo valida al crear el enlace. */
const UNKNOWN_STOCK = Number.MAX_SAFE_INTEGER;

/**
 * Herramientas del panel de pedido (auditoría filas 23 y 24): la IA arma el
 * carrito desde el chat, sugiere promos por cantidad y combos, aplica
 * descuentos dentro del tope de la tienda (si pasa el tope, pide permiso al
 * supervisor) y deja el texto de la promo en el chat.
 */
export default function ArmarPedidoTools({
  conversationId,
  storeId,
  inventoryId,
  cart,
  setCart,
  onInsertMessage,
  onPolicy,
  autoAi = false,
}: Props) {
  const policyQ = useStorePolicy(storeId, !!storeId);
  const policy = policyQ.data;
  const discountsQ = useConversationDiscounts(conversationId);
  const { request } = useDiscountMutations(conversationId);

  const [ai, setAi] = useState<AiCartResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [promo, setPromo] = useState<EvaluateResponse | null>(null);
  const [percent, setPercent] = useState("");
  const [reason, setReason] = useState("");
  // Precio de lista de cada línea: los descuentos siempre se calculan sobre él.
  const basePrice = useRef(new Map<string, number>());
  const [lineDiscount, setLineDiscount] = useState<Record<string, number>>({});
  const policySent = useRef(false);

  for (const l of cart) {
    if (!basePrice.current.has(l.productVariantId)) basePrice.current.set(l.productVariantId, l.unitPrice);
  }

  useEffect(() => {
    if (policy && !policySent.current) {
      policySent.current = true;
      onPolicy?.(policy);
    }
  }, [policy, onPolicy]);

  const autoAiDone = useRef(false);
  useEffect(() => {
    // Sin almacén no se conoce el stock: espera a que se elija.
    if (autoAi && storeId && inventoryId && !autoAiDone.current) {
      autoAiDone.current = true;
      void armarConIa();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAi, storeId, inventoryId]);

  // Promos y combos se recalculan cuando cambia el carrito (cantidad o líneas).
  const cartKey = cart.map((l) => `${l.productVariantId}:${l.quantity}`).join("|");
  useEffect(() => {
    if (!storeId || cart.length === 0) {
      setPromo(null);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      evaluatePromos({
        storeId,
        lines: cart.map((l) => ({
          productVariantId: l.productVariantId,
          name: l.name,
          quantity: Number.isFinite(l.quantity) ? l.quantity : 0,
          unitPrice: basePrice.current.get(l.productVariantId) ?? l.unitPrice,
        })),
      })
        .then((r) => active && setPromo(r))
        .catch(() => active && setPromo(null));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, cartKey]);

  /** Aplica `pct` a las líneas indicadas sobre su precio de lista. */
  function applyPercent(ids: string[], pct: number) {
    const set = new Set(ids);
    setLineDiscount((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = pct;
      return next;
    });
    setCart((prev) =>
      prev.map((l) => {
        if (!set.has(l.productVariantId)) return l;
        const base = basePrice.current.get(l.productVariantId) ?? l.unitPrice;
        return { ...l, unitPrice: round2(base * (1 - pct / 100)) };
      }),
    );
  }

  function clearDiscounts() {
    setLineDiscount({});
    setCart((prev) =>
      prev.map((l) => ({ ...l, unitPrice: basePrice.current.get(l.productVariantId) ?? l.unitPrice })),
    );
  }

  async function armarConIa() {
    if (!storeId) return toast.error("Elige la tienda primero.");
    setAiLoading(true);
    try {
      const r = await buildAiCart(conversationId, { storeId, ...(inventoryId ? { inventoryId } : {}) });
      setAi(r);
      if (r.lines.length === 0) {
        toast.info("La IA no encontró productos del catálogo en el chat.");
        return;
      }
      setCart((prev) => {
        const next = [...prev];
        for (const l of r.lines) {
          basePrice.current.set(l.productVariantId, l.unitPrice);
          const i = next.findIndex((x) => x.productVariantId === l.productVariantId);
          const line = cartLineFromAi(l);
          if (i >= 0) next[i] = { ...next[i], quantity: l.quantity, stock: line.stock };
          else next.push(line);
        }
        return next;
      });
      toast.success(`IA armó ${r.lines.length} línea(s). Revisa antes de crear el enlace.`);
    } catch (e) {
      toast.error(crmError(e).message);
    } finally {
      setAiLoading(false);
    }
  }

  function addCombo(bundleId: string) {
    const combo = promo?.combos.find((c) => c.bundleId === bundleId);
    const bundle = promo?.bundles.find((b) => b.id === bundleId);
    if (!combo || !bundle) return;
    const missing = combo.missing.filter((m) => m.variantId);
    if (missing.length < combo.missing.length) {
      toast.error("Algún producto del combo no tiene variante en Core: agrégalo desde el catálogo.");
    }
    setCart((prev) => {
      const next = [...prev];
      for (const m of missing) {
        const id = m.variantId as string;
        if (next.some((l) => l.productVariantId === id)) continue;
        basePrice.current.set(id, Number(m.price));
        next.push({
          productVariantId: id,
          name: m.productName,
          variant: "",
          sku: m.sku ?? "",
          unitPrice: Number(m.price),
          quantity: 1,
          stock: UNKNOWN_STOCK,
        });
      }
      return next;
    });
  }

  /** Reparte el precio del combo entre sus productos ya presentes en el carrito. */
  function applyComboPrice(bundleId: string) {
    const combo = promo?.combos.find((c) => c.bundleId === bundleId);
    const bundle = promo?.bundles.find((b) => b.id === bundleId);
    if (!combo || !bundle || combo.listPrice <= 0) return;
    const pct = round2((1 - combo.packPrice / combo.listPrice) * 100);
    const ids = cart
      .filter((l) =>
        bundle.items.some((it) => it.variantId === l.productVariantId || (it.productName && l.name.startsWith(it.productName))),
      )
      .map((l) => l.productVariantId);
    applyPercent(ids, pct);
    toast.success(`Precio de combo «${combo.name}» aplicado.`);
  }

  async function discount() {
    const pct = Number(percent);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return toast.error("Ingresa un descuento entre 1 y 99 %.");
    const r = await request.mutateAsync({ percent: pct, storeId, ...(reason.trim() ? { reason: reason.trim() } : {}) });
    if (r.approved) {
      applyPercent(
        cart.map((l) => l.productVariantId),
        pct,
      );
      toast.success(`Descuento de ${pct} % aplicado.`);
    } else {
      toast.info(`Pasa el tope de ${r.cap} %: se pidió permiso al supervisor.`);
    }
  }

  const approvedPending = (discountsQ.data ?? []).find(
    (d) => d.status === "aprobado" && !Object.values(lineDiscount).includes(Number(d.percent)),
  );
  const waiting = (discountsQ.data ?? []).find((d) => d.status === "pendiente");
  const listTotal = cart.reduce(
    (s, l) => s + (basePrice.current.get(l.productVariantId) ?? l.unitPrice) * (l.quantity || 0),
    0,
  );
  const total = cart.reduce((s, l) => s + l.unitPrice * (l.quantity || 0), 0);
  const saving = round2(listTotal - total);

  return (
    <section aria-label="Herramientas del pedido" className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={aiLoading || !storeId} onClick={armarConIa}>
          {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />} Armar con IA
        </Button>
        {policy?.promoText && onInsertMessage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              onInsertMessage(policy.promoText);
              toast.success("Promo lista en la caja del chat.");
            }}
          >
            <Megaphone /> Enviar promo
          </Button>
        )}
        {ai && (
          <Badge variant="secondary" data-testid="ai-source">
            {ai.source === "ai" ? `IA${ai.model ? ` · ${ai.model}` : ""}` : "Lector local (sin llave de IA)"}
          </Badge>
        )}
        {policy && (
          <span className="text-xs text-muted-foreground">
            Envío: {policy.shipCharge > 0 ? money(policy.shipCharge) : "gratis"} · Tope de descuento {policy.discountCap} %
          </span>
        )}
      </div>
      {ai?.warning && <p className="text-xs text-muted-foreground">{ai.warning}</p>}
      {ai && ai.lines.length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted-foreground" aria-label="Lo que leyó la IA">
          {ai.lines.map((l) => (
            <li key={l.productVariantId}>
              {l.quantity} × {l.name}
              {l.evidence ? ` — «${l.evidence}»` : ""}
            </li>
          ))}
        </ul>
      )}

      {promo && (promo.quantityHits.length > 0 || promo.combos.length > 0) && (
        <div className="space-y-1.5" aria-label="Promos sugeridas">
          {promo.quantityHits.map((h) => (
            <div key={h.label} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <span>
                <Percent className="mr-1 inline h-3.5 w-3.5" />
                {h.label} · ahorra {money(h.saving)}
              </span>
              <Button type="button" size="sm" variant="outline" onClick={() => applyPercent(h.productVariantIds, h.percent)}>
                Aplicar
              </Button>
            </div>
          ))}
          {promo.combos.map((c) => (
            <div key={c.bundleId} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-xs">
              <span>
                <Package className="mr-1 inline h-3.5 w-3.5" />
                Combo {c.name}: {money(c.packPrice)} (antes {money(c.listPrice)}) · tienes {c.inCart} de {c.total}
              </span>
              {c.missing.length > 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={() => addCombo(c.bundleId)}>
                  Agregar combo
                </Button>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => applyComboPrice(c.bundleId)}>
                  Aplicar precio
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {promo?.source === "local" && promo.warning && (
        <p className="text-xs text-muted-foreground">{promo.warning}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-[110px_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label htmlFor="armar-descuento" className="text-xs">
            Descuento (%)
          </Label>
          <Input
            id="armar-descuento"
            type="number"
            min={1}
            max={99}
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder={policy ? `Hasta ${policy.discountCap}` : ""}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="armar-descuento-motivo" className="text-xs">
            Motivo (si pasa el tope)
          </Label>
          <Input id="armar-descuento-motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex gap-1">
          <Button type="button" size="sm" disabled={cart.length === 0 || request.isPending} onClick={discount}>
            {request.isPending && <Loader2 className="animate-spin" />} Aplicar
          </Button>
          {saving > 0 && (
            <Button type="button" size="sm" variant="ghost" aria-label="Quitar descuentos" onClick={clearDiscounts}>
              <Undo2 />
            </Button>
          )}
        </div>
      </div>
      {waiting && (
        <p className="text-xs text-muted-foreground" role="status">
          Esperando al supervisor: {waiting.percent} % de descuento.
        </p>
      )}
      {approvedPending && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 p-2 text-xs">
          <span>
            {approvedPending.decidedByName ?? "El supervisor"} autorizó {approvedPending.percent} % de descuento.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              applyPercent(
                cart.map((l) => l.productVariantId),
                Number(approvedPending.percent),
              )
            }
          >
            Aplicar autorizado
          </Button>
        </div>
      )}
      {saving > 0 && (
        <p className="text-xs font-medium" data-testid="armar-ahorro">
          Precio de lista {money(listTotal)} · ahorro {money(saving)}
        </p>
      )}
    </section>
  );
}
