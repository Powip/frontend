"use client";

import { Lock } from "lucide-react";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_SENDING_SETTINGS_SUGGESTED } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import type { WhatsAppSkippedNotice } from "@/features/whatsapp/models/queue.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppSendingSettings } from "@/features/whatsapp/models/sending-settings.model";
import { formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { FormDraftActions } from "./FormDraftActions";
import { SettingsStateGate } from "./SettingsStateGate";

const MISSING_DATA_NOTE_ID = "missing-data-persistence-note";

interface MissingDataValues {
  notifyAgent: boolean;
  sendWhenFixed: boolean;
}

interface MissingDataSectionProps {
  settings: ResourceState<WhatsAppSendingSettings>;
  skipped: ResourceState<WhatsAppSkippedNotice[]>;
  canManage: boolean;
  canPersist: boolean;
  onCorrectOrder?: (orderId: string) => void;
}

function toValues(settings: ResourceState<WhatsAppSendingSettings>): MissingDataValues {
  if (settings.kind === "ready") return { ...settings.data.missingData };
  return {
    notifyAgent: WHATSAPP_SENDING_SETTINGS_SUGGESTED.notifyAgent,
    sendWhenFixed: WHATSAPP_SENDING_SETTINGS_SUGGESTED.sendWhenFixed,
  };
}

const MANDATORY_RULES = [
  "No enviar si falta el link de rastreo, el courier o la agencia",
  "No enviar si el teléfono no es un celular válido de Perú (+51, 9 dígitos, empieza en 9), salvo que se permitan avisos a números extranjeros en Bajas, alertas y permisos",
];

export function MissingDataSection({
  settings,
  skipped,
  canManage,
  canPersist,
  onCorrectOrder,
}: MissingDataSectionProps) {
  const form = useForm<MissingDataValues>({ defaultValues: toValues(settings) });
  const values = useWatch({ control: form.control }) as MissingDataValues;
  const { isDirty } = form.formState;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toValues(settings));
  }, [settings, form]);

  const configurable: { name: keyof MissingDataValues; label: string }[] = [
    { name: "notifyAgent", label: "Avisar a la asesora del pedido para que lo corrija" },
    {
      name: "sendWhenFixed",
      label: "Enviar solo cuando se corrija el dato (si el pedido sigue en el mismo estado)",
    },
  ];

  return (
    <section
      aria-labelledby="missing-data-title"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div>
        <h3 id="missing-data-title" className="font-semibold">
          Si al pedido le faltan datos
        </h3>
        <p className="text-sm text-muted-foreground">
          Antes de enviar se revisa que el mensaje salga completo. Si falta algo, no se envía con
          huecos.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Siempre activas (no se pueden apagar)</legend>
            {MANDATORY_RULES.map((rule) => (
              <p
                key={rule}
                className="flex items-start gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm"
              >
                <Lock
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">{rule}</span>
                <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                  Obligatoria
                </span>
              </p>
            ))}
          </fieldset>

          <SettingsStateGate settings={settings}>
            {() => (
              <form noValidate className="space-y-2" onSubmit={(event) => event.preventDefault()}>
                <fieldset disabled={!canManage} className="space-y-2">
                  <legend className="text-sm font-medium">Configurables</legend>
                  {settings.kind === "pending-integration" && (
                    <p className="text-xs text-muted-foreground">
                      Valores iniciales sugeridos por el documento. La configuración guardada de la
                      tienda se mostrará cuando el servicio esté disponible; estos valores no están
                      guardados.
                    </p>
                  )}
                  {configurable.map((option) => (
                    <div
                      key={option.name}
                      className="flex items-center gap-3 rounded-lg border p-2.5"
                    >
                      <Label
                        htmlFor={`missing-data-${option.name}`}
                        className="min-w-0 flex-1 font-normal"
                      >
                        {option.label}
                      </Label>
                      <Switch
                        id={`missing-data-${option.name}`}
                        checked={values[option.name]}
                        onCheckedChange={(checked) =>
                          form.setValue(option.name, checked, { shouldDirty: true })
                        }
                      />
                    </div>
                  ))}
                </fieldset>
                {!canPersist && isDirty && (
                  <p id={MISSING_DATA_NOTE_ID} className="text-xs text-muted-foreground">
                    Guardar estará disponible cuando se conecte el servicio de configuración.
                  </p>
                )}
                <FormDraftActions
                  isDirty={canManage && isDirty}
                  blocked={!canPersist}
                  blockedReasonId={MISSING_DATA_NOTE_ID}
                  saveLabel="Guardar"
                  discardTitle="¿Descartar los cambios de datos faltantes?"
                  onConfirmDiscard={() => form.reset(toValues(settings))}
                />
              </form>
            )}
          </SettingsStateGate>
        </div>

        <div className="min-w-0 space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Hoy no se enviaron
          </h4>
          <WhatsAppResourceState
            state={skipped}
            pendingTitle="Listado pendiente de integración"
            pendingDescription="Los avisos que hoy no se enviaron por datos faltantes se mostrarán cuando el historial de envíos esté disponible."
            loadingLabel="Cargando avisos no enviados"
            errorTitle="No se pudo cargar el listado"
            isEmpty={(data) => data.length === 0}
            empty={<p className="text-sm text-muted-foreground">Hoy no hubo avisos sin enviar.</p>}
          >
            {(notices) => (
              <ul className="divide-y rounded-lg border" aria-label="Avisos que hoy no se enviaron">
                {notices.map((notice) => (
                  <li key={notice.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {notice.orderNumber} · {notice.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{notice.templateName}</span> · {notice.reason} ·{" "}
                        {formatLimaTime(notice.createdAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!notice.orderId || !onCorrectOrder}
                      aria-label={`Corregir pedido ${notice.orderNumber}`}
                      onClick={() => notice.orderId && onCorrectOrder?.(notice.orderId)}
                    >
                      Corregir
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </WhatsAppResourceState>
          <p className="text-xs text-muted-foreground">
            También aparecen en Conversaciones, columna «No enviado». El reenvío al corregir lo hace
            el servicio de avisos, no esta pantalla.
          </p>
        </div>
      </div>
    </section>
  );
}
