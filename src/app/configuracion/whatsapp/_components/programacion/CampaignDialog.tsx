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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import {
  waButton,
  waCaps,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waField,
  waHint,
  waInput,
  waLabel,
  waSelectTrigger,
} from "@/components/whatsapp/ui/wa-classes";
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
import { cn } from "@/lib/utils";
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
        <FormItem className={waField}>
          <FormLabel className={waLabel}>{label}</FormLabel>
          <Select
            value={field.value || undefined}
            onValueChange={(value) => {
              if (value && value !== field.value) field.onChange(value);
            }}
            disabled={disabled}
          >
            <FormControl>
              <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
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
          {description && <FormDescription className={waHint}>{description}</FormDescription>}
          <FormMessage className="text-xs text-wa-red" />
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
          className={cn(
            waDialogContent,
            "flex max-h-[calc(100dvh-2rem)] w-full flex-col sm:max-w-[560px]",
          )}
        >
          <DialogHeader className={waDialogHeader}>
            <div className="min-w-0">
              <DialogTitle className={waDialogTitle}>
                {campaign ? "Editar envío programado" : "Programar envío"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Mensaje a un grupo de pedidos, una vez o de forma recurrente.
              </DialogDescription>
            </div>
            <Button
              type="button"
              className={cn(waButton({ variant: "ghost", size: "icon" }), "-my-1.5 -mr-2")}
              aria-label="Cerrar ventana"
              onClick={requestClose}
            >
              <X aria-hidden="true" />
            </Button>
          </DialogHeader>

          <Form {...form}>
            <form
              noValidate
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => event.preventDefault()}
            >
              <div
                className={cn(waDialogBody, "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto")}
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className={waField}>
                      <FormLabel className={waLabel}>Nombre del envío</FormLabel>
                      <FormControl>
                        <WaInput
                          {...field}
                          placeholder="Ej. Aviso de retraso por feriado"
                          className={waInput}
                        />
                      </FormControl>
                      <FormMessage className="text-xs text-wa-red" />
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

                <fieldset className="m-0 min-w-0 border-0 p-0">
                  <legend className={cn(waCaps, "mt-1 mb-3.5 p-0")}>A quién se envía</legend>
                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
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
                    <div role="status">
                      <WaCallout>
                        Hoy esto incluye{" "}
                        <strong className="wa-num">
                          {data.matchingToday.toLocaleString("es-PE")} pedidos
                        </strong>{" "}
                        (calculado el {formatLimaDateTime(data.computedAt)}). La lista se vuelve a
                        calcular justo antes de enviar: los pedidos que cambien de estado entran o
                        salen solos.
                      </WaCallout>
                    </div>
                  )}
                </WhatsAppResourceState>

                <FormField
                  control={form.control}
                  name="scheduleType"
                  render={({ field }) => (
                    <FormItem className="space-y-0">
                      <FormControl>
                        <TemplateSegmentedChoice
                          legend="Cuándo"
                          className="[&>legend]:mt-1 [&>legend]:mb-3.5 [&>legend]:text-[11px] [&>legend]:font-semibold [&>legend]:uppercase [&>legend]:tracking-[0.06em] [&>legend]:text-wa-muted [&>div]:w-full"
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
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  {values.scheduleType === WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.ONCE ? (
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem className={waField}>
                          <FormLabel className={waLabel}>Fecha</FormLabel>
                          <FormControl>
                            <WaInput type="date" {...field} className={cn(waInput, "wa-num")} />
                          </FormControl>
                          <FormMessage className="text-xs text-wa-red" />
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
                      <FormItem className={waField}>
                        <FormLabel className={waLabel}>Hora (Lima)</FormLabel>
                        <FormControl>
                          <WaInput type="time" {...field} className={cn(waInput, "wa-num")} />
                        </FormControl>
                        <FormMessage className="text-xs text-wa-red" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className={cn(waDialogFooter, "static flex-col items-stretch gap-2.5")}>
                {blocked && (
                  <p id={CAMPAIGN_BLOCKED_ID} className="m-0 text-xs text-wa-muted sm:text-right">
                    Programar y guardar envíos estarán disponibles cuando se conecte el servicio de
                    envíos programados. Puedes completar y revisar el formulario; no se guarda nada.
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2.5">
                  <Button type="button" className={waButton()} onClick={requestClose}>
                    Cancelar
                  </Button>
                  <BlockedActionButton
                    className={waButton({ variant: "primary" })}
                    blocked={blocked}
                    blockedReasonId={CAMPAIGN_BLOCKED_ID}
                    onClick={() => onSave && void form.handleSubmit(onSave)()}
                  >
                    <CalendarClock aria-hidden="true" />
                    {campaign ? "Guardar cambios" : "Programar"}
                  </BlockedActionButton>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[440px]")}>
          <AlertDialogHeader className={waDialogHeader}>
            <AlertDialogTitle className={waDialogTitle}>¿Descartar los cambios?</AlertDialogTitle>
          </AlertDialogHeader>
          <div className={waDialogBody}>
            <AlertDialogDescription className="m-0 text-sm text-wa-muted">
              Los cambios de este envío no se guardaron y se perderán al cerrar.
            </AlertDialogDescription>
          </div>
          <AlertDialogFooter className={waDialogFooter}>
            <AlertDialogCancel className={waButton()}>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              className={waButton({ variant: "solid-danger" })}
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
