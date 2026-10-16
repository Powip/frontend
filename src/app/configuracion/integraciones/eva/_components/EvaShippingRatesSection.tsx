"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Combobox } from "@/components/ui/combobox";
import {
  getEvaDistricts,
  getEvaShippingRates,
  saveEvaShippingRates,
} from "@/services/evaService";

const MAX_COST = 9999.99;

/** Vacío = sin valor; si no, el número (puede ser NaN si no es válido). */
function parseCost(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function isInvalidCost(value: string): boolean {
  const n = parseCost(value);
  return (
    n !== null &&
    (Number.isNaN(n) ||
      n < 0 ||
      n > MAX_COST ||
      Math.abs(Math.round(n * 100) - n * 100) > 1e-6)
  );
}

/** Tarifa de envío EVA: precio por defecto + precios por distrito (FEAT-26). */
export default function EvaShippingRatesSection({
  companyId,
  token,
}: {
  companyId: string;
  token: string;
}) {
  const [defaultCost, setDefaultCost] = useState("");
  const [rows, setRows] = useState<Array<{ district: string; cost: string }>>(
    [],
  );
  const [districts, setDistricts] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getEvaShippingRates(token, companyId), getEvaDistricts(token)])
      .then(([rates, list]) => {
        setDefaultCost(
          rates.defaultCost === null ? "" : String(rates.defaultCost),
        );
        setRows(
          Object.entries(rates.districts).map(([district, cost]) => ({
            district,
            cost: String(cost),
          })),
        );
        setDistricts(list);
      })
      .catch(() => toast.error("No se pudo cargar la tarifa de EVA."))
      .finally(() => setLoading(false));
  }, [companyId, token]);

  const invalid =
    isInvalidCost(defaultCost) ||
    rows.some((r) => r.cost.trim() === "" || isInvalidCost(r.cost));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEvaShippingRates(token, companyId, {
        defaultCost: parseCost(defaultCost),
        districts: Object.fromEntries(
          rows.map((r) => [r.district, Number(r.cost)]),
        ),
      });
      toast.success("Tarifa de EVA guardada");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(msg ?? "No se pudo guardar la tarifa de EVA.");
    } finally {
      setSaving(false);
    }
  };

  const available = districts.filter(
    (d) => !rows.some((r) => r.district === d),
  );

  return (
    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold dark:text-slate-100">
          Tarifas de envío
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          EVA no informa el costo por API: esta tarifa precarga el costo de
          cada envío. Si un distrito no está en la lista, se usa el costo por
          defecto.
        </p>
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Cargando tarifa...
        </p>
      ) : (
        <>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-300">
            Costo por defecto (S/)
            <input
              type="number"
              min={0}
              step={0.01}
              value={defaultCost}
              onChange={(e) => setDefaultCost(e.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </label>
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={row.district} className="flex items-center gap-2 text-xs">
                <span className="flex-1 font-medium text-gray-700 dark:text-slate-200">
                  {row.district}
                </span>
                <input
                  aria-label={`Costo ${row.district}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={row.cost}
                  onChange={(e) =>
                    setRows((p) =>
                      p.map((r, i) =>
                        i === index ? { ...r, cost: e.target.value } : r,
                      ),
                    )
                  }
                  className={`w-28 rounded border px-2 py-1 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${row.cost.trim() === "" || isInvalidCost(row.cost) ? "border-red-400" : ""}`}
                />
                <button
                  type="button"
                  aria-label={`Quitar ${row.district}`}
                  onClick={() => setRows((p) => p.filter((_, i) => i !== index))}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {adding ? (
            <Combobox
              value=""
              onValueChange={(district) => {
                setRows((p) => [...p, { district, cost: "" }]);
                setAdding(false);
              }}
              options={available.map((d) => ({ value: d, label: d }))}
              placeholder="Elegí un distrito"
              searchPlaceholder="Buscar distrito..."
              emptyMessage="No hay más distritos."
            />
          ) : (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-300"
            >
              + Agregar distrito
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || invalid}
            className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar tarifas"}
          </button>
        </>
      )}
    </div>
  );
}
