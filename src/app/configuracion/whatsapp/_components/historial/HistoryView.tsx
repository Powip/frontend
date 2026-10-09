"use client";

import { Download, SearchX, Send } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { DebouncedSearchInput } from "@/components/whatsapp/DebouncedSearchInput";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import {
  HISTORY_PERIOD_OPTIONS,
  HISTORY_STATUS_FILTER_OPTIONS,
} from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import {
  WHATSAPP_HISTORY_PERIODS,
  WHATSAPP_HISTORY_STATUS_FILTERS,
  WHATSAPP_PERMISSION_CODES,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppHistoryFilters,
  WhatsAppHistoryMetrics,
  WhatsAppHistoryPage,
  WhatsAppHistoryQuery,
} from "@/features/whatsapp/models/history.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppEffectivePermissions } from "@/features/whatsapp/models/settings-tab.model";
import { normalizeConversationSearch } from "@/features/whatsapp/utils/conversation-filters.util";
import { getLimaPeriodRange, toHistoryQuery } from "@/features/whatsapp/utils/history.util";
import { formatDateKey } from "@/features/whatsapp/utils/lima-time.util";
import {
  combineBlockReasons,
  getPermissionBlockReason,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
import { HistoryFunnel, HistoryKpis } from "./HistoryKpis";
import { HistoryMessagesTable } from "./HistoryMessagesTable";

const ALL_STORES = "all";

export const HISTORY_PENDING_REASON =
  "Pendiente de integración: el historial de POWIP todavía no está disponible. No se envió ni se exportó nada.";

const EXPORT_PERMISSION_UNKNOWN = "El permiso para exportar todavía no está definido.";

const STATUS_LEGEND = [
  { title: "Enviado", text: "Salió de tu número y está en los servidores de WhatsApp." },
  { title: "Entregado", text: "Llegó al celular del comprador." },
  {
    title: "Leído",
    text: "El comprador abrió el chat. Si apagó las confirmaciones de lectura, se queda en Entregado.",
  },
  { title: "No enviado", text: "Meta no pudo entregarlo o POWIP no lo envió. Revisa el motivo." },
  {
    title: "Asistido",
    text: "Lo envió una asesora a mano desde el número de contingencia. No tiene confirmación de entrega ni de lectura.",
  },
];

export interface HistoryViewProps {
  stores: { id: string; name: string }[];
  filters: WhatsAppHistoryFilters;
  onFiltersChange: (filters: WhatsAppHistoryFilters) => void;
  now: Date;
  metrics: ResourceState<WhatsAppHistoryMetrics>;
  page: ResourceState<WhatsAppHistoryPage>;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
  effectivePermissions: WhatsAppEffectivePermissions;
  exportPermission: boolean | null;
  onResend?: (messageId: string) => Promise<void>;
  onExport?: (
    query: WhatsAppHistoryQuery,
    status: WhatsAppHistoryFilters["status"],
  ) => Promise<void>;
  onOpenOrder: (orderId: string) => void;
}

function hasTableFilters(filters: WhatsAppHistoryFilters): boolean {
  return (
    filters.status !== WHATSAPP_HISTORY_STATUS_FILTERS.ALL ||
    filters.storeId !== null ||
    normalizeConversationSearch(filters.search) !== null
  );
}

export function HistoryView({
  stores,
  filters,
  onFiltersChange,
  now,
  metrics,
  page,
  onPageChange,
  onRetry,
  effectivePermissions,
  exportPermission,
  onResend,
  onExport,
  onOpenOrder,
}: HistoryViewProps) {
  const exportReasonId = useId();
  const [exportStatus, setExportStatus] = useState<
    { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const range = getLimaPeriodRange(filters.period, now);
  const filtered = hasTableFilters(filters);

  const exportReason = combineBlockReasons(
    onExport ? null : HISTORY_PENDING_REASON,
    exportPermission === true
      ? null
      : exportPermission === false
        ? "No tienes permiso para exportar."
        : EXPORT_PERMISSION_UNKNOWN,
  );
  const resendReason = combineBlockReasons(
    onResend ? null : HISTORY_PENDING_REASON,
    getPermissionBlockReason(effectivePermissions, WHATSAPP_PERMISSION_CODES.REPLY),
  );

  const runExport = async () => {
    if (exportReason || !onExport || exportStatus.kind === "pending") return;
    setExportStatus({ kind: "pending" });
    try {
      await onExport(toHistoryQuery(filters, now), filters.status);
      setExportStatus({ kind: "idle" });
    } catch (caught) {
      setExportStatus({
        kind: "error",
        message:
          caught instanceof Error && caught.message ? caught.message : "No se pudo exportar.",
      });
    }
  };

  const clearFilters = () =>
    onFiltersChange({
      period: filters.period,
      status: WHATSAPP_HISTORY_STATUS_FILTERS.ALL,
      search: "",
      storeId: null,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <TemplateSegmentedChoice
            legend="Periodo"
            name="history-period"
            value={filters.period}
            options={HISTORY_PERIOD_OPTIONS}
            onValueChange={(period) => onFiltersChange({ ...filters, period })}
          />
          <Select
            value={filters.storeId ?? ALL_STORES}
            onValueChange={(value) => {
              if (!value) return;
              const storeId = value === ALL_STORES ? null : value;
              if (storeId !== filters.storeId) onFiltersChange({ ...filters, storeId });
            }}
          >
            <SelectTrigger className="w-full sm:w-52" aria-label="Tienda">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STORES}>Todas las tiendas</SelectItem>
              {stores.map((store) => (
                <SelectItem key={store.id} value={store.id}>
                  {store.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 lg:text-right">
          <BlockedActionButton
            variant="outline"
            blocked={!!exportReason || exportStatus.kind === "pending"}
            blockedReasonId={exportReasonId}
            onClick={runExport}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar Excel
          </BlockedActionButton>
          {exportReason && (
            <p id={exportReasonId} className="max-w-sm text-xs text-muted-foreground">
              {exportReason}
            </p>
          )}
          {exportStatus.kind === "pending" && (
            <p role="status" className="text-xs text-muted-foreground">
              Preparando el archivo con todos los mensajes filtrados…
            </p>
          )}
          {exportStatus.kind === "error" && (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">
              {exportStatus.message}
            </p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {filters.period === WHATSAPP_HISTORY_PERIODS.TODAY
          ? `Hoy, ${formatDateKey(range.toKey)}`
          : `Del ${formatDateKey(range.fromKey)} al ${formatDateKey(range.toKey)}`}{" "}
        (hora de Lima). Indicadores y tabla usan el mismo periodo, tienda y búsqueda.
      </p>

      <section aria-labelledby="history-kpis-title" className="space-y-3">
        <h3 id="history-kpis-title" className="font-semibold">
          Indicadores
        </h3>
        <WhatsAppResourceState
          state={metrics}
          pendingTitle="Indicadores pendientes de integración"
          pendingDescription="No se muestran ceros ni porcentajes de ejemplo: aparecerán cuando POWIP informe los envíos reales."
          loadingLabel="Cargando indicadores"
          errorTitle="No se pudieron cargar los indicadores"
          onRetry={onRetry}
        >
          {(data) => (
            <div className="space-y-4">
              <HistoryKpis metrics={data} />
              <HistoryFunnel metrics={data} />
            </div>
          )}
        </WhatsAppResourceState>
      </section>

      <section aria-labelledby="history-legend-title" className="space-y-2">
        <h3 id="history-legend-title" className="font-semibold">
          Qué significa cada estado
        </h3>
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {STATUS_LEGEND.map((item) => (
            <div key={item.title} className="rounded-lg border p-3 text-sm">
              <dt className="font-medium">{item.title}</dt>
              <dd className="text-muted-foreground">{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="history-table-title" className="space-y-3">
        <h3 id="history-table-title" className="font-semibold">
          Mensajes
        </h3>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <TemplateSegmentedChoice
            legend="Estado"
            name="history-status"
            value={filters.status}
            options={HISTORY_STATUS_FILTER_OPTIONS}
            onValueChange={(status) => onFiltersChange({ ...filters, status })}
          />
          <DebouncedSearchInput
            value={filters.search}
            onValueChange={(search) => onFiltersChange({ ...filters, search })}
            label="Buscar pedido, cliente o teléfono"
            className="lg:w-80"
          />
        </div>
        <WhatsAppResourceState
          state={page}
          pendingTitle="Mensajes pendientes de integración"
          pendingDescription="La tabla mostrará cada aviso con su línea de tiempo cuando POWIP lo informe."
          loadingLabel="Cargando mensajes"
          errorTitle="No se pudieron cargar los mensajes"
          onRetry={onRetry}
          isEmpty={(data) => data.items.length === 0 && data.page === 1}
          empty={
            filtered ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">No hay mensajes con estos filtros.</p>
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
                <Send className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">
                  Todavía no se enviaron avisos en este periodo.
                </p>
              </div>
            )
          }
        >
          {(data) => (
            <HistoryMessagesTable
              page={data}
              resendBlockedReason={resendReason}
              onResend={onResend}
              onOpenOrder={onOpenOrder}
              onPageChange={onPageChange}
              paginationBlockedReason={HISTORY_PENDING_REASON}
            />
          )}
        </WhatsAppResourceState>
      </section>
    </div>
  );
}
