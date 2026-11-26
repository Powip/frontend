"use client";
import { useState } from "react";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useSheets } from "@/hooks/useCrmContent";
import { cn } from "@/lib/utils";
import GuionMaterialList from "./GuionMaterialList";
import { NATIVE_SELECT_CLASS } from "./format";

/**
 * «Material de venta» por producto (mockup 152, K4): eliges un producto y
 * gestionas su material (fotos, video, tabla de medidas, testimonios, audio)
 * al lado de los datos de su ficha que usa la IA.
 */
export default function GuionProductMaterial() {
  const { stores } = useCrmMe();
  const sheets = useSheets("");
  const [pickedId, setPickedId] = useState<string>("");
  const list = sheets.data ?? [];
  if (list.length === 0) return null;
  const sheet = list.find((s) => s.id === pickedId) ?? null;
  const storeName = (id?: string | null) =>
    id ? (stores.find((st) => st.id === id)?.name ?? null) : null;
  const fields: Array<[string, string]> = sheet
    ? [
        ["Para quién es", sheet.forWhom],
        ["En qué destaca", sheet.highlights],
        ["Qué ofrecer si no hay stock", sheet.alternatives],
        ["Qué ofrecer además", sheet.complements],
      ]
    : [];

  return (
    <section
      aria-labelledby="guion-material-producto"
      className="space-y-3 rounded-md border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="guion-material-producto" className="text-base font-semibold">
            Material de venta
          </h2>
          <p className="text-sm text-muted-foreground">
            Fotos, tabla de medidas, testimonios, videos y audios por producto.
            Las vendedoras lo envían con un clic desde el chat.
          </p>
        </div>
        <select
          aria-label="Producto del material"
          className={cn(NATIVE_SELECT_CLASS, "h-9 w-72 text-sm")}
          value={sheet?.id ?? ""}
          onChange={(e) => setPickedId(e.target.value)}
        >
          <option value="">Elige un producto…</option>
          {list.map((s) => (
            <option key={s.id} value={s.id}>
              {`${s.name} · ${storeName(s.storeId) ?? "Todas las tiendas"}`}
            </option>
          ))}
        </select>
      </div>
      {!sheet && (
        <p className="text-sm text-muted-foreground">
          Elige un producto para ver y gestionar su material.
        </p>
      )}
      {sheet && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Material del producto
            </h3>
            <GuionMaterialList
              sheetId={sheet.id}
              items={sheet.materials}
              label={`Material de venta de ${sheet.name}`}
            />
          </div>
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ficha de venta (la usa la IA)
            </h3>
            <dl className="space-y-2 text-sm">
              {fields.map(([label, value]) => (
                <div key={label} className="rounded-md border p-2">
                  <dt className="text-xs font-medium text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="whitespace-pre-wrap">
                    {value?.trim() || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Se edita en «Productos (fichas)», más abajo.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
