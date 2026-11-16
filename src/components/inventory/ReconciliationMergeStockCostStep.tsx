"use client";

import { Input } from "@/components/ui/input";
import type { MergeStockMode } from "@/services/reconciliationTask.service";
import {
  COUNT_MULTI_WAREHOUSE_MESSAGE,
  countAllowed,
  formatMoney,
  totalReserved,
  type MergeCostChoice,
  type MergeCostResolution,
  type MergeStockSides,
  type MergeStockValidation,
  type MergeWarehouseRow,
} from "./mergeStockCost";

// FEAT-17 Anexo E — paso 3 del modal de Unificar (solo pares). Componente
// controlado: el estado vive en `ReconciliationMergeDialog`.

const SHOPIFY_NOTICE =
  "Este producto se sincroniza periódicamente con Shopify. Si cambia el stock o el precio allá, se va a actualizar acá: ajústalo en Shopify. También puedes cambiarlo de forma manual en Powip.";

export interface ReconciliationMergeStockCostStepProps {
  sides: MergeStockSides;
  // FEAT-24 H1-A: desglose por almacén; solo se muestra si el conteo físico no se ofrece.
  warehouseRows?: MergeWarehouseRow[];
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

function stockText(quantity: number, reserved: number): string {
  return `${quantity} físico · ${reserved} reservado`;
}

export function ReconciliationMergeStockCostStep({
  sides,
  warehouseRows = [],
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
  const canCount = countAllowed(sides);

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
        {canCount && (
          <RadioRow
            name="merge-stock-mode"
            label="Conteo físico"
            checked={stockMode === "count"}
            disabled={disabled}
            onChange={() => onStockModeChange("count")}
          />
        )}
        {canCount && stockMode === "count" && (
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
        {!canCount && (
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">{COUNT_MULTI_WAREHOUSE_MESSAGE}</p>
            <table aria-label="Stock por almacén" className="w-full text-left">
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1 pr-3 font-medium">Almacén</th>
                  <th scope="col" className="py-1 pr-3 font-medium">Madre</th>
                  <th scope="col" className="py-1 font-medium">Otra variante</th>
                </tr>
              </thead>
              <tbody>
                {warehouseRows.map((row) => (
                  <tr key={row.inventoryId} className="border-t">
                    <th scope="row" className="py-1 pr-3 font-medium">{row.inventoryName}</th>
                    <td className="py-1 pr-3">{stockText(row.winnerQuantity, row.winnerReserved)}</td>
                    <td className="py-1">{stockText(row.loserQuantity, row.loserReserved)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
