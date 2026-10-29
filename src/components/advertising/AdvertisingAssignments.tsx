"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  AdvertisingAssignmentPayload,
  AdvertisingWorkspace,
} from "@/services/advertisingWorkspaceService";
import { formatMetaSpend } from "./advertising-meta-model";
import { advertisingBasisPoints, advertisingSharePercent } from "./advertising-workspace-model";

interface ShareInput {
  key: string;
  storeId: string;
  channel: string;
  percent: string;
}
interface Props {
  workspace: AdvertisingWorkspace;
  busy: boolean;
  onSave: (accountId: string, payload: AdvertisingAssignmentPayload) => Promise<boolean>;
}
export function AdvertisingAssignments({ workspace, busy, onSave }: Props) {
  const id = useId();
  const nextKey = useRef(0);
  const [accountId, setAccountId] = useState("");
  const [version, setVersion] = useState(0);
  const [effectiveFrom, setEffectiveFrom] = useState(workspace.today);
  const [shares, setShares] = useState<ShareInput[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const assignment = workspace.assignments.find((item) => item.accountId === accountId);
  const canConfigure = workspace.capabilities.canConfigure;
  function chooseAccount(value: string) {
    setAccountId(value);
    setError(null);
    setReason("");
    const current = workspace.assignments.find((item) => item.accountId === value);
    setVersion(current?.version ?? 0);
    setEffectiveFrom(
      current && current.effectiveFrom > workspace.today ? current.effectiveFrom : workspace.today,
    );
    setShares(
      current?.shares.map((share) => ({
        key: `${share.storeId}:${share.channel}`,
        storeId: share.storeId,
        channel: share.channel ?? "none",
        percent: advertisingSharePercent(share.basisPoints),
      })) ?? [],
    );
  }
  function changeShare(index: number, patch: Partial<ShareInput>) {
    setShares((items) =>
      items.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }
  async function save() {
    if (!canConfigure || busy) return;
    const parsed = shares.map((share) => ({
      storeId: share.storeId,
      channel: share.channel === "none" ? null : share.channel,
      basisPoints: advertisingBasisPoints(share.percent),
    }));
    if (!accountId || effectiveFrom < workspace.today || reason.trim().length < 3) {
      setError("Elige una cuenta, una fecha desde hoy y escribe el motivo del cambio.");
      return;
    }
    if (
      parsed.some((share) => !share.storeId || share.basisPoints === null) ||
      (parsed.length > 0 &&
        parsed.reduce((sum, share) => sum + (share.basisPoints ?? 0), 0) !== 10_000)
    ) {
      setError("Elige las tiendas y reparte exactamente el 100 % con hasta dos decimales.");
      return;
    }
    const combinations = parsed.map((share) => `${share.storeId}:${share.channel ?? ""}`);
    if (new Set(combinations).size !== combinations.length) {
      setError("Cada tienda y canal debe aparecer una sola vez.");
      return;
    }
    setError(null);
    const saved = await onSave(accountId, {
      expectedVersion: version,
      effectiveFrom,
      reason: reason.trim(),
      shares: parsed.map((share) => ({ ...share, basisPoints: share.basisPoints ?? 0 })),
    });
    if (saved) {
      setReason("");
      setVersion((current) => current + 1);
    }
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Reparte el gasto de cada cuenta entre tiendas. La vigencia empieza desde hoy; los cierres
        anteriores se conservan.
      </p>
      {workspace.assignments.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asignaciones guardadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspace.assignments.map((item) => (
              <div key={item.accountId} className="space-y-1 rounded-lg border border-border p-3">
                <p className="text-sm font-medium">
                  {workspace.accounts.find((account) => account.id === item.accountId)?.name ??
                    "Cuenta"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Desde {item.effectiveFrom} · Versión {item.version}
                </p>
                {item.shares.length ? (
                  item.shares.map((share) => (
                    <p key={`${share.storeId}:${share.channel}`} className="text-sm">
                      {workspace.stores.find((store) => store.id === share.storeId)?.name ??
                        "Tienda"}{" "}
                      · {share.channel ?? "Sin canal"} ·{" "}
                      {advertisingSharePercent(share.basisPoints)} %
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Sin asignación</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asignación por cuenta</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <fieldset disabled={!canConfigure || busy} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-account`}>Cuenta Meta</Label>
                  <Select
                    value={accountId}
                    onValueChange={chooseAccount}
                    disabled={!canConfigure || busy}
                  >
                    <SelectTrigger id={`${id}-account`} className="w-full">
                      <SelectValue placeholder="Elige una cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspace.accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} · {account.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${id}-date`}>Vigente desde</Label>
                  <Input
                    id={`${id}-date`}
                    type="date"
                    min={workspace.today}
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                    required
                  />
                </div>
              </div>
              {assignment ? (
                <p className="text-xs text-muted-foreground">
                  Versión guardada {assignment.version} · Vigente desde {assignment.effectiveFrom}
                </p>
              ) : null}
              {shares.map((share, index) => (
                <div
                  key={share.key}
                  className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_100px_auto]"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-store-${index}`}>Tienda</Label>
                    <Select
                      value={share.storeId}
                      onValueChange={(value) => changeShare(index, { storeId: value })}
                      disabled={!canConfigure || busy}
                    >
                      <SelectTrigger id={`${id}-store-${index}`} className="w-full">
                        <SelectValue placeholder="Elige una tienda" />
                      </SelectTrigger>
                      <SelectContent>
                        {workspace.stores.map((store) => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-channel-${index}`}>Canal</Label>
                    <Select
                      value={share.channel}
                      onValueChange={(value) => changeShare(index, { channel: value })}
                      disabled={!canConfigure || busy}
                    >
                      <SelectTrigger id={`${id}-channel-${index}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin canal</SelectItem>
                        {workspace.channels.map((channel) => (
                          <SelectItem key={channel} value={channel}>
                            {channel}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${id}-share-${index}`}>Porcentaje</Label>
                    <Input
                      id={`${id}-share-${index}`}
                      inputMode="decimal"
                      value={share.percent}
                      onChange={(event) => changeShare(index, { percent: event.target.value })}
                      placeholder="50"
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="self-end"
                    aria-label={`Quitar tienda ${index + 1}`}
                    onClick={() =>
                      setShares((items) => items.filter((_, position) => position !== index))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!accountId || !workspace.stores.length || shares.length >= 20}
                onClick={() => {
                  const key = `${id}-new-${nextKey.current++}`;
                  setShares((items) => [
                    ...items,
                    { key, storeId: "", channel: "none", percent: items.length ? "" : "100" },
                  ]);
                }}
              >
                <Plus aria-hidden="true" />
                Añadir tienda
              </Button>
              {!shares.length && accountId ? (
                <p className="text-sm text-muted-foreground">
                  La cuenta quedará sin asignación. Su gasto seguirá en el total de empresa.
                </p>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor={`${id}-reason`}>Motivo del cambio</Label>
                <Input
                  id={`${id}-reason`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={3}
                  maxLength={500}
                  required
                />
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" size="sm" disabled={!accountId || !canConfigure || busy}>
                Guardar asignación
              </Button>
            </fieldset>
          </form>
          {!canConfigure ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Necesitas permiso para configurar las asignaciones.
            </p>
          ) : null}
          {!workspace.stores.length ? (
            <p className="mt-3 text-xs text-muted-foreground">
              No hay tiendas disponibles en esta empresa.
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gasto asignado del periodo</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-3">
          {workspace.allocated.coverage.map((item) => (
            <Badge key={item.currency} variant="outline">
              {item.currency} ·{" "}
              {item.coverage === "complete"
                ? "Datos completos"
                : item.coverage === "partial"
                  ? "Datos parciales"
                  : "Datos pendientes"}
              {item.provisional ? " · Provisionales" : ""}
            </Badge>
          ))}
          {workspace.allocated.totals.length ? (
            <Table aria-label="Gasto asignado a tiendas">
              <TableHeader>
                <TableRow>
                  <TableHead>Tienda</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Gasto disponible</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspace.allocated.totals.map((item) => (
                  <TableRow key={`${item.storeId}:${item.channel}:${item.currency}`}>
                    <TableCell>
                      {workspace.stores.find((store) => store.id === item.storeId)?.name ??
                        "Tienda no disponible"}
                    </TableCell>
                    <TableCell>{item.channel ?? "Sin canal"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatMetaSpend(item.amount, item.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No hay gasto asignado en este periodo.</p>
          )}
          {workspace.allocated.unassigned.map((item) => (
            <p key={`${item.accountId}:${item.currency}`} className="text-xs text-muted-foreground">
              Sin asignación ·{" "}
              {workspace.accounts.find((account) => account.id === item.accountId)?.name ??
                "Cuenta"}{" "}
              · {formatMetaSpend(item.amount, item.currency)}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
