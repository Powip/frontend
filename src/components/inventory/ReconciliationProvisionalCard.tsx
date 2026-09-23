"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  ReconciliationTask,
  ReconciliationTaskSuggestion,
  ReconciliationTaskSuggestionMatch,
  getReconciliationTaskErrorMessage,
} from "@/services/reconciliationTask.service";
import { useReconciliationVariantSearch } from "@/hooks/useReconciliationVariantSearch";
import type { ReconciliationLinkTargetVariant } from "./ReconciliationLinkDialog";

// FEAT-17 Anexo A (sección 4) — texto del badge de coincidencia mostrado
// junto a la sugerencia, en el mismo orden de fuerza de señal que usa el
// backend para ordenar `suggestions` (SKU > nombre+atributos > nombre).
const MATCH_LABELS: Record<ReconciliationTaskSuggestionMatch, string> = {
  sku: "SKU igual",
  name_attributes: "Nombre y atributos",
  name: "Nombre parecido",
};

interface VariantSearchOption {
  value: string;
  label: string;
  sku: string;
  company_sku: string | null;
  attribute_values: Record<string, string>;
}

function formatAttributeChip(
  attributeValues: Record<string, string> | undefined,
): string | null {
  if (!attributeValues) return null;
  const values = Object.values(attributeValues).filter(Boolean);
  return values.length > 0 ? values.join(" · ") : null;
}

interface ReconciliationProvisionalCardProps {
  task: ReconciliationTask;
  isSelected: boolean;
  isProcessing: boolean;
  onToggleSelected: (checked: boolean) => void;
  // "No, es nueva → crear" — mismo confirm-provisional de siempre.
  onConfirmNew: () => void;
  onReject: () => void;
  // "Sí, es la misma → unificar" (desde la sugerencia elegida) o al elegir
  // un resultado de "Buscar otra variante" — en ambos casos abre
  // `ReconciliationLinkDialog` con la variante recibida acá.
  onLinkToVariant: (variant: ReconciliationLinkTargetVariant) => void;
}

export function ReconciliationProvisionalCard({
  task,
  isSelected,
  isProcessing,
  onToggleSelected,
  onConfirmNew,
  onReject,
  onLinkToVariant,
}: ReconciliationProvisionalCardProps) {
  const item = task.items[0];
  const suggestions: ReconciliationTaskSuggestion[] = item?.suggestions ?? [];
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const selectedSuggestion =
    suggestions[selectedSuggestionIndex] ?? suggestions[0];
  const itemAttributeChip = formatAttributeChip(item?.attribute_values);
  const selectedSuggestionChip = selectedSuggestion
    ? formatAttributeChip(selectedSuggestion.attribute_values)
    : null;

  const {
    results: searchResults,
    isLoading: isSearching,
    isError: isSearchError,
    error: searchError,
    isSearchable,
  } = useReconciliationVariantSearch(searchInput);

  // react-query v5 sacó `onError` de `useQuery` — este efecto sólo dispara
  // el toast cuando cambia el estado de error, no hace fetch (eso lo sigue
  // haciendo react-query dentro del hook).
  useEffect(() => {
    if (isSearchError) {
      toast.error(
        getReconciliationTaskErrorMessage(
          searchError,
          "No se pudieron buscar variantes",
        ),
      );
    }
  }, [isSearchError, searchError]);

  const searchOptions: VariantSearchOption[] = searchResults.map(
    (result) => ({
      value: result.variant_id,
      label: result.product_name,
      sku: result.sku,
      company_sku: result.company_sku,
      attribute_values: result.attribute_values,
    }),
  );

  const searchEmptyMessage = isSearchError
    ? getReconciliationTaskErrorMessage(
        searchError,
        "No se pudieron buscar variantes",
      )
    : !isSearchable
      ? "Escribí al menos 2 caracteres para buscar"
      : isSearching
        ? "Buscando..."
        : "No se encontraron variantes";

  const handleSelectSearchResult = (variantId: string) => {
    const found = searchResults.find(
      (result) => result.variant_id === variantId,
    );
    if (found) onLinkToVariant(found);
  };

  return (
    <div className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {task.status === "pending" && (
            <Checkbox
              className="mt-1"
              checked={isSelected}
              onCheckedChange={(checked) =>
                onToggleSelected(checked === true)
              }
            />
          )}
          <div className="space-y-1">
            <p className="text-sm font-medium" title={item?.variant_name}>
              {item?.variant_name ?? "-"}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">
                SKU: {item?.sku ?? item?.company_sku ?? "Sin SKU"}
              </span>
              {item?.source && (
                <Badge variant="outline" className="text-[10px] uppercase">
                  {item.source}
                </Badge>
              )}
              {itemAttributeChip && (
                <Badge variant="secondary" className="text-[10px]">
                  {itemAttributeChip}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
          disabled={isProcessing}
          onClick={onReject}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Rechazar
        </Button>
      </div>

      {suggestions.length > 0 && selectedSuggestion ? (
        <div className="space-y-2 rounded-md border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            ¿Es la misma?
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {selectedSuggestion.product_name}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">
                  SKU:{" "}
                  {selectedSuggestion.sku ||
                    selectedSuggestion.company_sku ||
                    "Sin SKU"}
                </span>
                {selectedSuggestionChip && (
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedSuggestionChip}
                  </Badge>
                )}
              </div>
            </div>
            <Badge className="bg-blue-600 hover:bg-blue-600">
              {MATCH_LABELS[selectedSuggestion.match]}
            </Badge>
          </div>

          {suggestions.length > 1 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.variant_id}
                  type="button"
                  aria-pressed={index === selectedSuggestionIndex}
                  className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                    index === selectedSuggestionIndex
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedSuggestionIndex(index)}
                >
                  {suggestion.product_name}
                  {suggestion.sku ? ` · ${suggestion.sku}` : ""}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
              disabled={isProcessing}
              onClick={() => onLinkToVariant(selectedSuggestion)}
            >
              {isProcessing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              Sí, es la misma → unificar
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isProcessing}
              onClick={onConfirmNew}
            >
              No, es nueva → crear
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-emerald-200 text-emerald-600 hover:bg-emerald-50"
          disabled={isProcessing}
          onClick={onConfirmNew}
        >
          {isProcessing ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="mr-1 h-3.5 w-3.5" />
          )}
          Confirmar como nuevo
        </Button>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">
          Buscar otra variante
        </p>
        <Combobox
          value=""
          onValueChange={handleSelectSearchResult}
          onSearchChange={setSearchInput}
          options={searchOptions}
          placeholder="Buscar por nombre o SKU..."
          searchPlaceholder="Nombre, SKU..."
          emptyMessage={searchEmptyMessage}
          isLoading={isSearching}
          disabled={isProcessing}
          className="h-9 w-full max-w-sm text-xs"
          renderLabel={(option: VariantSearchOption) => {
            const chip = formatAttributeChip(option.attribute_values);
            return (
              <div className="flex flex-col gap-0.5 py-0.5">
                <span className="text-sm">{option.label}</span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  SKU: {option.sku || option.company_sku || "Sin SKU"}
                </span>
                {chip && (
                  <span className="text-[10px] text-muted-foreground">
                    {chip}
                  </span>
                )}
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
