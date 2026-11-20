"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import {
  findLocation,
  type ModeChangeFailure,
  parseModeChangeError,
  sharedWarehouseSiblings,
  STOCK_MODE_DESCRIPTIONS,
  STOCK_MODE_LABELS,
  STOCK_MODES,
  type UnmetPrecondition,
} from "@/lib/shopifyStock";
import {
  changeShopifyStockMode,
  getShopifyStockLocations,
  type ShopifyStockMode,
  type ShopifyStockModeChange,
  type ShopifyStockShop,
} from "@/services/shopifyStockService";

// FEAT-24 H1-D (H1D-5) — cambiar quién manda el stock de una tienda de Shopify.
// Solo lo abre un administrador. Las aceptaciones (`acknowledgeZeroDeny`,
// `acknowledgeMultiLocation`) se ofrecen solo cuando el backend las pide (422).

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** El paso natural desde cada modo. */
const NEXT_MODE: Record<ShopifyStockMode, ShopifyStockMode> = {
  shopify: "reporte",
  reporte: "powip",
  powip: "shopify",
};

interface Props {
  shop: ShopifyStockShop;
  shops: ShopifyStockShop[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se llama después de un cambio (o de un 409) para volver a pedir las tiendas. */
  onChanged: () => void;
}

function UnmetList({ items }: { items: UnmetPrecondition[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((p) => (
        <li key={p.code}>
          <span className="font-medium">{p.label}</span>
          {p.detail ? <span className="block text-xs text-muted-foreground">{p.detail}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function CheckLine({
  checked,
  onChange,
  label,
  children,
  emphasis = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(v === true)} aria-label={label} className="mt-0.5" />
      <span className={emphasis ? "font-medium text-amber-800 dark:text-amber-300" : undefined}>{children}</span>
    </label>
  );
}

/**
 * El contenido del diálogo. Vive dentro de `DialogContent`, que se desmonta al cerrar: cada vez que se
 * abre arranca de cero (sin efectos que reinicien el estado).
 */
function ModeChangeForm({ shop, shops, onClose, onChanged }: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [target, setTarget] = useState<ShopifyStockMode>(NEXT_MODE[shop.stockMode]);
  /** null = no se tocó: vale la ubicación por defecto. */
  const [pickedLocation, setPickedLocation] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [ackZeroDeny, setAckZeroDeny] = useState(false);
  const [ackMulti, setAckMulti] = useState(false);
  const [withGroup, setWithGroup] = useState(false);
  const [failure, setFailure] = useState<ModeChangeFailure | null>(null);

  const needsLocation = target !== "shopify";
  const locationsQuery = useQuery({
    queryKey: ["shopify-stock-locations", shop.id],
    queryFn: () => getShopifyStockLocations(shop.id),
    enabled: needsLocation,
    retry: false,
    staleTime: 60_000,
  });
  const activeLocations = useMemo(
    () => (locationsQuery.data?.locations ?? []).filter((l) => l.isActive),
    [locationsQuery.data],
  );
  // Por defecto, la guardada si sigue activa; si hay una sola activa, esa.
  const defaultLocation =
    findLocation(activeLocations, shop.stockLocationId)?.id ?? (activeLocations.length === 1 ? activeLocations[0].id : "");
  const locationId = pickedLocation ?? defaultLocation;

  const siblings = useMemo(() => sharedWarehouseSiblings(shop, shops), [shop, shops]);
  const showGroup = target === "powip" && siblings.length > 0;

  const mutation = useMutation({
    mutationFn: (change: ShopifyStockModeChange) => changeShopifyStockMode(shop.id, change),
    onSuccess: (result) => {
      const others = result.group?.length ?? 0;
      if (result.changed) {
        toast.success(
          `${shop.shopUrl} quedó en «${STOCK_MODE_LABELS[result.currentMode]}»` +
            (others > 0 ? ` junto con ${others} ${others === 1 ? "tienda más" : "tiendas más"}.` : "."),
        );
      } else {
        toast.info(`No hubo cambios: ${shop.shopUrl} ya estaba en «${STOCK_MODE_LABELS[result.currentMode]}».`);
      }
      onChanged();
      onClose();
    },
    onError: (error) => {
      const parsed = parseModeChangeError(error);
      setFailure(parsed);
      if (parsed.status !== 422) toast.error(parsed.message);
      if (parsed.status === 409) onChanged();
    },
  });

  const chooseTarget = (mode: ShopifyStockMode) => {
    setTarget(mode);
    setFailure(null);
    setConfirm(false);
    setAckZeroDeny(false);
    setAckMulti(false);
  };

  const submit = () => {
    if (mutation.isPending) return;
    const change: ShopifyStockModeChange = { mode: target };
    if (needsLocation && locationId) change.stockLocationId = locationId;
    if (target === "powip") {
      change.confirm = confirm;
      if (failure?.needsAckZeroDeny && ackZeroDeny) change.acknowledgeZeroDeny = true;
      if (failure?.needsAckMultiLocation && ackMulti) change.acknowledgeMultiLocation = true;
      if (showGroup && withGroup) change.groupShopIds = siblings.map((s) => s.id);
    }
    mutation.mutate(change);
  };

  const options = STOCK_MODES.filter((m) => m !== shop.stockMode);
  const submitDisabled = mutation.isPending || (target === "powip" && !confirm);
  const submitLabel = target === "shopify" ? "Volver a «Shopify manda»" : `Pasar a «${STOCK_MODE_LABELS[target]}»`;
  const showFailure = failure !== null && (failure.status === 422 || failure.unmet.length > 0 || failure.groupUnmet.length > 0);

  return (
    <>
      <div className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Nuevo modo</legend>
          {options.map((mode) => (
            <label key={mode} className="flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm">
              <input
                type="radio"
                name={`stock-mode-${shop.id}`}
                value={mode}
                checked={target === mode}
                onChange={() => chooseTarget(mode)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">{STOCK_MODE_LABELS[mode]}</span>
                <span className="block text-muted-foreground">{STOCK_MODE_DESCRIPTIONS[mode]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {target === "shopify" ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Shopify vuelve a mandar: Powip deja de publicar en Shopify y los cambios de stock en Shopify vuelven a pisar el
            stock de Powip.
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={`stock-location-${shop.id}`}>Ubicación de Shopify</Label>
            {locationsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">Cargando ubicaciones…</p>
            ) : locationsQuery.isError ? (
              <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                {warehouseErrorMessage(locationsQuery.error, "No se pudieron leer las ubicaciones de Shopify.")}
              </p>
            ) : (
              <select
                id={`stock-location-${shop.id}`}
                className={SELECT_CLASS}
                value={locationId}
                onChange={(e) => {
                  setPickedLocation(e.target.value);
                  setFailure(null);
                }}
              >
                <option value="">Elige una ubicación</option>
                {activeLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name || l.id}
                    {l.fulfillsOnlineOrders ? " · despacha online" : ""}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-muted-foreground">
              {target === "powip"
                ? "Powip publica su disponible solo en esta ubicación."
                : "El reporte compara el stock de Powip con el de esta ubicación."}
            </p>
          </div>
        )}

        {showGroup ? (
          <CheckLine
            checked={withGroup}
            onChange={setWithGroup}
            label="Pasar también las tiendas que comparten el almacén"
            emphasis={failure?.needsGroup === true}
          >
            Pasar también a «Powip manda»: {siblings.map((s) => s.shopUrl).join(", ")}. Comparten el almacén de Powip y,
            mientras alguna siga en otro modo, ninguna puede pasar sola.
          </CheckLine>
        ) : null}

        {showFailure ? (
          <div
            role="alert"
            className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              {failure.message}
            </p>
            {failure.unmet.length > 0 ? <UnmetList items={failure.unmet} /> : null}
            {failure.groupUnmet.map((g) => (
              <div key={g.shopUrl} className="space-y-1">
                <p className="font-medium">En {g.shopUrl}:</p>
                <UnmetList items={g.unmet} />
              </div>
            ))}
          </div>
        ) : null}

        {target === "powip" && failure?.needsAckZeroDeny ? (
          <CheckLine checked={ackZeroDeny} onChange={setAckZeroDeny} label="Aceptar que haya productos que dejen de venderse">
            Acepto que {failure.zeroDenyCount ?? "algunas"} variantes con stock en Shopify queden en 0 y dejen de venderse
            en la tienda online (la lista está en el reporte, «Frenan la venta»).
          </CheckLine>
        ) : null}

        {target === "powip" && failure?.needsAckMultiLocation ? (
          <CheckLine checked={ackMulti} onChange={setAckMulti} label="Aceptar publicar en una sola ubicación">
            Acepto que Powip publique solo en la ubicación elegida aunque otras ubicaciones también despachen pedidos
            online (Shopify puede vender también su stock).
          </CheckLine>
        ) : null}

        {target === "powip" ? (
          <CheckLine checked={confirm} onChange={setConfirm} label="Confirmar que Powip pase a mandar el stock">
            Confirmo que Powip pase a mandar el stock de esta tienda en Shopify. Desde la próxima publicación, Shopify
            mostrará el disponible de Powip.
          </CheckLine>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={submitDisabled}
          onClick={submit}
          className={target === "shopify" ? undefined : "bg-teal-600 hover:bg-teal-700"}
        >
          {mutation.isPending ? "Guardando…" : submitLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

export default function ShopifyStockModeDialog({ shop, shops, open, onOpenChange, onChanged }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cambiar el modo de stock</DialogTitle>
          <DialogDescription>
            {shop.shopUrl} está en «{STOCK_MODE_LABELS[shop.stockMode]}». Cambiar el modo nunca escribe en Shopify en el
            momento.
          </DialogDescription>
        </DialogHeader>
        <ModeChangeForm shop={shop} shops={shops} onClose={() => onOpenChange(false)} onChanged={onChanged} />
      </DialogContent>
    </Dialog>
  );
}
