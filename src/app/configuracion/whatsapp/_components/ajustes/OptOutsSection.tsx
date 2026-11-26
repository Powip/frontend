"use client";

import { Ban, Plus, UserX } from "lucide-react";
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
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import {
  waButton,
  waSwitch,
  waTable,
  waTableWrap,
  waTd,
  waTh,
  waTr,
} from "@/components/whatsapp/ui/wa-classes";
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
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col gap-2.5">
      {source.note && <SuggestedValuesNote reason={source.note} />}
      <div className="flex items-center gap-3 rounded-xl border border-wa-border bg-wa-surface px-4 py-[13px] text-[13px]">
        <Ban className="size-[18px] shrink-0 text-wa-muted" aria-hidden="true" />
        <label htmlFor={switchId} className="min-w-0 flex-1">
          Dar de baja solo si el cliente escribe <b>STOP</b>, <b>BAJA</b> o <b>NO MÁS</b>, y
          confirmarle que ya no recibirá avisos
        </label>
        <Switch
          id={switchId}
          className={waSwitch}
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
    <WaCard aria-labelledby="opt-outs-title" className="flex flex-col gap-3.5">
      <WaCardHeader
        className="mb-0"
        titleId="opt-outs-title"
        title="Clientes que no quieren avisos"
        description="A estos números no se les envía nada: ni avisos automáticos ni envíos programados."
        actions={
          canEdit && (
            <Button
              type="button"
              className={waButton({ size: "sm" })}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden="true" />
              Agregar número
            </Button>
          )
        }
      />

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
        className="sm:max-w-[320px]"
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
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-wa-border-strong p-6 text-center">
            <UserX className="size-6 text-wa-muted" aria-hidden="true" />
            <p className="m-0 text-sm font-medium">
              {searching ? "Ningún número coincide con la búsqueda." : "Nadie se dio de baja."}
            </p>
          </div>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <div className={waTableWrap}>
              <Table className={waTable}>
                <TableHeader>
                  <TableRow className={waTr}>
                    <TableHead className={waTh}>Cliente</TableHead>
                    <TableHead className={waTh}>Teléfono</TableHead>
                    <TableHead className={waTh}>Tienda</TableHead>
                    <TableHead className={waTh}>Cómo se dio de baja</TableHead>
                    <TableHead className={waTh}>Fecha</TableHead>
                    <TableHead className={waTh}>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((optOut) => (
                    <TableRow key={optOut.id} className={waTr}>
                      <TableCell className={cn(waTd, "min-w-36 [overflow-wrap:anywhere]")}>
                        {optOut.customerName ?? "Sin nombre"}
                      </TableCell>
                      <TableCell className={cn(waTd, "wa-num whitespace-nowrap")}>
                        {optOut.phone}
                      </TableCell>
                      <TableCell className={cn(waTd, "whitespace-nowrap")}>
                        <span className="rounded-md border border-wa-border px-2 py-0.5 text-[11px]">
                          {optOut.storeName ??
                            (optOut.storeId === null ? "Todas las tiendas" : "Tienda sin informar")}
                        </span>
                      </TableCell>
                      <TableCell className={cn(waTd, "min-w-40")}>
                        {originLabel(optOut)}
                        {optOut.createdBy && (
                          <span className="block text-xs text-wa-muted">
                            Registró: {optOut.createdBy.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={cn(waTd, "wa-num whitespace-nowrap")}>
                        {formatLimaDateTime(optOut.createdAt)}
                      </TableCell>
                      <TableCell className={cn(waTd, "text-right")}>
                        {canEdit && (
                          <Button
                            type="button"
                            className={waButton({ size: "sm" })}
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
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="text-wa-muted">
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
                      className={waButton({ size: "sm" })}
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
              <p id={paginationReasonId} className="m-0 text-xs text-wa-muted">
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
    </WaCard>
  );
}
