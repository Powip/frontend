"use client";

import { Bot, KanbanSquare, List, UserRound } from "lucide-react";
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
  WHATSAPP_CONVERSATION_VIEWS,
  type WhatsAppConversationView,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppConversationFilters } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";

const ALL_STORES = "all";

const VIEW_OPTIONS = [
  { value: WHATSAPP_CONVERSATION_VIEWS.BOARD, label: "Tablero", icon: KanbanSquare },
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
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        <DebouncedSearchInput
          value={filters.search}
          onValueChange={(search) => onFiltersChange({ ...filtersRef.current, search })}
          label="Buscar pedido, cliente o teléfono"
          className="flex-1 sm:max-w-sm"
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
        <div>
          <BlockedActionButton
            variant={filters.assignedToMe ? "default" : "outline"}
            aria-pressed={filters.assignedToMe}
            blocked={!currentUserId}
            blockedReasonId={mineReasonId}
            onClick={() => onFiltersChange({ ...filters, assignedToMe: !filters.assignedToMe })}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Asignadas a mí
          </BlockedActionButton>
          {!currentUserId && (
            <p id={mineReasonId} className="mt-1 text-xs text-muted-foreground">
              No se pudo identificar tu usuario.
            </p>
          )}
        </div>
        {canConfigureAutoReply && (
          <Button type="button" variant="outline" onClick={onOpenAutoReply}>
            <Bot className="h-4 w-4" aria-hidden="true" />
            Respuesta automática
          </Button>
        )}
      </div>
      <fieldset className="flex shrink-0 gap-1 rounded-lg border bg-muted/50 p-1">
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
              className={cn(
                "inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected && "bg-background text-foreground shadow-sm",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </fieldset>
    </div>
  );
}
