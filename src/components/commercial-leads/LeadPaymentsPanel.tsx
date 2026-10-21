"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import type { LeadDetail } from "@/types/leads";
import type {
  CaptureLeadPaymentInput,
  LeadPayment,
  LeadPaymentCapabilities,
  LeadPaymentMethod,
} from "@/types/leadPayments";
import {
  getLeadPaymentCapabilities,
  getLeadPayments,
  captureLeadPayment,
  uploadLeadPaymentProof,
} from "@/services/leadPaymentsService";
import { commercialLeadError } from "@/services/commercialLeadsService";
import { notifyCommercialChange } from "@/utils/commercialOrders";
import LeadPaymentLedger from "./LeadPaymentLedger";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import { leadCommandId } from "./lead-ui";
import {
  paymentGroups,
  paymentMoney,
  validatePaymentProof,
  validPaymentCurrency,
} from "./paymentPresentation";

const METHODS: LeadPaymentMethod[] = [
  "YAPE",
  "PLIN",
  "TRANSFERENCIA",
  "EFECTIVO",
  "BCP",
  "BANCO_NACION",
  "MERCADO_PAGO",
  "POS",
];
export default function LeadPaymentsPanel({
  lead,
  onChanged,
}: {
  lead: LeadDetail;
  onChanged: () => void;
}) {
  const { auth } = useAuth();
  const scope = `${auth?.company?.id || ""}:${auth?.user?.id || ""}:${auth?.user?.role || ""}:${(auth?.user?.permissions || []).join(",")}:${lead.id}`;
  const [caps, setCaps] = useState<LeadPaymentCapabilities | null>(null);
  const [payments, setPayments] = useState<LeadPayment[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [amount, setAmount] = useState(""),
    [currency, setCurrency] = useState(lead.currency || ""),
    [method, setMethod] = useState<LeadPaymentMethod>("YAPE"),
    [reference, setReference] = useState(""),
    [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [proofRetry, setProofRetry] = useState<{
    paymentId: string;
    file: File;
  } | null>(null);
  const [loadedScope, setLoadedScope] = useState("");
  const [readFailed, setReadFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const orderId = lead.convertedOrderId || lead.legacyOrderId;
  const epoch = useRef(0),
    lock = useRef(false),
    activeScope = useRef(scope);
  activeScope.current = scope;
  const command = useRef<{
    scope: string;
    input: CaptureLeadPaymentInput;
    file: File | null;
  } | null>(null);
  const load = useCallback(async () => {
    const request = ++epoch.current;
    setLoading(true);
    setReadFailed(false);
    try {
      const capabilities = await getLeadPaymentCapabilities();
      if (request !== epoch.current || activeScope.current !== scope) return;
      setCaps(capabilities);
      if (!capabilities.enabled || !capabilities.canView) {
        setPayments([]);
        setLoadedScope(scope);
        return;
      }
      const result = await getLeadPayments(lead.id);
      if (request === epoch.current && activeScope.current === scope) {
        setPayments(result.data);
        setLoadedScope(scope);
      }
    } catch (error) {
      if (request === epoch.current && activeScope.current === scope) {
        setReadFailed(true);
        setError(commercialLeadError(error));
        setLoadedScope(scope);
      }
    } finally {
      if (request === epoch.current) setLoading(false);
    }
  }, [scope, lead.id]);
  useEffect(() => {
    activeScope.current = scope;
    setError("");
    setPayments([]);
    setCaps(null);
    setNotice("");
    setAmount("");
    setCurrency(lead.currency || "");
    setFile(null);
    setProofRetry(null);
    setPending(false);
    setOrderOpen(false);
    setBusy(false);
    command.current = null;
    void load();
    return () => {
      epoch.current += 1;
      activeScope.current = "";
    };
  }, [scope, load]);
  const changed = () => {
    void load();
    notifyCommercialChange(auth?.company?.id);
    onChanged();
  };
  const capture = async () => {
    if (lock.current || loading || readFailed || orderId || !caps?.canCapture)
      return;
    if (!command.current) {
      if (
        !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
        Number(amount) <= 0 ||
        !validPaymentCurrency(currency)
      ) {
        setError(
          "Indica un monto positivo y una moneda válida; usa hasta dos decimales.",
        );
        return;
      }
      if (file) {
        const validation = validatePaymentProof(file);
        if (validation) {
          setError(validation);
          return;
        }
      }
      command.current = {
        scope,
        input: {
          captureId: leadCommandId(),
          amount: Number(amount),
          currency,
          paymentMethod: method,
          externalReference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        file,
      };
      setPending(true);
    }
    const operation = command.current;
    if (operation.scope !== scope) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await captureLeadPayment(lead.id, operation.input);
      if (activeScope.current !== operation.scope) return;
      command.current = null;
      setPending(false);
      setAmount("");
      setReference("");
      setNotes("");
      setFile(null);
      setNotice(
        "Anticipo registrado. La compra sigue pendiente de confirmación del vendedor.",
      );
      if (operation.file) {
        try {
          await uploadLeadPaymentProof(
            lead.id,
            saved.id,
            saved.leadPaymentVersion!,
            operation.file,
          );
          if (activeScope.current === operation.scope) setProofRetry(null);
        } catch (error) {
          if (activeScope.current === operation.scope) {
            setProofRetry({ paymentId: saved.id, file: operation.file });
            setError(
              `El anticipo ya está guardado. Falta adjuntar su comprobante: ${commercialLeadError(error)}`,
            );
          }
        }
      }
      if (activeScope.current === operation.scope) {
        void load();
        notifyCommercialChange(auth?.company?.id);
        onChanged();
      }
    } catch (error) {
      if (activeScope.current === operation.scope)
        setError(commercialLeadError(error));
    } finally {
      lock.current = false;
      if (activeScope.current === operation.scope) setBusy(false);
    }
  };
  if (loadedScope !== scope) return <p role="status">Cargando pagos…</p>;
  if (!loading && caps && !caps.enabled)
    return (
      <p className="text-sm text-muted-foreground">
        Los anticipos de Leads todavía no están habilitados.
      </p>
    );
  if (!loading && caps && !caps.canView)
    return (
      <p className="text-sm text-muted-foreground">
        No tienes permiso para consultar estos pagos.
      </p>
    );
  return (
    <section className="space-y-4" aria-label="Anticipos del Lead">
      <h3 className="font-semibold">Anticipos y pagos</h3>
      <p className="text-sm text-muted-foreground">
        Los pagos conservan su identidad al confirmar la compra. Un anticipo
        aprobado no convierte este Lead en venta.
      </p>
      {loading ? <p role="status">Cargando pagos…</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="text-sm">
          {notice}
        </p>
      ) : null}
      {error && !pending ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setError("");
            void load();
          }}
        >
          Reintentar lectura
        </Button>
      ) : null}
      {!readFailed &&
        paymentGroups(payments).map((group) => (
          <p key={group.currency || "UNKNOWN"} className="text-sm">
            Aprobado: {paymentMoney(group.paid, group.currency)} · Pendiente:{" "}
            {paymentMoney(group.pending, group.currency)} · Rechazado:{" "}
            {paymentMoney(group.lost, group.currency)}
          </p>
        ))}
      {!readFailed && (
        <LeadPaymentLedger
          payments={payments}
          canReview={false}
          canUpload={caps?.canCapture === true}
          onChanged={changed}
        />
      )}
      {payments.some((p) => p.status === "PENDING") ? (
        <Link
          href={`/finanzas?tab=anticiposLeads&leadId=${encodeURIComponent(lead.id)}`}
          className="underline text-sm"
        >
          Revisar pagos en Finanzas
        </Link>
      ) : null}
      {proofRetry ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || loading || readFailed}
          onClick={async () => {
            if (lock.current) return;
            const payment = payments.find((p) => p.id === proofRetry.paymentId);
            if (!payment?.leadPaymentVersion) return;
            const operationScope = scope;
            lock.current = true;
            setBusy(true);
            try {
              await uploadLeadPaymentProof(
                lead.id,
                payment.id,
                payment.leadPaymentVersion,
                proofRetry.file,
              );
              if (activeScope.current !== operationScope) return;
              setProofRetry(null);
              setError("");
              changed();
            } catch (error) {
              if (activeScope.current === operationScope)
                setError(commercialLeadError(error));
            } finally {
              lock.current = false;
              if (activeScope.current === operationScope) setBusy(false);
            }
          }}
        >
          Reintentar sólo el comprobante
        </Button>
      ) : null}
      {orderId && caps?.canCapture ? (
        <>
          <Button variant="outline" onClick={() => setOrderOpen(true)}>
            Gestionar pagos del pedido vinculado
          </Button>
          <PaymentVerificationModal
            open={orderOpen}
            onClose={() => setOrderOpen(false)}
            orderId={orderId}
            orderNumber={orderId}
            canApprove={false}
            onPaymentUpdated={changed}
          />
        </>
      ) : null}
      {caps?.canCapture &&
      !orderId &&
      !["CONVERTIDO", "PERDIDO"].includes(lead.status) ? (
        <form
          className="rounded-lg border p-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void capture();
          }}
        >
          <h4 className="font-medium">Registrar anticipo</h4>
          <fieldset
            disabled={busy || pending || loading || readFailed}
            className="grid gap-3 sm:grid-cols-2"
          >
            <label className="text-sm">
              Monto
              <input
                aria-label="Monto del anticipo"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                className="border rounded p-2 w-full"
              />
            </label>
            <label className="text-sm">
              Moneda
              <input
                aria-label="Moneda del anticipo"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                placeholder="PEN, USD…"
                className="border rounded p-2 w-full"
              />
            </label>
            <label className="text-sm">
              Método
              <select
                aria-label="Método del anticipo"
                value={method}
                onChange={(e) => setMethod(e.target.value as LeadPaymentMethod)}
                className="border rounded p-2 w-full"
              >
                {METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Referencia
              <input
                value={reference}
                maxLength={150}
                onChange={(e) => setReference(e.target.value)}
                className="border rounded p-2 w-full"
              />
            </label>
            <label className="text-sm">
              Nota
              <input
                value={notes}
                maxLength={500}
                onChange={(e) => setNotes(e.target.value)}
                className="border rounded p-2 w-full"
              />
            </label>
            <label className="text-sm">
              Comprobante opcional
              <input
                aria-label="Comprobante del anticipo"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block mt-1 text-xs"
              />
            </label>
          </fieldset>
          <Button disabled={busy || loading || readFailed}>
            {busy
              ? "Guardando…"
              : pending
                ? "Reintentar el mismo anticipo"
                : "Registrar anticipo pendiente"}
          </Button>
        </form>
      ) : null}
    </section>
  );
}
