"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelProductActivation,
  canCorrectTrackingRequest,
  getProductTracking,
  parseUnitCodes,
  regularizeProduct,
  resumeProductTracking,
  trackingError,
  validateUnitCodes,
  type ProductTrackingContext,
  type RegularizationRequest,
  type RegularizationResult,
} from "@/services/inventoryTrackingService";

export default function RegularizeProductModal({
  productId,
  productName,
  companyId,
  onClose,
  onSaved,
}: {
  productId: string;
  productName: string;
  companyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [context, setContext] = useState<ProductTrackingContext | null>(null);
  const [mode, setMode] = useState<"SERIAL" | "IMEI">("SERIAL");
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [canCorrect, setCanCorrect] = useState(false);
  const [result, setResult] = useState<RegularizationResult | null>(null);
  const [pending, setPending] = useState<RegularizationRequest | null>(null);
  const requestRef = useRef<RegularizationRequest | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    if (!companyId) return;
    const controller = new AbortController();
    alive.current = true;
    setLoading(true);
    getProductTracking(productId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.productId !== productId || !Array.isArray(data.variants))
          throw new Error("No se pudo validar el producto.");
        setContext(data);
        if (data.pendingActivation) setMode(data.pendingActivation.trackingMode);
        else if (data.trackingMode === "SERIAL" || data.trackingMode === "IMEI")
          setMode(data.trackingMode);
      })
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(trackingError(err, "No se pudo consultar el producto."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      controller.abort();
      alive.current = false;
    };
  }, [productId, companyId]);

  const blocked = context?.variants.some(
    (item) =>
      item.reservedQuantity > 0 || item.quantity < 0 || !Number.isSafeInteger(item.quantity),
  );
  const alreadyHasUnits = context?.variants.some((item) => item.unitCount > 0);
  const recovering = !!context?.pendingActivation;
  const total = context?.variants.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const variantNames = new Map(
    context?.catalogVariants?.map((variant) => [
      variant.id,
      [variant.sku, ...Object.values(variant.attributeValues ?? {})].filter(Boolean).join(" · "),
    ]),
  );
  const correct = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      // The backend atomically fences any late delivery before releasing the intent.
      // It is idempotent when validation failed before an intent was persisted.
      await cancelProductActivation(productId);
      const fresh = await getProductTracking(productId);
      if (!alive.current) return;
      setContext(fresh);
      requestRef.current = null;
      setPending(null);
      setCanCorrect(false);
    } catch (err) {
      if (alive.current)
        setError(
          trackingError(
            err,
            "No se pudo cancelar la activación. Reintenta la operación pendiente.",
          ),
        );
    } finally {
      if (alive.current) setSaving(false);
    }
  };
  const submit = async () => {
    if (!context || saving || (!recovering && (blocked || alreadyHasUnits))) return;
    let request = requestRef.current;
    if (!request && !recovering) {
      const items = context.variants.map((item) => ({
        variantId: item.variantId,
        ...(item.inventoryItemId
          ? { inventoryItemId: item.inventoryItemId }
          : { inventoryId: item.inventoryId }),
        expectedQuantity: item.quantity,
        codes: parseUnitCodes(codes[item.variantId] ?? ""),
      }));
      const validation = validateUnitCodes(
        items.map((item) => ({ ...item, quantity: item.expectedQuantity, trackingMode: mode })),
      );
      if (validation) {
        setError(validation);
        return;
      }
      request = { operationId: crypto.randomUUID(), trackingMode: mode, items };
      requestRef.current = request;
      setPending(request);
    }
    setSaving(true);
    setError("");
    setCanCorrect(false);
    try {
      let response: RegularizationResult;
      if (recovering) response = await resumeProductTracking(productId);
      else {
        if (!request) throw new Error("La solicitud no está lista. Revisa los códigos.");
        response = await regularizeProduct(productId, request);
      }
      if (!alive.current) return;
      if (response.stockBefore !== response.stockAfter)
        throw new Error(
          "La respuesta no confirma la conservación del stock. Conserva esta solicitud y verifica antes de continuar.",
        );
      setResult(response);
      onSaved();
    } catch (err) {
      if (alive.current) {
        setError(trackingError(err, "No se pudo asociar los códigos."));
        setCanCorrect(canCorrectTrackingRequest(err));
      }
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving && (!pending || result || canCorrect)) onClose();
      }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(event) => {
          if (pending && !result) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Asociar IMEI o series · {productName}</DialogTitle>
          <DialogDescription>
            Asociar códigos no suma stock. Se identificarán las existencias actuales de todas las
            variantes del producto.
          </DialogDescription>
        </DialogHeader>
        {loading ? <p role="status">Consultando existencias de todo el producto…</p> : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {result ? (
          <div role="status" className="space-y-2">
            <p>Se asociaron {result.unitCount} unidades.</p>
            <p>
              Stock anterior: <strong>{result.stockBefore}</strong>. Stock actual:{" "}
              <strong>{result.stockAfter}</strong>. No se sumaron existencias.
            </p>
          </div>
        ) : context ? (
          <>
            {recovering ? (
              <p role="status">
                Hay una activación pendiente. Reintenta para completar la misma operación con los
                códigos ya guardados.
              </p>
            ) : null}
            {blocked && !recovering ? (
              <p role="alert">
                Libera las reservas y concilia cualquier stock negativo antes de continuar.
              </p>
            ) : null}
            {alreadyHasUnits && !recovering ? (
              <p role="alert">
                Este producto ya tiene unidades identificadas. Consulta sus códigos en «Ver
                unidades».
              </p>
            ) : null}
            <fieldset
              disabled={saving || !!pending || !!blocked || !!alreadyHasUnits || recovering}
              className="space-y-4"
              hidden={recovering}
            >
              <div className="space-y-1">
                <Label htmlFor="regularize-mode">Identificador por unidad</Label>
                <select
                  id="regularize-mode"
                  className="border rounded-md p-2 w-full"
                  value={mode}
                  disabled={context.trackingMode !== "NONE"}
                  onChange={(event) => setMode(event.target.value as "SERIAL" | "IMEI")}
                >
                  <option value="SERIAL">Número de serie</option>
                  <option value="IMEI">IMEI</option>
                </select>
              </div>
              <p className="text-sm">
                Stock actual total: <strong>{total}</strong> unidades. No registres una compra para
                este stock.
              </p>
              {context.variants.map((item, index) => (
                <div key={item.variantId} className="space-y-1 border rounded-md p-3">
                  <Label htmlFor={`regularize-codes-${index}`}>
                    {variantNames.get(item.variantId) || `Variante ${index + 1}`} ·{" "}
                    {item.inventoryName || "Almacén"} · {item.quantity} unidades
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Reservadas: {item.reservedQuantity}
                  </p>
                  <Textarea
                    id={`regularize-codes-${index}`}
                    value={codes[item.variantId] ?? ""}
                    onChange={(event) =>
                      setCodes((previous) => ({
                        ...previous,
                        [item.variantId]: event.target.value,
                      }))
                    }
                    placeholder="Pega un código por línea"
                    rows={Math.min(6, Math.max(2, item.quantity))}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={item.quantity === 0}
                  />
                  <p className="text-xs">
                    {parseUnitCodes(codes[item.variantId] ?? "").length} de {item.quantity} códigos
                  </p>
                </div>
              ))}
            </fieldset>
            {pending && error ? (
              <p className="text-sm">
                Conservé los códigos y la solicitud. «Reintentar» consulta la misma operación para
                evitar duplicados.
              </p>
            ) : null}
          </>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving || (!!pending && !result && !canCorrect)}
          >
            {result ? "Cerrar" : "Cancelar"}
          </Button>
          {(canCorrect || recovering) && !result ? (
            <Button variant="outline" disabled={saving} onClick={() => void correct()}>
              {recovering ? "Cancelar activación" : "Corregir datos"}
            </Button>
          ) : null}
          {!result ? (
            <Button
              onClick={() => void submit()}
              disabled={
                loading || saving || !context || (!recovering && (!!blocked || !!alreadyHasUnits))
              }
            >
              {saving
                ? "Asociando…"
                : recovering
                  ? "Reintentar activación"
                  : pending
                    ? "Reintentar"
                    : "Asociar códigos sin sumar stock"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
