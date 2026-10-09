import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { WHATSAPP_SCHEDULING_LIMITS } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_RULE_DATE_MODES,
  type WhatsAppRuleDateMode,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { RuleConfigValues } from "@/features/whatsapp/schemas/rule-config.schema";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
import { ScopeChipGroup } from "./ScopeChipGroup";

interface RuleScopeFieldsProps {
  catalogs: WhatsAppScopeCatalogs;
  summary: string;
  readOnly: boolean;
  onRequestCount?: () => void;
}

export function RuleScopeFields({
  catalogs,
  summary,
  readOnly,
  onRequestCount,
}: RuleScopeFieldsProps) {
  const form = useFormContext<RuleConfigValues>();
  const dateMode = useWatch({ control: form.control, name: "dateMode" });
  const summaryId = useId();

  const setChips = (
    name: "storeIds" | "salesChannels" | "shippingTypes" | "courierIds",
    value: string[],
  ) => form.setValue(name, value, { shouldDirty: true });

  return (
    <details className="group rounded-lg border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-medium">A qué pedidos</span>
        <span id={summaryId} className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {summary}
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 border-t p-3">
        <p className="text-xs text-muted-foreground">Resumen: {summary}</p>
        <FormField
          control={form.control}
          name="dateMode"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <TemplateSegmentedChoice
                  legend="Fechas"
                  name={`${summaryId}-date-mode`}
                  value={field.value}
                  readOnly={readOnly}
                  options={[
                    {
                      value: WHATSAPP_RULE_DATE_MODES.SINCE_ACTIVATION,
                      label: "Desde que se activa",
                    },
                    { value: WHATSAPP_RULE_DATE_MODES.RANGE, label: "Entre dos fechas" },
                  ]}
                  onValueChange={(value: WhatsAppRuleDateMode) =>
                    form.setValue("dateMode", value, { shouldDirty: true })
                  }
                />
              </FormControl>
              <FormDescription>Fecha de creación del pedido.</FormDescription>
            </FormItem>
          )}
        />
        {dateMode === WHATSAPP_RULE_DATE_MODES.RANGE && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="from"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Desde</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} readOnly={readOnly} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hasta (opcional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} readOnly={readOnly} />
                  </FormControl>
                  <FormDescription>Vacío = sin fin.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        <FormField
          control={form.control}
          name="maxOrderAgeDays"
          render={({ field }) => (
            <FormItem className="max-w-xs">
              <FormLabel>No avisar pedidos con más de (días)</FormLabel>
              <FormControl>
                <Input {...field} inputMode="numeric" readOnly={readOnly} />
              </FormControl>
              <FormDescription>
                Entre {WHATSAPP_SCHEDULING_LIMITS.maxOrderAgeDays.min} y{" "}
                {WHATSAPP_SCHEDULING_LIMITS.maxOrderAgeDays.max} días.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <ScopeChipGroup
          legend="Tiendas"
          allLabel="Todas"
          emptyLabel="Tu empresa todavía no tiene tiendas."
          catalog={catalogs.stores}
          value={form.watch("storeIds")}
          onChange={(value) => setChips("storeIds", value)}
          disabled={readOnly}
        />
        <ScopeChipGroup
          legend="Canal de venta"
          allLabel="Todos"
          emptyLabel="Tu empresa no tiene canales de venta configurados."
          catalog={catalogs.salesChannels}
          value={form.watch("salesChannels")}
          onChange={(value) => setChips("salesChannels", value)}
          disabled={readOnly}
        />
        <ScopeChipGroup
          legend="Tipo de envío"
          allLabel="Todos"
          emptyLabel="No hay tipos de envío disponibles."
          catalog={catalogs.shippingTypes}
          value={form.watch("shippingTypes")}
          onChange={(value) => setChips("shippingTypes", value)}
          disabled={readOnly}
        />
        <ScopeChipGroup
          legend="Courier"
          allLabel="Todos"
          emptyLabel="Tu empresa no tiene couriers activos."
          catalog={catalogs.couriers}
          value={form.watch("courierIds")}
          onChange={(value) => setChips("courierIds", value)}
          disabled={readOnly}
        />
        {onRequestCount && (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-2 hover:underline"
            onClick={onRequestCount}
          >
            Ver a cuántos pedidos actuales aplica
          </button>
        )}
      </div>
    </details>
  );
}
