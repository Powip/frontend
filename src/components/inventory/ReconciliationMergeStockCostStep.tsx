"use client";

import { Input } from "@/components/ui/input";
import type { MergeStockMode } from "@/services/reconciliationTask.service";
import {
  formatMoney,
  totalReserved,
  type MergeCostChoice,
  type MergeCostResolution,
  type MergeStockSides,
  type MergeStockValidation,
} from "./mergeStockCost";

// FEAT-17 Anexo E — paso 3 del modal de Unificar (solo pares). Componente
// controlado: el estado vive en `ReconciliationMergeDialog`.

const SHOPIFY_NOTICE =
  "Este producto se sincroniza periódicamente con Shopify. Si cambia el stock o el precio allá, se va a actualizar acá: ajustalo en Shopify. También podés cambiarlo de forma manual en Powip.";

export interface ReconciliationMergeStockCostStepProps {
  sides: MergeStockSides;
  winnerCost: number;
  loserCost: number;
  showShopifyNotice: boolean;
  stockMode: MergeStockMode | null;
  onStockModeChange: (mode: MergeStockMode) => void;
  countedRaw: string;
  onCountedRawChange: (value: string) => void;
  costChoice: MergeCostChoice;
  onCostChoiceChange: (choice: MergeCostChoice) => void;
  customCostRaw: string;
  onCustomCostRawChange: (value: string) => void;
  stockValidation: MergeStockValidation;
  cost: MergeCostResolution;
  disabled: boolean;
}

function RadioRow({
  name,
  label,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="radio"
        name={name}
        className="h-4 w-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      {label}
    </label>
  );
}

export function ReconciliationMergeStockCostStep({
  sides,
  winnerCost,
  loserCost,
  showShopifyNotice,
  stockMode,
  onStockModeChange,
  countedRaw,
  onCountedRawChange,
  costChoice,
  onCostChoiceChange,
  customCostRaw,
  onCustomCostRawChange,
  stockValidation,
  cost,
  disabled,
}: ReconciliationMergeStockCostStepProps) {
  const reserved = totalReserved(sides);
  const sameCost = winnerCost === loserCost;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Stock</legend>
        <RadioRow
          name="merge-stock-mode"
          label={`Usar stock de la madre (${sides.winnerQuantity})`}
          checked={stockMode === "winner"}
          disabled={disabled}
          onChange={() => onStockModeChange("winner")}
        />
        <RadioRow
          name="merge-stock-mode"
          label={`Sumar ambos (${sides.winnerQuantity + sides.loserQuantity})`}
          checked={stockMode === "sum"}
          disabled={disabled}
          onChange={() => onStockModeChange("sum")}
        />
        <RadioRow
          name="merge-stock-mode"
          label="Conteo físico"
          checked={stockMode === "count"}
          disabled={disabled}
          onChange={() => onStockModeChange("count")}
        />
        {stockMode === "count" && (
          <div className="pl-6">
            <label className="text-xs text-muted-foreground" htmlFor="merge-counted-quantity">
              Cantidad contada
            </label>
            <Input
              id="merge-counted-quantity"
              inputMode="numeric"
              className="mt-1 w-40"
              value={countedRaw}
              disabled={disabled}
              onChange={(event) => onCountedRawChange(event.target.value)}
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Reservas que pasan a la madre: {sides.loserReserved}
        </p>
        {stockValidation.error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {stockValidation.error}
          </p>
        )}
      </fieldset>

      <fieldset className="space-y-2 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">Costo</legend>
        {sameCost ? (
          <p className="text-sm">
            {formatMoney(winnerCost)} (igual en las dos)
          </p>
        ) : (
          <>
            <RadioRow
              name="merge-cost-choice"
              label={`Costo de la madre (${formatMoney(winnerCost)})`}
              checked={costChoice === "winner"}
              disabled={disabled}
              onChange={() => onCostChoiceChange("winner")}
            />
            <RadioRow
              name="merge-cost-choice"
              label={`Costo de la otra variante (${formatMoney(loserCost)})`}
              checked={costChoice === "loser"}
              disabled={disabled}
              onChange={() => onCostChoiceChange("loser")}
            />
            <RadioRow
              name="merge-cost-choice"
              label="Otro valor"
              checked={costChoice === "custom"}
              disabled={disabled}
              onChange={() => onCostChoiceChange("custom")}
            />
            {costChoice === "custom" && (
              <div className="pl-6">
                <label className="text-xs text-muted-foreground" htmlFor="merge-custom-cost">
                  Nuevo costo
                </label>
                <Input
                  id="merge-custom-cost"
                  inputMode="decimal"
                  className="mt-1 w-40"
                  value={customCostRaw}
                  disabled={disabled}
                  onChange={(event) => onCustomCostRawChange(event.target.value)}
                />
              </div>
            )}
            {cost.error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {cost.error}
              </p>
            )}
          </>
        )}
      </fieldset>

      {showShopifyNotice && (
        <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {SHOPIFY_NOTICE}
        </div>
      )}

      <p data-testid="merge-summary" className="text-sm font-semibold">
        Stock {sides.winnerQuantity} → {stockValidation.finalQuantity ?? "—"} · Reservado {reserved} · Costo{" "}
        {cost.value === null ? "—" : formatMoney(cost.value)}
      </p>
    </div>
  );
}
