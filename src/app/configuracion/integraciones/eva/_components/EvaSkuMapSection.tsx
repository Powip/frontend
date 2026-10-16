"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  deleteEvaSkuMapping,
  getEvaSkuMap,
  saveEvaSkuMap,
} from "@/services/evaService";
import { fetchBusinessInventories } from "@/services/inventoryCatalogService";
import { fetchBusinessInventoryItems } from "@/services/businessInventoryItemsService";
import { isValidEvaSkuCode } from "@/components/eva/evaModalHelpers";

interface VariantRow {
  variantId: string;
  productName: string;
  sku: string;
  attributes?: Record<string, string>;
}

/** Nombre visible de la variante: producto + atributos, para distinguir colores/tallas. */
function variantLabel(variant: VariantRow): string {
  const attrs = Object.values(variant.attributes ?? {}).filter(Boolean);
  return attrs.length > 0
    ? `${variant.productName} (${attrs.join(" / ")})`
    : variant.productName;
}

/** Vínculo de todas las variantes de la empresa con su código del almacén EVA (FEAT-26). */
export default function EvaSkuMapSection({
  companyId,
  token,
}: {
  companyId: string;
  token: string;
}) {
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const inventories = await fetchBusinessInventories({
        companyId,
        accessToken: token,
      });
      const [rows, mappings] = await Promise.all([
        fetchBusinessInventoryItems({
          inventories,
          companyId,
          accessToken: token,
        }),
        getEvaSkuMap(token, companyId),
      ]);
      // Una fila por variante: la misma variante aparece una vez por almacén.
      const unique = new Map<string, VariantRow>();
      rows.forEach((r) => {
        if (!unique.has(r.variantId)) {
          unique.set(r.variantId, {
            variantId: r.variantId,
            productName: r.productName,
            sku: r.sku,
            attributes: r.attributes,
          });
        }
      });
      const savedCodes = Object.fromEntries(
        mappings.map((m) => [m.variantId, m.evaSku]),
      );
      setVariants(
        [...unique.values()].sort((a, b) =>
          variantLabel(a).localeCompare(variantLabel(b), "es"),
        ),
      );
      setSaved(savedCodes);
      setValues(savedCodes);
    } catch {
      setError("No se pudieron cargar los productos o los vínculos de EVA.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [companyId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return variants;
    return variants.filter((v) =>
      [variantLabel(v), v.sku, values[v.variantId] ?? ""].some((text) =>
        text.toLowerCase().includes(q),
      ),
    );
  }, [variants, values, search]);

  const changed = variants.filter(
    (v) => (values[v.variantId] ?? "").trim() !== (saved[v.variantId] ?? ""),
  );
  const toUpsert = changed.filter(
    (v) => (values[v.variantId] ?? "").trim() !== "",
  );
  const toDelete = changed.filter(
    (v) => (values[v.variantId] ?? "").trim() === "" && saved[v.variantId],
  );
  const hasInvalid = toUpsert.some(
    (v) => !isValidEvaSkuCode(values[v.variantId]),
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (toUpsert.length > 0) {
        await saveEvaSkuMap(
          token,
          companyId,
          toUpsert.map((v) => ({
            variantId: v.variantId,
            evaSku: values[v.variantId].trim(),
            // Snapshots para mostrar: el backend acepta hasta 100 y 200 caracteres.
            powipSku: v.sku?.slice(0, 100),
            productName: v.productName?.slice(0, 200),
          })),
        );
      }
      await Promise.all(
        toDelete.map((v) => deleteEvaSkuMapping(token, companyId, v.variantId)),
      );
      const next = { ...saved };
      toUpsert.forEach((v) => (next[v.variantId] = values[v.variantId].trim()));
      toDelete.forEach((v) => delete next[v.variantId]);
      setSaved(next);
      setValues(next);
      toast.success("Vínculos de SKU EVA guardados");
    } catch {
      toast.error(
        "No se pudieron guardar los vínculos. Revisá los códigos y probá de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-sm font-semibold dark:text-slate-100">
          Productos (SKU EVA)
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Código de cada producto en el almacén de EVA. Se completa solo al
          enviar pedidos.
        </p>
      </div>
      {loading && (
        <p className="text-xs text-gray-400 dark:text-slate-500">
          Cargando productos...
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!loading && !error && (
        <>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU"
            className="w-full rounded-lg border px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <div className="max-h-96 divide-y overflow-y-auto rounded-lg border dark:divide-slate-700 dark:border-slate-700">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-400 dark:text-slate-500">
                No hay productos para mostrar.
              </p>
            )}
            {filtered.map((v) => (
              <div
                key={v.variantId}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0 text-xs">
                  <p className="truncate font-medium text-gray-800 dark:text-slate-100">
                    {variantLabel(v)}
                  </p>
                  <p className="font-mono text-[11px] text-gray-400 dark:text-slate-500">
                    {v.sku}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {saved[v.variantId] && (values[v.variantId] ?? "") !== "" && (
                    <button
                      type="button"
                      aria-label={`Quitar vínculo de ${variantLabel(v)}`}
                      title="Quitar vínculo (se aplica al guardar)"
                      onClick={() =>
                        setValues((p) => ({ ...p, [v.variantId]: "" }))
                      }
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      ✕
                    </button>
                  )}
                  <input
                    aria-label={`SKU EVA de ${variantLabel(v)}`}
                    value={values[v.variantId] ?? ""}
                    onChange={(e) =>
                      setValues((p) => ({
                        ...p,
                        [v.variantId]: e.target.value,
                      }))
                    }
                    placeholder="Código EVA"
                    className={`w-36 rounded border px-2 py-1 font-mono text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 ${values[v.variantId]?.trim() && !isValidEvaSkuCode(values[v.variantId]) ? "border-red-400" : ""}`}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || changed.length === 0 || hasInvalid}
            className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Guardando..."
              : `Guardar cambios${changed.length ? ` (${changed.length})` : ""}`}
          </button>
        </>
      )}
    </div>
  );
}
