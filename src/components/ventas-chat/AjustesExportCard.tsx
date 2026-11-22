"use client";
import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCreateExport, useExportLog } from "@/hooks/useCrmTeam";
import type { ExportDataset, ExportLogItem, ExportSheet } from "@/types/crmTeam";
import { NATIVE_SELECT_CLASS } from "./format";

export const DATASET_LABEL: Record<ExportDataset, string> = {
  clients: "Clientes",
  orders: "Pedidos",
};

type Period = "" | "30" | "90";
const PERIOD_LABEL: Record<Period, string> = {
  "": "Todo",
  "30": "Últimos 30 días",
  "90": "Últimos 90 días",
};

/** Arma el Excel (una hoja por base) y lo descarga. */
export async function downloadExcel(sheets: ExportSheet[], filename: string) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = sheet.rows.length
      ? XLSX.utils.json_to_sheet(sheet.rows)
      : XLSX.utils.aoa_to_sheet([["Sin datos para estos filtros"]]);
    XLSX.utils.book_append_sheet(book, ws, DATASET_LABEL[sheet.dataset]);
  }
  XLSX.writeFile(book, filename);
}

function filtersLabel(item: ExportLogItem, storeName: (id: string) => string) {
  const parts = [
    item.filters.storeId ? storeName(item.filters.storeId) : "Todas las tiendas",
    item.filters.days ? `Últimos ${item.filters.days} días` : "Todo",
  ];
  return parts.join(" · ");
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Solo administrador: descarga de la base de clientes y pedidos, con registro. */
export default function AjustesExportCard() {
  const { stores } = useCrmMe();
  const log = useExportLog();
  const create = useCreateExport();
  const [datasets, setDatasets] = useState<ExportDataset[]>(["clients", "orders"]);
  const [storeId, setStoreId] = useState("");
  const [period, setPeriod] = useState<Period>("");
  const [truncated, setTruncated] = useState(false);
  const storeName = (id: string) => stores.find((s) => s.id === id)?.name ?? id;

  const toggle = (d: ExportDataset, on: boolean) =>
    setDatasets((cur) => (on ? [...cur.filter((x) => x !== d), d] : cur.filter((x) => x !== d)));

  const run = () => {
    const ordered = (["clients", "orders"] as const).filter((d) => datasets.includes(d));
    create.mutate(
      {
        datasets: [...ordered],
        ...(storeId ? { storeId } : {}),
        ...(period ? { days: Number(period) as 30 | 90 } : {}),
      },
      {
        onSuccess: async (sheets) => {
          setTruncated(sheets.some((s) => s.truncated));
          const day = new Date().toISOString().slice(0, 10);
          await downloadExcel(sheets, `base-crm-${day}.xlsx`);
        },
      },
    );
  };

  const items = log.data ?? [];
  return (
    <section
      aria-labelledby="export-title"
      className="space-y-3 rounded-md border bg-card p-4"
      data-testid="card-export"
    >
      <div className="space-y-1">
        <h2 id="export-title" className="text-sm font-semibold">
          Descargar base de datos
        </h2>
        <p className="text-xs text-muted-foreground">
          Excel con tus clientes y pedidos del chat. Solo el administrador puede descargarla y cada
          descarga queda registrada abajo con quién, cuándo y qué filtros usó.
        </p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Qué descargar</legend>
        <div className="flex flex-wrap gap-4">
          {(["clients", "orders"] as const).map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={datasets.includes(d)}
                onCheckedChange={(v) => toggle(d, v === true)}
                aria-label={DATASET_LABEL[d]}
              />
              {DATASET_LABEL[d]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        {stores.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Tienda
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Periodo
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className={cn(NATIVE_SELECT_CLASS, "w-auto min-w-40")}
          >
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {datasets.length === 0 && (
        <p className="text-xs text-amber-700">Elige al menos una base para descargar.</p>
      )}
      {truncated && (
        <p className="text-xs text-amber-700">
          La descarga se cortó en 20 000 filas por base. Usa un filtro para bajar el resto.
        </p>
      )}
      {create.isError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {crmError(create.error).message}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={datasets.length === 0 || create.isPending}
          onClick={run}
        >
          {create.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-1 h-3.5 w-3.5" />
          )}
          Descargar Excel
        </Button>
      </div>

      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold">Registro de descargas</h3>
        {log.isLoading ? (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando registro…
          </p>
        ) : log.isError ? (
          <p role="alert" className="text-xs text-destructive">
            {crmError(log.error).message}
          </p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Todavía nadie descargó la base.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-xs" data-testid="export-log">
              <thead className="bg-muted/40">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Quién</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Qué</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Filtros</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Filas</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {formatDateTime(it.createdAt)}
                    </td>
                    <td className="px-3 py-2">{it.userEmail ?? it.userId}</td>
                    <td className="px-3 py-2">{DATASET_LABEL[it.dataset] ?? it.dataset}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {filtersLabel(it, storeName)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{it.rowCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
