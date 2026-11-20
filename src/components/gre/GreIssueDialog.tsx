"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GreModeBanner } from "@/components/gre/GreModeBanner";
import { UbigeoField } from "@/components/gre/UbigeoField";
import {
  getOrderForGreApi,
  issueDespatchAdviceApi,
  refreshDespatchAdviceStatusApi,
  sendDespatchAdviceApi,
} from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import { greKeys, useDespatchAdvices, useGreSettings } from "@/features/sunat/despatch-advice/hooks/use-despatch-advices";
import type { DespatchAdvice, DespatchIdentityDocumentType } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import {
  GRE_DOCUMENT_TYPE_LABEL,
  GRE_MODE,
  GRE_MODE_LABEL,
  GRE_REASON,
  GRE_REASON_LABEL,
  GRE_STATUS_LABEL,
  type GreAddressNames,
  greEmissionBlockReason,
  greErrorMessage,
  type GreFormState,
  greFormFromOrder,
  greFormFromTransfer,
  greFormProblems,
  greFormToRequest,
  greLastErrorText,
  type GreOrderInput,
  isLiveDespatchAdvice,
} from "@/features/sunat/despatch-advice/utils/gre-form";
import { useActiveTaxDocumentForOrder } from "@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order";
import { todayInPeru } from "@/lib/peruDate";
import { cn } from "@/lib/utils";
import { getWarehouseDetails, type Transfer, type WarehouseDetails } from "@/services/warehouseOpsService";

// FEAT-24 H12 — emitir la guía de remisión electrónica remitente (GRE) real:
// - motivo 01 (venta) desde un pedido: destinatario, llegada (ubigeo resuelto o
//   elegido) e ítems NIU del pedido; partida = su almacén (ficha H5);
// - motivo 04 (traslado entre establecimientos) desde un traslado de H5:
//   partida y llegada de las fichas de los dos almacenes; el destinatario es
//   el propio emisor (lo completa ms-sunat).
// Las reglas SUNAT se validan aquí antes de pedir número (una guía rechazada
// deja un hueco en la serie). Reemplaza el mock en memoria (H12-D6).

export type GreSource =
  | { kind: "order"; orderId: string }
  | { kind: "transfer"; transfer: Transfer; originName?: string; destinationName?: string };

interface Props {
  source: GreSource;
  onClose: () => void;
  onIssued?: (advice: DespatchAdvice) => void;
}

interface OrderForGre extends GreOrderInput {
  id: string;
  inventoryId?: string | null;
  stockStoreName?: string | null;
}

const SELECT_CLASS = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";
const STATUS_POLL_MS = 4000;
const STATUS_POLL_MAX = 6;

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export default function GreIssueDialog({ source, onClose, onIssued }: Props) {
  const queryClient = useQueryClient();
  const today = useMemo(() => todayInPeru(), []);
  const orderId = source.kind === "order" ? source.orderId : null;
  const transfer = source.kind === "transfer" ? source.transfer : null;

  const settingsQuery = useGreSettings();
  const settings = settingsQuery.data;

  const orderQuery = useQuery({
    queryKey: ["gre-order", orderId],
    queryFn: ({ signal }) => getOrderForGreApi<OrderForGre>(orderId ?? "", signal),
    enabled: Boolean(orderId),
    retry: false,
  });
  const order = orderQuery.data;
  const taxDocument = useActiveTaxDocumentForOrder(orderId, Boolean(orderId));

  const originWarehouseId = transfer ? transfer.originInventoryId : (order?.inventoryId ?? null);
  const destinationWarehouseId = transfer ? transfer.destinationInventoryId : null;
  const originWarehouse = useQuery({
    queryKey: ["warehouse-details", originWarehouseId],
    queryFn: ({ signal }) => getWarehouseDetails(originWarehouseId ?? "", signal),
    enabled: Boolean(originWarehouseId),
    retry: false,
  });
  const destinationWarehouse = useQuery({
    queryKey: ["warehouse-details", destinationWarehouseId],
    queryFn: ({ signal }) => getWarehouseDetails(destinationWarehouseId ?? "", signal),
    enabled: Boolean(destinationWarehouseId),
    retry: false,
  });

  const originName = originWarehouse.data?.name ?? (source.kind === "transfer" ? source.originName : undefined) ?? order?.stockStoreName ?? null;
  const destinationName = destinationWarehouse.data?.name ?? (source.kind === "transfer" ? source.destinationName : undefined) ?? null;
  const reference = transfer?.number ?? order?.orderNumber ?? "";
  const existing = useDespatchAdvices({ externalReference: reference, pageSize: 10 }, Boolean(reference));
  const liveExisting = (existing.data?.items ?? []).filter((advice) => isLiveDespatchAdvice(advice.status));

  const [form, setForm] = useState<GreFormState | null>(null);
  const [destinationNames, setDestinationNames] = useState<GreAddressNames | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<DespatchAdvice | null>(null);

  const settled = (query: { isPending: boolean; fetchStatus: string }) => !query.isPending || query.fetchStatus === "idle";
  const sourceReady = transfer ? true : Boolean(order);
  const dataReady = sourceReady && settled(originWarehouse) && settled(destinationWarehouse) && Boolean(settings);

  // Precarga una sola vez, cuando llegaron el pedido (o el traslado), las fichas y la configuración.
  useEffect(() => {
    if (form || !dataReady || !settings) return;
    const origin: WarehouseDetails | undefined = originWarehouse.data;
    const destination: WarehouseDetails | undefined = destinationWarehouse.data;
    let next: GreFormState;
    if (transfer) {
      next = greFormFromTransfer(transfer, origin, destination, today);
    } else if (order) {
      const built = greFormFromOrder(order, origin, today);
      next = built.form;
      setDestinationNames(built.destinationNames);
    } else {
      return;
    }
    const active = settings.profiles.filter((profile) => profile.isActive);
    const preferred =
      (taxDocument ? active.find((profile) => profile.ruc === taxDocument.rucIssuer) : undefined) ??
      active.find((profile) => profile.isDefault && profile.configured) ??
      active.find((profile) => profile.configured) ??
      active.find((profile) => profile.isDefault) ??
      active[0];
    next.sunatProfileId = preferred?.sunatProfileId ?? "";
    if (taxDocument && !transfer && (taxDocument.taxDocumentType === "01" || taxDocument.taxDocumentType === "03")) {
      next.relatedDocument = { documentType: taxDocument.taxDocumentType, number: `${taxDocument.series}-${Number(taxDocument.correlative)}` };
    }
    setForm(next);
  }, [form, dataReady, settings, transfer, order, originWarehouse.data, destinationWarehouse.data, taxDocument, today]);

  // El comprobante del pedido puede llegar después de la precarga: se agrega si no se escribió otro.
  useEffect(() => {
    if (!form || transfer || form.relatedDocument || !taxDocument) return;
    if (taxDocument.taxDocumentType !== "01" && taxDocument.taxDocumentType !== "03") return;
    const documentType = taxDocument.taxDocumentType;
    setForm((value) =>
      value && !value.relatedDocument ? { ...value, relatedDocument: { documentType, number: `${taxDocument.series}-${Number(taxDocument.correlative)}` } } : value,
    );
  }, [form, transfer, taxDocument]);

  const profile = settings?.profiles.find((item) => item.sunatProfileId === form?.sunatProfileId) ?? null;
  const problems = form ? greFormProblems(form, { today, issuerRuc: profile?.ruc ?? null }) : {};
  const blockReason = greEmissionBlockReason(settings);
  const profileProblem = profile && !profile.configured ? "Este RUC no tiene credenciales GRE: cárgalas en Facturación › Certificado Digital o elige otro." : null;
  const visible = (path: string) => (showErrors ? problems[path] : undefined);

  const update = (patch: (current: GreFormState) => GreFormState) => setForm((current) => (current ? patch(current) : current));

  const issue = useMutation({
    mutationFn: (current: GreFormState) => issueDespatchAdviceApi(greFormToRequest(current)),
    onSuccess: (advice) => {
      setResult(advice);
      setSubmitError(null);
      void queryClient.invalidateQueries({ queryKey: greKeys.all });
      onIssued?.(advice);
    },
    onError: (error) => setSubmitError(greErrorMessage(error, "No se pudo emitir la guía. Inténtalo de nuevo.")),
  });

  const resend = useMutation({
    mutationFn: (advice: DespatchAdvice) => sendDespatchAdviceApi(advice.id),
    onSuccess: (advice) => {
      setResult(advice);
      void queryClient.invalidateQueries({ queryKey: greKeys.all });
    },
    onError: (error) => setSubmitError(greErrorMessage(error, "No se pudo reenviar la guía.")),
  });

  // SUNAT contesta por ticket: mientras esté SENT se consulta el estado unas veces.
  const statusQuery = useQuery({
    queryKey: ["gre-status", result?.id],
    queryFn: () => refreshDespatchAdviceStatusApi(result?.id ?? ""),
    enabled: result?.status === "SENT",
    retry: false,
    refetchInterval: (query) => (query.state.data?.status ?? "SENT") === "SENT" && query.state.dataUpdateCount < STATUS_POLL_MAX ? STATUS_POLL_MS : false,
  });
  const current = result && statusQuery.data?.id === result.id ? statusQuery.data : result;
  useEffect(() => {
    if (statusQuery.data && statusQuery.data.status !== "SENT") void queryClient.invalidateQueries({ queryKey: greKeys.lists() });
  }, [statusQuery.data, queryClient]);

  const submit = () => {
    if (!form) return;
    setShowErrors(true);
    setSubmitError(null);
    if (blockReason || profileProblem || Object.keys(problems).length > 0) return;
    issue.mutate(form);
  };

  const busy = issue.isPending || resend.isPending;
  const loadError = orderQuery.isError
    ? "No se pudo cargar el pedido. Cierra y vuelve a intentarlo."
    : settingsQuery.isError
      ? "No se pudo cargar la configuración de guías de remisión."
      : null;
  const title = transfer ? `Traslado ${transfer.number}` : order ? `Pedido ${order.orderNumber}` : "Pedido";
  const reasonText = transfer ? `${GRE_REASON.TRANSFER} · ${GRE_REASON_LABEL["04"]}` : `${GRE_REASON.SALE} · ${GRE_REASON_LABEL["01"]}`;

  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" aria-hidden="true" />
            Emitir guía de remisión
          </DialogTitle>
          <DialogDescription>
            {title} · Motivo {reasonText}. Se emite antes de que la mercadería salga del almacén.
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <GreResult
            advice={current}
            polling={statusQuery.isFetching}
            resending={resend.isPending}
            error={submitError}
            onResend={() => {
              setSubmitError(null);
              resend.mutate(current);
            }}
            onFixAndRetry={() => {
              setResult(null);
              setSubmitError(null);
            }}
            onClose={onClose}
          />
        ) : loadError ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {loadError}
          </p>
        ) : !form ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Preparando la guía…
          </p>
        ) : (
          <div className="space-y-4">
            <GreModeBanner settings={settings} sunatProfileId={form.sunatProfileId || undefined} />

            {liveExisting.length > 0 ? (
              <p role="status" className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <span>
                  {reference} ya tiene {liveExisting.length === 1 ? "la guía" : "las guías"}{" "}
                  {liveExisting.map((advice) => `${advice.number} (${GRE_STATUS_LABEL[advice.status].toLowerCase()})`).join(", ")}. Emite otra solo si la
                  anterior no sirve.
                </span>
              </p>
            ) : null}

            <Field id="gre-profile" label="RUC emisor" error={visible("sunatProfileId") ?? (showErrors ? (profileProblem ?? undefined) : undefined)}>
              <select
                id="gre-profile"
                className={SELECT_CLASS}
                value={form.sunatProfileId}
                onChange={(event) => update((value) => ({ ...value, sunatProfileId: event.target.value }))}
              >
                <option value="">Elige el RUC</option>
                {settings?.profiles
                  .filter((item) => item.isActive)
                  .map((item) => (
                    <option key={item.sunatProfileId} value={item.sunatProfileId}>
                      {item.razonSocial} · RUC {item.ruc}
                      {item.configured ? ` · serie ${item.series ?? "T001"}` : " · sin credenciales GRE"}
                    </option>
                  ))}
              </select>
            </Field>

            {form.transferReason === GRE_REASON.SALE ? (
              <Section title="Destinatario">
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <Field id="gre-recipient-type" label="Documento">
                    <select
                      id="gre-recipient-type"
                      className={SELECT_CLASS}
                      value={form.recipient.documentType}
                      onChange={(event) => update((value) => ({ ...value, recipient: { ...value.recipient, documentType: event.target.value as DespatchIdentityDocumentType } }))}
                    >
                      {(["1", "6", "4", "7"] as const).map((type) => (
                        <option key={type} value={type}>
                          {GRE_DOCUMENT_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="gre-recipient-number" label="Número de documento" error={visible("recipient.identityDocumentNumber")}>
                    <Input
                      id="gre-recipient-number"
                      value={form.recipient.documentNumber}
                      onChange={(event) => update((value) => ({ ...value, recipient: { ...value.recipient, documentNumber: event.target.value } }))}
                    />
                  </Field>
                </div>
                <Field id="gre-recipient-name" label="Nombre o razón social" error={visible("recipient.name")}>
                  <Input
                    id="gre-recipient-name"
                    value={form.recipient.name}
                    onChange={(event) => update((value) => ({ ...value, recipient: { ...value.recipient, name: event.target.value } }))}
                  />
                </Field>
              </Section>
            ) : (
              <p className="text-sm text-muted-foreground">En un traslado entre establecimientos el destinatario es tu propia empresa.</p>
            )}

            <Section title={`Punto de partida${originName ? ` · ${originName}` : ""}`}>
              {originWarehouse.isError ? <p className="text-xs text-amber-700 dark:text-amber-300">No se pudo leer la ficha del almacén: completa los datos a mano.</p> : null}
              <Field id="gre-origin-address" label="Dirección de partida" error={visible("origin.address")}>
                <Input id="gre-origin-address" value={form.origin.address} onChange={(event) => update((value) => ({ ...value, origin: { ...value.origin, address: event.target.value } }))} />
              </Field>
              <UbigeoField
                id="gre-origin"
                label="Ubigeo de partida"
                value={form.origin.ubigeo}
                onChange={(ubigeo) => update((value) => ({ ...value, origin: { ...value.origin, ubigeo } }))}
                error={visible("origin.ubigeo")}
              />
              <Field
                id="gre-origin-establishment"
                label="Código de establecimiento SUNAT"
                hint={form.transferReason === GRE_REASON.TRANSFER ? undefined : "Opcional en una venta (0000 = domicilio fiscal)."}
                error={visible("origin.establishmentCode")}
              >
                <Input
                  id="gre-origin-establishment"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.origin.establishmentCode}
                  onChange={(event) => update((value) => ({ ...value, origin: { ...value.origin, establishmentCode: event.target.value } }))}
                />
              </Field>
            </Section>

            <Section title={`Punto de llegada${destinationName ? ` · ${destinationName}` : ""}`}>
              <Field id="gre-destination-address" label="Dirección de llegada" error={visible("destination.address") ?? visible("destination")}>
                <Input
                  id="gre-destination-address"
                  value={form.destination.address}
                  onChange={(event) => update((value) => ({ ...value, destination: { ...value.destination, address: event.target.value } }))}
                />
              </Field>
              <UbigeoField
                id="gre-destination"
                label="Ubigeo de llegada"
                value={form.destination.ubigeo}
                names={destinationNames}
                onChange={(ubigeo) => update((value) => ({ ...value, destination: { ...value.destination, ubigeo } }))}
                error={visible("destination.ubigeo")}
              />
              {form.transferReason === GRE_REASON.TRANSFER ? (
                <Field id="gre-destination-establishment" label="Código de establecimiento SUNAT" error={visible("destination.establishmentCode")}>
                  <Input
                    id="gre-destination-establishment"
                    inputMode="numeric"
                    maxLength={4}
                    value={form.destination.establishmentCode}
                    onChange={(event) => update((value) => ({ ...value, destination: { ...value.destination, establishmentCode: event.target.value } }))}
                  />
                </Field>
              ) : null}
            </Section>

            <Section title="Transporte">
              <div className="flex gap-2" role="group" aria-label="Modalidad de transporte">
                {([GRE_MODE.PUBLIC, GRE_MODE.PRIVATE] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={form.transportMode === mode}
                    onClick={() => update((value) => ({ ...value, transportMode: mode }))}
                    className={cn(
                      "flex-1 rounded-md border px-3 py-2 text-center text-xs font-semibold",
                      form.transportMode === mode ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground",
                    )}
                  >
                    {mode} · {GRE_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
              {form.transportMode === GRE_MODE.PUBLIC ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="gre-carrier-ruc" label="RUC del transportista" error={visible("carrier.ruc")}>
                    <Input
                      id="gre-carrier-ruc"
                      inputMode="numeric"
                      maxLength={11}
                      placeholder="20xxxxxxxxx"
                      value={form.carrier.ruc}
                      onChange={(event) => update((value) => ({ ...value, carrier: { ...value.carrier, ruc: event.target.value } }))}
                    />
                  </Field>
                  <Field id="gre-carrier-name" label="Razón social del transportista" error={visible("carrier.name")}>
                    <Input
                      id="gre-carrier-name"
                      value={form.carrier.name}
                      onChange={(event) => update((value) => ({ ...value, carrier: { ...value.carrier, name: event.target.value } }))}
                    />
                  </Field>
                  <Field id="gre-carrier-mtc" label="Registro MTC (opcional)" error={visible("carrier.mtcRegistrationNumber")}>
                    <Input
                      id="gre-carrier-mtc"
                      value={form.carrier.mtcRegistrationNumber}
                      onChange={(event) => update((value) => ({ ...value, carrier: { ...value.carrier, mtcRegistrationNumber: event.target.value } }))}
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="gre-plate" label="Placa del vehículo" error={visible("vehicle.plate")}>
                    <Input id="gre-plate" placeholder="ABC123" value={form.vehicle.plate} onChange={(event) => update((value) => ({ ...value, vehicle: { plate: event.target.value } }))} />
                  </Field>
                  <Field id="gre-license" label="Licencia del conductor" error={visible("drivers.0.licenseNumber")}>
                    <Input
                      id="gre-license"
                      placeholder="Q12345678"
                      value={form.driver.licenseNumber}
                      onChange={(event) => update((value) => ({ ...value, driver: { ...value.driver, licenseNumber: event.target.value } }))}
                    />
                  </Field>
                  <Field id="gre-driver-type" label="Documento del conductor">
                    <select
                      id="gre-driver-type"
                      className={SELECT_CLASS}
                      value={form.driver.documentType}
                      onChange={(event) => update((value) => ({ ...value, driver: { ...value.driver, documentType: event.target.value as DespatchIdentityDocumentType } }))}
                    >
                      {(["1", "4", "7"] as const).map((type) => (
                        <option key={type} value={type}>
                          {GRE_DOCUMENT_TYPE_LABEL[type]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field id="gre-driver-number" label="Número de documento del conductor" error={visible("drivers.0.identityDocumentNumber")}>
                    <Input
                      id="gre-driver-number"
                      value={form.driver.documentNumber}
                      onChange={(event) => update((value) => ({ ...value, driver: { ...value.driver, documentNumber: event.target.value } }))}
                    />
                  </Field>
                  <Field id="gre-driver-first-name" label="Nombres del conductor" error={visible("drivers.0.firstName")}>
                    <Input
                      id="gre-driver-first-name"
                      value={form.driver.firstName}
                      onChange={(event) => update((value) => ({ ...value, driver: { ...value.driver, firstName: event.target.value } }))}
                    />
                  </Field>
                  <Field id="gre-driver-family-name" label="Apellidos del conductor" error={visible("drivers.0.familyName")}>
                    <Input
                      id="gre-driver-family-name"
                      value={form.driver.familyName}
                      onChange={(event) => update((value) => ({ ...value, driver: { ...value.driver, familyName: event.target.value } }))}
                    />
                  </Field>
                </div>
              )}
            </Section>

            <Section title="Envío">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  id="gre-start-date"
                  label={form.transportMode === GRE_MODE.PUBLIC ? "Fecha de entrega al transportista" : "Fecha de inicio del traslado"}
                  error={visible("transferStartDate")}
                >
                  <Input
                    id="gre-start-date"
                    type="date"
                    min={today}
                    value={form.transferStartDate}
                    onChange={(event) => update((value) => ({ ...value, transferStartDate: event.target.value }))}
                  />
                </Field>
                <Field id="gre-weight" label="Peso bruto (kg)" error={visible("grossWeightKg")}>
                  <Input
                    id="gre-weight"
                    inputMode="decimal"
                    placeholder="0.000"
                    value={form.grossWeightKg}
                    onChange={(event) => update((value) => ({ ...value, grossWeightKg: event.target.value }))}
                  />
                </Field>
                <Field id="gre-packages" label="Bultos" error={visible("packageCount")}>
                  <Input
                    id="gre-packages"
                    inputMode="numeric"
                    value={form.packageCount}
                    onChange={(event) => update((value) => ({ ...value, packageCount: event.target.value }))}
                  />
                </Field>
              </div>
              <Field id="gre-note" label="Nota (opcional)" error={visible("note")}>
                <Input id="gre-note" maxLength={250} value={form.note} onChange={(event) => update((value) => ({ ...value, note: event.target.value }))} />
              </Field>
              {form.transferReason === GRE_REASON.SALE ? (
                <Field
                  id="gre-related"
                  label="Comprobante relacionado (opcional)"
                  hint={form.relatedDocument ? undefined : "Si el pedido ya tiene boleta o factura, escribe su número (B001-123)."}
                  error={visible("relatedDocuments.0.number")}
                >
                  <div className="flex gap-2">
                    <select
                      aria-label="Tipo de comprobante relacionado"
                      className={`${SELECT_CLASS} w-32`}
                      value={form.relatedDocument?.documentType ?? "03"}
                      onChange={(event) =>
                        update((value) => ({ ...value, relatedDocument: { documentType: event.target.value as "01" | "03", number: value.relatedDocument?.number ?? "" } }))
                      }
                    >
                      <option value="03">Boleta</option>
                      <option value="01">Factura</option>
                    </select>
                    <Input
                      id="gre-related"
                      placeholder="B001-123"
                      value={form.relatedDocument?.number ?? ""}
                      onChange={(event) =>
                        update((value) => ({ ...value, relatedDocument: { documentType: value.relatedDocument?.documentType ?? "03", number: event.target.value } }))
                      }
                    />
                  </div>
                </Field>
              ) : null}
            </Section>

            <Section title={`Productos (${form.items.length})`}>
              {visible("items") ? <p className="text-xs text-destructive">{visible("items")}</p> : null}
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Descripción</th>
                      <th className="px-3 py-1.5 text-left font-medium">Código</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cantidad</th>
                      <th className="px-3 py-1.5 text-left font-medium">Unidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, index) => (
                      <tr key={`${item.code ?? "item"}-${index}`} className="border-t">
                        <td className="px-3 py-1.5">{item.description}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{item.code ?? "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-1.5">NIU</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {showErrors && Object.keys(problems).length > 0 ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                Revisa los campos marcados antes de emitir: SUNAT rechazaría la guía y su número quedaría usado.
              </p>
            ) : null}
            {blockReason ? (
              <p role="alert" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                {blockReason}
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                {submitError}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
                Cancelar
              </Button>
              <Button type="button" onClick={submit} disabled={busy || Boolean(blockReason)}>
                {issue.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Emitiendo…
                  </>
                ) : (
                  "Emitir guía"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GreResult({
  advice,
  polling,
  resending,
  error,
  onResend,
  onFixAndRetry,
  onClose,
}: {
  advice: DespatchAdvice;
  polling: boolean;
  resending: boolean;
  error: string | null;
  onResend: () => void;
  onFixAndRetry: () => void;
  onClose: () => void;
}) {
  const accepted = advice.status === "ACCEPTED" || advice.status === "ACCEPTED_WITH_OBSERVATION";
  return (
    <div className="space-y-4" data-testid="gre-result">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            accepted && "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
            advice.status === "REJECTED" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
            (advice.status === "SENT" || advice.status === "PENDING") && "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
          )}
        >
          {accepted ? <CheckCircle2 className="h-5 w-5" /> : advice.status === "REJECTED" ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-base font-semibold">
            {accepted
              ? `SUNAT aceptó la guía ${advice.number}`
              : advice.status === "REJECTED"
                ? `SUNAT rechazó la guía ${advice.number}`
                : advice.status === "SENT"
                  ? `Guía ${advice.number} enviada a SUNAT`
                  : `La guía ${advice.number} quedó pendiente de envío`}
          </p>
          {accepted ? <p className="text-muted-foreground">La mercadería ya puede salir con esta guía.</p> : null}
          {advice.status === "ACCEPTED_WITH_OBSERVATION" && advice.observations.length ? (
            <ul className="list-disc pl-5 text-xs text-muted-foreground">
              {advice.observations.map((observation) => (
                <li key={observation}>{observation}</li>
              ))}
            </ul>
          ) : null}
          {advice.status === "SENT" ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              {polling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Esperando la respuesta de SUNAT. Si tarda, consulta el estado desde Facturación › Guías de remisión.
            </p>
          ) : null}
          {advice.status === "REJECTED" ? (
            <p>
              Código {advice.sunatCode ?? "—"}: {advice.sunatDescription ?? "sin descripción"}. Corrige los datos y emite otra guía: la rechazada no se reenvía.
            </p>
          ) : null}
          {advice.status === "PENDING" ? (
            <p>
              {greLastErrorText(advice.lastError) ?? "SUNAT todavía no la recibió."} Conserva su número: puedes reenviarla ahora o desde Facturación › Guías de
              remisión.
            </p>
          ) : null}
        </div>
      </div>
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        {advice.status === "REJECTED" ? (
          <Button type="button" variant="outline" onClick={onFixAndRetry}>
            Corregir y emitir otra
          </Button>
        ) : null}
        {advice.status === "PENDING" ? (
          <Button type="button" variant="outline" onClick={onResend} disabled={resending}>
            {resending ? "Reenviando…" : "Reenviar ahora"}
          </Button>
        ) : null}
        <Button type="button" onClick={onClose} disabled={resending}>
          Cerrar
        </Button>
      </DialogFooter>
    </div>
  );
}
