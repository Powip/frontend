"use client";
import { useEffect, useState } from "react";
import { Check, Eye, FileUp, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useConversationOrders } from "@/hooks/useCrmChat";
import {
  useCodMutations,
  useCodOrder,
  useDiscountMutations,
  useFinanceQueue,
  usePendingDiscounts,
  useReceiptMutations,
  useReceipts,
  useSavePolicy,
  useStorePolicy,
} from "@/hooks/useCrmOrderPanel";
import { crmError } from "@/services/crmService";
import { getReceiptFile } from "@/services/crmOrderPanelService";
import type { Conversation, ConversationOrder } from "@/types/crm";
import {
  CANCEL_REASONS,
  RECEIPT_METHODS,
  RECEIPT_METHOD_LABELS,
  type CancelReason,
  type CodAsk,
  type FirstOffer,
  type PaymentReceipt,
  type QuantityPromo,
  type ReceiptMethod,
  type ReceiptStatus,
  type SavePolicyInput,
  type StorePolicy,
} from "@/types/crmOrderPanel";
import { formatMoney, formatTime, NATIVE_SELECT_CLASS } from "./format";
import { USE_AS_RECEIPT_EVENT } from "./WhatsAppMedia";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

const FIRST_OFFER_LABEL: Record<FirstOffer, string> = {
  full: "Pago completo",
  dep: "Adelanto",
  cod: "Contra entrega",
};
const COD_ASK_LABEL: Record<CodAsk, string> = {
  dep: "Pedir adelanto",
  full: "Pedir pago completo",
  confirm: "Solo confirmar",
};
const RECEIPT_STATUS_LABEL: Record<ReceiptStatus, string> = {
  porval: "Por validar",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};
const DESTINATION_LABEL: Record<PaymentReceipt["destination"], string> = {
  core: "En Finanzas",
  local: "Solo en el CRM",
  simulated: "Simulado",
};
const DNI_RE = /^\d{8}$/;

/** Tienda del chat o, si no tiene, la elegida en el menú de Powip. */
export function useConversationStore(conversation: Pick<Conversation, "storeId">) {
  const { selectedStoreId } = useAuth();
  return conversation.storeId ?? selectedStoreId ?? "";
}

// ---------------- Política de pagos (fila 25) ----------------

function PolicyDialog({
  policy,
  onClose,
}: {
  policy: StorePolicy;
  onClose: () => void;
}) {
  const save = useSavePolicy();
  const [form, setForm] = useState<SavePolicyInput>(() => {
    const { saved: _saved, ...rest } = policy;
    return { ...rest, quantityPromos: rest.quantityPromos.map((q) => ({ ...q })) };
  });
  const set = <K extends keyof SavePolicyInput>(k: K, v: SavePolicyInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setPromo = (i: number, patch: Partial<QuantityPromo>) =>
    set(
      "quantityPromos",
      form.quantityPromos.map((q, j) => (j === i ? { ...q, ...patch } : q)),
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.depositEnabled && !(form.depositAmount > 0)) return toast.error("Indica el monto del adelanto.");
    if (form.discountCap < 0 || form.discountCap > 100) return toast.error("El tope de descuento va de 0 a 100 %.");
    await save.mutateAsync({
      ...form,
      quantityPromos: form.quantityPromos
        .filter((q) => q.minQty > 0 && q.percent > 0)
        .map((q) => ({ ...q, label: q.label.trim() || `Desde ${q.minQty} unid. -${q.percent}%` })),
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Política de pagos de la tienda</DialogTitle>
          <DialogDescription>
            La usan las vendedoras y Pau al cobrar. Solo supervisores la cambian.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pol-envio">Cobro de envío (S/)</Label>
              <Input
                id="pol-envio"
                type="number"
                min={0}
                step="0.01"
                value={form.shipCharge}
                onChange={(e) => set("shipCharge", Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-primera">Primera oferta</Label>
              <select
                id="pol-primera"
                className={NATIVE_SELECT_CLASS}
                value={form.firstOffer}
                onChange={(e) => set("firstOffer", e.target.value as FirstOffer)}
              >
                {(Object.keys(FIRST_OFFER_LABEL) as FirstOffer[]).map((k) => (
                  <option key={k} value={k}>
                    {FIRST_OFFER_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pol-adelanto-on">Aceptar adelanto</Label>
            <Switch
              id="pol-adelanto-on"
              checked={form.depositEnabled}
              onCheckedChange={(v) => set("depositEnabled", v)}
            />
          </div>
          {form.depositEnabled && (
            <div className="space-y-1">
              <Label htmlFor="pol-adelanto">Monto del adelanto (S/)</Label>
              <Input
                id="pol-adelanto"
                type="number"
                min={0}
                step="0.01"
                value={form.depositAmount}
                onChange={(e) => set("depositAmount", Number(e.target.value))}
              />
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="pol-cod-full">Contra entrega solo con pago completo al recibir</Label>
            <Switch id="pol-cod-full" checked={form.codFull} onCheckedChange={(v) => set("codFull", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="pol-cod-ask">En contra entrega</Label>
              <select
                id="pol-cod-ask"
                className={NATIVE_SELECT_CLASS}
                value={form.codAsk}
                onChange={(e) => set("codAsk", e.target.value as CodAsk)}
              >
                {(Object.keys(COD_ASK_LABEL) as CodAsk[]).map((k) => (
                  <option key={k} value={k}>
                    {COD_ASK_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pol-tope">Tope de descuento (%)</Label>
              <Input
                id="pol-tope"
                type="number"
                min={0}
                max={100}
                value={form.discountCap}
                onChange={(e) => set("discountCap", Number(e.target.value))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pol-promo">Texto de la promo</Label>
            <Textarea
              id="pol-promo"
              rows={2}
              value={form.promoText}
              onChange={(e) => set("promoText", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Promos por cantidad</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  set("quantityPromos", [...form.quantityPromos, { minQty: 2, percent: 5, label: "" }])
                }
              >
                <Plus /> Agregar
              </Button>
            </div>
            {form.quantityPromos.map((q, i) => (
              <div key={i} className="grid grid-cols-[70px_70px_1fr_auto] items-center gap-2">
                <Input
                  aria-label={`Desde (unidades) ${i + 1}`}
                  type="number"
                  min={1}
                  value={q.minQty}
                  onChange={(e) => setPromo(i, { minQty: Number(e.target.value) })}
                />
                <Input
                  aria-label={`Descuento % ${i + 1}`}
                  type="number"
                  min={1}
                  max={99}
                  value={q.percent}
                  onChange={(e) => setPromo(i, { percent: Number(e.target.value) })}
                />
                <Input
                  aria-label={`Nombre de la promo ${i + 1}`}
                  value={q.label}
                  placeholder="Ej. 3x2 en polos"
                  onChange={(e) => setPromo(i, { label: e.target.value })}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`Quitar promo ${i + 1}`}
                  onClick={() => set("quantityPromos", form.quantityPromos.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PaymentPolicySection({ conversation }: { conversation: Conversation }) {
  const storeId = useConversationStore(conversation);
  const { isSupervisor } = useCrmMe();
  const q = useStorePolicy(storeId, true);
  const [editing, setEditing] = useState(false);
  const p = q.data;
  return (
    <section className="space-y-2" aria-label="Política de pagos">
      <div className="flex items-center justify-between">
        <SectionTitle>Política de pagos</SectionTitle>
        {isSupervisor && p && (
          <Button size="sm" variant="ghost" aria-label="Editar política" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
        )}
      </div>
      {q.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Cargando política" />}
      {q.isError && <p className="text-xs text-muted-foreground">{crmError(q.error).message}</p>}
      {p && (
        <div className="space-y-0.5 rounded-md border p-2 text-xs" data-testid="policy-summary">
          <p>
            Primera oferta: <span className="font-medium">{FIRST_OFFER_LABEL[p.firstOffer]}</span>
            {p.depositEnabled ? ` · Adelanto ${formatMoney(p.depositAmount)}` : " · Sin adelanto"}
          </p>
          <p>
            Envío {p.shipCharge > 0 ? formatMoney(p.shipCharge) : "gratis"} · Contra entrega:{" "}
            {COD_ASK_LABEL[p.codAsk]}
            {p.codFull ? " (pago completo al recibir)" : ""}
          </p>
          <p>Descuento sin permiso: hasta {p.discountCap} %</p>
          {!p.saved && <p className="text-muted-foreground">Usa la política general de la empresa.</p>}
        </div>
      )}
      {editing && p && <PolicyDialog policy={p} onClose={() => setEditing(false)} />}
    </section>
  );
}

// ---------------- Descuentos por autorizar (fila 24) ----------------

export function DiscountApprovalsSection() {
  const { isSupervisor } = useCrmMe();
  const q = usePendingDiscounts(isSupervisor);
  const { decide } = useDiscountMutations();
  if (!isSupervisor || !q.data || q.data.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Descuentos por autorizar">
      <SectionTitle>Descuentos por autorizar</SectionTitle>
      <ul className="space-y-1.5">
        {q.data.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
            <span>
              <span className="font-medium">{d.percent} %</span> (tope {d.cap} %)
              {d.requestedByName ? ` · ${d.requestedByName}` : ""}
              {d.reason ? ` · «${d.reason}»` : ""}
            </span>
            <span className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Autorizar ${d.percent} %`}
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: d.id, approve: true })}
              >
                <Check />
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Rechazar ${d.percent} %`}
                disabled={decide.isPending}
                onClick={() => decide.mutate({ id: d.id, approve: false })}
              >
                <X />
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- Comprobantes (fila 26) ----------------

function statusVariant(s: ReceiptStatus): "secondary" | "default" | "destructive" {
  return s === "aprobado" ? "default" : s === "rechazado" ? "destructive" : "secondary";
}

async function openReceiptFile(id: string) {
  try {
    const blob = await getReceiptFile(id);
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    toast.error(crmError(e).message);
  }
}

function orderLabel(o: ConversationOrder) {
  return o.orderNumber ?? o.orderId.slice(0, 8);
}

export function ReceiptsSection({ conversation }: { conversation: Conversation }) {
  const receipts = useReceipts(conversation.id);
  const orders = useConversationOrders(conversation.id);
  const { upload, simulate } = useReceiptMutations(conversation.id);
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<ReceiptMethod>("YAPE");
  const [amount, setAmount] = useState("");
  const [operation, setOperation] = useState("");
  const [orderId, setOrderId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fromMessageId, setFromMessageId] = useState<string | null>(null);

  // Botón «Usar como comprobante de pago» de una imagen recibida: abre el formulario con ese archivo.
  useEffect(() => {
    const onUse = (e: Event) => {
      const id = (e as CustomEvent<{ messageId?: string }>).detail?.messageId;
      if (!id) return;
      setFromMessageId(id);
      setFile(null);
      setOpen(true);
    };
    window.addEventListener(USE_AS_RECEIPT_EVENT, onUse);
    return () => window.removeEventListener(USE_AS_RECEIPT_EVENT, onUse);
  }, []);

  function reset() {
    setOpen(false);
    setAmount("");
    setOperation("");
    setFile(null);
    setFromMessageId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) return toast.error("Ingresa el monto pagado.");
    if (!file && !fromMessageId) return toast.error("Adjunta la foto o PDF del comprobante.");
    await upload.mutateAsync({
      method,
      amount: n,
      ...(fromMessageId ? { messageId: fromMessageId } : { file: file as File }),
      ...(operation.trim() ? { operationNumber: operation.trim() } : {}),
      ...(orderId ? { orderId } : {}),
    });
    reset();
  }

  function simulatePay() {
    const n = Number(amount);
    simulate.mutate({ amount: n > 0 ? n : 1, method, ...(orderId ? { orderId } : {}) });
  }

  return (
    <section className="space-y-2" aria-label="Comprobantes de pago">
      <div className="flex items-center justify-between">
        <SectionTitle>Comprobantes de pago</SectionTitle>
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <FileUp /> Subir comprobante
          </Button>
        )}
      </div>
      {open && (
        <form className="space-y-2 rounded-md border p-2" onSubmit={submit} aria-label="Subir comprobante">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="comp-metodo" className="text-xs">
                Método
              </Label>
              <select
                id="comp-metodo"
                className={NATIVE_SELECT_CLASS}
                value={method}
                onChange={(e) => setMethod(e.target.value as ReceiptMethod)}
              >
                {RECEIPT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {RECEIPT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="comp-monto" className="text-xs">
                Monto (S/)
              </Label>
              <Input
                id="comp-monto"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="comp-operacion" className="text-xs">
              N.° de operación
            </Label>
            <Input id="comp-operacion" value={operation} onChange={(e) => setOperation(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="comp-pedido" className="text-xs">
              Pedido
            </Label>
            <select
              id="comp-pedido"
              className={NATIVE_SELECT_CLASS}
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            >
              <option value="">Sin pedido (queda en el CRM)</option>
              {(orders.data ?? []).map((o) => (
                <option key={o.id} value={o.orderId}>
                  {orderLabel(o)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="comp-archivo" className="text-xs">
              Foto o PDF
            </Label>
            {fromMessageId ? (
              <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs">
                <span data-testid="receipt-from-chat">Archivo recibido por el chat</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFromMessageId(null)}>
                  Quitar
                </Button>
              </div>
            ) : (
              <Input
                id="comp-archivo"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={simulate.isPending}
              onClick={simulatePay}
              title="Solo pruebas: no mueve dinero real"
            >
              Simular pago
            </Button>
            <Button type="submit" size="sm" disabled={upload.isPending}>
              {upload.isPending && <Loader2 className="animate-spin" />} Enviar a Finanzas
            </Button>
          </div>
        </form>
      )}
      {receipts.isError && <p className="text-xs text-muted-foreground">{crmError(receipts.error).message}</p>}
      {receipts.data && receipts.data.length === 0 && !open && (
        <p className="text-xs text-muted-foreground">Sin comprobantes en este chat.</p>
      )}
      {receipts.data && receipts.data.length > 0 && (
        <ul className="space-y-1.5" aria-label="Comprobantes del chat">
          {receipts.data.map((r) => (
            <li key={r.id} className="space-y-0.5 rounded-md border p-2 text-xs" data-testid="receipt-row">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">
                  {r.methodLabel} · {formatMoney(r.amount)}
                </span>
                <Badge variant={statusVariant(r.status)}>{RECEIPT_STATUS_LABEL[r.status]}</Badge>
              </div>
              <p className="text-muted-foreground">
                {r.operationNumber ? `Op. ${r.operationNumber} · ` : ""}
                {r.orderNumber ? `Pedido ${r.orderNumber} · ` : ""}
                {DESTINATION_LABEL[r.destination]} · {formatTime(r.createdAt)}
              </p>
              {r.coreError && <p className="text-muted-foreground">Powip: {r.coreError}</p>}
              {r.reviewNote && <p className="text-muted-foreground">Nota: {r.reviewNote}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Cola de Finanzas: comprobantes por validar de toda la empresa. */
export function FinanceQueueSection() {
  const { isSupervisor } = useCrmMe();
  const { hasPermission } = useAuth();
  const allowed =
    isSupervisor || (typeof hasPermission === "function" && hasPermission("VIEW_FINANCES"));
  const q = useFinanceQueue(allowed, "porval");
  const { review } = useReceiptMutations();
  const [note, setNote] = useState<Record<string, string>>({});
  if (!allowed || !q.data || q.data.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Pagos por validar">
      <SectionTitle>Pagos por validar ({q.data.length})</SectionTitle>
      <ul className="space-y-1.5">
        {q.data.map((r) => (
          <li key={r.id} className="space-y-1 rounded-md border p-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {r.methodLabel} · {formatMoney(r.amount)}
                {r.orderNumber ? ` · ${r.orderNumber}` : ""}
              </span>
              {r.hasFile && (
                <Button size="sm" variant="ghost" aria-label="Ver comprobante" onClick={() => openReceiptFile(r.id)}>
                  <Eye />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground">
              {r.operationNumber ? `Op. ${r.operationNumber} · ` : ""}
              {r.uploadedByName ?? "Vendedora"} · {formatTime(r.createdAt)}
            </p>
            <div className="flex gap-1">
              <Input
                aria-label="Nota de revisión"
                placeholder="Nota (opcional)"
                className="h-8"
                value={note[r.id] ?? ""}
                onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate({ id: r.id, approve: true, note: note[r.id] })}
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate({ id: r.id, approve: false, note: note[r.id] })}
              >
                Rechazar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------- Contra entrega con Gestión CC (fila 27) ----------------

function CodCard({ conversationId, link }: { conversationId: string; link: ConversationOrder }) {
  const q = useCodOrder(conversationId, link.orderId);
  const m = useCodMutations(conversationId, link.orderId);
  const [askDni, setAskDni] = useState(false);
  const [dni, setDni] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState<CancelReason>("no_contesta");
  const [detail, setDetail] = useState("");
  const o = q.data;
  if (q.isError || !o) return null;
  const busy = m.confirm.isPending || m.cancel.isPending || m.reschedule.isPending || m.dni.isPending;

  async function confirm() {
    try {
      await m.confirm.mutateAsync(askDni ? dni : undefined);
      setAskDni(false);
      setDni("");
    } catch (e) {
      if (crmError(e).code === "DNI_REQUIRED") {
        setAskDni(true);
        toast.info("Falta el DNI del cliente (8 dígitos) para confirmar.");
      }
    }
  }

  async function saveDni() {
    if (!DNI_RE.test(dni)) return toast.error("El DNI debe tener 8 dígitos.");
    if (askDni) return confirm();
    await m.dni.mutateAsync(dni);
    setDni("");
  }

  return (
    <li className="space-y-1.5 rounded-md border p-2 text-xs" data-testid="cod-card">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{o.orderNumber ?? link.orderId.slice(0, 8)}</span>
        {o.confirmed ? (
          <Badge data-testid="cod-confirmed">Confirmada</Badge>
        ) : (
          <Badge variant="secondary">{o.subEstadoCc ?? o.status}</Badge>
        )}
      </div>
      <p className="text-muted-foreground">
        {formatMoney(o.total)} · DNI {o.dniValid ? o.dniCliente : "pendiente"}
        {o.courier ? ` · ${o.courier}` : ""}
      </p>
      {!o.confirmed && (askDni || !o.dniValid) && (
        <div className="flex gap-1">
          <Input
            aria-label="DNI del cliente"
            inputMode="numeric"
            maxLength={8}
            placeholder="DNI (8 dígitos)"
            className="h-8"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          />
          <Button size="sm" variant="outline" disabled={busy || dni.length !== 8} onClick={saveDni}>
            {askDni ? "Confirmar con DNI" : "Guardar DNI"}
          </Button>
        </div>
      )}
      {o.confirmed ? null : cancelling ? (
        <div className="space-y-1">
          <select
            aria-label="Motivo de anulación"
            className={NATIVE_SELECT_CLASS}
            value={reason}
            onChange={(e) => setReason(e.target.value as CancelReason)}
          >
            {(Object.keys(CANCEL_REASONS) as CancelReason[]).map((k) => (
              <option key={k} value={k}>
                {CANCEL_REASONS[k]}
              </option>
            ))}
          </select>
          <Input
            aria-label="Detalle de anulación"
            placeholder="Detalle (opcional)"
            className="h-8"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setCancelling(false)}>
              Volver
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                await m.cancel.mutateAsync({ reason, ...(detail.trim() ? { detail: detail.trim() } : {}) });
                setCancelling(false);
              }}
            >
              Anular pedido
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {o.canConfirm !== false && (
            <Button size="sm" variant="outline" disabled={busy} onClick={confirm}>
              {m.confirm.isPending && <Loader2 className="animate-spin" />} Confirmar
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={busy} onClick={() => m.reschedule.mutate(undefined)}>
            Reprogramar
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setCancelling(true)}>
            Anular
          </Button>
        </div>
      )}
    </li>
  );
}

/** Pedidos contra entrega del chat con las acciones de Gestión CC. */
export function CodSection({ conversation }: { conversation: Conversation }) {
  const orders = useConversationOrders(conversation.id);
  const list = orders.data ?? [];
  if (list.length === 0) return null;
  return (
    <section className="space-y-2" aria-label="Contra entrega">
      <SectionTitle>Contra entrega (Gestión CC)</SectionTitle>
      <ul className="space-y-1.5">
        {list.map((o) => (
          <CodCard key={o.id} conversationId={conversation.id} link={o} />
        ))}
      </ul>
    </section>
  );
}
