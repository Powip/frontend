"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import type {
  AdvertisingLocalManualRecord,
  AdvertisingManualImportPreview,
} from "@/services/advertisingService";
import {
  advertisingErrorStatus,
  advertisingManualErrorMessage,
  batchAdvertisingManualRecords,
  importAdvertisingManualRecords,
  previewAdvertisingManualImport,
} from "@/services/advertisingService";
import { readAdvertisingLocalRecords } from "./advertising-local-records";
import { formatAdvertisingDate } from "./advertising-model";

interface Props {
  open: boolean;
  companyId: string;
  token: string;
  storeIds: string[];
  canReconcile: boolean;
  onClose: () => void;
  onImported: (result: AdvertisingManualImportPreview) => Promise<void>;
  onAccessDenied: () => Promise<void>;
}

function recordKey(record: { source: string; browserKey: string; sourceId: string }) {
  return JSON.stringify([record.source, record.browserKey, record.sourceId]);
}

export function AdvertisingManualImportDialog({
  open,
  companyId,
  token,
  storeIds,
  canReconcile,
  onClose,
  onImported,
  onAccessDenied,
}: Props) {
  const id = useId();
  const [records, setRecords] = useState<AdvertisingLocalManualRecord[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [preview, setPreview] = useState<AdvertisingManualImportPreview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const request = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const storeKey = JSON.stringify(storeIds);

  useEffect(() => {
    if (!open || !canReconcile) return;
    const local = readAdvertisingLocalRecords({
      companyId,
      storeIds: JSON.parse(storeKey) as string[],
    });
    setRecords(local.records);
    setWarnings(local.warnings);
    setNextOffset(local.nextOffset);
    setPage(0);
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    setError(null);
    setBusy(null);
    return () => {
      request.current += 1;
      controller.current?.abort();
    };
  }, [open, companyId, storeKey, canReconcile]);

  const batches = useMemo(() => batchAdvertisingManualRecords(records), [records]);
  const batch = batches[page] ?? [];
  const newKeys = preview?.entries.filter((entry) => entry.state === "new").map(recordKey) ?? [];
  const canImport =
    canReconcile && confirmed && selected.length > 0 && preview !== null && busy === null;

  async function loadPreview() {
    if (!batch.length || busy || !canReconcile) return;
    const sequence = ++request.current;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setBusy("preview");
    setError(null);
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    try {
      const result = await previewAdvertisingManualImport(
        token,
        companyId,
        batch,
        nextController.signal,
      );
      if (request.current === sequence) setPreview(result);
    } catch (failure: unknown) {
      if (request.current === sequence) {
        setError(advertisingManualErrorMessage(failure));
        if ([401, 403].includes(advertisingErrorStatus(failure) ?? 0)) await onAccessDenied();
      }
    } finally {
      if (request.current === sequence) setBusy(null);
    }
  }

  async function importSelected() {
    if (!canImport) return;
    const sequence = ++request.current;
    const chosen = batch.filter(
      (record) => selected.includes(recordKey(record)) && newKeys.includes(recordKey(record)),
    );
    if (!chosen.length) return;
    setBusy("import");
    setError(null);
    try {
      const result = await importAdvertisingManualRecords(token, companyId, chosen);
      if (request.current !== sequence) return;
      await onImported(result);
      if (request.current === sequence) onClose();
    } catch (failure: unknown) {
      if (request.current === sequence) {
        setError(advertisingManualErrorMessage(failure));
        if ([401, 403].includes(advertisingErrorStatus(failure) ?? 0)) await onAccessDenied();
      }
    } finally {
      if (request.current === sequence) setBusy(null);
    }
  }

  function changePage(next: number) {
    setPage(next);
    setPreview(null);
    setSelected([]);
    setConfirmed(false);
    setError(null);
  }

  function readNextGroup() {
    if (nextOffset === null || busy) return;
    const local = readAdvertisingLocalRecords({ companyId, storeIds, offset: nextOffset });
    setRecords(local.records);
    setWarnings(local.warnings);
    setNextOffset(local.nextOffset);
    changePage(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-2xl sm:p-6"
        showCloseButton={!busy}
      >
        <DialogHeader className="pr-5 text-left">
          <DialogTitle>Registros de este navegador</DialogTitle>
          <DialogDescription>
            Revisa Pauta y Cierre antes de guardarlos en la empresa. Los originales se conservan.
          </DialogDescription>
        </DialogHeader>
        {warnings.length > 0 && (
          <Alert>
            <AlertDescription>
              <ul className="space-y-1">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {!canReconcile ? (
          <p className="text-sm text-muted-foreground">
            Necesitas permiso para revisar históricos.
          </p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No encontramos registros importables en este navegador.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                {records.length} {records.length === 1 ? "registro" : "registros"} en esta lectura ·
                lote {page + 1} de {batches.length}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null || page === 0}
                  onClick={() => changePage(page - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy !== null || page + 1 >= batches.length}
                  onClick={() => changePage(page + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
            {preview ? (
              <>
                <p role="status" className="text-sm text-muted-foreground">
                  {preview.counts.new} {preview.counts.new === 1 ? "nuevo" : "nuevos"} ·{" "}
                  {preview.counts.existing} ya guardados · {preview.counts.conflict} cambiaron
                </p>
                {newKeys.length > 0 && (
                  <Label className="flex min-h-11 items-center gap-2">
                    <Checkbox
                      checked={selected.length === newKeys.length}
                      disabled={busy !== null}
                      onCheckedChange={(value) => setSelected(value === true ? newKeys : [])}
                    />
                    Seleccionar nuevos
                  </Label>
                )}
                <section
                  className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-2"
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable records stay keyboard accessible when every checkbox is disabled.
                  tabIndex={0}
                  aria-label="Vista previa de registros"
                >
                  {preview.entries.map((entry, index) => {
                    const key = recordKey(entry);
                    const original = batch.find((record) => recordKey(record) === key);
                    const payloadOriginal = original?.payload.original;
                    const channel =
                      payloadOriginal &&
                      typeof payloadOriginal === "object" &&
                      !Array.isArray(payloadOriginal)
                        ? (payloadOriginal as Record<string, unknown>).canalId
                        : undefined;
                    return (
                      <Label
                        key={key}
                        htmlFor={`${id}-${index}`}
                        className="flex min-h-16 items-start gap-3 rounded-md border border-border p-3"
                      >
                        <Checkbox
                          id={`${id}-${index}`}
                          className="mt-1"
                          checked={selected.includes(key)}
                          disabled={busy !== null || entry.state !== "new"}
                          onCheckedChange={(value) =>
                            setSelected((current) =>
                              value === true
                                ? [...current.filter((item) => item !== key), key]
                                : current.filter((item) => item !== key),
                            )
                          }
                        />
                        <span className="min-w-0 space-y-1">
                          <span className="block text-sm font-medium">
                            {entry.source === "pauta" ? "Pauta" : "Cierre"} ·{" "}
                            {formatAdvertisingDate(entry.date)}
                          </span>
                          <span className="block text-sm tabular-nums">
                            {entry.amount ?? "Importe pendiente"} ·{" "}
                            {entry.currency ?? "Moneda por confirmar"}
                          </span>
                          <span className="block break-all text-xs text-muted-foreground">
                            Referencia: {entry.sourceId}
                          </span>
                          {entry.source === "pauta" && typeof channel === "string" && (
                            <span className="block break-words text-xs text-muted-foreground">
                              Canal registrado: {channel}
                            </span>
                          )}
                          {entry.source === "cierre" &&
                            (() => {
                              const original = batch.find((record) => recordKey(record) === key);
                              const store = original?.payload.storeId;
                              const platform = original?.payload.platform;
                              return (
                                <span className="block break-words text-xs text-muted-foreground">
                                  Tienda: {typeof store === "string" ? store : "Por identificar"} ·
                                  Plataforma:{" "}
                                  {platform === "meta"
                                    ? "Meta Ads"
                                    : platform === "tiktok"
                                      ? "TikTok Ads"
                                      : platform === "google"
                                        ? "Google Ads"
                                        : "Por identificar"}
                                </span>
                              );
                            })()}
                          <Badge variant="outline">
                            {entry.state === "new"
                              ? "Nuevo"
                              : entry.state === "existing"
                                ? "Ya guardado"
                                : "Cambió: no se sobrescribe"}
                          </Badge>
                        </span>
                      </Label>
                    );
                  })}
                </section>
                <Label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={confirmed}
                    disabled={busy !== null}
                    onCheckedChange={(value) => setConfirmed(value === true)}
                  />
                  <span>Se guardarán por revisar. Todavía no se suman al gasto.</span>
                </Label>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Solo se recuperan datos de este navegador. Cada operación admite hasta 200
                registros.
              </p>
            )}
          </div>
        )}
        {canReconcile && nextOffset !== null && (
          <Button variant="outline" disabled={busy !== null} onClick={readNextGroup}>
            Leer siguientes registros del navegador
          </Button>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={onClose}>
            Cerrar
          </Button>
          {canReconcile &&
            records.length > 0 &&
            (preview ? (
              <Button disabled={!canImport} onClick={() => void importSelected()}>
                {busy === "import"
                  ? "Guardando…"
                  : `Guardar ${selected.length} ${selected.length === 1 ? "registro" : "registros"}`}
              </Button>
            ) : (
              <Button disabled={busy !== null} onClick={() => void loadPreview()}>
                {busy === "preview" ? "Consultando…" : "Ver vista previa"}
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
