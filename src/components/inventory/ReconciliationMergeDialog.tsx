"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/buttonVariant";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  ReconciliationTask,
  ReconciliationTaskDetailCandidate,
  ReconciliationTaskItem,
  getReconciliationTaskErrorMessage,
  resolveReconciliationMerge,
} from "@/services/reconciliationTask.service";
import { VariantStock } from "@/services/inventoryItems.service";
import { useReconciliationTaskDetails } from "@/hooks/useReconciliationTaskDetails";
import { useReconciliationStockByVariants } from "@/hooks/useReconciliationStockByVariants";
import { ReconciliationSourceChip } from "./ReconciliationSourceChip";

type MergeStep = "select" | "preview";

interface ReconciliationMergeDialogProps {
  // Tarea `type: 'duplicate_cluster'` a resolver. `null` cierra el diálogo —
  // se renderiza como diálogo controlado (en vez de dueño de su propio
  // trigger) para poder abrirse desde el botón "Revisar y unificar" de cada
  // card del cluster en `ReconciliationTab`.
  task: ReconciliationTask | null;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
}

function formatMoney(value: number | null | undefined): string {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return "S/ 0.00";
  }
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(numeric);
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function AttributeBadges({
  attributes,
}: {
  attributes: Record<string, string>;
}) {
  const values = Object.values(attributes).filter(Boolean);
  if (values.length === 0) return null;
  return (
    <>
      {values.map((value, index) => (
        <Badge
          key={`${value}-${index}`}
          variant="secondary"
          className="text-[10px] font-normal"
        >
          {value}
        </Badge>
      ))}
    </>
  );
}

interface CandidateCardProps {
  item: ReconciliationTaskItem;
  detail: ReconciliationTaskDetailCandidate | undefined;
  stock: VariantStock | undefined;
  stockByVariantId: Map<string, VariantStock>;
  isStockLoading: boolean;
  isStockError: boolean;
  isSelected: boolean;
  isSubmitting: boolean;
  isExpanded: boolean;
  onSelect: (variantId: string) => void;
  onToggleExpand: (key: string) => void;
}

function CandidateCard({
  item,
  detail,
  stock,
  stockByVariantId,
  isStockLoading,
  isStockError,
  isSelected,
  isSubmitting,
  isExpanded,
  onSelect,
  onToggleExpand,
}: CandidateCardProps) {
  const cardKey = item.variant_id ?? item.variant_name;
  const product = detail?.product ?? null;
  const productName = product?.name ?? item.variant_name;
  const attributeValues = detail?.variant.attribute_values ?? item.attribute_values ?? {};
  const sku = detail?.variant.sku ?? item.sku ?? item.company_sku ?? "Sin SKU";
  const initials = getInitials(productName);

  const stockText = isStockLoading
    ? "cargando…"
    : isStockError
      ? "—"
      : `${stock?.quantity ?? 0} (${stock?.reserved_quantity ?? 0} reservado)`;

  const statParts = [
    product
      ? `${product.variants.length} variante${product.variants.length === 1 ? "" : "s"}`
      : null,
    `stock ${stockText}`,
    detail ? `precio ${formatMoney(detail.variant.price)}` : null,
  ].filter((part): part is string => !!part);

  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-lg border-2 p-4 transition-colors",
        isSubmitting && "pointer-events-none opacity-60",
        isSelected
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/30",
      )}
      onClick={() => item.variant_id && onSelect(item.variant_id)}
    >
      <input
        type="radio"
        name="reconciliation-merge-winner"
        className="absolute top-4 right-4 h-4 w-4 accent-primary"
        checked={isSelected}
        disabled={isSubmitting}
        onChange={() => item.variant_id && onSelect(item.variant_id)}
        aria-label={`Elegir "${productName}" como la que queda en Powip`}
      />

      <div className="flex items-center justify-between pr-6">
        <span
          className={cn(
            "text-[11px] font-semibold tracking-wide uppercase",
            isSelected ? "text-primary" : "text-muted-foreground",
          )}
        >
          {isSelected ? "Queda en Powip" : "Se fusiona"}
        </span>
        {item.is_suggested_winner && (
          <Badge className="bg-emerald-600 hover:bg-emerald-600">
            Sugerida
          </Badge>
        )}
      </div>

      <div className="flex items-start gap-3">
        {product?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={productName}
            className="h-12 w-12 shrink-0 rounded-md border object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold" title={productName}>
            {productName}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <ReconciliationSourceChip source={item.source} />
            <AttributeBadges attributes={attributeValues} />
          </div>
        </div>
      </div>

      <span className="font-mono text-xs text-muted-foreground">
        SKU: {sku}
      </span>

      <p className="text-xs text-muted-foreground">
        {statParts.length > 0
          ? statParts.join(" · ")
          : `${Math.round(item.confidence * 100)}% confianza`}
      </p>

      {product && (
        <button
          type="button"
          className="flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpand(cardKey);
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Ocultar detalle
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Ver detalle
            </>
          )}
        </button>
      )}

      {isExpanded && product && (
        <div
          className="space-y-3 rounded-md border bg-muted/20 p-3 text-xs"
          onClick={(event) => event.stopPropagation()}
        >
          {product.description && (
            <p className="line-clamp-3 text-muted-foreground">
              {product.description}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
            <span>
              <strong className="text-foreground">Marca:</strong>{" "}
              {product.brand?.name ?? "—"}
            </span>
            <span>
              <strong className="text-foreground">Categoría:</strong>{" "}
              {product.category?.name ?? "—"}
              {product.subcategory?.name
                ? ` › ${product.subcategory.name}`
                : ""}
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-7 px-2 text-[10px]">
                  Atributos
                </TableHead>
                <TableHead className="h-7 px-2 text-[10px]">SKU</TableHead>
                <TableHead className="h-7 px-2 text-right text-[10px]">
                  Precio
                </TableHead>
                <TableHead className="h-7 px-2 text-right text-[10px]">
                  Stock
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.variants.map((variant) => {
                const variantStock = stockByVariantId.get(variant.id);
                const isThisVariant =
                  variant.id === (detail?.variant.id ?? item.variant_id);
                return (
                  <TableRow
                    key={variant.id}
                    className={isThisVariant ? "bg-primary/5" : undefined}
                  >
                    <TableCell className="px-2 py-1 whitespace-normal">
                      {Object.values(variant.attribute_values)
                        .filter(Boolean)
                        .join(" · ") || "—"}
                      {isThisVariant && (
                        <Badge variant="outline" className="ml-1 text-[9px]">
                          Esta variante
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-2 py-1 font-mono">
                      {variant.sku ?? variant.company_sku ?? "—"}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right">
                      {formatMoney(variant.price)}
                    </TableCell>
                    <TableCell className="px-2 py-1 text-right">
                      {isStockLoading
                        ? "…"
                        : isStockError
                          ? "—"
                          : (variantStock?.quantity ?? 0)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function ReconciliationMergeDialog({
  task,
  onClose,
  onSuccess,
}: ReconciliationMergeDialogProps) {
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<MergeStep>("select");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Preselecciona la ganadora sugerida por el backend (heurística: origen
  // manual > variante más antigua). Si el cluster no trae ninguna marcada
  // (no debería pasar), cae al primer candidato. También resetea el paso y
  // las tarjetas expandidas cada vez que se abre un cluster distinto.
  useEffect(() => {
    if (!task) {
      setSelectedWinnerId("");
      setStep("select");
      setExpandedIds(new Set());
      return;
    }
    const suggested = task.items.find((item) => item.is_suggested_winner);
    const fallback = task.items[0];
    setSelectedWinnerId((suggested ?? fallback)?.variant_id ?? "");
    setStep("select");
    setExpandedIds(new Set());
  }, [task]);

  const detailsQuery = useReconciliationTaskDetails(task?.id ?? null);

  const candidates = useMemo(
    () => detailsQuery.data?.candidates ?? [],
    [detailsQuery.data],
  );

  const candidateByVariantId = useMemo(() => {
    const map = new Map<string, ReconciliationTaskDetailCandidate>();
    candidates.forEach((candidate) => map.set(candidate.variant_id, candidate));
    return map;
  }, [candidates]);

  // Stock de TODAS las variantes de los productos candidatos (no sólo las
  // candidatas del cluster) para poder mostrar la mini-tabla de variantes
  // hermanas dentro del detalle expandible. Si `details` falló, cae al
  // conjunto básico de variantes del propio cluster (`task.items`).
  const variantIdsForStock = useMemo(() => {
    if (detailsQuery.isSuccess) {
      const ids = new Set<string>();
      candidates.forEach((candidate) => {
        if (candidate.product && candidate.product.variants.length > 0) {
          candidate.product.variants.forEach((variant) => ids.add(variant.id));
        } else {
          ids.add(candidate.variant_id);
        }
      });
      return Array.from(ids);
    }
    if (detailsQuery.isError) {
      return (task?.items ?? [])
        .map((item) => item.variant_id)
        .filter((id): id is string => id !== null);
    }
    return [];
  }, [detailsQuery.isSuccess, detailsQuery.isError, candidates, task]);

  const stockQuery = useReconciliationStockByVariants(variantIdsForStock);

  const stockByVariantId = useMemo(() => {
    const map = new Map<string, VariantStock>();
    (stockQuery.data ?? []).forEach((stock) => map.set(stock.variant_id, stock));
    return map;
  }, [stockQuery.data]);

  if (!task) return null;

  const toggleExpand = (key: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const suggestedItem =
    task.items.find((item) => item.is_suggested_winner) ?? task.items[0];
  const suggestedDetail = suggestedItem?.variant_id
    ? candidateByVariantId.get(suggestedItem.variant_id)
    : undefined;
  const suggestedName =
    suggestedDetail?.product?.name ?? suggestedItem?.variant_name ?? "producto";

  const winnerItem = task.items.find(
    (item) => item.variant_id === selectedWinnerId,
  );
  const winnerDetail = selectedWinnerId
    ? candidateByVariantId.get(selectedWinnerId)
    : undefined;
  const winnerStock = selectedWinnerId
    ? stockByVariantId.get(selectedWinnerId)
    : undefined;
  const winnerName =
    winnerDetail?.product?.name ?? winnerItem?.variant_name ?? "—";
  const winnerSku =
    winnerDetail?.variant.sku ??
    winnerItem?.sku ??
    winnerItem?.company_sku ??
    "Sin SKU";
  const winnerAttributeValues =
    winnerDetail?.variant.attribute_values ?? winnerItem?.attribute_values ?? {};

  const loserItems = task.items.filter(
    (item) => item.variant_id !== null && item.variant_id !== selectedWinnerId,
  );

  // `stockQuery` queda `enabled: false` mientras `details` no resolvió los
  // ids de variantes a pedir — en ese estado `isLoading` e `isError` son
  // ambos `false` (todavía no hay fetch en curso), así que usar `isSuccess`
  // es la única forma correcta de saber si el stock ya llegó completo.
  const hasFullStock = stockQuery.isSuccess;
  // Cubre tanto el fetch en curso como el estado "pending" por `enabled:
  // false" (a la espera de `details`). Se usa en la vista previa para no
  // mostrar "0 → 0" como si fuera un dato real mientras todavía se está
  // calculando.
  const isCalculatingStock = detailsQuery.isPending || stockQuery.isPending;
  const stockBefore = winnerStock?.quantity ?? 0;
  const reservedBefore = winnerStock?.reserved_quantity ?? 0;
  const stockAfter = hasFullStock
    ? stockBefore +
      loserItems.reduce((sum, loserItem) => {
        const loserStock = loserItem.variant_id
          ? stockByVariantId.get(loserItem.variant_id)
          : undefined;
        return sum + (loserStock?.quantity ?? 0);
      }, 0)
    : null;
  const reservedAfter = hasFullStock
    ? reservedBefore +
      loserItems.reduce((sum, loserItem) => {
        const loserStock = loserItem.variant_id
          ? stockByVariantId.get(loserItem.variant_id)
          : undefined;
        return sum + (loserStock?.reserved_quantity ?? 0);
      }, 0)
    : null;

  const handleConfirm = async () => {
    if (!selectedWinnerId) return;

    const loserVariantIds = task.items
      .map((item) => item.variant_id)
      .filter(
        (variantId): variantId is string =>
          variantId !== null && variantId !== selectedWinnerId,
      );

    setIsSubmitting(true);
    try {
      await resolveReconciliationMerge(
        task.id,
        selectedWinnerId,
        loserVariantIds,
      );
      toast.success("Cluster de duplicados fusionado correctamente");
      await onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        getReconciliationTaskErrorMessage(
          error,
          "No se pudo resolver el merge del cluster",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const subtitle =
    step === "select"
      ? "Elegí cuál queda en Powip. Nada se aplica hasta que confirmes."
      : "Vista previa: así va a quedar. Todavía no se aplicó nada.";

  return (
    <AlertDialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <AlertDialogContent className="flex max-h-[88vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <AlertDialogHeader className="border-b px-6 py-4 text-left">
          <AlertDialogTitle>Unificar · {suggestedName}</AlertDialogTitle>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4 text-sm text-foreground">
            <p className="text-sm text-muted-foreground">{subtitle}</p>

            {detailsQuery.isError && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                No se pudo cargar el detalle de los productos (imagen,
                descripción, variantes hermanas). Podés igual elegir con la
                información básica de cada candidata.
              </div>
            )}

            {step === "select" ? (
              detailsQuery.isLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {task.items.map((item) => (
                    <div
                      key={item.variant_id ?? item.variant_name}
                      className="space-y-3 rounded-lg border-2 border-border p-4"
                    >
                      <Skeleton className="h-3 w-24" />
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-12 w-12 rounded-md" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {task.items.map((item) => {
                    const key = item.variant_id ?? item.variant_name;
                    const detail = item.variant_id
                      ? candidateByVariantId.get(item.variant_id)
                      : undefined;
                    const stock = item.variant_id
                      ? stockByVariantId.get(item.variant_id)
                      : undefined;
                    return (
                      <CandidateCard
                        key={key}
                        item={item}
                        detail={detail}
                        stock={stock}
                        stockByVariantId={stockByVariantId}
                        isStockLoading={isCalculatingStock}
                        isStockError={stockQuery.isError}
                        isSelected={
                          !!item.variant_id && selectedWinnerId === item.variant_id
                        }
                        isSubmitting={isSubmitting}
                        isExpanded={expandedIds.has(key)}
                        onSelect={setSelectedWinnerId}
                        onToggleExpand={toggleExpand}
                      />
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Variantes que se fusionan
                    </p>
                    <p className="text-lg font-bold">{loserItems.length}</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Stock total antes → después
                    </p>
                    <p className="text-lg font-bold">
                      {isCalculatingStock ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          Calculando…
                        </span>
                      ) : stockQuery.isError ? (
                        "—"
                      ) : (
                        `${stockBefore} → ${stockAfter}`
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">
                      Reservas antes → después
                    </p>
                    <p className="text-lg font-bold">
                      {isCalculatingStock ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          Calculando…
                        </span>
                      ) : stockQuery.isError ? (
                        "—"
                      ) : (
                        `${reservedBefore} → ${reservedAfter}`
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{winnerName}</span>
                    <AttributeBadges attributes={winnerAttributeValues} />
                    <span className="font-mono text-xs text-muted-foreground">
                      SKU: {winnerSku}
                    </span>
                    <ReconciliationSourceChip source={winnerItem?.source ?? null} />
                    <Badge className="bg-primary hover:bg-primary">
                      Queda en Powip
                    </Badge>
                  </div>

                  <div className="space-y-2 border-l-2 pl-4">
                    {loserItems.map((loserItem) => {
                      const loserStock = loserItem.variant_id
                        ? stockByVariantId.get(loserItem.variant_id)
                        : undefined;
                      const loserSku =
                        loserItem.sku ?? loserItem.company_sku ?? "Sin SKU";
                      return (
                        <div
                          key={loserItem.variant_id ?? loserItem.variant_name}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <span className="font-medium">
                            {loserItem.variant_name}
                          </span>
                          <ReconciliationSourceChip source={loserItem.source} />
                          <span className="font-mono text-xs text-muted-foreground">
                            SKU: {loserSku}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            Se fusiona
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Stock{" "}
                            {isCalculatingStock
                              ? "…"
                              : stockQuery.isError
                                ? "—"
                                : (loserStock?.quantity ?? 0)}{" "}
                            → pasa a la que queda
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Las variantes que se fusionan quedan inactivas. Sus
                  próximas ventas descuentan de la variante que queda.
                </div>

                <p className="text-sm font-semibold text-destructive">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            )}
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter className="border-t px-6 py-4">
          {step === "select" ? (
            <>
              <AlertDialogCancel disabled={isSubmitting}>
                Cancelar
              </AlertDialogCancel>
              <Button
                type="button"
                disabled={isSubmitting || !selectedWinnerId}
                onClick={() => setStep("preview")}
              >
                Vista previa →
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setStep("select")}
              >
                ← Volver
              </Button>
              <AlertDialogAction
                className={buttonVariants({ variant: "destructive" })}
                disabled={isSubmitting || !selectedWinnerId}
                onClick={(event) => {
                  // Mantiene el diálogo abierto (mostrando el spinner) hasta
                  // que la mutación termina, en vez del cierre inmediato por
                  // defecto de Radix al clickear una AlertDialogAction.
                  event.preventDefault();
                  handleConfirm();
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  "Aplicar unificación"
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
