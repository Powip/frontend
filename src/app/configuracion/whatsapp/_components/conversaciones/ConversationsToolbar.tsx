"use client";

import { Bot, Columns3, List, UserRound } from "lucide-react";
import { useId, useRef } from "react";
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
import {
  waFilterChip,
  waSegmented,
  waSegmentedItem,
  waSelectTrigger,
} from "@/components/whatsapp/ui/wa-classes";
import {
  WHATSAPP_CONVERSATION_VIEWS,
  type WhatsAppConversationView,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationFilters } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";

const ALL_STORES = "all";

const VIEW_OPTIONS = [
  { value: WHATSAPP_CONVERSATION_VIEWS.BOARD, label: "Tablero", icon: Columns3 },
  { value: WHATSAPP_CONVERSATION_VIEWS.LIST, label: "Lista", icon: List },
];

interface ConversationsToolbarProps {
  stores: { id: string; name: string }[];
  filters: WhatsAppConversationFilters;
  onFiltersChange: (filters: WhatsAppConversationFilters) => void;
  currentUserId: string | null;
  view: WhatsAppConversationView;
  onViewChange: (view: WhatsAppConversationView) => void;
  canConfigureAutoReply: boolean;
  onOpenAutoReply: () => void;
}

export function ConversationsToolbar({
  stores,
  filters,
  onFiltersChange,
  currentUserId,
  view,
  onViewChange,
  canConfigureAutoReply,
  onOpenAutoReply,
}: ConversationsToolbarProps) {
  const mineReasonId = useId();
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  return (
    <div className="flex flex-wrap items-start justify-between gap-2.5">
      <div className="flex w-full min-w-0 flex-wrap items-start gap-2.5 min-[900px]:w-auto min-[900px]:flex-1">
        <DebouncedSearchInput
          value={filters.search}
          onValueChange={(search) => onFiltersChange({ ...filtersRef.current, search })}
          label="Buscar pedido, cliente o teléfono"
          className="min-w-[200px] flex-1 sm:max-w-[320px]"
        />
        <Select
          value={filters.storeId ?? ALL_STORES}
          onValueChange={(value) => {
            if (!value) return;
            const storeId = value === ALL_STORES ? null : value;
            if (storeId !== filters.storeId) onFiltersChange({ ...filters, storeId });
          }}
        >
          <SelectTrigger className={cn(waSelectTrigger, "w-auto min-w-40")} aria-label="Tienda">
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
        <div>
          <BlockedActionButton
            className={cn(waFilterChip, "h-auto shadow-none")}
            aria-pressed={filters.assignedToMe}
            blocked={!currentUserId}
            blockedReasonId={mineReasonId}
            onClick={() => onFiltersChange({ ...filters, assignedToMe: !filters.assignedToMe })}
          >
            <span
              aria-hidden="true"
              className="grid size-5 place-items-center rounded-full bg-wa-primary-soft text-wa-primary"
            >
              <UserRound className="size-3" />
            </span>
            Asignadas a mí
          </BlockedActionButton>
          {!currentUserId && (
            <p id={mineReasonId} className="mt-1 mb-0 text-xs text-wa-muted">
              No se pudo identificar tu usuario.
            </p>
          )}
        </div>
        {canConfigureAutoReply && (
          <Button
            type="button"
            className={cn(waFilterChip, "h-auto shadow-none")}
            onClick={onOpenAutoReply}
          >
            <Bot className="size-[15px]" aria-hidden="true" />
            Respuesta automática
          </Button>
        )}
      </div>
      <fieldset className={cn(waSegmented, "m-0 shrink-0")}>
        <legend className="sr-only">Vista</legend>
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = view === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onViewChange(option.value)}
              className={cn(waSegmentedItem, "inline-flex items-center gap-1.5")}
            >
              <Icon className="size-[15px]" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
