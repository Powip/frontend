"use client";

import { MessageCircle, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}: Props) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
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
        <MessageCircle className="h-3.5 w-3.5" />
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
    </div>
  );
}
