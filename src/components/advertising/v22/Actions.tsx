"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adsWrite, type AdsRow } from "@/services/advertisingV22Service";
import { useAdsV22, useRefreshAds } from "./context";
import { money, numeric, pct } from "./model";
import { Failure } from "./shared";

export interface ActionSelection {
  rows: AdsRow[];
  action: "pause" | "activate" | "budget" | "scale" | "duplicate";
}
export function AdvertisingActionDialog({
  selection,
  onClose,
  onPaused,
}: {
  selection: ActionSelection | null;
  onClose: () => void;
  onPaused?: (rows: AdsRow[]) => void;
}) {
  const { identity, settings } = useAdsV22();
  const refresh = useRefreshAds();
  const requestIds = useRef(new Map<string, string>());
  const [amount, setAmount] = useState("");
  const [pauseOriginal, setPauseOriginal] = useState(true);
  const [copyPaused, setCopyPaused] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const first = selection?.rows[0];
  const budget = first?.budget;
  const current = numeric(budget?.dailyBudget ?? budget?.amount);
  const proposed =
    amount === "" && current !== null
      ? current * (selection?.action === "scale" ? 1.2 : 1)
      : numeric(amount);
  const increase = current && proposed !== null ? (proposed - current) / current : null;
  const budgetAction =
    selection?.action === "budget" ||
    selection?.action === "scale" ||
    selection?.action === "duplicate";
  async function apply() {
    if (!identity || !selection || pending || !settings?.capabilities.edit) return;
    setPending(true);
    setError(null);
    let applied = 0;
    try {
      for (const row of selection.rows) {
        const ownBudget = row.budget;
        const action =
          selection.action === "pause" || selection.action === "activate"
            ? "status"
            : selection.action === "duplicate"
              ? "duplicate"
              : "budget";
        if (action !== "status" && (proposed === null || proposed <= 0 || !ownBudget))
          throw new Error("Necesitamos el presupuesto actual de Meta y un importe mayor a cero.");
        const requestKey = `${row.id}:${selection.action}:${proposed}`;
        if (!requestIds.current.has(requestKey))
          requestIds.current.set(requestKey, crypto.randomUUID());
        await adsWrite(identity, "post", "/meta/v22/actions", {
          requestId: requestIds.current.get(requestKey),
          accountId: row.accountId,
          objectId: action === "status" || action === "duplicate" ? row.id : ownBudget!.objectId,
          level:
            action === "duplicate" ? "adset" : action === "status" ? row.level : ownBudget!.level,
          action,
          ...(action === "status"
            ? { status: selection.action === "activate" ? "ACTIVE" : "PAUSED" }
            : {
                budget: proposed!.toFixed(2),
                ...(action === "duplicate"
                  ? { pauseOriginal, copyStatus: copyPaused ? "PAUSED" : "INHERITED_FROM_SOURCE" }
                  : {}),
              }),
        });
        applied++;
      }
      if (selection.action === "pause") onPaused?.(selection.rows);
      await refresh();
      setAmount("");
      onClose();
    } catch (failure) {
      setError(
        applied > 0
          ? new Error(
              `Meta confirmó ${applied} de ${selection.rows.length} cambios. ${failure instanceof Error ? failure.message : "Revisa el historial antes de continuar."}`,
            )
          : failure,
      );
      if (applied) await refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open={selection !== null}
      onOpenChange={(open) => {
        if (!open && !pending) {
          setAmount("");
          setError(null);
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {selection?.action === "pause"
              ? "Pausar anuncios"
              : selection?.action === "activate"
                ? "Activar anuncios"
                : selection?.action === "duplicate"
                  ? "Duplicar conjunto"
                  : "Cambiar presupuesto"}
          </DialogTitle>
          <DialogDescription>
            El cambio se aplica en Meta al confirmar y queda registrado en el historial.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 overflow-auto text-sm">
          {selection?.rows.map((row) => (
            <li key={row.id} className="flex justify-between gap-3 border-b py-2">
              <span>{row.name}</span>
              <span className="text-xs text-muted-foreground">
                {row.effectiveStatus ?? row.status}
              </span>
            </li>
          ))}
        </ul>
        {budgetAction && (
          <div className="space-y-3">
            <p className="text-sm">
              Actual: {money(current, first?.currency ?? "PEN")} ·{" "}
              {budget?.level === "campaign" ? "presupuesto de campaña" : "presupuesto del conjunto"}{" "}
              · afecta {budget?.affectedAds ?? "—"} anuncios
            </p>
            <label className="block space-y-1 text-sm">
              Nuevo presupuesto diario{" "}
              {first?.currency === "PEN" || !first?.currency ? "S/" : first.currency}
              <Input
                aria-label="Nuevo presupuesto diario"
                type="number"
                min=".01"
                step=".01"
                value={amount === "" ? (proposed?.toFixed(2) ?? "") : amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            {increase !== null && increase > 0.3 && (
              <p
                className={`rounded-md p-3 text-sm ${increase > 0.5 ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
              >
                Aumenta {pct(increase)}.
                {increase > 0.5
                  ? " Meta puede reiniciar el aprendizaje."
                  : " Revisa el impacto antes de confirmar."}
              </p>
            )}
            {budget?.increasedAt &&
              Date.now() - new Date(budget.increasedAt).getTime() < 3 * 86_400_000 && (
                <p className="text-sm text-amber-700">
                  Este presupuesto subió hace menos de 3 días. Espera 2–3 días antes de volver a
                  subirlo.
                </p>
              )}
            {selection?.action === "duplicate" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={copyPaused}
                    onChange={(event) => setCopyPaused(event.target.checked)}
                  />
                  Mantener copia pausada para revisar
                </label>
                <p className="text-xs text-muted-foreground">
                  Si quitas esta opción, la copia hereda el estado del conjunto original y puede
                  empezar a gastar.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={pauseOriginal}
                    onChange={(event) => setPauseOriginal(event.target.checked)}
                  />
                  Pausar el conjunto original
                </label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Meta permite hasta 4 cambios por hora por conjunto. El importe se convierte a la
              unidad mínima de la moneda al enviarlo.
            </p>
            {!budget && (
              <p className="text-sm text-amber-700">
                Meta todavía no informa el presupuesto propietario. Actualiza los datos antes de
                cambiarlo.
              </p>
            )}
          </div>
        )}
        {error != null && <Failure error={error} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Volver
          </Button>
          <Button
            disabled={
              pending ||
              !settings?.capabilities.edit ||
              (budgetAction && (!budget || proposed === null || proposed <= 0))
            }
            onClick={() => void apply()}
          >
            {pending ? "Aplicando en Meta…" : "Confirmar en Meta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
