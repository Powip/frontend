"use client";

import { useRef, useState } from "react";
import { CloudOff } from "lucide-react";
import ScanInput from "@/components/almacen/ScanInput";
import { useWarehouseQueue } from "@/components/almacen/WarehouseQueueContext";
import { useAuth } from "@/contexts/AuthContext";
import { scanFeedback } from "@/lib/barcodeScanner";
import { OfflineUnavailableError, readWithSnapshot, type SnapshotRead } from "@/lib/offlineStore";
import { apiErrorMessage } from "@/lib/orderStock";
import {
  fetchConsultResult,
  formatSavedAt,
  MATCHED_BY_LABEL,
  snapshotKey,
  type ConsultResult,
  type ConsultVariant,
} from "@/lib/warehouseMode";

// FEAT-24 H6-D (H6-D3) — Consultar: se escanea un código y se ve el producto,
// la variante y su stock por almacén (físico, reservado y disponible). Cada
// consulta queda guardada en el celular: sin señal se muestra la última, con
// su hora.

type State =
  | { status: "idle" }
  | { status: "loading"; code: string }
  | { status: "done"; read: SnapshotRead<ConsultResult> }
  | { status: "error"; code: string; message: string };

function StockFigure({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1.5 text-center">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

function VariantCard({ variant }: { variant: ConsultVariant }) {
  return (
    <article className="space-y-3 rounded-xl border p-4" data-testid={`consult-${variant.variantId}`}>
      <div>
        <h2 className="text-base font-semibold leading-tight">{variant.productName}</h2>
        {variant.attributes ? <p className="text-sm">{variant.attributes}</p> : null}
        <p className="text-xs text-muted-foreground">
          SKU {variant.sku}
          {variant.companySku && variant.companySku !== variant.sku ? ` · ${variant.companySku}` : ""}
          {variant.matchedBy ? ` · leído por ${MATCHED_BY_LABEL[variant.matchedBy]}` : ""}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StockFigure label="Físico" value={variant.totals.physical} />
        <StockFigure label="Reservado" value={variant.totals.reserved} />
        <StockFigure label="Disponible" value={variant.totals.available} tone={variant.totals.available < 0 ? "danger" : undefined} />
      </div>
      {variant.warehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin stock en ningún almacén activo.</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Stock por almacén</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1 font-medium">Almacén</th>
              <th className="py-1 text-right font-medium">Físico</th>
              <th className="py-1 text-right font-medium">Reserv.</th>
              <th className="py-1 text-right font-medium">Disp.</th>
            </tr>
          </thead>
          <tbody>
            {variant.warehouses.map((row) => (
              <tr key={row.inventoryId} className="border-t">
                <td className="py-1.5 pr-2">{row.name}</td>
                <td className="py-1.5 text-right tabular-nums">{row.physical}</td>
                <td className="py-1.5 text-right tabular-nums">{row.reserved}</td>
                <td className={`py-1.5 text-right font-medium tabular-nums ${row.available < 0 ? "text-destructive" : ""}`}>{row.available}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

export default function ConsultScreen() {
  const { auth } = useAuth();
  const { snapshots, session } = useWarehouseQueue();
  const companyId = auth?.company?.id ?? auth?.user?.companyId ?? "";
  const [state, setState] = useState<State>({ status: "idle" });
  // Un lector rápido puede mandar varios códigos: solo se muestra el último.
  const latest = useRef(0);

  const consult = async (code: string) => {
    if (!snapshots || !session) {
      setState({ status: "error", code, message: "Espera un momento: se está preparando el almacenamiento del celular." });
      return;
    }
    const request = ++latest.current;
    setState({ status: "loading", code });
    try {
      const read = await readWithSnapshot(snapshots, snapshotKey(session, "consult", code.toLowerCase()), () => fetchConsultResult(code, companyId), {
        online: navigator.onLine !== false,
      });
      if (request !== latest.current) return;
      scanFeedback(read.data.variants.length > 0 ? "ok" : "error");
      setState({ status: "done", read });
    } catch (error) {
      if (request !== latest.current) return;
      scanFeedback("error");
      setState({
        status: "error",
        code,
        message:
          error instanceof OfflineUnavailableError
            ? `Sin señal: el código ${code} todavía no se consultó en este celular.`
            : apiErrorMessage(error, `No se pudo consultar el código ${code}.`),
      });
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight">Consultar</h1>
      <ScanInput id="almacen-consultar" onCode={(code) => void consult(code)} label="Código del producto" />

      {state.status === "loading" ? <p className="text-sm text-muted-foreground">Buscando {state.code}…</p> : null}
      {state.status === "error" ? (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      {state.status === "done" ? (
        <section className="space-y-3" aria-label={`Resultado de ${state.read.data.code}`}>
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {state.read.fromCache ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <CloudOff className="h-3 w-3" aria-hidden="true" />
                Sin señal: datos guardados
              </span>
            ) : null}
            Última actualización: {formatSavedAt(state.read.savedAt)}
          </p>
          {state.read.data.variants.length === 0 ? (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              El código {state.read.data.code} no es de ningún producto de tu empresa.
            </p>
          ) : (
            state.read.data.variants.map((variant) => <VariantCard key={variant.variantId} variant={variant} />)
          )}
        </section>
      ) : null}
      {state.status === "idle" ? (
        <p className="text-sm text-muted-foreground">Escanea el EAN de POWIP, el código de fábrica o el SKU.</p>
      ) : null}
    </div>
  );
}
