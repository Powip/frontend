"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { Switch } from "@/components/ui/switch";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import {
  waField,
  waHint,
  waInput,
  waLabel,
  waSelectTrigger,
  waSwitch,
} from "@/components/whatsapp/ui/wa-classes";
import {
  WHATSAPP_OUT_OF_HOURS_OPTIONS,
  WHATSAPP_SCHEDULING_LIMITS,
  WHATSAPP_WEEKDAY_OPTIONS,
} from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import type { WhatsAppOutOfHoursPolicy } from "@/features/whatsapp/enums/whatsapp.enums";
import { toSendingScheduleValues } from "@/features/whatsapp/mappers/to-scheduling-form-values.mapper";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppSendingSettings } from "@/features/whatsapp/models/sending-settings.model";
import {
  type SendingScheduleValues,
  sendingScheduleSchema,
} from "@/features/whatsapp/schemas/sending-schedule.schema";
import { cn } from "@/lib/utils";
import { FormDraftActions } from "./FormDraftActions";
import { SettingsStateGate } from "./SettingsStateGate";

const SENDING_HOURS_NOTE_ID = "sending-hours-persistence-note";

interface SendingHoursSectionProps {
  settings: ResourceState<WhatsAppSendingSettings>;
  canManage: boolean;
  canPersist: boolean;
}

function toValues(settings: ResourceState<WhatsAppSendingSettings>): SendingScheduleValues {
  return toSendingScheduleValues(settings.kind === "ready" ? settings.data : null);
}

export function SendingHoursSection({ settings, canManage, canPersist }: SendingHoursSectionProps) {
  const form = useForm<SendingScheduleValues>({
    resolver: zodResolver(sendingScheduleSchema),
    defaultValues: toValues(settings),
    mode: "onTouched",
  });
  const days = useWatch({ control: form.control, name: "days" });
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toValues(settings));
  }, [settings, form]);

  const toggleDay = (day: SendingScheduleValues["days"][number]) => {
    const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
    form.setValue("days", next, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <WaCard aria-labelledby="sending-hours-title">
      <WaCardHeader
        level={3}
        titleId="sending-hours-title"
        title="Horario permitido"
        description="Fuera de este horario no se envía nada a tus clientes."
      />

      <SettingsStateGate settings={settings}>
        {() => (
          <Form {...form}>
            <form
              noValidate
              className="flex flex-col gap-3.5"
              onSubmit={(event) => event.preventDefault()}
            >
              {settings.kind === "pending-integration" && (
                <p className="m-0 text-xs text-wa-muted">
                  Valores iniciales sugeridos por el documento (Lun–Sáb, 08:00–21:00, máximo 3
                  avisos). No son la configuración guardada de la tienda.
                </p>
              )}
              <fieldset
                disabled={!canManage}
                className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0"
              >
                <legend className="sr-only">Horario y límites de envío</legend>
                <FormField
                  control={form.control}
                  name="days"
                  render={() => (
                    <FormItem className="space-y-0">
                      <fieldset className="m-0 border-0 p-0">
                        <legend className="sr-only">Días</legend>
                        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                          {WHATSAPP_WEEKDAY_OPTIONS.map((day) => {
                            const selected = days.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                aria-pressed={selected}
                                aria-label={day.label}
                                onClick={() => toggleDay(day.value)}
                                className={cn(
                                  "cursor-pointer rounded-[9px] border border-wa-border bg-wa-surface px-1 py-2 text-center text-xs font-medium outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary disabled:cursor-not-allowed disabled:opacity-50",
                                  selected && "border-wa-teal bg-wa-teal-soft text-wa-teal",
                                )}
                              >
                                {day.short}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                      <FormMessage className="mt-1 text-xs text-wa-red" />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="from"
                    render={({ field }) => (
                      <FormItem className={waField}>
                        <FormLabel className={waLabel}>Desde</FormLabel>
                        <FormControl>
                          <WaInput type="time" {...field} className={cn(waInput, "wa-num")} />
                        </FormControl>
                        <FormMessage className="text-xs text-wa-red" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem className={waField}>
                        <FormLabel className={waLabel}>Hasta</FormLabel>
                        <FormControl>
                          <WaInput type="time" {...field} className={cn(waInput, "wa-num")} />
                        </FormControl>
                        <FormMessage className="text-xs text-wa-red" />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="outOfHours"
                  render={({ field }) => (
                    <FormItem className={waField}>
                      <FormLabel className={waLabel}>Si un aviso cae fuera del horario</FormLabel>
                      <Select
                        value={field.value}
                        disabled={!canManage}
                        onValueChange={(value) => {
                          if (!value || value === field.value) return;
                          form.setValue("outOfHours", value as WhatsAppOutOfHoursPolicy, {
                            shouldDirty: true,
                          });
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className={waSelectTrigger} onBlur={field.onBlur}>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {WHATSAPP_OUT_OF_HOURS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dedupe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between gap-3 space-y-0">
                      <div className="min-w-0">
                        <FormLabel className="text-sm font-medium text-wa-fg">
                          No repetir el mismo aviso en un pedido
                        </FormLabel>
                        <FormDescription className={waHint}>
                          Si el courier reenvía un estado, el cliente no recibe el mensaje dos
                          veces.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          className={waSwitch}
                          checked={field.value}
                          onCheckedChange={(checked) =>
                            form.setValue("dedupe", checked, { shouldDirty: true })
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxPerOrderPerDay"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-1 space-y-0">
                      <div className="flex flex-row items-center justify-between gap-3">
                        <div className="min-w-0">
                          <FormLabel className="text-sm font-medium text-wa-fg">
                            Máximo de avisos por pedido al día
                          </FormLabel>
                          <FormDescription className={waHint}>
                            Evita que el cliente se sature y bloquee tu número. Entre{" "}
                            {WHATSAPP_SCHEDULING_LIMITS.maxPerOrderPerDay.min} y{" "}
                            {WHATSAPP_SCHEDULING_LIMITS.maxPerOrderPerDay.max}; comprobante e
                            incidencia tienen prioridad.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <WaInput
                            {...field}
                            inputMode="numeric"
                            className={cn(waInput, "wa-num w-[70px] shrink-0 text-center")}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs text-wa-red" />
                    </FormItem>
                  )}
                />
                <p className="m-0 text-xs text-wa-muted">Zona horaria: Lima (GMT-5)</p>
              </fieldset>
              {!canPersist && isDirty && (
                <p id={SENDING_HOURS_NOTE_ID} className="m-0 text-xs text-wa-muted">
                  Guardar estará disponible cuando se conecte el servicio de configuración.
                </p>
              )}
              <FormDraftActions
                isDirty={canManage && isDirty}
                blocked={!canPersist}
                blockedReasonId={SENDING_HOURS_NOTE_ID}
                saveLabel="Guardar horario"
                discardTitle="¿Descartar los cambios del horario?"
                onConfirmDiscard={() => form.reset(toValues(settings))}
              />
            </form>
          </Form>
        )}
      </SettingsStateGate>
    </WaCard>
  );
}
