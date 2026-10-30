import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { useId } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { WaInput } from "@/components/whatsapp/ui/WaInput";
import { waButton, waInput } from "@/components/whatsapp/ui/wa-classes";
import { WHATSAPP_SCHEDULING_LIMITS } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import {
  WHATSAPP_RULE_DATE_MODES,
  type WhatsAppRuleDateMode,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { RuleConfigValues } from "@/features/whatsapp/schemas/rule-config.schema";
import { cn } from "@/lib/utils";
import { TemplateSegmentedChoice } from "../plantillas/TemplateSegmentedChoice";
import { SCOPE_ROW, SCOPE_ROW_LABEL, ScopeChipGroup } from "./ScopeChipGroup";

interface RuleScopeFieldsProps {
  catalogs: WhatsAppScopeCatalogs;
  summary: string;
  readOnly: boolean;
  onRequestCount?: () => void;
}

const SMALL_INPUT = cn(waInput, "px-2 py-1 text-[12.5px]");

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
    <details className="group rounded-[10px] border border-wa-border bg-wa-surface-2">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[10px] px-3 py-[9px] text-[12.5px] outline-none group-open:rounded-b-none group-open:border-b group-open:border-wa-border focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-wa-primary [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-[15px] shrink-0" aria-hidden="true" />
        <b className="font-semibold">A qué pedidos</b>
        <span id={summaryId} className="min-w-0 flex-1 truncate text-wa-muted">
          {summary}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="flex flex-col gap-3 p-3">
        <p className="sr-only">Resumen: {summary}</p>
        <FormField
          control={form.control}
          name="dateMode"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <div className={SCOPE_ROW}>
                <span className={SCOPE_ROW_LABEL} aria-hidden="true">
                  Fechas
                </span>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <FormControl>
                    <TemplateSegmentedChoice
                      legend="Fechas"
                      className="[&>legend]:sr-only"
                      name={`${summaryId}-date-mode`}
                      value={field.value}
                      readOnly={readOnly}
                      options={[
                        {
                          value: WHATSAPP_RULE_DATE_MODES.SINCE_ACTIVATION,
                          label: "Creados desde que se activa",
                        },
                        { value: WHATSAPP_RULE_DATE_MODES.RANGE, label: "Entre dos fechas" },
                      ]}
                      onValueChange={(value: WhatsAppRuleDateMode) =>
                        form.setValue("dateMode", value, { shouldDirty: true })
                      }
                    />
                  </FormControl>
                  {dateMode === WHATSAPP_RULE_DATE_MODES.RANGE && (
                    <div className="flex flex-wrap items-start gap-1.5">
                      <FormField
                        control={form.control}
                        name="from"
                        render={({ field: from }) => (
                          <FormItem className="gap-1 space-y-0">
                            <FormLabel className="sr-only">Desde</FormLabel>
                            <FormControl>
                              <WaInput
                                type="date"
                                {...from}
                                readOnly={readOnly}
                                className={cn(SMALL_INPUT, "wa-num w-auto")}
                              />
                            </FormControl>
                            <FormMessage className="text-xs text-wa-red" />
                          </FormItem>
                        )}
                      />
                      <span className="pt-1.5 text-wa-muted">al</span>
                      <FormField
                        control={form.control}
                        name="to"
                        render={({ field: to }) => (
                          <FormItem className="gap-1 space-y-0">
                            <FormLabel className="sr-only">Hasta (opcional)</FormLabel>
                            <FormControl>
                              <WaInput
                                type="date"
                                {...to}
                                readOnly={readOnly}
                                className={cn(SMALL_INPUT, "wa-num w-auto")}
                              />
                            </FormControl>
                            <FormMessage className="text-xs text-wa-red" />
                          </FormItem>
                        )}
                      />
                      <span className="pt-1.5 text-xs text-wa-muted">vacío = sin fin</span>
                    </div>
                  )}
                </div>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="maxOrderAgeDays"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <div className={SCOPE_ROW}>
                <span className={SCOPE_ROW_LABEL} aria-hidden="true">
                  Antigüedad
                </span>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span aria-hidden="true">No avisar pedidos con más de</span>
                    <FormLabel className="sr-only">No avisar pedidos con más de (días)</FormLabel>
                    <FormControl>
                      <WaInput
                        {...field}
                        inputMode="numeric"
                        readOnly={readOnly}
                        className={cn(SMALL_INPUT, "wa-num w-16 text-center")}
                      />
                    </FormControl>
                    <span aria-hidden="true">días</span>
                  </div>
                  <span className="text-xs text-wa-muted">
                    Entre {WHATSAPP_SCHEDULING_LIMITS.maxOrderAgeDays.min} y{" "}
                    {WHATSAPP_SCHEDULING_LIMITS.maxOrderAgeDays.max} días.
                  </span>
                  <FormMessage className="text-xs text-wa-red" />
                </div>
              </div>
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
            className={cn(
              waButton({ size: "sm" }),
              "max-w-full self-start whitespace-normal text-left",
            )}
            onClick={onRequestCount}
          >
            <Search aria-hidden="true" />
            Ver a cuántos pedidos actuales aplica
          </button>
        )}
      </div>
    </details>
  );
}
