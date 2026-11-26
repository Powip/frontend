"use client";

import { FileSpreadsheet, SearchX, Send, TriangleAlert, UserRound } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
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
import { DoubleTick, SingleTick } from "@/components/whatsapp/MessageStatusTicks";
import { PendingIntegrationNotice } from "@/components/whatsapp/PendingIntegrationNotice";
import { WaCard } from "@/components/whatsapp/ui/WaCard";
import { WaChipRadioGroup } from "@/components/whatsapp/ui/WaChipRadioGroup";
import { waButton, waSelectTrigger } from "@/components/whatsapp/ui/wa-classes";
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
import { cn } from "@/lib/utils";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
import {
  FUNNEL_BAR,
  FUNNEL_LINE,
  HistoryFunnel,
  HistoryFunnelCard,
  HistoryKpis,
  KPI_CARD,
  KPI_GRID,
  KPI_ICONS,
} from "./HistoryKpis";
import { HistoryListPreview } from "./HistoryListPreview";
import { HistoryMessagesTable } from "./HistoryMessagesTable";

const ALL_STORES = "all";

export const HISTORY_PENDING_REASON =
  "Pendiente de integración: el historial de POWIP todavía no está disponible. No se envió ni se exportó nada.";

const EXPORT_PERMISSION_UNKNOWN = "El permiso para exportar todavía no está definido.";

const STATUS_LEGEND = [
  {
    title: "Enviado",
    icon: <SingleTick className="text-wa-tick" />,
    text: "Salió de tu número y está en los servidores de WhatsApp.",
  },
  {
    title: "Entregado",
    icon: <DoubleTick className="text-wa-tick" />,
    text: "Llegó al celular del comprador.",
  },
  {
    title: "Leído",
    icon: <DoubleTick className="text-wa-tick-read" />,
    text: "El comprador abrió el chat. Si apagó las confirmaciones de lectura, se queda en Entregado.",
  },
  {
    title: "No enviado",
    icon: <TriangleAlert className="size-3.5 text-wa-red" aria-hidden="true" />,
    text: "Meta no pudo entregarlo o POWIP no lo envió. Revisa el motivo.",
    danger: true,
  },
  {
    title: "Asistido",
    icon: <UserRound className="size-3.5 text-wa-muted" aria-hidden="true" />,
    text: "Lo envió una asesora a mano desde el número de contingencia. No tiene confirmación de entrega ni de lectura.",
  },
];

const STATUS_FILTER_ICONS: Partial<Record<string, ReactNode>> = {
  [WHATSAPP_HISTORY_STATUS_FILTERS.SENT]: <SingleTick className="text-wa-tick" />,
  [WHATSAPP_HISTORY_STATUS_FILTERS.DELIVERED]: <DoubleTick className="text-wa-tick" />,
  [WHATSAPP_HISTORY_STATUS_FILTERS.READ]: <DoubleTick className="text-wa-tick-read" />,
  [WHATSAPP_HISTORY_STATUS_FILTERS.ASSISTED]: (
    <UserRound className="size-3.5 text-wa-muted" aria-hidden="true" />
  ),
};

const PENDING_KPIS = [
  { title: "Enviados", icon: KPI_ICONS.sent },
  { title: "Entregados", icon: KPI_ICONS.delivered },
  { title: "Leídos", icon: KPI_ICONS.read },
  { title: "Abrieron el rastreo", icon: KPI_ICONS.tracking },
  { title: "No enviados", icon: KPI_ICONS.notSent },
  { title: "Asistidos", icon: KPI_ICONS.assisted },
];

const PENDING_FUNNEL = ["Enviados", "Entregados", "Leídos", "Abrieron el rastreo"];

function PendingKpis() {
  return (
    <div className={KPI_GRID} aria-hidden="true">
      {PENDING_KPIS.map((kpi) => (
        <div key={kpi.title} className={KPI_CARD}>
          <span className="flex items-center justify-between gap-2 text-[13px] text-wa-muted">
            {kpi.title}
            {kpi.icon}
          </span>
          <span className="text-[26px] font-bold leading-[1.1] text-wa-muted-2">—</span>
          <span className="text-xs text-wa-muted">Sin dato todavía</span>
        </div>
      ))}
    </div>
  );
}

function PendingFunnel() {
  return (
    <HistoryFunnelCard>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-hidden="true">
        {PENDING_FUNNEL.map((label) => (
          <li key={label} className={FUNNEL_LINE}>
            <span>{label}</span>
            <span className={FUNNEL_BAR} />
            <span className="text-wa-muted-2">—</span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3.5 text-xs text-wa-muted">
        El embudo se calcula con los envíos reales cuando POWIP los informe.
      </p>
    </HistoryFunnelCard>
  );
}

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
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <TemplateSegmentedChoice
            legend="Periodo"
            name="history-period"
            value={filters.period}
            options={HISTORY_PERIOD_OPTIONS}
            onValueChange={(period) => onFiltersChange({ ...filters, period })}
            className="[&>div]:w-fit [&>legend]:sr-only"
          />
          <Select
            value={filters.storeId ?? ALL_STORES}
            onValueChange={(value) => {
              if (!value) return;
              const storeId = value === ALL_STORES ? null : value;
              if (storeId !== filters.storeId) onFiltersChange({ ...filters, storeId });
            }}
          >
            <SelectTrigger
              className={cn(waSelectTrigger, "w-auto min-w-40 py-[7px]")}
              aria-label="Tienda"
            >
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
        <div className="flex flex-col items-end gap-1">
          <BlockedActionButton
            className={waButton({ size: "sm" })}
            blocked={!!exportReason || exportStatus.kind === "pending"}
            blockedReasonId={exportReasonId}
            onClick={runExport}
          >
            <FileSpreadsheet aria-hidden="true" />
            Exportar Excel
          </BlockedActionButton>
          {exportReason && (
            <p id={exportReasonId} className="m-0 max-w-sm text-right text-xs text-wa-muted">
              {exportReason}
            </p>
          )}
          {exportStatus.kind === "pending" && (
            <p role="status" className="m-0 text-xs text-wa-muted">
              Preparando el archivo con todos los mensajes filtrados…
            </p>
          )}
          {exportStatus.kind === "error" && (
            <p role="alert" className="m-0 text-xs text-wa-red">
              {exportStatus.message}
            </p>
          )}
        </div>
      </div>
      <p className="-mt-2 mb-0 text-xs text-wa-muted">
        {filters.period === WHATSAPP_HISTORY_PERIODS.TODAY
          ? `Hoy, ${formatDateKey(range.toKey)}`
          : `Del ${formatDateKey(range.fromKey)} al ${formatDateKey(range.toKey)}`}{" "}
        (hora de Lima). Indicadores y tabla usan el mismo periodo, tienda y búsqueda.
      </p>

      <section aria-labelledby="history-kpis-title" className="flex flex-col gap-3">
        <h2 id="history-kpis-title" className="sr-only">
          Indicadores
        </h2>
        {metrics.kind === "pending-integration" ? (
          <>
            <PendingIntegrationNotice
              title="Indicadores pendientes de integración"
              description="No se muestran ceros ni porcentajes de ejemplo: aparecerán cuando POWIP informe los envíos reales."
            />
            <PendingKpis />
          </>
        ) : (
          <WhatsAppResourceState
            state={metrics}
            pendingTitle="Indicadores pendientes de integración"
            loadingLabel="Cargando indicadores"
            errorTitle="No se pudieron cargar los indicadores"
            onRetry={onRetry}
          >
            {(data) => <HistoryKpis metrics={data} />}
          </WhatsAppResourceState>
        )}
      </section>

      <div className="grid grid-cols-1 items-start gap-5 min-[1050px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {metrics.kind === "ready" ? <HistoryFunnel metrics={metrics.data} /> : <PendingFunnel />}
        <HistoryListPreview />
      </div>

      <section aria-labelledby="history-legend-title">
        <h2 id="history-legend-title" className="sr-only">
          Qué significa cada estado
        </h2>
        <dl className="m-0 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {STATUS_LEGEND.map((item) => (
            <div
              key={item.title}
              className="flex min-w-0 flex-col gap-1 rounded-xl border border-wa-border px-3.5 py-3 text-[12.5px] text-wa-muted"
            >
              <dt
                className={cn(
                  "flex items-center gap-1.5 text-[13px] font-semibold text-wa-fg",
                  item.danger && "text-wa-red",
                )}
              >
                {item.icon}
                {item.title}
              </dt>
              <dd className="m-0">{item.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <WaCard aria-labelledby="history-table-title">
        <h2 id="history-table-title" className="sr-only">
          Mensajes
        </h2>
        <div className="mb-3.5 flex flex-wrap items-start gap-2.5">
          <WaChipRadioGroup
            legend="Estado"
            name="history-status"
            value={filters.status}
            options={HISTORY_STATUS_FILTER_OPTIONS.map((option) => ({
              ...option,
              icon: STATUS_FILTER_ICONS[option.value],
              tone:
                option.value === WHATSAPP_HISTORY_STATUS_FILTERS.NOT_SENT ? "danger" : "default",
            }))}
            onValueChange={(status) => onFiltersChange({ ...filters, status })}
          />
          <DebouncedSearchInput
            value={filters.search}
            onValueChange={(search) => onFiltersChange({ ...filters, search })}
            label="Buscar pedido, cliente o teléfono"
            className="min-w-[200px] flex-1 sm:max-w-[320px]"
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
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-wa-border-strong p-8 text-center">
                <SearchX className="size-6 text-wa-muted" aria-hidden="true" />
                <p className="m-0 text-sm font-medium">No hay mensajes con estos filtros.</p>
                <Button type="button" className={waButton({ size: "sm" })} onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-wa-border-strong p-8 text-center">
                <Send className="size-6 text-wa-muted" aria-hidden="true" />
                <p className="m-0 text-sm font-medium">
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
      </WaCard>
    </div>
  );
}
