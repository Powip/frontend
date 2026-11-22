"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { waChoice, waSwitch } from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { FOREIGN_INBOUND_OPTIONS } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { useSettingsDraft } from "@/features/whatsapp/hooks/use-settings-draft";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppProtectionSettings } from "@/features/whatsapp/models/settings-tab.model";
import {
  type ProtectionSettingsValues,
  toProtectionSettingsValues,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import { SettingsDraftFooter, SuggestedValuesNote } from "./SettingsDraftFooter";
import { resolveSettingsSource, type SettingsSource } from "./settings-types";

function ForeignForm({
  source,
  canEdit,
  blockedReason,
  onSave,
}: {
  source: SettingsSource<ProtectionSettingsValues>;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: ProtectionSettingsValues) => Promise<void>;
}) {
  const switchId = useId();
  const { draft, setDraft, isDirty, discard } = useSettingsDraft(source.values);
  return (
    <div className="flex flex-col gap-2">
      {source.note && <SuggestedValuesNote reason={source.note} />}
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Si escribe un número que no es de Perú (+51)</legend>
        {FOREIGN_INBOUND_OPTIONS.map((option) => (
          <label key={option.value} className={waChoice}>
            <input
              type="radio"
              name="foreign-inbound"
              value={option.value}
              checked={draft.foreignInbound === option.value}
              disabled={!canEdit}
              onChange={() => setDraft({ ...draft, foreignInbound: option.value })}
              className="size-4 shrink-0 accent-wa-blue"
            />
            <span className="min-w-0">
              <span className="block font-semibold">{option.label}</span>
              {option.description && (
                <span className="block text-xs text-wa-muted">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-center justify-between gap-3 pt-1">
        <label htmlFor={switchId} className="min-w-0 text-xs">
          <span className="block">Permitir avisos automáticos a números extranjeros</span>
          <span className="block text-[11px] text-wa-muted">
            Apagado, los avisos solo salen a celulares de Perú (+51, 9 dígitos que empiezan en 9),
            la misma regla que muestra Programación en «Si al pedido le faltan datos». Encendido,
            esa regla deja de excluir números extranjeros; POWIP valida el número al encolar.
          </span>
        </label>
        <Switch
          id={switchId}
          className={waSwitch}
          checked={draft.allowForeignOutbound}
          disabled={!canEdit}
          onCheckedChange={(checked) => setDraft({ ...draft, allowForeignOutbound: checked })}
        />
      </div>
      <SettingsDraftFooter
        isDirty={isDirty}
        blockedReason={blockedReason}
        saveLabel="Guardar"
        discardTitle="¿Descartar los cambios en números extranjeros?"
        onDiscard={discard}
        onSave={onSave ? () => onSave(draft) : undefined}
      />
    </div>
  );
}

interface ForeignNumbersSectionProps {
  protection: ResourceState<WhatsAppProtectionSettings | null>;
  storeKey: string;
  canEdit: boolean;
  blockedReason: string | null;
  onSave?: (values: ProtectionSettingsValues) => Promise<void>;
  onRetry?: () => void;
}

export function ForeignNumbersSection({
  protection,
  storeKey,
  canEdit,
  blockedReason,
  onSave,
  onRetry,
}: ForeignNumbersSectionProps) {
  const source = resolveSettingsSource(protection, toProtectionSettingsValues);
  return (
    <WaCard aria-labelledby="foreign-title">
      <WaCardHeader
        level={3}
        titleId="foreign-title"
        title="Números extranjeros"
        description="Qué hacer si escribe un número que no es de Perú (+51)."
      />
      {source ? (
        <ForeignForm
          key={storeKey}
          source={source}
          canEdit={canEdit}
          blockedReason={blockedReason}
          onSave={onSave}
        />
      ) : (
        <WhatsAppResourceState
          state={protection}
          pendingTitle=""
          loadingLabel="Cargando la configuración de números extranjeros"
          errorTitle="No se pudo cargar la configuración de números extranjeros"
          onRetry={onRetry}
        >
          {() => null}
        </WhatsAppResourceState>
      )}
    </WaCard>
  );
}
