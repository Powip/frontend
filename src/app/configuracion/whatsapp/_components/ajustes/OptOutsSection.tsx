"use client";

import { Plus, UserX } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DebouncedSearchInput } from "@/components/whatsapp/DebouncedSearchInput";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  OPT_OUT_ORIGIN_LABELS,
  OPT_OUT_UNKNOWN_ORIGIN_LABEL,
} from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { useSettingsDraft } from "@/features/whatsapp/hooks/use-settings-draft";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppOptOut,
  WhatsAppOptOutPage,
  WhatsAppProtectionSettings,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  type ProtectionSettingsValues,
  toProtectionSettingsValues,
} from "@/features/whatsapp/schemas/settings-tab.schema";
import { normalizeConversationSearch } from "@/features/whatsapp/utils/conversation-filters.util";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { AddOptOutDialog } from "./AddOptOutDialog";
import { ReactivateOptOutDialog } from "./ReactivateOptOutDialog";
import { SettingsDraftFooter, SuggestedValuesNote } from "./SettingsDraftFooter";
import {
  resolveSettingsSource,
  type SettingsMutations,
  type SettingsSource,
} from "./settings-types";

interface OptOutsSectionProps {
  stores: { id: string; name: string }[];
  storeContext: { id: string; name: string } | null;
  protection: ResourceState<WhatsAppProtectionSettings | null>;
  optOuts: ResourceState<WhatsAppOptOutPage>;
  search: string;
  onSearchChange: (search: string) => void;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
  canEdit: boolean;
  protectionBlockedReason: string | null;
  optOutsBlockedReason: string | null;
  reactivateBlockedReason: string | null;
  mutations: SettingsMutations;
}

function KeywordForm({
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
      <div className="flex items-start justify-between gap-3 rounded-lg border p-3">
        <label htmlFor={switchId} className="text-sm">
          Dar de baja solo si el cliente escribe STOP, BAJA o NO MÁS, y confirmarle que ya no
          recibirá avisos
        </label>
        <Switch
          id={switchId}
          checked={draft.optOutByKeyword}
          disabled={!canEdit}
          onCheckedChange={(checked) => setDraft({ ...draft, optOutByKeyword: checked })}
        />
      </div>
      <SettingsDraftFooter
        isDirty={isDirty}
        blockedReason={blockedReason}
        saveLabel="Guardar"
        discardTitle="¿Descartar el cambio en las bajas automáticas?"
        onDiscard={discard}
        onSave={onSave ? () => onSave(draft) : undefined}
      />
    </div>
  );
}

function originLabel(optOut: WhatsAppOptOut): string {
  return optOut.origin ? OPT_OUT_ORIGIN_LABELS[optOut.origin] : OPT_OUT_UNKNOWN_ORIGIN_LABEL;
}

export function OptOutsSection({
  stores,
  storeContext,
  protection,
  optOuts,
  search,
  onSearchChange,
  onPageChange,
  onRetry,
  canEdit,
  protectionBlockedReason,
  optOutsBlockedReason,
  reactivateBlockedReason,
  mutations,
}: OptOutsSectionProps) {
  const paginationReasonId = useId();
  const [adding, setAdding] = useState(false);
  const [reactivating, setReactivating] = useState<WhatsAppOptOut | null>(null);
  const source = resolveSettingsSource(protection, toProtectionSettingsValues);
  const searching = normalizeConversationSearch(search) !== null;

  return (
    <section aria-labelledby="opt-outs-title" className="space-y-4 rounded-xl border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="opt-outs-title" className="font-semibold">
            Clientes que no quieren avisos
          </h3>
          <p className="text-sm text-muted-foreground">
            A estos números no se les envía nada: ni avisos automáticos ni envíos programados.
          </p>
        </div>
        {canEdit && (
          <Button type="button" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar número
          </Button>
        )}
      </div>

      {source ? (
        <KeywordForm
          key={storeContext?.id ?? "sin-tienda"}
          source={source}
          canEdit={canEdit}
          blockedReason={protectionBlockedReason}
          onSave={mutations.saveProtection}
        />
      ) : (
        <WhatsAppResourceState
          state={protection}
          pendingTitle=""
          loadingLabel="Cargando la configuración de bajas"
          errorTitle="No se pudo cargar la configuración de bajas"
          onRetry={onRetry}
        >
          {() => null}
        </WhatsAppResourceState>
      )}

      <DebouncedSearchInput
        value={search}
        onValueChange={onSearchChange}
        label="Buscar por nombre o teléfono"
        className="sm:max-w-sm"
      />

      <WhatsAppResourceState
        state={optOuts}
        pendingTitle="Bajas pendientes de integración"
        pendingDescription="La lista real de números dados de baja aparecerá cuando POWIP la informe."
        loadingLabel="Cargando bajas"
        errorTitle="No se pudieron cargar las bajas"
        onRetry={onRetry}
        isEmpty={(data) => data.items.length === 0 && data.page === 1}
        empty={
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <UserX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">
              {searching ? "Ningún número coincide con la búsqueda." : "Nadie se dio de baja."}
            </p>
          </div>
        }
      >
        {(data) => (
          <div className="space-y-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Tienda</TableHead>
                    <TableHead>Cómo se dio de baja</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((optOut) => (
                    <TableRow key={optOut.id}>
                      <TableCell className="min-w-36 [overflow-wrap:anywhere]">
                        {optOut.customerName ?? "Sin nombre"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{optOut.phone}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {optOut.storeName ??
                          (optOut.storeId === null ? "Todas las tiendas" : "Tienda sin informar")}
                      </TableCell>
                      <TableCell className="min-w-40">
                        {originLabel(optOut)}
                        {optOut.createdBy && (
                          <span className="block text-xs text-muted-foreground">
                            Registró: {optOut.createdBy.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatLimaDateTime(optOut.createdAt)}
                      </TableCell>
                      <TableCell>
                        {canEdit && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setReactivating(optOut)}
                          >
                            Reactivar
                            <span className="sr-only"> {optOut.phone}</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {(data.page > 1 || data.hasMore) && (
              <nav
                aria-label="Paginación de bajas"
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">
                  Página {data.page}
                  {data.total !== null && ` · ${data.total.toLocaleString("es-PE")} números`}
                </span>
                <span className="flex gap-2">
                  {[
                    { label: "Anterior", enabled: data.page > 1, target: data.page - 1 },
                    { label: "Siguiente", enabled: data.hasMore, target: data.page + 1 },
                  ].map((control) => (
                    <Button
                      key={control.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!control.enabled}
                      aria-disabled={!onPageChange && control.enabled ? true : undefined}
                      aria-describedby={
                        !onPageChange && control.enabled ? paginationReasonId : undefined
                      }
                      onClick={() => onPageChange?.(control.target)}
                    >
                      {control.label}
                    </Button>
                  ))}
                </span>
              </nav>
            )}
            {!onPageChange && (data.page > 1 || data.hasMore) && (
              <p id={paginationReasonId} className="text-xs text-muted-foreground">
                {optOutsBlockedReason}
              </p>
            )}
          </div>
        )}
      </WhatsAppResourceState>

      {adding && (
        <AddOptOutDialog
          stores={stores}
          defaultStoreId={storeContext?.id ?? null}
          blockedReason={optOutsBlockedReason}
          addOptOut={mutations.addOptOut}
          onClose={() => setAdding(false)}
        />
      )}
      {reactivating && (
        <ReactivateOptOutDialog
          optOut={reactivating}
          blockedReason={reactivateBlockedReason}
          reactivate={mutations.reactivateOptOut}
          onClose={() => setReactivating(null)}
        />
      )}
    </section>
  );
}
