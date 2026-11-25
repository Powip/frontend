"use client";

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { canSeeProductCosts } from "@/config/permissions.config";
import { useReconciliationVariantSearch } from "@/hooks/useReconciliationVariantSearch";
import { useReconciliationStockByVariants } from "@/hooks/useReconciliationStockByVariants";
import { getReconciliationTaskErrorMessage } from "@/services/reconciliationTask.service";
import type { VariantStock } from "@/services/inventoryItems.service";
import {
  createUnification,
  type UnificationHistoryItem,
  type UnificationStockMode,
} from "@/services/unification.service";
import { ChannelBadge, KindBadge, ProductThumb } from "@/components/catalog/CatalogBadges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProductKind } from "@/lib/catalog/catalogProducts";
import { cn } from "@/lib/utils";
import {
  COUNT_MULTI_WAREHOUSE_MESSAGE,
  buildMergeWarehouses,
  countAllowed,
  formatMoney,
  parseCountedQuantity,
  type MergeStockSides,
} from "./mergeStockCost";
import {
  isSerializedTracking,
  pickFromSearch,
  unificationWarnings,
  validateUnificationStock,
  variantDisplayLabel,
  type UnificationPick,
} from "./unificationRules";

// FEAT-24 H11 (H11-D2) — «Unificar manualmente» del mockup uni.html: unir dos
// variantes cualesquiera de la empresa con `POST /unifications`. Tres pasos:
// elegir (buscador seguro, nunca un UUID pegado) con la vista previa lado a
// lado, elegir qué pasa con el stock y confirmar sabiendo que no se deshace.
// La vista previa sale del mismo buscador (`variant-search` trae foto, tipo,
// canal e IMEI/serie desde H11); no se pide `GET /product-variant/:id`.

type Step = "elegir" | "stock" | "confirmar";

const STEP_TITLES: Record<Step, string> = {
  elegir: "Paso 1 de 3 · Elige las dos variantes",
  stock: "Paso 2 de 3 · ¿Qué pasa con el stock?",
  confirmar: "Paso 3 de 3 · Confirma la unificación",
};

const asKind = (type: string | null | undefined): ProductKind | null =>
  type === "simple" || type === "variantes" || type === "pack" ? type : null;

const skuOf = (pick: UnificationPick) => pick.company_sku || pick.sku || "Sin SKU";

/** Dato que el buscador no mandó (backend anterior a H11). */
function Unknown({ label }: { label: string }) {
  return <span className="text-xs text-muted-foreground">{label} —</span>;
}

function StepTitle({ n, children }: { n: number; children: ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>
      {children}
    </p>
  );
}

function VariantSearchList({ title, onPick }: { title: string; onPick: (pick: UnificationPick) => void }) {
  const [query, setQuery] = useState("");
  const search = useReconciliationVariantSearch(query);
  const message = search.isError
    ? getReconciliationTaskErrorMessage(search.error, "No se pudieron buscar variantes")
    : !search.isSearchable
      ? "Escribe al menos 2 caracteres para buscar."
      : search.isLoading
        ? "Buscando…"
        : search.results.length === 0
          ? "No se encontraron variantes."
          : null;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={`Buscar ${title}`}
          placeholder="Buscar por nombre o SKU…"
          className="pl-9"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="max-h-60 overflow-auto rounded-md border">
        {message ? (
          <p className="px-3 py-6 text-center text-xs italic text-muted-foreground">{message}</p>
        ) : (
          search.results.map((result) => (
            <button
              key={result.variant_id}
              type="button"
              className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-b-0 hover:bg-primary/5"
              onClick={() => onPick(pickFromSearch(result))}
            >
              <span className="text-sm font-medium">{result.product_name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">SKU: {result.company_sku || result.sku || "Sin SKU"}</span>
              <span className="text-[11px] text-muted-foreground">{variantDisplayLabel(result.attribute_values)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function VariantCard({
  pick,
  stock,
  stockLoaded,
  showCost,
}: {
  pick: UnificationPick;
  stock: VariantStock | undefined;
  stockLoaded: boolean;
  showCost: boolean;
}) {
  const kind = asKind(pick.product_type);
  return (
    <div className="flex gap-3 rounded-md border bg-background p-3">
      <ProductThumb src={pick.image_url} name={pick.product_name} size={56} />
      <div className="min-w-0 space-y-1 text-sm">
        <p className="font-medium">{pick.product_name}</p>
        <p className="font-mono text-xs text-muted-foreground">SKU: {skuOf(pick)}</p>
        <p className="text-xs text-muted-foreground">{variantDisplayLabel(pick.attribute_values)}</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {kind ? <KindBadge kind={kind} /> : <Unknown label="Tipo" />}
          {pick.external_source === undefined ? <Unknown label="Canal" /> : <ChannelBadge source={pick.external_source} />}
          {pick.tracking_mode === undefined ? (
            <Unknown label="Seguimiento" />
          ) : isSerializedTracking(pick.tracking_mode) ? (
            <Badge variant="outline" className="border-primary/25 bg-primary/5 text-primary">IMEI o serie</Badge>
          ) : null}
          {pick.is_active === false ? <Badge variant="outline">Desactivada</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Stock hoy{" "}
          <span className="font-semibold text-foreground">
            {stockLoaded ? `${stock?.quantity ?? 0} (${stock?.reserved_quantity ?? 0} reservado)` : "—"}
          </span>
          {showCost && pick.cost !== undefined && pick.cost !== null ? (
            <>
              {" · "}Costo <span className="font-semibold text-foreground">{formatMoney(pick.cost)}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function StockOption({
  value,
  current,
  title,
  explanation,
  disabled,
  onChange,
  children,
}: {
  value: UnificationStockMode;
  current: UnificationStockMode | null;
  title: string;
  explanation: string;
  disabled?: boolean;
  onChange: (mode: UnificationStockMode) => void;
  children?: ReactNode;
}) {
  const checked = current === value;
  return (
    <div className={cn("rounded-lg border p-3", checked && "border-primary bg-primary/5", disabled && "opacity-60")}>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="radio"
          name="unification-stock-mode"
          className="mt-1 h-4 w-4 accent-primary"
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(value)}
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-semibold">{title}</span>
          <span className="block text-xs text-muted-foreground">{explanation}</span>
        </span>
      </label>
      {children}
    </div>
  );
}

export interface ManualUnificationDialogProps {
  open: boolean;
  /** «Unir a…» desde «Por unificar»: la variante que se une ya viene elegida. */
  initialOrigin?: UnificationPick | null;
  onClose: () => void;
  onUnified: (result: UnificationHistoryItem) => void | Promise<void>;
}

export function ManualUnificationDialog({ open, initialOrigin = null, onClose, onUnified }: ManualUnificationDialogProps) {
  const { auth } = useAuth();
  const showCost = canSeeProductCosts(auth?.user);
  const [step, setStep] = useState<Step>("elegir");
  const [target, setTarget] = useState<UnificationPick | null>(null);
  const [origin, setOrigin] = useState<UnificationPick | null>(initialOrigin);
  const [stockMode, setStockMode] = useState<UnificationStockMode | null>(null);
  const [countedRaw, setCountedRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const bothPicked = Boolean(target && origin);
  const stockQuery = useReconciliationStockByVariants(bothPicked ? [target!.variant_id, origin!.variant_id] : []);
  const stockById = new Map((stockQuery.data ?? []).map((row) => [row.variant_id, row]));
  const targetStock = target ? stockById.get(target.variant_id) : undefined;
  const originStock = origin ? stockById.get(origin.variant_id) : undefined;
  const stockLoaded = stockQuery.isSuccess;
  const warehouseRows = buildMergeWarehouses(targetStock, originStock);
  const sides: MergeStockSides = {
    winnerQuantity: targetStock?.quantity ?? 0,
    winnerReserved: targetStock?.reserved_quantity ?? 0,
    loserQuantity: originStock?.quantity ?? 0,
    loserReserved: originStock?.reserved_quantity ?? 0,
    warehouseCount: warehouseRows.length,
  };
  const canCount = !stockLoaded || countAllowed(sides);
  // El stock pasó a estar en varios almacenes con «Contar ahora» elegido: se descarta la elección.
  if (stockMode === "count" && !canCount) {
    setStockMode(null);
    setCountedRaw("");
  }
  const check = validateUnificationStock(stockMode, countedRaw, stockLoaded ? { sides, rows: warehouseRows } : null);
  const warnings = unificationWarnings(origin, target);

  const resetStock = () => {
    setStockMode(null);
    setCountedRaw("");
    setServerError(null);
  };

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async () => {
    if (!origin || !target || !stockMode || !check.valid) return;
    const counted = parseCountedQuantity(countedRaw);
    if (stockMode === "count" && counted === null) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await createUnification({
        originVariantId: origin.variant_id,
        targetVariantId: target.variant_id,
        stockMode,
        ...(stockMode === "count" && counted !== null ? { countedQuantity: counted } : {}),
      });
      toast.success(`«${origin.product_name}» se unió a «${target.product_name}».`);
      await onUnified(result);
      onClose();
    } catch (error) {
      const message = getReconciliationTaskErrorMessage(error, "No se pudo unificar. Intenta de nuevo.");
      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const finalText = stockMode === "count"
    ? `${parseCountedQuantity(countedRaw) ?? "—"} (conteo físico)`
    : stockLoaded && check.finalQuantity !== null
      ? String(check.finalQuantity)
      : "—";

  // FEAT-24 C-D2: quedan reservas sin stock; avisa, no bloquea.
  const stockWarning = check.warning ? (
    <p role="status" className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {check.warning}
    </p>
  ) : null;

  const warningList = warnings.length > 0 ? (
    <div role="status" className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      {warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {warning}
        </p>
      ))}
      <p className="text-amber-800/80 dark:text-amber-200/80">Puedes seguir: el servidor revisa la unificación y te dirá si no se puede.</p>
    </div>
  ) : null;

  const column = (
    n: number,
    title: string,
    pick: UnificationPick | null,
    stock: VariantStock | undefined,
    setPick: (pick: UnificationPick | null) => void,
  ) => (
    <div className="min-w-0">
      <StepTitle n={n}>{title}</StepTitle>
      {pick ? (
        <div className="space-y-2">
          <VariantCard pick={pick} stock={stock} stockLoaded={stockLoaded} showCost={showCost} />
          <Button type="button" variant="ghost" size="sm" aria-label={`Cambiar ${title}`} onClick={() => { setPick(null); resetStock(); }}>
            Cambiar
          </Button>
        </div>
      ) : (
        <VariantSearchList title={title} onPick={(next) => { setPick(next); resetStock(); }} />
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <DialogContent className="flex max-h-[90vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b px-6 py-4 text-left">
          <DialogTitle>Unificar manualmente</DialogTitle>
          <DialogDescription>
            Une dos variantes aunque tengan otro nombre o SKU. La que se une queda desactivada y todo pasa a la variante madre.
          </DialogDescription>
          <p className="pt-1 text-xs font-medium text-muted-foreground">{STEP_TITLES[step]}</p>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {step === "elegir" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {column(1, "Variante madre (se queda)", target, targetStock, setTarget)}
                {column(2, "Variante que se une", origin, originStock, setOrigin)}
              </div>
              <p className="rounded-md bg-primary/5 px-3 py-2 text-xs text-foreground">
                {target && origin
                  ? `«${origin.product_name}» (${skuOf(origin)}) se unirá a «${target.product_name}» (${skuOf(target)}). En el siguiente paso eliges qué pasa con el stock.`
                  : "Elige las dos variantes. Pueden tener nombre y SKU distintos, pero la talla, el color y las demás opciones tienen que coincidir."}
              </p>
              {warningList}
            </>
          ) : null}

          {step === "stock" && target && origin ? (
            <div className="space-y-3">
              <p className="text-sm">
                «{origin.product_name}» se une a «{target.product_name}». Elige con qué stock queda la variante madre.
              </p>
              {stockQuery.isError ? (
                <p className="text-xs text-muted-foreground">No se pudo leer el stock de las dos variantes; igual puedes elegir y el servidor lo valida.</p>
              ) : null}
              <StockOption
                value="winner"
                current={stockMode}
                onChange={setStockMode}
                title={`Quedarse con el stock de la madre${stockLoaded ? ` (${sides.winnerQuantity})` : ""}`}
                explanation="La madre conserva el stock que ya tiene; las unidades de la que se une no se suman."
              />
              <StockOption
                value="sum"
                current={stockMode}
                onChange={setStockMode}
                title={`Sumar ambos${stockLoaded ? ` (${sides.winnerQuantity + sides.loserQuantity})` : ""}`}
                explanation="El stock de las dos variantes queda junto en la madre."
              />
              <StockOption
                value="count"
                current={stockMode}
                onChange={setStockMode}
                disabled={!canCount}
                title="Contar ahora"
                explanation={canCount ? "Cuenta las unidades físicas y escribe el total: ese número queda como stock de la madre." : COUNT_MULTI_WAREHOUSE_MESSAGE}
              >
                {stockMode === "count" ? (
                  <div className="mt-2 pl-6">
                    <label className="text-xs text-muted-foreground" htmlFor="unification-counted-quantity">
                      Cantidad contada (de 0 a 10,000)
                    </label>
                    <Input
                      id="unification-counted-quantity"
                      inputMode="numeric"
                      className="mt-1 w-40"
                      value={countedRaw}
                      onChange={(event) => setCountedRaw(event.target.value)}
                    />
                  </div>
                ) : null}
              </StockOption>
              {stockLoaded && sides.loserReserved > 0 ? (
                <p className="text-xs text-muted-foreground">Reservas que pasan a la madre: {sides.loserReserved}</p>
              ) : null}
              {check.error ? <p role="alert" className="text-xs font-medium text-destructive">{check.error}</p> : null}
              {stockWarning}
            </div>
          ) : null}

          {step === "confirmar" && target && origin && stockMode ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <p>
                  <span className="font-semibold">«{origin.product_name}»</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">({skuOf(origin)})</span> se une a{" "}
                  <span className="font-semibold">«{target.product_name}»</span>{" "}
                  <span className="font-mono text-xs text-muted-foreground">({skuOf(target)})</span>.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Stock de la madre: {stockLoaded ? sides.winnerQuantity : "—"} → <span className="font-semibold text-foreground">{finalText}</span>
                </p>
              </div>
              {stockWarning}
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>La variante que se une queda desactivada y unida a la madre.</li>
                <li>Sus reservas, pedidos abiertos y vínculos con los canales pasan a la madre, y sus próximas ventas descuentan de ella.</li>
                <li>Queda registrada en el Historial con tu usuario.</li>
              </ul>
              {warningList}
              <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2">
                <p className="font-semibold text-destructive">Esta unificación no se puede deshacer.</p>
                <p className="text-xs text-muted-foreground">
                  Si algo queda mal, se corrige con un ajuste de stock; la variante no se vuelve a separar.
                </p>
              </div>
              {serverError ? <p role="alert" className="rounded-md border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive">{serverError}</p> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3">
          {step === "elegir" ? (
            <>
              <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
              <Button type="button" disabled={!bothPicked} onClick={() => setStep("stock")}>
                Continuar <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          ) : null}
          {step === "stock" ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep("elegir")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Volver
              </Button>
              <Button type="button" disabled={!check.valid} onClick={() => { setServerError(null); setStep("confirmar"); }}>
                Vista previa <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          ) : null}
          {step === "confirmar" ? (
            <>
              <Button type="button" variant="outline" disabled={submitting} onClick={() => setStep("stock")}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Volver
              </Button>
              <Button type="button" variant="destructive" disabled={submitting || !check.valid} onClick={() => void submit()}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Aplicar unificación
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
