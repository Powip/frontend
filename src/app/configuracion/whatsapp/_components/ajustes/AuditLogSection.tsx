"use client";

import { ChevronDown, Lock } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaMini } from "@/components/whatsapp/ui/WaPill";
import { waButton, waSelectTriggerSm } from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { AUDIT_ENTITY_LABELS } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import type { WhatsAppAuditEntity } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppAuditEntry,
  WhatsAppAuditFilters,
  WhatsAppAuditPage,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  type AuditChange,
  buildAuditChanges,
  truncateAuditText,
} from "@/features/whatsapp/utils/audit-format.util";
import { formatLimaDateTime } from "@/features/whatsapp/utils/lima-time.util";
import { cn } from "@/lib/utils";

const ALL = "all";

function ChangeValue({ text, sensitive }: { text: string; sensitive: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { preview, truncated } = truncateAuditText(text);
  if (sensitive) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        {text}
      </span>
    );
  }
  return (
    <span
      className={cn("[overflow-wrap:anywhere]", text === "Sin dato" && "text-muted-foreground")}
    >
      {expanded ? text : preview}
      {truncated && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-1 py-0 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ver menos" : "Ver completo"}
        </Button>
      )}
    </span>
  );
}

function ChangesTable({ changes }: { changes: AuditChange[] }) {
  if (changes.length === 0) {
    return <p className="m-0 text-xs text-wa-muted">POWIP no informó el detalle del cambio.</p>;
  }
  return (
    <dl className="m-0 flex flex-col gap-1.5 text-xs">
      {changes.map((change) => (
        <div
          key={change.key}
          className="grid gap-1 rounded-lg bg-wa-surface-2 px-2.5 py-2 sm:grid-cols-[9rem_1fr]"
        >
          <dt className="font-wa-mono text-[11px] text-wa-muted [overflow-wrap:anywhere]">
            {change.key}
          </dt>
          <dd className="space-y-0.5">
            <span className="block">
              <span className="text-wa-muted">Antes: </span>
              <ChangeValue text={change.before} sensitive={change.sensitive} />
            </span>
            <span className="block">
              <span className="text-wa-muted">Después: </span>
              <ChangeValue text={change.after} sensitive={change.sensitive} />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AuditRow({ entry }: { entry: WhatsAppAuditEntry }) {
  const detailId = useId();
  const [open, setOpen] = useState(false);
  const changes = buildAuditChanges(entry.before, entry.after);
  return (
    <li className="flex flex-col gap-2 border-t border-wa-border py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start gap-3">
        <WaMini className="wa-num mt-0.5">
          <time dateTime={entry.createdAt.toISOString()}>
            {formatLimaDateTime(entry.createdAt)}
          </time>
        </WaMini>
        <div className="min-w-[180px] flex-1 text-[13px]">
          <p className="m-0">
            <b className="font-semibold">{entry.user?.name ?? "Usuario sin informar"}</b>{" "}
            <span className="[overflow-wrap:anywhere]">{entry.action}</span>
          </p>
          <p className="m-0 text-xs text-wa-muted">
            {AUDIT_ENTITY_LABELS[entry.entity]}
            {entry.summary ? ` · ${entry.summary}` : ""}
          </p>
        </div>
        <Button
          type="button"
          className={waButton({ variant: "ghost", size: "sm" })}
          aria-expanded={open}
          aria-controls={detailId}
          onClick={() => setOpen(!open)}
        >
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
          {open ? "Ocultar detalle" : "Ver antes y después"}
        </Button>
      </div>
      {open && (
        <div id={detailId}>
          <ChangesTable changes={changes} />
        </div>
      )}
    </li>
  );
}

interface AuditLogSectionProps {
  audit: ResourceState<WhatsAppAuditPage>;
  filters: WhatsAppAuditFilters;
  onFiltersChange: (filters: WhatsAppAuditFilters) => void;
  onPageChange?: (page: number) => void;
  onRetry?: () => void;
  paginationBlockedReason: string;
}

export function AuditLogSection({
  audit,
  filters,
  onFiltersChange,
  onPageChange,
  onRetry,
  paginationBlockedReason,
}: AuditLogSectionProps) {
  const paginationReasonId = useId();
  const userReasonId = useId();
  const users = audit.kind === "ready" ? audit.data.users : null;
  const filtered = filters.entity !== null || filters.userId !== null;

  return (
    <WaCard aria-labelledby="audit-title">
      <WaCardHeader
        level={3}
        titleId="audit-title"
        title="Registro de cambios"
        description="Quién cambió qué y cuándo. Lo registra POWIP y no se puede borrar."
      />
      <div className="mb-3.5 flex flex-wrap items-start gap-2">
        <Select
          value={filters.entity ?? ALL}
          onValueChange={(value) => {
            if (!value) return;
            const entity = value === ALL ? null : (value as WhatsAppAuditEntity);
            if (entity !== filters.entity) onFiltersChange({ ...filters, entity });
          }}
        >
          <SelectTrigger className={waSelectTriggerSm} aria-label="Tipo de cambio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los tipos</SelectItem>
            {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <Select
            value={filters.userId ?? ALL}
            disabled={!users}
            onValueChange={(value) => {
              if (!value) return;
              const userId = value === ALL ? null : value;
              if (userId !== filters.userId) onFiltersChange({ ...filters, userId });
            }}
          >
            <SelectTrigger
              className={waSelectTriggerSm}
              aria-label="Usuario"
              aria-describedby={users ? undefined : userReasonId}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos los usuarios</SelectItem>
              {(users ?? []).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!users && (
            <p id={userReasonId} className="m-0 max-w-64 text-[11px] text-wa-muted">
              El filtro por usuario se habilita cuando POWIP informe quiénes hicieron cambios.
            </p>
          )}
        </div>
      </div>
      <WhatsAppResourceState
        state={audit}
        pendingTitle="Registro pendiente de integración"
        pendingDescription="Los cambios reales aparecerán cuando POWIP los registre. Los cambios que hagas en esta pantalla no se registran mientras no se guarden."
        loadingLabel="Cargando el registro de cambios"
        errorTitle="No se pudo cargar el registro de cambios"
        onRetry={onRetry}
        isEmpty={(data) => data.items.length === 0 && data.page === 1}
        empty={
          <p className="m-0 text-[13px] text-wa-muted">
            {filtered ? "No hay cambios con estos filtros." : "Todavía no hay cambios registrados."}
          </p>
        }
      >
        {(data) => (
          <div className="flex flex-col gap-3">
            <ul className="m-0 list-none p-0" aria-label="Cambios registrados">
              {data.items.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </ul>
            {(data.page > 1 || data.hasMore) && (
              <nav
                aria-label="Paginación del registro"
                className="flex items-center justify-between gap-2 text-[13px]"
              >
                <span className="text-wa-muted">Página {data.page}</span>
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
                {paginationBlockedReason}
              </p>
            )}
          </div>
        )}
      </WhatsAppResourceState>
    </WaCard>
  );
}
