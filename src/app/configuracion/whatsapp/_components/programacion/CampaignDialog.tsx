"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type UseFormReturn, useForm, useWatch } from "react-hook-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  WHATSAPP_CAMPAIGN_DESTINATION_OPTIONS,
  WHATSAPP_CAMPAIGN_RECURRENCE_OPTIONS,
  WHATSAPP_CAMPAIGN_STAGE_OPTIONS,
} from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppCampaignScheduleType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { toCampaignValues } from "@/features/whatsapp/mappers/to-scheduling-form-values.mapper";
import type {
  WhatsAppCampaign,
  WhatsAppSegmentCount,
} from "@/features/whatsapp/models/campaign.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import {
  CAMPAIGN_ALL_COURIERS,
  type CampaignValues,
  createCampaignSchema,
} from "@/features/whatsapp/schemas/campaign.schema";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";

const CAMPAIGN_BLOCKED_ID = "campaign-dialog-blocked";

export type CampaignDialogMode = { kind: "new" } | { kind: "edit"; campaign: WhatsAppCampaign };

interface CampaignDialogProps {
  mode: CampaignDialogMode;
  templates: ResourceState<WhatsAppTemplate[]>;
  catalogs: WhatsAppScopeCatalogs;
  canPersist: boolean;
  getSegmentCount: (values: CampaignValues) => ResourceState<WhatsAppSegmentCount>;
  now?: () => Date;
  onClose: () => void;
  onSave?: (values: CampaignValues) => void;
}

function SelectField({
  form,
  name,
  label,
  placeholder,
  options,
  disabled,
  description,
}: {
  form: UseFormReturn<CampaignValues>;
  name: "templateId" | "stage" | "courierId" | "storeId" | "destination" | "recurrence";
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  description?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value || undefined}
            onValueChange={(value) => {
              if (value && value !== field.value) field.onChange(value);
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className="w-full" onBlur={field.onBlur}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampaignDialog({
  mode,
  templates,
  catalogs,
  canPersist,
  getSegmentCount,
  now,
  onClose,
  onSave,
}: CampaignDialogProps) {
  const campaign = mode.kind === "edit" ? mode.campaign : null;
  const storeOptions = catalogs.stores.kind === "ready" ? catalogs.stores.data : [];
  const courierOptions = catalogs.couriers.kind === "ready" ? catalogs.couriers.data : [];
  const schema = useMemo(() => createCampaignSchema(now), [now]);
  const form = useForm<CampaignValues>({
    resolver: zodResolver(schema),
    defaultValues: toCampaignValues(campaign, { storeId: storeOptions[0]?.value ?? "" }),
    mode: "onTouched",
  });
  const values = useWatch({ control: form.control }) as CampaignValues;
  const { isDirty } = form.formState;
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const blocked = !canPersist || !onSave;

  useEffect(() => {
    const subscription = form.watch((_values, { name }) => {
      if ((name === "time" || name === "scheduleType") && form.getFieldState("date").isTouched) {
        void form.trigger("date");
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const approvedTemplates =
    templates.kind === "ready"
      ? templates.data.filter((template) => template.status === WHATSAPP_TEMPLATE_STATUSES.APPROVED)
      : [];
  const templateOptions = approvedTemplates.map((template) => ({
    value: template.id,
    label: template.name,
  }));
  if (campaign && !templateOptions.some((option) => option.value === campaign.templateId)) {
    templateOptions.push({ value: campaign.templateId, label: campaign.templateName });
  }

  const requestClose = () => {
    if (isDirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const count = getSegmentCount(values);

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && requestClose()}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
        >
          <DialogHeader className="flex-row items-start justify-between gap-3 border-b px-4 py-3 text-left sm:px-6">
            <div className="min-w-0 space-y-1">
              <DialogTitle>{campaign ? "Editar envío programado" : "Programar envío"}</DialogTitle>
              <DialogDescription>
                Mensaje a un grupo de pedidos, una vez o de forma recurrente.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Cerrar ventana"
              onClick={requestClose}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DialogHeader>

          <Form {...form}>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => event.preventDefault()}
            >
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del envío</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej. Aviso de retraso por feriado" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <SelectField
                  form={form}
                  name="templateId"
                  label="Plantilla"
                  placeholder={
                    templates.kind === "ready"
                      ? "Elige una plantilla aprobada"
                      : "Plantillas pendientes de integración"
                  }
                  options={templateOptions}
                  disabled={templates.kind !== "ready"}
                  description="Solo aparecen plantillas aprobadas por Meta."
                />

                <fieldset className="min-w-0 space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    A quién se envía
                  </legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                      form={form}
                      name="stage"
                      label="Estado del pedido"
                      placeholder="Elige un estado"
                      options={WHATSAPP_CAMPAIGN_STAGE_OPTIONS}
                    />
                    <SelectField
                      form={form}
                      name="courierId"
                      label="Courier"
                      placeholder="Elige un courier"
                      options={[
                        { value: CAMPAIGN_ALL_COURIERS, label: "Todos" },
                        ...courierOptions,
                      ]}
                      description={
                        catalogs.couriers.kind === "loading"
                          ? "Cargando couriers…"
                          : catalogs.couriers.kind === "error"
                            ? catalogs.couriers.message
                            : undefined
                      }
                    />
                    <SelectField
                      form={form}
                      name="storeId"
                      label="Tienda"
                      placeholder={storeOptions.length ? "Elige una tienda" : "Sin tiendas"}
                      options={storeOptions}
                      disabled={storeOptions.length === 0}
                    />
                    <SelectField
                      form={form}
                      name="destination"
                      label="Destino"
                      placeholder="Elige un destino"
                      options={WHATSAPP_CAMPAIGN_DESTINATION_OPTIONS}
                    />
                  </div>
                </fieldset>

                <WhatsAppResourceState
                  state={count}
                  pendingTitle="Conteo de destinatarios pendiente de integración"
                  pendingDescription="La cantidad de pedidos se mostrará cuando el servicio esté disponible. En cualquier caso, la lista se vuelve a calcular justo antes de enviar."
                  loadingLabel="Calculando destinatarios"
                  errorTitle="No se pudo calcular la cantidad de pedidos"
                >
                  {(data) => (
                    <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
                      Hoy esto incluye{" "}
                      <strong>{data.matchingToday.toLocaleString("es-PE")} pedidos</strong>{" "}
                      (calculado el {formatLimaDateTime(data.computedAt)}). La lista se vuelve a
                      calcular justo antes de enviar: los pedidos que cambien de estado entran o
                      salen solos.
                    </p>
                  )}
                </WhatsAppResourceState>

                <FormField
                  control={form.control}
                  name="scheduleType"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TemplateSegmentedChoice
                          legend="Cuándo"
                          name="campaign-schedule-type"
                          value={field.value}
                          options={[
                            { value: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE, label: "Una sola vez" },
                            {
                              value: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING,
                              label: "Se repite",
                            },
                          ]}
                          onValueChange={(value: WhatsAppCampaignScheduleType) =>
                            form.setValue("scheduleType", value, { shouldDirty: true })
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {values.scheduleType === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE ? (
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <SelectField
                      form={form}
                      name="recurrence"
                      label="Frecuencia"
                      placeholder="Elige la frecuencia"
                      options={WHATSAPP_CAMPAIGN_RECURRENCE_OPTIONS}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hora (Lima)</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t px-4 py-3 sm:px-6">
                {blocked && (
                  <p id={CAMPAIGN_BLOCKED_ID} className="text-sm text-muted-foreground">
                    Programar y guardar envíos estarán disponibles cuando se conecte el servicio de
                    envíos programados. Puedes completar y revisar el formulario; no se guarda nada.
                  </p>
                )}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={requestClose}>
                    Cancelar
                  </Button>
                  <BlockedActionButton
                    blocked={blocked}
                    blockedReasonId={CAMPAIGN_BLOCKED_ID}
                    onClick={() => onSave && void form.handleSubmit(onSave)()}
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    {campaign ? "Guardar cambios" : "Programar"}
                  </BlockedActionButton>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
            <AlertDialogDescription>
              Los cambios de este envío no se guardaron y se perderán al cerrar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                onClose();
              }}
            >
              Descartar cambios
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
