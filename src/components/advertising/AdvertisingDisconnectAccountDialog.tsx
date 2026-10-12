"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AdvertisingAccountWire,
  type AdvertisingDisconnectPreview,
  advertisingDisconnectErrorMessage,
  disconnectAdvertisingAccount,
  previewAdvertisingAccountDisconnect,
} from "@/services/advertisingService";

interface Props {
  actorId: string;
  companyId: string;
  token: string;
  account: AdvertisingAccountWire;
  canDisconnect: boolean;
  onClose: () => void;
  onDisconnected: (accountId: string) => Promise<void>;
}

function validPreview(
  value: AdvertisingDisconnectPreview,
  accountId: string,
  provider: AdvertisingAccountWire["provider"],
) {
  if (
    !value ||
    value.account?.id !== accountId ||
    value.account.provider !== provider ||
    typeof value.alreadyDisconnected !== "boolean" ||
    !Number.isSafeInteger(value.preservedManualRecords) ||
    value.preservedManualRecords < 0 ||
    !value.deleteCounts
  )
    return false;
  for (const field of [
    "ledgerDays",
    "metaObjects",
    "metaAdDays",
    "metaCoverageDays",
    "metaCatalogStates",
  ] as const) {
    if (!Number.isSafeInteger(value.deleteCounts[field]) || value.deleteCounts[field] < 0)
      return false;
  }
  return value.alreadyDisconnected
    ? value.previewVersion === null && value.expiresAt === null
    : typeof value.previewVersion === "string" &&
        value.previewVersion.trim().length > 0 &&
        typeof value.expiresAt === "string" &&
        Number.isFinite(Date.parse(value.expiresAt));
}

export function AdvertisingDisconnectAccountDialog({
  actorId,
  companyId,
  token,
  account,
  canDisconnect,
  onClose,
  onDisconnected,
}: Props) {
  const scope = JSON.stringify([actorId, companyId, token, account.id]);
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const mounted = useRef(true);
  const submitted = useRef(false);
  const confirmController = useRef<AbortController | null>(null);
  const [prepared, setPrepared] = useState<{
    scope: string;
    value: AdvertisingDisconnectPreview;
  } | null>(null);
  const [error, setError] = useState<{ scope: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expired, setExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const allowed = !!actorId && !!companyId && !!token && canDisconnect && !account.disconnectedAt;
  const currentAllowed = useRef(allowed);
  currentAllowed.current = allowed;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      confirmController.current?.abort();
    };
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: attempt explicitly requests a new preview after a conflict.
  useEffect(() => {
    submitted.current = false;
    confirmController.current?.abort();
    setSaving(false);
    setPrepared(null);
    setError(null);
    setExpired(false);
    if (!allowed) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    previewAdvertisingAccountDisconnect(token, companyId, account.id, controller.signal)
      .then((value) => {
        if (!active || currentScope.current !== scope || !currentAllowed.current) return;
        if (!validPreview(value, account.id, account.provider)) {
          setError({ scope, message: "No pudimos revisar esta cuenta. Inténtalo de nuevo." });
          return;
        }
        setPrepared({ scope, value });
      })
      .catch((failure: unknown) => {
        if (active && currentScope.current === scope)
          setError({ scope, message: advertisingDisconnectErrorMessage(failure) });
      })
      .finally(() => {
        if (active && currentScope.current === scope) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [scope, allowed, actorId, companyId, token, account.id, account.provider, attempt]);

  const preview = prepared?.scope === scope ? prepared.value : null;
  const failure = error?.scope === scope ? error.message : null;
  const validUntil = preview?.expiresAt ? Date.parse(preview.expiresAt) : 0;
  const canConfirm =
    allowed &&
    !!preview?.previewVersion &&
    !preview.alreadyDisconnected &&
    !failure &&
    !saving &&
    !loading &&
    !expired &&
    validUntil > Date.now();

  useEffect(() => {
    if (!preview || preview.alreadyDisconnected) return;
    const timer = setTimeout(() => setExpired(true), Math.max(0, validUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [preview, validUntil]);

  async function confirm() {
    if (
      !canConfirm ||
      submitted.current ||
      currentScope.current !== scope ||
      !currentAllowed.current ||
      !preview?.previewVersion
    )
      return;
    submitted.current = true;
    const controller = new AbortController();
    confirmController.current = controller;
    setSaving(true);
    try {
      const result = await disconnectAdvertisingAccount(
        token,
        companyId,
        account.id,
        preview.previewVersion,
        controller.signal,
      );
      if (!mounted.current || currentScope.current !== scope || !currentAllowed.current) return;
      if (result.disconnected !== true) throw new Error("Invalid disconnection result");
      await onDisconnected(account.id);
    } catch (failure: unknown) {
      if (mounted.current && currentScope.current === scope) {
        setPrepared(null);
        setError({ scope, message: advertisingDisconnectErrorMessage(failure) });
      }
    } finally {
      if (mounted.current && currentScope.current === scope) {
        submitted.current = false;
        setSaving(false);
      }
    }
  }

  const needsReview =
    failure || expired || (!!preview && !preview.alreadyDisconnected && validUntil <= Date.now());
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !submitted.current) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6"
        showCloseButton={!saving}
      >
        <DialogHeader className="pr-5 text-left">
          <DialogTitle>Desconectar cuenta</DialogTitle>
          <DialogDescription>{account.name}</DialogDescription>
        </DialogHeader>
        {!allowed ? (
          <Alert variant="destructive">
            <AlertDescription>No tienes permiso para desconectar esta cuenta.</AlertDescription>
          </Alert>
        ) : loading || (!preview && !failure) ? (
          <div role="status" aria-label="Revisando la cuenta">
            <Skeleton className="h-24" />
          </div>
        ) : preview?.alreadyDisconnected ? (
          <p className="text-sm">Esta cuenta ya está desconectada.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              Se eliminarán el gasto y los anuncios importados. La cuenta podrá vincularse a otra
              empresa.
            </p>
            {preview ? (
              <dl className="space-y-2 rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt>Días de gasto</dt>
                  <dd className="font-medium">{preview.deleteCounts.ledgerDays}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Campañas, grupos y anuncios</dt>
                  <dd className="font-medium">{preview.deleteCounts.metaObjects}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Registros diarios de anuncios</dt>
                  <dd className="font-medium">{preview.deleteCounts.metaAdDays}</dd>
                </div>
              </dl>
            ) : null}
            <p className="text-sm text-muted-foreground">
              Se conservarán pedidos, registros manuales y auditorías.
            </p>
          </div>
        )}
        {needsReview && allowed ? (
          <Alert variant="destructive">
            <AlertDescription>
              {failure ?? "La revisión caducó. Vuelve a revisar antes de desconectar."}
            </AlertDescription>
          </Alert>
        ) : null}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (!submitted.current) onClose();
            }}
          >
            {preview?.alreadyDisconnected ? "Cerrar" : "Cancelar"}
          </Button>
          {preview?.alreadyDisconnected ? (
            <Button disabled={saving} onClick={() => void onDisconnected(account.id)}>
              Actualizar cuentas
            </Button>
          ) : needsReview ? (
            <Button
              variant="outline"
              disabled={!allowed || saving}
              onClick={() => setAttempt((value) => value + 1)}
            >
              Volver a revisar
            </Button>
          ) : (
            <Button variant="destructive" disabled={!canConfirm} onClick={() => void confirm()}>
              {saving ? "Desconectando…" : "Desconectar y eliminar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
