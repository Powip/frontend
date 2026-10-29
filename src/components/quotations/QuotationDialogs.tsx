"use client";

import { useEffect, useState } from "react";
import { getLeadPaymentCapabilities } from "@/services/leadPaymentsService";
import type { LeadPaymentCapabilities } from "@/types/leadPayments";
import { commercialLeadHref } from "@/utils/commercialOrders";
import Link from "next/link";
import {
  AlertTriangle,
  Copy,
  ExternalLink,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  convertQuotation,
  registerQuotationPayment,
  reviewQuotationPayment,
  reconcileQuotationLeadPayment,
  uploadQuotationProof,
} from "@/services/quotationService";
import type {
  ConvertQuotationInput,
  Quotation,
  QuotationPayment,
} from "@/types/quotations";
import {
  errorMessage,
  lineHasStockIssue,
  money,
  quotationHasStockIssue,
  quotationHasUnlinkedLines,
  quotationHttpUrl,
  quotationStatus,
  quotationWhatsAppUrl,
  statusClasses,
  statusLabels,
} from "./quotationHelpers";
import QuotationLocationFields from "./QuotationLocationFields";
import { isCompleteQuotationLocation, quotationLocation, quotationSalesRegion, quotationSuggestedZone } from "./quotationLocations";

const fieldClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
export const paymentLabels = {
  YAPE_QR: "Yape QR",
  MERCADO_PAGO: "Mercado Pago",
  TRANSFERENCIA: "Transferencia",
};
const paymentStatusLabels = {
  PENDIENTE: "Por aprobar",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
};

export function activeQuotationPayment(quotation: Quotation) {
  const latest = quotation.payments?.[quotation.payments.length - 1];
  return latest?.status === "RECHAZADO" ? undefined : latest;
}

export function depositAmount(quotation: Quotation) {
  return (
    quotation.depositAmount ??
    Number(activeQuotationPayment(quotation)?.amount || 0)
  );
}

function Summary({
  quotation,
  shipping = 0,
  conversion = false,
  currency,
}: {
  quotation: Quotation;
  shipping?: number;
  conversion?: boolean;
  currency?: string;
}) {
  const deposit = depositAmount(quotation);
  const showMoney = (amount: number) =>
    currency && currency !== "PEN"
      ? `${currency} ${Number(amount || 0).toFixed(2)}`
      : money(amount);
  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <div className="flex justify-between">
        <span>Total productos</span>
        <strong>{showMoney(quotation.total)}</strong>
      </div>
      {(shipping > 0 || conversion) && (
        <div className="flex justify-between">
          <span>Envío</span>
          <strong>{showMoney(shipping)}</strong>
        </div>
      )}
      {deposit > 0 && (
        <div className="flex justify-between text-teal-700 dark:text-teal-300">
          <span>Adelanto registrado</span>
          <strong>−{showMoney(deposit)}</strong>
        </div>
      )}
      <div className="flex justify-between border-t pt-3">
        <strong>{conversion ? "Total a cobrar" : "Saldo pendiente"}</strong>
        <strong className="text-lg text-teal-700 dark:text-teal-300">
          {showMoney(Math.max(0, Number(quotation.total) + shipping - deposit))}
        </strong>
      </div>
    </div>
  );
}

export function QuotationShareDialog({
  quotation,
  onClose,
}: {
  quotation: Quotation;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Link de cotización</DialogTitle>
          <DialogDescription>
            {quotation.customerName} puede revisar su cotización, confirmar y
            enviar el comprobante desde este link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="quotation-public-url">
            Link para {quotation.customerName}
          </Label>
          <div className="flex gap-2">
            <Input
              id="quotation-public-url"
              value={quotation.publicUrl}
              readOnly
            />
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(quotation.publicUrl);
                  setCopied(true);
                } catch {
                  toast.error("No se pudo copiar. Selecciona y copia el link.");
                }
              }}
            >
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            El mismo link permite seguir el pedido después de convertirlo en
            venta.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <a
              href={quotationWhatsAppUrl(quotation)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle className="mr-2 h-4 w-4" />
              Abrir en WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationPaymentDialog({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: Quotation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(
    quotation.payments?.length ? "" : String(quotation.suggestedDeposit || ""),
  );
  const [method, setMethod] = useState<QuotationPayment["method"]>("YAPE_QR");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending =
    activeQuotationPayment(quotation)?.status === "PENDIENTE"
      ? activeQuotationPayment(quotation)
      : undefined;
  const overpayment = Number(amount) > Number(quotation.total);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0)
      return setError("Ingresa un monto válido mayor a cero.");
    if (
      file &&
      (!["image/jpeg", "image/png", "application/pdf"].includes(file.type) ||
        file.size > 5 * 1024 * 1024)
    )
      return setError("Adjunta un JPG, PNG o PDF de hasta 5 MB.");
    setSaving(true);
    setError("");
    try {
      const proofUrl = file
        ? await uploadQuotationProof(quotation.id, file)
        : undefined;
      await registerQuotationPayment(quotation.id, {
        amount: Number(amount),
        method,
        proofUrl,
      });
      toast.success("Adelanto registrado. Pendiente de aprobación.");
      onSaved();
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo registrar el adelanto."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar adelanto</DialogTitle>
          <DialogDescription>
            {quotation.number} · {quotation.customerName}. El comprobante se
            revisará antes de aprobar el pago.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Summary quotation={quotation} />
          {pending && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
              <strong>
                Adelanto pendiente de aprobación: {money(pending.amount)}
              </strong>
              <p className="mt-1 text-xs">
                Verifica el comprobante. El adelanto registrado se reflejará al
                convertir esta cotización.
              </p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">Monto del adelanto (S/) *</Label>
              <Input
                id="payment-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Método *</Label>
              <select
                id="payment-method"
                className={fieldClass}
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as QuotationPayment["method"])
                }
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {overpayment && (
            <p
              role="status"
              className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              El adelanto supera el total cotizado. Revisa el monto; el saldo
              quedará en S/0.00.
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="payment-proof">Comprobante (opcional)</Label>
            <Input
              id="payment-proof"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-muted-foreground">
              JPG, PNG o PDF · máximo 5 MB
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Registrando…" : "Registrar adelanto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationDetailDialog({
  quotation,
  canReviewPayments,
  canConvert = true,
  onClose,
  onUpdated,
  onEdit,
  onConvert,
  onShare,
  onPayment,
}: {
  quotation: Quotation;
  canReviewPayments: boolean;
  canConvert?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onEdit: () => void;
  onConvert: () => void;
  onShare: () => void;
  onPayment: () => void;
}) {
  const [reviewing, setReviewing] = useState("");
  const [paymentCaps, setPaymentCaps] =
    useState<LeadPaymentCapabilities | null>(null);
  const [reconcileCurrency, setReconcileCurrency] = useState("");
  const [ackApproved, setAckApproved] = useState(false);
  const [reconciledLeadId, setReconciledLeadId] = useState<string | null>(null);
  const [capsError, setCapsError] = useState("");
  useEffect(() => {
    let active = true;
    setPaymentCaps(null);
    setCapsError("");
    setReconcileCurrency("");
    setAckApproved(false);
    setReconciledLeadId(null);
    getLeadPaymentCapabilities()
      .then((caps) => {
        if (active) setPaymentCaps(caps);
      })
      .catch(() => {
        if (active)
          setCapsError(
            "No se pudo comprobar el permiso financiero. Actualiza antes de revisar pagos.",
          );
      });
    return () => {
      active = false;
    };
  }, [quotation.id]);
  async function reconcile(payment: QuotationPayment) {
    if (!paymentCaps?.canReview || !/^[A-Z]{3}$/.test(reconcileCurrency))
      return;
    setReviewing(payment.id);
    try {
      const canonical = await reconcileQuotationLeadPayment(
        quotation.id,
        payment.id,
        { currency: reconcileCurrency, confirmApproved: ackApproved },
      );
      setReconciledLeadId(canonical.leadId);
      toast.success(
        "Anticipo vinculado al Lead con una sola identidad. Revísalo en su bandeja.",
      );
      onUpdated();
    } catch (error) {
      toast.error(errorMessage(error, "No se pudo conciliar el anticipo."));
    } finally {
      setReviewing("");
    }
  }

  const status = quotationStatus(quotation);
  async function review(
    paymentId: string,
    nextStatus: "APROBADO" | "RECHAZADO",
  ) {
    setReviewing(paymentId);
    try {
      await reviewQuotationPayment(quotation.id, paymentId, nextStatus);
      toast.success(
        nextStatus === "APROBADO" ? "Pago aprobado." : "Pago rechazado.",
      );
      onUpdated();
    } catch (failure) {
      toast.error(errorMessage(failure, "No se pudo actualizar el pago."));
    } finally {
      setReviewing("");
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {quotation.number}
            <span
              className={`rounded-full border px-2.5 py-1 text-xs ${statusClasses[status]}`}
            >
              {statusLabels[status]}
            </span>
          </DialogTitle>
          <DialogDescription>
            {quotation.customerName} · {quotation.customerPhone}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-muted-foreground">Tipo de cobro</p>
              <p className="mt-1 font-medium">
                {quotation.paymentType === "ADELANTO"
                  ? `Con adelanto de ${money(quotation.suggestedDeposit)}`
                  : "Pago completo"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Vigencia</p>
              <p className="mt-1 font-medium">
                {new Date(quotation.expiresAt).toLocaleString("es-PE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Cliente</p>
              <p className="mt-1 font-medium">
                {quotation.customerConfirmed
                  ? "Confirmó desde el link"
                  : "Por confirmar"}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3 text-left">Producto</th>
                  <th className="p-3 text-right">Cant.</th>
                  <th className="p-3 text-right">Precio</th>
                  <th className="p-3 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {quotation.lines.map((line, index) => (
                  <tr key={line.id || index} className="border-t">
                    <td className="p-3">
                      {quotationHttpUrl(line.imageUrl) && (
                        <img src={quotationHttpUrl(line.imageUrl)!} alt={line.name} width={48} height={48} loading="lazy" decoding="async" className="mb-2 h-12 w-12 rounded-md object-cover" />
                      )}
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[line.variant, line.sku].filter(Boolean).join(" · ")}
                      </p>
                      {line.isManual && (
                        <p className="text-xs text-amber-700">
                          Manual · sin control de stock
                        </p>
                      )}
                      {lineHasStockIssue(line) && (
                        <p className="text-xs text-red-700">
                          Sin stock suficiente — quedan{" "}
                          {line.stockAvailable ?? 0}
                        </p>
                      )}
                    </td>
                    <td className="p-3 text-right">{line.quantity}</td>
                    <td className="p-3 text-right">{money(line.unitPrice)}</td>
                    <td className="p-3 text-right font-medium">
                      {money(line.quantity * line.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Summary quotation={quotation} />
          {quotation.internalNote && (
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <p className="mb-1 font-medium">Nota interna</p>
              <p className="whitespace-pre-wrap">{quotation.internalNote}</p>
            </div>
          )}
          {quotation.payments?.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Historial de adelantos</h3>
              {capsError && (
                <p role="alert" className="text-sm text-destructive">
                  {capsError}
                </p>
              )}
              {paymentCaps?.enabled && (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p>
                    El anticipo vigente se vincula al Lead antes de convertir.
                    Su aprobación y comprobante conservan la misma identidad.
                  </p>
                  {paymentCaps.canReview && (
                    <>
                      <Label htmlFor="quote-reconcile-currency">
                        Moneda del anticipo
                      </Label>
                      <Input
                        id="quote-reconcile-currency"
                        maxLength={3}
                        value={reconcileCurrency}
                        placeholder="PEN, USD…"
                        onChange={(e) =>
                          setReconcileCurrency(e.target.value.toUpperCase())
                        }
                      />
                      {activeQuotationPayment(quotation)?.status ===
                        "APROBADO" && (
                        <label className="flex gap-2">
                          <input
                            type="checkbox"
                            checked={ackApproved}
                            onChange={(e) => setAckApproved(e.target.checked)}
                          />
                          Confirmo la evidencia del pago aprobado registrada en
                          la cotización
                        </label>
                      )}
                    </>
                  )}
                  {reconciledLeadId && (
                    <Link
                      className="underline"
                      href={commercialLeadHref(reconciledLeadId)}
                    >
                      Gestionar el anticipo en el Lead
                    </Link>
                  )}
                </div>
              )}
              {quotation.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {money(payment.amount)} · {paymentLabels[payment.method]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {paymentStatusLabels[payment.status]} ·{" "}
                      {new Date(payment.createdAt).toLocaleDateString("es-PE")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payment.proofUrl && (
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={payment.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Comprobante
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {paymentCaps?.enabled &&
                      paymentCaps.canReview &&
                      payment.id === activeQuotationPayment(quotation)?.id &&
                      status !== "CONVERTIDA" && (
                        <Button
                          size="sm"
                          disabled={
                            !!reviewing ||
                            !/^[A-Z]{3}$/.test(reconcileCurrency) ||
                            (payment.status === "APROBADO" && !ackApproved)
                          }
                          onClick={() => void reconcile(payment)}
                        >
                          Vincular anticipo al Lead
                        </Button>
                      )}
                    {paymentCaps &&
                      !paymentCaps.enabled &&
                      canReviewPayments &&
                      payment.status === "PENDIENTE" &&
                      status !== "CONVERTIDA" && (
                        <>
                          <Button
                            size="sm"
                            disabled={!!reviewing}
                            onClick={() => void review(payment.id, "APROBADO")}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!!reviewing}
                            onClick={() => void review(payment.id, "RECHAZADO")}
                          >
                            Rechazar
                          </Button>
                        </>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {status === "CONVERTIDA" && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-500/10">
              Venta creada:{" "}
              <Link className="font-bold underline" href="/ventas">
                {quotation.orderNumber || "Ver en Ventas"}
              </Link>
            </p>
          )}
        </div>
        <DialogFooter className="flex-wrap">
          <Button variant="outline" onClick={onShare}>
            Compartir link
          </Button>
          {status !== "CONVERTIDA" && (
            <>
              <Button variant="outline" onClick={onPayment}>
                Registrar adelanto
              </Button>
              {status === "PREVENTA" && (
                <>
                  <Button variant="outline" onClick={onEdit}>
                    Editar
                  </Button>
                  <Button
                    className="bg-teal-600 hover:bg-teal-700"
                    disabled={!canConvert || (!quotationHasUnlinkedLines(quotation) && quotationHasStockIssue(quotation))}
                    onClick={onConvert}
                  >
                    Convertir a venta
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationConvertDialog({
  quotation,
  onClose,
  onSaved,
}: {
  quotation: Quotation;
  onClose: () => void;
  onSaved: (quotation: Quotation) => void;
}) {
  const savedAddress = quotation.address;
  const savedLocation = quotationLocation(savedAddress);
  const [fields, setFields] = useState({
    currency: "",
    address: savedAddress?.address || "",
    ...savedLocation,
    reference: savedAddress?.reference || "",
    documentNumber: savedAddress?.documentNumber || "",
    zone: quotationSuggestedZone(savedLocation),
    clientType: "TRADICIONAL",
    salesChannel: "",
    closingChannel: "",
    deliveryType: "DOMICILIO",
    courier: "",
    paymentMethod: "",
    shippingTotal: "0",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof fields, value: string) =>
    setFields((previous) => ({ ...previous, [key]: value }));
  const shipping =
    fields.deliveryType === "DOMICILIO" ? Number(fields.shippingTotal) || 0 : 0;
  const hasUnlinkedLines = quotationHasUnlinkedLines(quotation);
  const unlinkedLinesMessage =
    "Reemplaza las líneas manuales o sin vincular por productos del catálogo antes de crear la venta. Puedes editar la cotización y conservar sus pagos.";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!fields.address.trim() || !isCompleteQuotationLocation(fields))
      return setError("Completa dirección y distrito, seleccionando también departamento y provincia para despachar la venta.");
    if (!/^[A-Z]{3}$/.test(fields.currency))
      return setError(
        "Selecciona la moneda del pedido y del anticipo conciliado.",
      );
    if (!fields.salesChannel || !fields.closingChannel)
      return setError(
        "Selecciona los canales de venta y cierre acordados con el cliente.",
      );
    if (!fields.paymentMethod)
      return setError(
        "Selecciona la condición de cobro acordada con el cliente.",
      );
    if (fields.documentNumber && !/^\d{8}$/.test(fields.documentNumber))
      return setError("El DNI debe tener 8 dígitos.");
    if (
      !Number.isFinite(Number(fields.shippingTotal)) ||
      Number(fields.shippingTotal) < 0
    )
      return setError("Ingresa un costo de envío válido.");
    setSaving(true);
    setError("");
    const payload: ConvertQuotationInput = {
      ...fields,
      address: fields.address.trim(),
      district: fields.district.trim(),
      deliveryType: fields.deliveryType as "DOMICILIO" | "RETIRO_TIENDA",
      shippingTotal: shipping,
      salesRegion: quotationSalesRegion(fields),
      paymentMethod: fields.paymentMethod as
        | "CONTRAENTREGA"
        | "YAPE_QR"
        | "MERCADO_PAGO"
        | "TRANSFERENCIA",
    };
    try {
      const saved = await convertQuotation(quotation.id, payload);
      toast.success(
        `Venta ${saved.orderNumber || ""} ${hasUnlinkedLines ? "recuperada" : "creada"}.`,
      );
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure, "No se pudo convertir la cotización."));
    } finally {
      setSaving(false);
    }
  }
  function textField(
    key: keyof typeof fields,
    label: string,
    required = false,
  ) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`convert-${key}`}>
          {label}
          {required ? " *" : ""}
        </Label>
        <Input
          id={`convert-${key}`}
          value={fields[key]}
          maxLength={key === "documentNumber" ? 8 : undefined}
          onChange={(event) =>
            update(
              key,
              key === "currency"
                ? event.target.value.toUpperCase()
                : event.target.value,
            )
          }
        />
      </div>
    );
  }
  function selectField(
    key: keyof typeof fields,
    label: string,
    options: [string, string][],
  ) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`convert-${key}`}>{label}</Label>
        <select
          id={`convert-${key}`}
          className={fieldClass}
          value={fields[key]}
          onChange={(event) =>
            update(
              key,
              key === "currency"
                ? event.target.value.toUpperCase()
                : event.target.value,
            )
          }
        >
          {["salesChannel", "closingChannel", "paymentMethod", "zone"].includes(key) ? (
            <option value="">Selecciona una opción</option>
          ) : null}
          {options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const channels: [string, string][] = [
    ["WHATSAPP", "WhatsApp"],
    ["TIKTOK", "TikTok"],
    ["SHOPIFY", "Shopify"],
    ["INSTAGRAM", "Instagram"],
    ["FACEBOOK", "Facebook"],
    ["WEB", "Web"],
    ["TIENDA_FISICA", "Tienda física"],
    ["MARKETPLACE", "Marketplace"],
    ["MERCADOLIBRE", "Mercado Libre"],
    ["OTRO", "Otro"],
  ];
  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Convertir cotización en venta</DialogTitle>
          <DialogDescription>
            {quotation.number} · Completa los datos de entrega y pago para crear
            la orden en Ventas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <strong>{quotation.customerName}</strong> ·{" "}
            {quotation.customerPhone}
            <p className="mt-1 text-muted-foreground">
              {quotation.lines
                .map((line) => `${line.quantity} × ${line.name}`)
                .join(" · ")}
            </p>
          </div>
          {hasUnlinkedLines && (
            <div
              role="alert"
              className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
            >
              <p>{unlinkedLinesMessage}</p>
              <p className="mt-2">
                Si una conversión anterior se interrumpió, puedes recuperar su venta existente.
                Esta acción sólo recupera una venta ya registrada.
              </p>
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-4">
              {textField("currency", "Moneda (PEN, USD…)", true)}
              {textField("address", "Dirección de entrega", true)}
              <QuotationLocationFields
                idPrefix="convert"
                value={fields}
                labelSuffix=" *"
                className={`${fieldClass} mt-1.5 min-w-0`}
                disabled={saving}
                onChange={(location) => setFields((previous) => ({
                  ...previous,
                  ...location,
                  zone: quotationSuggestedZone(location),
                }))}
              />
              {selectField(
                "zone",
                "Zona",
                [
                  "LIMA_NORTE",
                  "LIMA_SUR",
                  "LIMA_ESTE",
                  "LIMA_CENTRO",
                  "PROVINCIAS",
                ].map((value) => [value, value.replaceAll("_", " ")]),
              )}
              {textField("reference", "Referencia (opcional)")}
              {textField("documentNumber", "DNI (opcional)")}
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {selectField("clientType", "Tipo de cliente", [
                  ["TRADICIONAL", "Tradicional"],
                  ["RECURRENTE", "Recurrente"],
                  ["MAYORISTA", "Mayorista"],
                ])}
                {selectField("salesChannel", "Canal de venta", channels)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {selectField("closingChannel", "Canal de cierre", [
                  ...channels,
                  ["LLAMADA", "Llamada"],
                  ["TIKTOK_LIVE", "TikTok Live"],
                ])}
                {selectField("paymentMethod", "Tipo de pago", [
                  ["CONTRAENTREGA", "Contraentrega"],
                  ["YAPE_QR", "Yape QR"],
                  ["MERCADO_PAGO", "Mercado Pago"],
                  ["TRANSFERENCIA", "Transferencia"],
                ])}
              </div>
              {selectField("deliveryType", "Tipo de entrega", [
                ["DOMICILIO", "Envío a domicilio"],
                ["RETIRO_TIENDA", "Recojo en tienda"],
              ])}
              {fields.deliveryType === "DOMICILIO" && (
                <>
                  {textField("courier", "Courier (opcional)")}
                  <div className="space-y-1.5">
                    <Label htmlFor="convert-shipping">
                      Costo de envío (
                      {fields.currency === "PEN"
                        ? "S/"
                        : fields.currency || "moneda"}
                      )
                    </Label>
                    <Input
                      id="convert-shipping"
                      type="number"
                      min="0"
                      step="0.01"
                      value={fields.shippingTotal}
                      onChange={(event) =>
                        update("shippingTotal", event.target.value)
                      }
                    />
                  </div>
                </>
              )}
              <Summary
                quotation={quotation}
                shipping={shipping}
                conversion
                currency={fields.currency}
              />
              {activeQuotationPayment(quotation)?.status === "PENDIENTE" && (
                <p className="text-xs text-amber-700">
                  El adelanto pendiente conserva su estado y deberá verificarse.
                </p>
              )}
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                saving || (!hasUnlinkedLines && quotationHasStockIssue(quotation))
              }
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {hasUnlinkedLines
                ? saving ? "Recuperando venta…" : "Recuperar venta existente"
                : saving ? "Creando venta…" : "Confirmar y crear venta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
