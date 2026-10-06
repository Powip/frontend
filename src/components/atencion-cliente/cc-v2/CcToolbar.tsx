"use client";

import { Copy, Search, X, FileDown } from "lucide-react";
import { WhatsAppIcon } from "@/components/shared/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AgenteConKpis } from "@/interfaces/IOrder";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";

export const AGENTE_UNASSIGNED = "__unassigned__";

interface Props {
  agenteId: string;
  canalOrigen: string;
  agentes: AgenteConKpis[];
  agentesLoading?: boolean;
  onAgenteChange: (id: string) => void;
  onCanalChange: (canal: string) => void;
  selectedCount: number;
  onWhatsAppMasivo: () => void;
  onCopiar: () => void;
  canales: string[];
  date?: DateRange | undefined;
  onDateChange?: (date: DateRange | undefined) => void;
  /** Buscador de clientes (se muestra solo si se pasa onSearchChange). */
  search?: string;
  onSearchChange?: (value: string) => void;
  /** Exportar selección a Excel (se muestra solo si se pasa onExportar). */
  onExportar?: () => void;
  exporting?: boolean;
}

export function CcToolbar({
  agenteId,
  canalOrigen,
  agentes,
  agentesLoading,
  onAgenteChange,
  onCanalChange,
  selectedCount,
  onWhatsAppMasivo,
  onCopiar,
  canales,
  date,
  onDateChange,
  search = "",
  onSearchChange,
  onExportar,
  exporting,
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Buscador de clientes */}
      {onSearchChange && (
        <div className="relative w-[240px]">
          <Input
            type="search"
            placeholder="Buscar cliente, teléfono u orden..."
            aria-label="Buscar pedidos por cliente, teléfono u orden"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            icon={Search}
            className="h-[30px] text-xs md:text-xs pr-7 bg-white [&::-webkit-search-cancel-button]:hidden"
          />
          {search && (
            <button
              type="button"
              title="Limpiar búsqueda"
              aria-label="Limpiar búsqueda"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filtro Agente */}
      <select
        value={agenteId}
        onChange={(e) => onAgenteChange(e.target.value)}
        disabled={agentesLoading}
        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white outline-none cursor-pointer min-w-[160px] disabled:opacity-50"
      >
        <option value="">Todos los agentes</option>
        <option value={AGENTE_UNASSIGNED}>— Sin asignar (bolsa común)</option>
        {agentes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.nombre ?? a.email ?? a.id.slice(0, 8)}
            {a.pedidosPendientes > 0 ? ` (${a.pedidosPendientes})` : ""}
          </option>
        ))}
      </select>

      {/* Filtro Canal */}
      <select
        value={canalOrigen}
        onChange={(e) => onCanalChange(e.target.value)}
        className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 bg-white outline-none cursor-pointer min-w-[140px]"
      >
        <option value="">Todos los canales</option>
        {canales.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Filtro Fecha */}
      {onDateChange && (
        <DateRangePicker
          date={date}
          onDateChange={onDateChange}
          className="[&>div>button]:h-[30px] [&>div>button]:text-xs [&>div>button]:w-auto [&>div>button]:min-w-[200px]"
        />
      )}

      <div className="flex-1" />

      {/* Acciones bulk */}
      <Button
        size="sm"
        variant="outline"
        className="text-green-600 border-green-200 hover:bg-green-50 text-xs gap-1.5"
        disabled={selectedCount === 0}
        onClick={onWhatsAppMasivo}
      >
        <WhatsAppIcon className="h-3.5 w-3.5" />
        WA Masivo {selectedCount > 0 && `(${selectedCount})`}
      </Button>

      <Button
        size="sm"
        variant="outline"
        className="text-xs gap-1.5"
        disabled={selectedCount === 0}
        onClick={onCopiar}
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar {selectedCount > 0 && `(${selectedCount})`}
      </Button>

      {onExportar && (
        <Button
          size="sm"
          variant="outline"
          className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs gap-1.5"
          disabled={selectedCount === 0 || exporting}
          onClick={onExportar}
          title={selectedCount === 0 ? "Selecciona pedidos para exportar" : undefined}
        >
          <FileDown className="h-3.5 w-3.5" />
          {exporting ? "Exportando..." : `Exportar Excel${selectedCount > 0 ? ` (${selectedCount})` : ""}`}
        </Button>
      )}
    </div>
  );
}
