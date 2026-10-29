"use client";

import Link from "next/link";
import { useId } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SalesChannel } from "@/enum/Order.enum";
import type { SaleSalesChannel } from "@/services/saleContextService";

export function saleChannelLegacyType(type: SaleSalesChannel["type"]): SalesChannel {
  if (type === "PHYSICAL") return SalesChannel.TIENDA_FISICA;
  if (type === "SHOPIFY") return SalesChannel.WEB;
  if (type === "OTHER" || type === "TIKTOK") return SalesChannel.OTRO;
  return type as SalesChannel;
}
export function hasSaleChannelSelection({
  channels,
  selectedId,
  legacyType,
  editing,
  fixedId,
}: {
  channels: SaleSalesChannel[];
  selectedId?: string;
  legacyType?: string;
  editing: boolean;
  fixedId?: string | null;
}) {
  if (fixedId && editing) return true;
  if (selectedId)
    return channels.some((channel) => channel.id === selectedId && channel.isActive !== false);
  return Boolean(legacyType && (editing || channels.length === 0));
}
export function SaleChannelField({
  channels,
  legacyChannels,
  valueId,
  valueType,
  fixedId,
  editing,
  disabled,
  onChange,
}: {
  channels: SaleSalesChannel[];
  legacyChannels: string[];
  valueId?: string;
  valueType?: string;
  fixedId?: string | null;
  editing: boolean;
  disabled?: boolean;
  onChange: (id: string | undefined, type: SalesChannel) => void;
}) {
  const id = useId();
  const fixed = Boolean(editing && fixedId);
  const selected = channels.find((channel) => channel.id === (fixedId ?? valueId));
  const value = fixed ? (fixedId ?? "") : (valueId ?? (valueType ? `legacy:${valueType}` : ""));
  if (fixed)
    return (
      <div className="min-w-0 space-y-1">
        <Label>Canal de venta</Label>
        <p className="break-words rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
          {selected
            ? `${selected.label}${selected.identifier ? ` · ${selected.identifier}` : ""}`
            : `${valueType?.replace(/_/g, " ") ?? "Canal"} · registrado`}
        </p>
        <p className="text-xs text-muted-foreground">El canal registrado se conserva.</p>
      </div>
    );
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id}>
        Canal de venta <span className="text-destructive">*</span>
      </Label>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(choice) => {
          const instance = channels.find((channel) => channel.id === choice);
          if (instance) onChange(instance.id, saleChannelLegacyType(instance.type));
          else if (choice.startsWith("legacy:"))
            onChange(undefined, choice.slice(7) as SalesChannel);
        }}
      >
        <SelectTrigger
          id={id}
          className="min-w-0 overflow-hidden text-left [&>[data-slot=select-value]]:min-w-0 [&>[data-slot=select-value]]:flex-1 [&>[data-slot=select-value]]:truncate"
        >
          <SelectValue placeholder="Seleccionar canal de venta" />
        </SelectTrigger>
        <SelectContent>
          {channels.map((channel) => (
            <SelectItem key={channel.id} value={channel.id}>
              {channel.label}
              {channel.identifier ? ` · ${channel.identifier}` : ""}
            </SelectItem>
          ))}
          {channels.length === 0 ? (
            legacyChannels.map((channel) => (
              <SelectItem key={channel} value={`legacy:${channel}`}>
                {channel.replace(/_/g, " ")}
              </SelectItem>
            ))
          ) : editing && valueType && !valueId ? (
            <SelectItem value={`legacy:${valueType}`}>
              {valueType.replace(/_/g, " ")} · anterior sin identificar
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {channels.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Puedes usar estos canales de venta o{" "}
          <Link
            href="/configuracion/tiendas"
            className="text-primary underline-offset-4 hover:underline"
          >
            personalizarlos para esta tienda.
          </Link>
        </p>
      ) : editing && !valueId ? (
        <p className="text-xs text-muted-foreground">
          Elige un canal solo si confirmas el origen de esta venta.
        </p>
      ) : null}
    </div>
  );
}
