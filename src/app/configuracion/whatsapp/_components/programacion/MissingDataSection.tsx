"use client";

import { Bell, Link2, type LucideIcon, RefreshCw, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { waButton, waCaps, waSwitch } from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_SENDING_SETTINGS_SUGGESTED } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import type { WhatsAppSkippedNotice } from "@/features/whatsapp/models/queue.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppSaveSettings,
  WhatsAppSendingSettings,
} from "@/features/whatsapp/models/sending-settings.model";
import { formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";
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
  onSave?: WhatsAppSaveSettings;
}

function toValues(settings: ResourceState<WhatsAppSendingSettings>): MissingDataValues {
  if (settings.kind === "ready") return { ...settings.data.missingData };
  return {
    notifyAgent: WHATSAPP_SENDING_SETTINGS_SUGGESTED.notifyAgent,
    sendWhenFixed: WHATSAPP_SENDING_SETTINGS_SUGGESTED.sendWhenFixed,
  };
}

const MANDATORY_RULES: { icon: LucideIcon; label: string }[] = [
  { icon: Link2, label: "No enviar si falta el link de rastreo, el courier o la agencia" },
  {
    icon: Smartphone,
    label:
      "No enviar si el teléfono no es un celular válido de Perú (+51, 9 dígitos, empieza en 9), salvo que se permitan avisos a números extranjeros en Bajas, alertas y permisos",
  },
];

const TOGGLE_ROW =
  "flex items-center gap-3 rounded-xl border border-wa-border bg-wa-surface px-4 py-[13px] text-[13px]";

export function MissingDataSection({
  settings,
  skipped,
  canManage,
  canPersist,
  onCorrectOrder,
  onSave,
}: MissingDataSectionProps) {
  const form = useForm<MissingDataValues>({ defaultValues: toValues(settings) });
  const values = useWatch({ control: form.control }) as MissingDataValues;
  const { isDirty } = form.formState;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(toValues(settings));
  }, [settings, form]);

  const handleSave = form.handleSubmit(async (formValues) => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      const result = await onSave({
        missingData: {
          notifyAgent: formValues.notifyAgent,
          sendWhenFixed: formValues.sendWhenFixed,
        },
      });
      if (result.ok) form.reset(formValues);
    } finally {
      setSaving(false);
    }
  });

  const notSavedYet = settings.kind === "ready" && settings.data.version === 0;

  const configurable: { name: keyof MissingDataValues; label: string; icon: LucideIcon }[] = [
    {
      name: "notifyAgent",
      label: "Avisar a la asesora del pedido para que lo corrija",
      icon: Bell,
    },
    {
      name: "sendWhenFixed",
      label: "Enviar solo cuando se corrija el dato (si el pedido sigue en el mismo estado)",
      icon: RefreshCw,
    },
  ];

  return (
    <WaCard aria-labelledby="missing-data-title">
      <WaCardHeader
        level={3}
        titleId="missing-data-title"
        title="Si al pedido le faltan datos"
        description="Antes de enviar revisamos que el mensaje salga completo. Si falta algo, no se envía con huecos."
      />

      <div className="grid grid-cols-1 gap-5 min-[900px]:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="sr-only">Siempre activas (no se pueden apagar)</legend>
            {MANDATORY_RULES.map(({ icon: Icon, label }) => (
              <div key={label} className={cn(TOGGLE_ROW, "bg-wa-surface-2")}>
                <Icon className="size-[18px] shrink-0 text-wa-muted" aria-hidden="true" />
                <span className="min-w-0 flex-1">{label}</span>
                <span className="sr-only">Obligatoria</span>
                <Switch
                  className={waSwitch}
                  checked
                  disabled
                  aria-label={`Siempre activa: ${label}`}
                />
              </div>
            ))}
          </fieldset>

          <SettingsStateGate settings={settings}>
            {() => (
              <form
                noValidate
                className="flex flex-col gap-2.5"
                onSubmit={(event) => event.preventDefault()}
              >
                <fieldset
                  disabled={!canManage || saving}
                  className="m-0 flex flex-col gap-2.5 border-0 p-0"
                >
                  <legend className="sr-only">Configurables</legend>
                  {configurable.map((option) => (
                    <div key={option.name} className={TOGGLE_ROW}>
                      <option.icon
                        className="size-[18px] shrink-0 text-wa-muted"
                        aria-hidden="true"
                      />
                      <Label
                        htmlFor={`missing-data-${option.name}`}
                        className="min-w-0 flex-1 text-[13px] font-normal leading-snug"
                      >
                        {option.label}
                      </Label>
                      <Switch
                        id={`missing-data-${option.name}`}
                        className={waSwitch}
                        checked={values[option.name]}
                        onCheckedChange={(checked) =>
                          form.setValue(option.name, checked, { shouldDirty: true })
                        }
                      />
                    </div>
                  ))}
                  {settings.kind === "pending-integration" && (
                    <p className="m-0 text-xs text-wa-muted">
                      Valores iniciales sugeridos por el documento. La configuración guardada de la
                      tienda se mostrará cuando el servicio esté disponible; estos valores no están
                      guardados.
                    </p>
                  )}
                  {notSavedYet && (
                    <p className="m-0 text-xs text-wa-muted">
                      Esta tienda todavía no tiene esta configuración guardada. Se muestran los
                      valores sugeridos; guárdalos para que apliquen.
                    </p>
                  )}
                </fieldset>
                {!canPersist && isDirty && (
                  <p id={MISSING_DATA_NOTE_ID} className="m-0 text-xs text-wa-muted">
                    Guardar estará disponible cuando se conecte el servicio de configuración.
                  </p>
                )}
                <FormDraftActions
                  isDirty={canManage && isDirty}
                  blocked={!canPersist}
                  blockedReasonId={MISSING_DATA_NOTE_ID}
                  saveLabel={saving ? "Guardando…" : "Guardar"}
                  discardTitle="¿Descartar los cambios de datos faltantes?"
                  onConfirmDiscard={() => form.reset(toValues(settings))}
                  onSave={onSave ? () => void handleSave() : undefined}
                />
              </form>
            )}
          </SettingsStateGate>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <h4 className={cn(waCaps, "m-0")}>Hoy no se enviaron</h4>
          <WhatsAppResourceState
            state={skipped}
            pendingTitle="Listado pendiente de integración"
            pendingDescription="Los avisos que hoy no se enviaron por datos faltantes se mostrarán cuando el historial de envíos esté disponible."
            loadingLabel="Cargando avisos no enviados"
            errorTitle="No se pudo cargar el listado"
            isEmpty={(data) => data.length === 0}
            empty={<p className="m-0 text-[13px] text-wa-muted">Hoy no hubo avisos sin enviar.</p>}
          >
            {(notices) => (
              <ul className="m-0 list-none p-0" aria-label="Avisos que hoy no se enviaron">
                {notices.map((notice) => (
                  <li
                    key={notice.id}
                    className="flex flex-wrap items-center gap-3 border-t border-wa-border py-3 first:border-t-0 first:pt-0"
                  >
                    <div className="min-w-[180px] flex-1 text-[13px]">
                      <p className="m-0 font-semibold">
                        {notice.orderNumber} · {notice.customerName}
                      </p>
                      <p className="m-0 text-xs text-wa-muted">
                        {notice.templateName} · {notice.reason} ·{" "}
                        <span className="wa-num">{formatLimaTime(notice.createdAt)}</span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      className={waButton({ size: "sm" })}
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
          <p className="m-0 text-xs text-wa-muted">
            También aparecen en Conversaciones, columna «No enviado». El reenvío al corregir lo hace
            el servicio de avisos, no esta pantalla.
          </p>
        </div>
      </div>
    </WaCard>
  );
}