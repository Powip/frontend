"use client";

import { useId } from "react";
import { Switch } from "@/components/ui/switch";
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
    <div className="space-y-3">
      {source.note && <SuggestedValuesNote reason={source.note} />}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Si escribe un número que no es de Perú (+51)
        </legend>
        {FOREIGN_INBOUND_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-2 rounded-lg border p-3 text-sm"
          >
            <input
              type="radio"
              name="foreign-inbound"
              value={option.value}
              checked={draft.foreignInbound === option.value}
              disabled={!canEdit}
              onChange={() => setDraft({ ...draft, foreignInbound: option.value })}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="block text-muted-foreground">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <label htmlFor={switchId} className="space-y-1 text-sm">
          <span className="block">Permitir avisos automáticos a números extranjeros</span>
          <span className="block text-xs text-muted-foreground">
            Apagado, los avisos solo salen a celulares de Perú (+51, 9 dígitos que empiezan en 9),
            la misma regla que muestra Programación en «Si al pedido le faltan datos». Encendido,
            esa regla deja de excluir números extranjeros; POWIP valida el número al encolar.
          </span>
        </label>
        <Switch
          id={switchId}
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
    <section aria-labelledby="foreign-title" className="space-y-4 rounded-xl border p-4">
      <div>
        <h3 id="foreign-title" className="font-semibold">
          Números extranjeros
        </h3>
        <p className="text-sm text-muted-foreground">
          Qué hacer con mensajes y avisos de números que no son de Perú.
        </p>
      </div>
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
    </section>
  );
}
