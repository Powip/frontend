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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
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
    <section
      aria-labelledby="sending-hours-title"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div>
        <h3 id="sending-hours-title" className="font-semibold">
          Horario permitido
        </h3>
        <p className="text-sm text-muted-foreground">
          Fuera de este horario no se envía nada a tus clientes. Zona horaria fija: Lima (GMT-5).
        </p>
      </div>

      <SettingsStateGate settings={settings}>
        {() => (
          <Form {...form}>
            <form noValidate className="space-y-4" onSubmit={(event) => event.preventDefault()}>
              {settings.kind === "pending-integration" && (
                <p className="text-xs text-muted-foreground">
                  Valores iniciales sugeridos por el documento (Lun–Sáb, 08:00–21:00, máximo 3
                  avisos). No son la configuración guardada de la tienda.
                </p>
              )}
              <fieldset disabled={!canManage} className="min-w-0 space-y-4">
                <legend className="sr-only">Horario y límites de envío</legend>
                <FormField
                  control={form.control}
                  name="days"
                  render={() => (
                    <FormItem>
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Días</legend>
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
                                  "min-h-9 rounded-md border px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                                  selected &&
                                    "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-500/15 dark:text-teal-200",
                                )}
                              >
                                {day.short}
                              </button>
                            );
                          })}
                        </div>
                      </fieldset>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="from"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Desde</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hasta</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="outOfHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TemplateSegmentedChoice
                          legend="Si un aviso cae fuera del horario"
                          name="sending-out-of-hours"
                          value={field.value}
                          options={WHATSAPP_OUT_OF_HOURS_OPTIONS}
                          readOnly={!canManage}
                          onValueChange={(value: WhatsAppOutOfHoursPolicy) =>
                            form.setValue("outOfHours", value, { shouldDirty: true })
                          }
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dedupe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start justify-between gap-3 space-y-0">
                      <div className="space-y-1">
                        <FormLabel>No repetir el mismo aviso en un pedido</FormLabel>
                        <FormDescription>
                          Si el courier reenvía un estado, el cliente no recibe el mensaje dos
                          veces.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
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
                    <FormItem className="max-w-xs">
                      <FormLabel>Máximo de avisos por pedido al día</FormLabel>
                      <FormControl>
                        <Input {...field} inputMode="numeric" />
                      </FormControl>
                      <FormDescription>
                        Entre {WHATSAPP_SCHEDULING_LIMITS.maxPerOrderPerDay.min} y{" "}
                        {WHATSAPP_SCHEDULING_LIMITS.maxPerOrderPerDay.max}. Comprobante e incidencia
                        tienen prioridad.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>
              {!canPersist && isDirty && (
                <p id={SENDING_HOURS_NOTE_ID} className="text-xs text-muted-foreground">
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
    </section>
  );
}
