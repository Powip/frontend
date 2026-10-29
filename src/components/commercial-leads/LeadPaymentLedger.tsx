"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import {
  approveLeadPayment,
  rejectLeadPayment,
  changeLeadPaymentAmount,
  uploadLeadPaymentProof,
} from "@/services/leadPaymentsService";
import { commercialLeadError } from "@/services/commercialLeadsService";
import type { LeadPayment } from "@/types/leadPayments";
import {
  paymentMoney,
  safePaymentProof,
  validatePaymentProof,
} from "./paymentPresentation";

interface Props {
  payments: LeadPayment[];
  canReview: boolean;
  canUpload: boolean;
  onChanged: () => void;
}

function PaymentRow({
  payment,
  canReview,
  canUpload,
  onChanged,
}: Omit<Props, "payments"> & { payment: LeadPayment }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [notes, setNotes] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const anchored = Boolean(
    payment.leadId && Number.isInteger(payment.leadPaymentVersion),
  );
  const leadId = payment.commercialLeadId || payment.leadId;
  const proof = safePaymentProof(payment.paymentProofUrl);
  const act = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (!mounted.current) return;
      setCorrecting(false);
      onChanged();
    } catch (error) {
      if (!mounted.current) return;
      setError(commercialLeadError(error));
      onChanged();
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return (
    <li
      className="rounded-lg border p-4 space-y-3"
      aria-label={`Pago ${payment.id}`}
    >
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <strong>{paymentMoney(payment.amount, payment.currency)}</strong>
          <p className="text-sm">
            {payment.paymentMethod} ·{" "}
            {payment.status === "PENDING"
              ? "Pendiente de aprobación"
              : payment.status === "PAID"
                ? "Aprobado"
                : "Rechazado"}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {payment.order
            ? `Pedido ${payment.order.orderNumber || payment.order.id}`
            : "Anticipo sin pedido"}
          <p>
            {payment.paymentDate
              ? new Date(payment.paymentDate).toLocaleString("es-PE")
              : "Fecha no informada"}
          </p>
        </div>
      </div>
      {payment.contactName ? (
        <p className="text-sm">{payment.contactName}</p>
      ) : null}
      {payment.externalReference ? (
        <p className="text-xs break-all">
          Referencia: {payment.externalReference}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 text-sm">
        {proof ? (
          <a
            href={proof}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Ver comprobante
          </a>
        ) : (
          <span>Sin comprobante</span>
        )}
        {leadId ? (
          <Link
            href={`/leads-comerciales?leadId=${encodeURIComponent(leadId)}`}
            className="underline"
          >
            Ver Lead
          </Link>
        ) : null}
      </div>
      {anchored && canUpload ? (
        <label className="block text-sm">
          {busy ? "Procesando…" : "Adjuntar comprobante"}
          <input
            aria-label={`Comprobante ${payment.id}`}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            disabled={busy}
            className="block mt-1 text-xs"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const validation = validatePaymentProof(file);
              if (validation) {
                setError(validation);
                return;
              }
              void act(() =>
                uploadLeadPaymentProof(
                  payment.leadId!,
                  payment.id,
                  payment.leadPaymentVersion!,
                  file,
                ),
              );
            }}
          />
        </label>
      ) : null}
      {anchored && canReview && payment.status === "PENDING" ? (
        <div className="space-y-2">
          <label className="block text-sm">
            Nota de revisión
            <input
              aria-label={`Nota de revisión ${payment.id}`}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block border rounded px-2 py-1 w-full"
              disabled={busy}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  approveLeadPayment(payment.leadId!, payment.id, {
                    version: payment.leadPaymentVersion!,
                    notes: notes.trim() || undefined,
                  }),
                )
              }
            >
              Aprobar anticipo
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void act(() =>
                  rejectLeadPayment(payment.leadId!, payment.id, {
                    version: payment.leadPaymentVersion!,
                    notes: notes.trim() || undefined,
                  }),
                )
              }
            >
              Rechazar anticipo
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => setCorrecting((v) => !v)}
            >
              Corregir monto
            </Button>
          </div>
          {correcting ? (
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (
                  !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
                  Number(amount) <= 0
                ) {
                  setError("Indica un monto positivo con hasta dos decimales.");
                  return;
                }
                void act(() =>
                  changeLeadPaymentAmount(payment.leadId!, payment.id, {
                    version: payment.leadPaymentVersion!,
                    amount: Number(amount),
                  }),
                );
              }}
            >
              <label className="text-sm">
                Monto corregido
                <input
                  aria-label={`Monto corregido ${payment.id}`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="block border rounded p-1"
                  disabled={busy}
                />
              </label>
              <Button size="sm" disabled={busy}>
                Guardar monto
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {!anchored && payment.order ? (
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Este pago conserva el registro y el flujo de revisión de su pedido.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setOrderOpen(true)}
          >
            Gestionar pago del pedido
          </Button>
          <PaymentVerificationModal
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            orderId={payment.order.id}
            orderNumber={payment.order.orderNumber || payment.order.id}
            canApprove={canReview}
            onPaymentUpdated={onChanged}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </li>
  );
}

export default function LeadPaymentLedger(props: Props) {
  return props.payments.length ? (
    <ul className="space-y-3">
      {props.payments.map((payment) => (
        <PaymentRow
          key={`${payment.id}:${payment.leadPaymentVersion ?? payment.updated_at}:${props.canReview}:${props.canUpload}`}
          payment={payment}
          canReview={props.canReview}
          canUpload={props.canUpload}
          onChanged={props.onChanged}
        />
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground py-3">
      No hay pagos registrados en este Lead.
    </p>
  );
}
