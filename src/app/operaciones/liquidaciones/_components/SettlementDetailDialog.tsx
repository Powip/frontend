"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  collectionStatusLabels,
  getCourierCollection,
  getCourierSettlement,
  getSettlementProofUrl,
  reviewCourierSettlement,
  settlementMethodLabels,
  settlementMoney,
  settlementStatusLabels,
  uploadSettlementProof,
  type CollectionDetail,
  type SettlementDetail,
  type SettlementProof,
} from "@/services/courierSettlementsService";
import { settlementError } from "./SettlementCreateDialogs";

const eventLabels: Record<string, string> = {
  COLLECTION_CONFIRMED: "Cobro confirmado",
  DEPOSIT_REGISTERED: "Depósito registrado",
  DEPOSIT_REVIEWED: "Depósito revisado",
  DEPOSIT_REJECTED: "Depósito rechazado",
  PROOF_ATTACHED: "Comprobante adjuntado",
};

export function SettlementDetailDialog({
  companyId,
  actorId,
  kind,
  id,
  canReview,
  canUpload,
  onClose,
  onChanged,
}: {
  companyId: string;
  actorId: string;
  kind: "collections" | "settlements";
  id: string;
  canReview: boolean;
  canUpload: boolean;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const query = useQuery<CollectionDetail | SettlementDetail>({
    queryKey: ["courier-settlement-detail", companyId, actorId, kind, id],
    queryFn: ({ signal }) =>
      kind === "collections"
        ? getCourierCollection(companyId, id, signal)
        : getCourierSettlement(companyId, id, signal),
    retry: false,
  });
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(true);
  const submitting = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const data = query.data;
  const settlement = data && "allocations" in data ? data : null;
  const collection = data && !("allocations" in data) ? data : null;
  const pending = settlement?.status === "PENDIENTE_REVISION";
  const acceptsProof = canUpload && (!settlement || pending);

  async function upload() {
    if (!file || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await uploadSettlementProof(companyId, kind, id, file);
      if (!active.current) return;
      setFile(null);
      await query.refetch();
      await onChanged();
    } catch (cause) {
      if (active.current) setError(settlementError(cause));
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  async function review(accept: boolean) {
    if (!settlement || !pending || !canReview || submitting.current || notes.trim().length < 5)
      return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await reviewCourierSettlement(companyId, id, {
        accept,
        version: settlement.version,
        notes: notes.trim(),
      });
      if (!active.current) return;
      await query.refetch();
      await onChanged();
      setNotes("");
    } catch (cause) {
      if (active.current) {
        setError(settlementError(cause));
        await query.refetch();
      }
    } finally {
      submitting.current = false;
      if (active.current) setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {kind === "collections" ? "Detalle del cobro" : "Detalle del depósito"}
          </DialogTitle>
          <DialogDescription>
            Historial del courier hacia el negocio. Los pagos del cliente se verifican por separado
            en Finanzas.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p role="status">Cargando historial…</p>
        ) : query.isError || !data ? (
          <div role="alert">
            No se pudo cargar el registro.{" "}
            <Button type="button" variant="link" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">
                {data.courierName} ·{" "}
                {collection
                  ? collectionStatusLabels[collection.status]
                  : settlementStatusLabels[settlement!.status]}
              </p>
              <p>
                Registrado por {data.createdBy} · {new Date(data.createdAt).toLocaleString("es-PE")}
              </p>
              {data.notes && <p>{data.notes}</p>}
            </div>
            {collection && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p>
                  Pedido: {collection.orderNumber} · {collection.customerName}
                </p>
                <p>Fecha del cobro: {collection.collectedAt.slice(0, 10)}</p>
                <p>Cobro confirmado: {settlementMoney(collection.amount, collection.currency)}</p>
                <p>
                  Liquidado al negocio:{" "}
                  {settlementMoney(collection.settledAmount, collection.currency)}
                </p>
                <p>
                  Reservado en revisión:{" "}
                  {settlementMoney(collection.reservedAmount, collection.currency)}
                </p>
                <p>
                  Disponible por liquidar:{" "}
                  {settlementMoney(collection.availableAmount, collection.currency)}
                </p>
              </div>
            )}
            {collection?.providerEvidence && (
              <p className="rounded border p-2 text-sm">
                Evidencia vinculada: {collection.providerEvidence.provider} · Importe originalmente
                reportado: {collection.providerEvidence.reportedAmount ?? "No informado"}. La
                confirmación registrada es de{" "}
                {settlementMoney(collection.amount, collection.currency)}.
              </p>
            )}
            {settlement && (
              <>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Esperado al registrar", settlement.amountExpected],
                    ["Depositado", settlement.amountDeposited],
                    ["Asignado a cobros", settlement.amountAllocated],
                    ["Exceso sin asignar", settlement.unallocatedAmount],
                    ["Diferencia", settlement.difference],
                  ].map(([label, amount]) => (
                    <div key={String(label)}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-semibold">
                        {settlementMoney(Number(amount), settlement.currency)}
                      </dd>
                    </div>
                  ))}
                  <div>
                    <dt className="text-muted-foreground">Método y fecha</dt>
                    <dd>
                      {settlementMethodLabels[settlement.method]} · {settlement.date.slice(0, 10)}
                    </dd>
                  </div>
                </dl>
                {settlement.operationNumber && (
                  <p className="text-sm">Operación: {settlement.operationNumber}</p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Pedido</th>
                        <th className="p-2">Cliente</th>
                        <th className="p-2">Asignado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlement.allocations.map((item) => (
                        <tr key={item.collectionId} className="border-t">
                          <td className="p-2">{item.orderNumber}</td>
                          <td className="p-2">{item.customerName}</td>
                          <td className="p-2">
                            {settlementMoney(item.amount, settlement.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {settlement.reviewedAt && (
                  <p className="rounded bg-muted/40 p-3 text-sm">
                    Revisado por {settlement.reviewedBy} ·{" "}
                    {new Date(settlement.reviewedAt).toLocaleString("es-PE")}
                    <br />
                    {settlement.reviewNotes}
                  </p>
                )}
              </>
            )}
            <section className="space-y-2">
              <h3 className="font-semibold">Comprobantes guardados</h3>
              {data.proofs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin comprobantes adjuntos.</p>
              ) : (
                data.proofs.map((proof) => (
                  <ProofLink key={proof.id} companyId={companyId} proof={proof} />
                ))
              )}
              {acceptsProof && (
                <div className="space-y-2 rounded border p-3">
                  <Label htmlFor="detail-proof">Adjuntar comprobante real</Label>
                  <Input
                    id="detail-proof"
                    type="file"
                    disabled={busy}
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG, WebP o PDF · hasta 10 MB.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !file}
                    onClick={() => void upload()}
                  >
                    {busy ? "Guardando…" : "Guardar comprobante"}
                  </Button>
                </div>
              )}
            </section>
            {settlement && pending && canReview && (
              <section className="space-y-3 rounded-lg border p-3">
                <h3 className="font-semibold">Revisión de Finanzas</h3>
                <p className="text-sm text-muted-foreground">
                  Aceptar aplica únicamente las asignaciones indicadas. Los importes pendientes y
                  excesos se conservan; no aprueba pagos del cliente.
                </p>
                <Label htmlFor="settlement-review-notes">Resultado de la verificación</Label>
                <Textarea
                  id="settlement-review-notes"
                  disabled={busy}
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe lo verificado (mínimo 5 caracteres)."
                />
                {settlement.method !== "efectivo" && !settlement.proofs.length && (
                  <p className="text-sm text-amber-700">
                    Adjunta el comprobante antes de aceptar este depósito.
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || notes.trim().length < 5}
                    onClick={() => void review(false)}
                  >
                    Rechazar depósito
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      busy ||
                      notes.trim().length < 5 ||
                      (settlement.method !== "efectivo" && !settlement.proofs.length)
                    }
                    onClick={() => void review(true)}
                  >
                    Aceptar depósito verificado
                  </Button>
                </div>
              </section>
            )}
            <section>
              <h3 className="mb-2 font-semibold">Historial</h3>
              <ol className="space-y-2">
                {data.events.map((event) => (
                  <li key={event.id} className="rounded bg-muted/40 p-2 text-xs">
                    <p className="font-medium">
                      {eventLabels[event.type] ?? "Actualización del registro"}
                    </p>
                    <p>
                      {event.actorId} · {new Date(event.createdAt).toLocaleString("es-PE")}
                    </p>
                    {typeof event.data.notes === "string" && <p>{event.data.notes}</p>}
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function ProofLink({ companyId, proof }: { companyId: string; proof: SettlementProof }) {
  const [link, setLink] = useState<{ url: string; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function requestLink() {
    setBusy(true);
    setError("");
    try {
      const result = await getSettlementProofUrl(companyId, proof.id);
      setLink({ url: result.url, expiresAt: Date.now() + result.expiresIn * 1000 });
    } catch (cause) {
      setError(settlementError(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded border p-2 text-sm">
      <p>
        {proof.fileName} · {(proof.size / 1024).toFixed(0)} KB
      </p>
      {link && link.expiresAt > Date.now() ? (
        <a
          className="text-violet-700 underline"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir comprobante
        </a>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="link"
          disabled={busy}
          onClick={() => void requestLink()}
        >
          {busy ? "Preparando…" : "Preparar enlace privado"}
        </Button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
