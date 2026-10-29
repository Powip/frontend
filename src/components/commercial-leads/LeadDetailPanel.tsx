"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addCommercialLeadActivity,
  commercialLeadError,
  confirmCommercialLead,
  getCommercialLead,
  getCommercialLeadContext,
  loseCommercialLead,
  reopenCommercialLead,
  updateCommercialLead,
} from "@/services/commercialLeadsService";
import type {
  LeadCapabilities,
  LeadConfirmationCapabilities,
  LeadDetail,
  LeadType,
} from "@/types/leads";
import LeadContactForm from "./LeadContactForm";
import { prepareCommercialOrder } from "@/services/commercialOrderPreparationService";
import LeadPaymentsPanel from "./LeadPaymentsPanel";
import { notifyCommercialChange } from "@/utils/commercialOrders";
import {
  LEAD_ACTIVITY_LABELS,
  LEAD_STATUS_LABELS,
  leadCommandId,
  leadDate,
  leadIsOpen,
  leadMoney,
} from "./lead-ui";

type Context = Awaited<ReturnType<typeof getCommercialLeadContext>>;
export default function LeadDetailPanel({
  id,
  companyId,
  types,
  stores,
  capabilities,
  confirmationCapabilities,
  onChanged,
  onClose,
}: {
  id: string;
  companyId: string;
  types: LeadType[];
  stores: Array<{ id: string; name: string }>;
  capabilities: LeadCapabilities;
  confirmationCapabilities: LeadConfirmationCapabilities | null;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { auth, hasPermission } = useAuth();
  const canEditOrder = hasPermission?.("EDIT_SALE") ?? auth?.user.permissions?.includes("EDIT_SALE") === true;
  const canEditClient = hasPermission?.("MANAGE_CLIENTS") ?? auth?.user.permissions?.includes("MANAGE_CLIENTS") === true;
  const currentActorName =
    [auth?.user?.name, auth?.user?.surname].filter(Boolean).join(" ").trim() ||
    auth?.user?.email ||
    auth?.user?.id ||
    "Cuenta actual";
  const actorLabel = (actorId: string | null) =>
    !actorId
      ? "Actor no registrado"
      : actorId === auth?.user?.id
        ? "Tú"
        : actorId;
  const [lead, setLead] = useState<LeadDetail | null>(null),
    [context, setContext] = useState<Context | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [readFailed, setReadFailed] = useState(false);
  const [editing, setEditing] = useState(false),
    [note, setNote] = useState(""),
    [kind, setKind] = useState<"CONTACTADO" | "SEGUIMIENTO" | "NOTA">("NOTA"),
    [next, setNext] = useState("");
  const [closure, setClosure] = useState<"lose" | "reopen" | null>(null),
    [reason, setReason] = useState("");
  const [review, setReview] = useState<{
    commandId: string;
    version: number;
    expectedOrderUpdatedAt: string;
  } | null>(null);
  const request = useRef(0),
    mutationLock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const reload = useCallback(async () => {
    const current = ++request.current;
    setLoading(true);
    setError("");
    setReadFailed(false);
    try {
      const [fresh, source] = await Promise.all([
        getCommercialLead(id),
        getCommercialLeadContext(id),
      ]);
      if (current !== request.current) return;
      if (fresh.companyId !== companyId || source.leadId !== fresh.id)
        throw new Error("El Lead no está disponible en este negocio.");
      setLead(fresh);
      setContext(source);
      setReview(null);
    } catch (failure) {
      if (current === request.current) {
        setReadFailed(true);
        setError(commercialLeadError(failure));
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [id, companyId]);
  useEffect(() => {
    void reload();
    return () => {
      ++request.current;
    };
  }, [reload]);
  useEffect(() => {
    const changedExternally = (event: Event) => {
      const detail = (
        event as CustomEvent<{ companyId?: string; leadId?: string }>
      ).detail;
      if (detail?.companyId === companyId && detail.leadId === id)
        void reload();
    };
    window.addEventListener("commercial-leads:changed", changedExternally);
    return () =>
      window.removeEventListener("commercial-leads:changed", changedExternally);
  }, [companyId, id, reload]);
  const changed = () => {
    if (!mounted.current) return;
    notifyCommercialChange(companyId);
    onChanged();
    void reload();
  };
  async function mutate(action: () => Promise<unknown>, after?: () => void) {
    if (mutationLock.current || loading || readFailed) return;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (!mounted.current) return;
      after?.();
      changed();
    } catch (failure) {
      if (mounted.current) setError(commercialLeadError(failure));
    } finally {
      mutationLock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function activity(event: FormEvent) {
    event.preventDefault();
    if (!lead) return;
    await mutate(
      () =>
        addCommercialLeadActivity(lead.id, {
          version: lead.version,
          kind,
          note: note.trim() || undefined,
          nextActionAt: next ? new Date(next).toISOString() : undefined,
        }),
      () => {
        setNote("");
        setNext("");
      },
    );
  }
  const order = context?.order ?? null;
  const orderCurrency = order?.currency ?? lead?.currency ?? null;
  const open = lead ? leadIsOpen(lead) : false;
  const quotationId = context?.quotationId;
  const hasCheckout = !!context?.liveCheckoutId;
  return (
    <Dialog
      open
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{lead?.contactName || "Detalle del Lead"}</DialogTitle>
          <DialogDescription>
            Seguimiento comercial, documentos y pagos de la misma oportunidad.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 p-3 text-sm text-red-700"
          >
            {error}
            <Button
              className="ml-2"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void reload()}
            >
              Actualizar detalle
            </Button>
          </div>
        ) : null}
        {loading && !lead ? (
          <p role="status">Cargando Lead…</p>
        ) : lead ? (
          <fieldset
            className="min-w-0 space-y-6"
            disabled={busy || loading || readFailed}
          >
            {loading ? <p role="status">Actualizando Lead…</p> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium">
                  {LEAD_STATUS_LABELS[lead.status]}
                </span>
                <span className="rounded-full border px-3 py-1 text-sm">
                  {lead.type?.name ??
                    types.find((type) => type.code === lead.typeCode)?.name ??
                    lead.typeCode}
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void reload()}
                >
                  Actualizar
                </Button>
                {capabilities.canManage && open ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Cerrar edición" : "Editar contacto"}
                  </Button>
                ) : null}
              </div>
            </div>
            {editing ? (
              <LeadContactForm
                lead={lead}
                types={types}
                stores={stores}
                onCancel={() => setEditing(false)}
                onSaved={() => {
                  setEditing(false);
                  changed();
                }}
              />
            ) : (
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd className="break-words">
                    {lead.contactPhone || "Sin teléfono"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Correo</dt>
                  <dd className="break-words">
                    {lead.contactEmail || "Sin correo"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Tienda</dt>
                  <dd>
                    {stores.find((store) => store.id === lead.storeId)?.name ??
                      (lead.storeId
                        ? "Tienda del Lead"
                        : "Sin tienda asignada")}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Importe estimado</dt>
                  <dd>{leadMoney(lead.estimatedAmount, lead.currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Recibido</dt>
                  <dd>{leadDate(lead.receivedAt)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Próxima acción</dt>
                  <dd>
                    {lead.nextActionAt
                      ? leadDate(lead.nextActionAt)
                      : "Sin programar"}
                  </dd>
                </div>
                {Object.entries(lead.customFields).map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-muted-foreground">
                      {lead.type?.fields.find((field) => field.key === key)
                        ?.label ??
                        types
                          .find((type) => type.code === lead.typeCode)
                          ?.fields.find((field) => field.key === key)?.label ??
                        key}
                    </dt>
                    <dd className="break-words">
                      {typeof value === "boolean"
                        ? value
                          ? "Sí"
                          : "No"
                        : value == null
                          ? "Sin indicar"
                          : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {lead.status === "CONVERTIDO" ? (
              <section className="space-y-2 rounded-xl border border-green-200 bg-green-50 p-4 dark:bg-green-950/20">
                <h3 className="font-semibold">Compra confirmada</h3>
                <p className="text-sm">
                  {lead.confirmationBasis === "WEB_PREPAID"
                    ? "Web con prepago aprobado"
                    : lead.confirmationBasis === "SELLER"
                      ? "Confirmada por vendedor"
                      : "Venta histórica verificada"}{" "}
                  · {leadDate(lead.confirmedAt)}
                </p>
                <p className="text-sm">
                  Confirmó: {actorLabel(lead.confirmedBy)}
                </p>
                {lead.convertedOrderId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/registrar-venta?orderId=${encodeURIComponent(lead.convertedOrderId)}`}
                    >
                      Ver venta vinculada
                    </Link>
                  </Button>
                ) : null}
              </section>
            ) : null}
            {lead.status === "PERDIDO" ? (
              <p className="rounded-md border p-3 text-sm">
                Motivo de pérdida: {lead.lostReason}
              </p>
            ) : null}
            <section className="space-y-3 rounded-xl border p-4">
              <h3 className="font-semibold">Documentos vinculados</h3>
              {context?.sources.length ? (
                <ul
                  className="space-y-1 text-xs text-muted-foreground"
                  aria-label="Referencias de origen"
                >
                  {context.sources.map((source) => (
                    <li key={source.id} className="break-words">
                      {source.provider} · {source.objectType} ·{" "}
                      {source.externalId}
                    </li>
                  ))}
                </ul>
              ) : null}
              {order ? (
                <>
                  <div className="grid gap-2 text-sm sm:grid-cols-3">
                    <p>
                      Pedido: <strong>{order.orderNumber}</strong>
                    </p>
                    <p>
                      Total:{" "}
                      <strong>
                        {leadMoney(order.grandTotal, orderCurrency)}
                      </strong>
                    </p>
                    <p>
                      Estado operativo: <strong>{order.status}</strong>
                    </p>
                  </div>
                  {order.commercialStockState ? (
                    <p className="rounded-md border p-3 text-sm">
                      {order.commercialStockState === "DEFERRED"
                        ? "Reserva diferida: falta completar la información de la compra para gestionar su preparación."
                        : order.commercialStockState === "QUEUED"
                          ? "Solicitud de reserva registrada. Espera la confirmación de inventario antes de preparar el pedido."
                          : order.commercialStockState === "PRESERVED"
                            ? "Se conservan las reservas previas del pedido."
                            : order.commercialStockState === "NOT_REQUIRED" ? "Este pedido contiene sólo servicios y no requiere inventario físico ni reserva." : "Estado de reserva pendiente de revisión."}
                    </p>
                  ) : null}
                  {order.commercialStage === "SALE" && order.commercialStockState === "DEFERRED" && confirmationCapabilities?.enabled && confirmationCapabilities.canConfirm && (
                    <Button type="button" disabled={busy || loading || readFailed} onClick={() => void mutate(() => prepareCommercialOrder(order.id, order.updated_at))}>Solicitar preparación del pedido</Button>
                  )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Productos del pedido vinculado
                      </caption>
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2">Producto</th>
                          <th>Cantidad</th>
                          <th>Precio unitario</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((item) => (
                          <tr key={item.id} className="border-b">
                            <td className="py-2">{item.productName}</td>
                            <td>{item.quantity}</td>
                            <td>{leadMoney(item.unitPrice, orderCurrency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Confirmar la compra reutiliza este pedido y sus pagos. La
                    preparación y el despacho se gestionan después.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {hasCheckout
                    ? "El checkout Live todavía no tiene pedido vinculado. Espera a que se complete su flujo de pago."
                    : quotationId
                      ? "La compra se prepara desde la cotización vinculada."
                      : lead.legacyOrderId
                        ? "El pedido vinculado no está disponible para revisión."
                        : "Esta oportunidad todavía no tiene pedido."}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {open && order && canEditOrder ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/registrar-venta?orderId=${encodeURIComponent(order.id)}`}>
                      {canEditClient ? "Editar DNI y pedido" : "Editar pedido"}
                    </Link>
                  </Button>
                ) : null}
                {quotationId ? (
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={`/cotizaciones?quotationId=${encodeURIComponent(quotationId)}&fromLead=${encodeURIComponent(lead.id)}`}
                    >
                      Abrir cotización
                    </Link>
                  </Button>
                ) : null}
                {confirmationCapabilities?.enabled &&
                confirmationCapabilities.canConfirm &&
                open &&
                order &&
                !quotationId ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      setReview({
                        commandId: leadCommandId(),
                        version: lead.version,
                        expectedOrderUpdatedAt: order.updated_at,
                      })
                    }
                  >
                    Revisar y confirmar compra
                  </Button>
                ) : null}
                {confirmationCapabilities?.enabled &&
                confirmationCapabilities.canConfirm &&
                open &&
                !order &&
                !quotationId &&
                !hasCheckout &&
                !lead.legacyOrderId ? (
                  <Button asChild>
                    <Link
                      href={`/registrar-venta?leadId=${encodeURIComponent(lead.id)}`}
                    >
                      Preparar compra del Lead
                    </Link>
                  </Button>
                ) : null}
              </div>
              {review && order ? (
                <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <h4 className="font-medium">Confirmación del vendedor</h4>
                  <p className="text-sm">Confirmará: {currentActorName} (tú)</p>
                  <p className="text-sm">
                    Confirma que el cliente aceptó los productos y el total de{" "}
                    {leadMoney(order.grandTotal, orderCurrency)}. Los pagos
                    registrados se conservan.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void mutate(() =>
                          confirmCommercialLead(lead.id, review),
                        )
                      }
                    >
                      {busy ? "Confirmando…" : "Confirmar compra"}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setReview(null)}
                    >
                      Volver al detalle
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
            <LeadPaymentsPanel lead={lead} onChanged={changed} />
            {capabilities.canManage && open ? (
              <form
                onSubmit={activity}
                className="space-y-3 rounded-xl border p-4"
                aria-label="Registrar seguimiento"
              >
                <h3 className="font-semibold">Contacto y seguimiento</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="lead-activity-kind">Actividad</Label>
                    <select
                      id="lead-activity-kind"
                      className="w-full rounded-md border bg-background p-2 text-sm"
                      disabled={busy}
                      value={kind}
                      onChange={(event) =>
                        setKind(event.target.value as typeof kind)
                      }
                    >
                      <option value="NOTA">Nota</option>
                      <option value="CONTACTADO">Contacto realizado</option>
                      <option value="SEGUIMIENTO">Seguimiento</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="lead-next-action">Próxima acción</Label>
                    <Input
                      id="lead-next-action"
                      type="datetime-local"
                      disabled={busy}
                      value={next}
                      onChange={(event) => setNext(event.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="lead-note">Nota de seguimiento</Label>
                  <textarea
                    id="lead-note"
                    className="min-h-20 w-full rounded-md border bg-background p-3 text-sm"
                    maxLength={2000}
                    required={kind === "NOTA"}
                    disabled={busy}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy}>Registrar actividad</Button>
                  {lead.nextActionAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void mutate(() =>
                          updateCommercialLead(lead.id, {
                            version: lead.version,
                            nextActionAt: null,
                          }),
                        )
                      }
                    >
                      Quitar próxima acción
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : null}
            {capabilities.canManage && lead.status !== "CONVERTIDO" ? (
              <section className="space-y-3">
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setClosure(lead.status === "PERDIDO" ? "reopen" : "lose");
                    setReason("");
                  }}
                >
                  {lead.status === "PERDIDO"
                    ? "Reabrir Lead"
                    : "Marcar como perdido"}
                </Button>
                {closure ? (
                  <form
                    className="space-y-3 rounded-lg border p-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(
                        () =>
                          closure === "lose"
                            ? loseCommercialLead(lead.id, {
                                version: lead.version,
                                reason,
                              })
                            : reopenCommercialLead(lead.id, {
                                version: lead.version,
                                reason,
                              }),
                        () => setClosure(null),
                      );
                    }}
                  >
                    <Label htmlFor="lead-closure-reason">
                      Motivo de {closure === "lose" ? "pérdida" : "reapertura"}
                    </Label>
                    <Input
                      id="lead-closure-reason"
                      required
                      maxLength={500}
                      disabled={busy}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Esta acción cambia el seguimiento comercial y conserva los
                      pedidos, pagos y reservas vinculados.
                    </p>
                    <div className="flex gap-2">
                      <Button disabled={busy}>
                        Guardar {closure === "lose" ? "pérdida" : "reapertura"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setClosure(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}
              </section>
            ) : null}
            <section className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">Historial de la oportunidad</h3>
              {lead.activities.length ? (
                <ol className="space-y-3">
                  {lead.activities.map((activity) => (
                    <li
                      key={activity.id}
                      className="border-l-2 border-primary/20 pl-3"
                    >
                      <p className="text-sm font-medium">
                        {LEAD_ACTIVITY_LABELS[activity.kind] ??
                          activity.kind.replaceAll("_", " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {leadDate(activity.createdAt)} ·{" "}
                        {actorLabel(activity.actorId)}
                      </p>
                      {typeof activity.payload.note === "string" ? (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {activity.payload.note}
                        </p>
                      ) : null}
                      {typeof activity.payload.reason === "string" ? (
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {activity.payload.reason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin actividades registradas.
                </p>
              )}
            </section>
          </fieldset>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
