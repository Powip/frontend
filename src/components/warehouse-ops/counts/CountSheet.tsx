"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import ScanInput from "@/components/almacen/ScanInput";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationKeys } from "@/hooks/useOperationKeys";
import { scanFeedback } from "@/lib/barcodeScanner";
import { newOperationId } from "@/lib/purchaseOrders";
import {
  COUNT_DECISION_LABEL,
  COUNT_SCOPE_LABEL,
  COUNT_STATUS_CLASS,
  COUNT_STATUS_LABEL,
  countDecisionOptions,
  countDecisionProblem,
  countHidesSystem,
  countLineNeedsDecision,
  countProgress,
  formatDateTime,
  lineLabel,
  mergeCountEntries,
  opsErrorMessage,
  parseQuantity,
  UNRESOLVED_REASON_LABEL,
  warehouseOpsAccess,
  whoDid,
  type CountDecisionDraft,
} from "@/lib/warehouseOps";
import {
  addCountEntries,
  applyCount,
  cancelCount,
  closeCount,
  getCount,
  recountLines,
  setCountDecisions,
  type CountDecision,
  type CountEntriesResult,
  type CountLine,
  type StockCount,
} from "@/services/warehouseOpsService";
import { invalidateInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { ErrorBox, Money, ReasonDialog, SELECT_CLASS, StatusPill } from "../OpsBits";

// FEAT-24 H5-C (H5-D5) — una toma de inventario (mockup vConteo):
//   - En curso: se carga lo contado a mano (reemplaza) o escaneando (cada
//     escaneo suma 1; el código va tal cual y lo resuelve el servidor). Cerrar
//     la manda a validar.
//   - Por validar: diferencia = contado − esperado. Lo que entra en la
//     tolerancia se aplica solo; el resto pide decisión por línea (o reconteo).
//     Aplicar registra los ajustes.
// Conteo ciego: mientras está en curso la API omite el esperado y las
// diferencias; esta pantalla tampoco los muestra ni los calcula.

export const countKey = (companyId: string, countId: string) => ["stock-count", companyId, countId];

interface FailedScan {
  code: string;
  key: string;
}

interface Props {
  companyId: string;
  countId: string;
  warehouseName: string;
  courierWarehouse: boolean;
  onChanged: () => void;
  onClose: () => void;
}

const emptyDraft = (line: CountLine): CountDecisionDraft => ({
  decision: line.decision && line.decision !== "auto" ? line.decision : "",
  responsible: line.responsible ?? "",
  dueDate: line.dueDate ?? "",
  note: line.decisionNote ?? "",
});

export default function CountSheet({ companyId, countId, warehouseName, courierWarehouse, onChanged, onClose }: Props) {
  const { auth } = useAuth();
  const access = warehouseOpsAccess(auth?.user);
  const keys = useOperationKeys();
  const queryClient = useQueryClient();
  const key = countKey(companyId, countId);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => getCount(countId, signal), retry: false });
  const count = query.data;

  const [edits, setEdits] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, CountDecisionDraft>>({});
  const [recount, setRecount] = useState<Set<string>>(() => new Set());
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [failedScans, setFailedScans] = useState<FailedScan[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const scans = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    // Al cambiar de estado (cerrar, recontar, aplicar) se descartan los borradores.
    setEdits({});
    setRecount(new Set());
    setDrafts({});
  }, [count?.status]);

  const hideSystem = count ? countHidesSystem(count) : true;
  const status = count?.status;
  const lines = useMemo(() => count?.lines ?? [], [count?.lines]);
  const needing = useMemo(() => (status ? lines.filter((line) => countLineNeedsDecision(line, status)) : []), [lines, status]);

  const merge = (result: CountEntriesResult) => {
    queryClient.setQueryData<StockCount>(key, (current) => (current ? mergeCountEntries(current, result.applied) : current));
  };

  const sendScan = async (code: string, scanKey: string): Promise<boolean> => {
    try {
      const result = await addCountEntries(countId, { mode: "add", entries: [{ code, quantity: 1 }], operationId: scanKey });
      merge(result);
      const missing = result.unresolved[0];
      if (missing) {
        setScanInfo(null);
        setScanError(`El código ${code} ${UNRESOLVED_REASON_LABEL[missing.reason] ?? "no se pudo leer"}.`);
        scanFeedback("error");
        return true;
      }
      const applied = result.applied[0];
      const line = applied ? lines.find((candidate) => candidate.id === applied.lineId) : undefined;
      setScanError(null);
      setScanInfo(result.duplicate ? `Ese escaneo ya estaba registrado.` : `+1: ${line ? lineLabel(line) : code} (contado ${applied?.counted ?? "—"})`);
      scanFeedback("ok");
      return true;
    } catch (error) {
      setScanInfo(null);
      setScanError(`No se registró el escaneo ${code}. ${opsErrorMessage(error, "Inténtalo de nuevo.")}`);
      scanFeedback("error");
      return false;
    }
  };

  const scan = (code: string) => {
    const scanKey = newOperationId();
    scans.current = scans.current.then(async () => {
      const ok = await sendScan(code, scanKey);
      if (!ok) setFailedScans((current) => [...current, { code, key: scanKey }]);
    });
  };

  const retryFailed = () => {
    const pending = failedScans;
    setFailedScans([]);
    scans.current = scans.current.then(async () => {
      for (const failed of pending) {
        // Misma clave que el primer intento: si el servidor ya lo había registrado, no lo suma dos veces.
        const ok = await sendScan(failed.code, failed.key);
        if (!ok) setFailedScans((current) => [...current, failed]);
      }
    });
  };

  const setCounted = useMutation({
    mutationFn: ({ line, quantity }: { line: CountLine; quantity: number }) =>
      addCountEntries(countId, { mode: "set", entries: [{ variantId: line.variantId, quantity }], operationId: keys.get(`set:${line.id}:${quantity}`) }),
    onSuccess: (result, { line, quantity }) => {
      keys.release(`set:${line.id}:${quantity}`);
      merge(result);
      setEdits((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
    },
    onError: (error) => setActionError(opsErrorMessage(error, "No se pudo guardar lo contado. Inténtalo de nuevo.")),
  });

  const commitEdit = (line: CountLine) => {
    const raw = edits[line.id];
    if (raw === undefined) return;
    const quantity = parseQuantity(raw, 0, 100_000);
    if (quantity === null) {
      setActionError(`Revisa lo contado de ${lineLabel(line)}: entero entre 0 y 100.000.`);
      return;
    }
    if (quantity === line.counted) {
      setEdits((current) => {
        const next = { ...current };
        delete next[line.id];
        return next;
      });
      return;
    }
    setActionError(null);
    setCounted.mutate({ line, quantity });
  };

  const after = (updated: StockCount | undefined, message: string) => {
    if (updated) queryClient.setQueryData(key, updated);
    void queryClient.invalidateQueries({ queryKey: key });
    toast.success(message);
    setActionError(null);
    onChanged();
  };

  const close = useMutation({
    mutationFn: () => closeCount(countId),
    onSuccess: (updated) => after(updated?.lines ? updated : undefined, `${count?.number ?? "Conteo"} enviado a validación`),
    onError: (error) => setActionError(opsErrorMessage(error, "No se pudo cerrar el conteo.")),
  });

  const decisionsPayload = () =>
    needing
      .map((line) => ({ line, draft: drafts[line.id] ?? emptyDraft(line) }))
      .filter(({ draft }) => draft.decision)
      .map(({ line, draft }) => ({
        lineId: line.id,
        decision: draft.decision as CountDecision,
        ...(draft.responsible.trim() ? { responsible: draft.responsible.trim() } : {}),
        ...(draft.dueDate ? { dueDate: draft.dueDate } : {}),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      }));

  const decisionProblem = (() => {
    for (const line of needing) {
      const problem = countDecisionProblem(drafts[line.id] ?? emptyDraft(line));
      if (problem) return `${lineLabel(line)}: ${problem}`;
    }
    return null;
  })();

  const saveDecisions = useMutation({
    mutationFn: () => setCountDecisions(countId, decisionsPayload()),
    onSuccess: (updated) => after(updated?.lines ? updated : undefined, "Decisiones guardadas"),
    onError: (error) => setActionError(opsErrorMessage(error, "No se pudieron guardar las decisiones.")),
  });

  const apply = useMutation({
    mutationFn: async () => {
      const payload = decisionsPayload();
      if (payload.length > 0) await setCountDecisions(countId, payload);
      return applyCount(countId, { operationId: keys.get(`apply:${countId}`) });
    },
    onSuccess: (result) => {
      keys.release(`apply:${countId}`);
      after(result.count?.lines ? result.count : undefined, result.duplicate ? "Ese conteo ya estaba aplicado." : `${count?.number ?? "Conteo"} aplicado`);
      void queryClient.invalidateQueries({ queryKey: ["business-inventory-items"] });
      void invalidateInventoryAlerts(queryClient);
    },
    onError: (error) => setActionError(opsErrorMessage(error, "No se pudo aplicar el conteo.")),
  });

  const askRecount = useMutation({
    mutationFn: () => recountLines(countId, [...recount]),
    onSuccess: (updated) => after(updated?.lines ? updated : undefined, "Reconteo pedido: el conteo vuelve a estar en curso"),
    onError: (error) => setActionError(opsErrorMessage(error, "No se pudo pedir el reconteo.")),
  });

  if (query.isPending) return <p className="text-sm text-muted-foreground">Cargando el conteo…</p>;
  if (query.isError || !count) return <ErrorBox>{opsErrorMessage(query.error, "No se pudo cargar el conteo.")}</ErrorBox>;

  const progress = countProgress(count);
  const busy = close.isPending || saveDecisions.isPending || apply.isPending || askRecount.isPending;
  const inProgress = count.status === "en_curso";
  const validating = count.status === "por_validar";
  const showDifference = !hideSystem && !inProgress;

  return (
    <section className="space-y-4 rounded-md border p-4" aria-label={`Conteo ${count.number}`}>
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {count.number} · {warehouseName}
            <StatusPill label={COUNT_STATUS_LABEL[count.status] ?? count.status} className={COUNT_STATUS_CLASS[count.status] ?? ""} />
            {count.blind ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                <EyeOff className="h-3 w-3" aria-hidden="true" />
                Ciego
              </span>
            ) : null}
          </h3>
          <p className="text-xs text-muted-foreground">
            {COUNT_SCOPE_LABEL[count.scope] ?? count.scope} · iniciado {formatDateTime(count.createdAt)} por {whoDid(count.userName, count.userEmail)} ·{" "}
            {progress.counted} de {progress.total} SKU contados
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inProgress && access.operate ? (
            <Button type="button" disabled={busy} onClick={() => close.mutate()}>
              Cerrar y enviar a validación
            </Button>
          ) : null}
          {validating && access.manage ? (
            <>
              {recount.size > 0 ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => askRecount.mutate()}>
                  Recontar {recount.size} línea(s)
                </Button>
              ) : null}
              {needing.length > 0 ? (
                <Button type="button" variant="outline" disabled={busy || decisionsPayload().length === 0} onClick={() => saveDecisions.mutate()}>
                  Guardar decisiones
                </Button>
              ) : null}
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (decisionProblem) {
                    setActionError(decisionProblem);
                    return;
                  }
                  apply.mutate();
                }}
              >
                {apply.isPending ? "Aplicando…" : "Validar y aplicar"}
              </Button>
            </>
          ) : null}
          {(inProgress || validating) && access.manage ? (
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(true)}>
              Anular
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon" aria-label="Cerrar el detalle" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      {inProgress && access.operate ? (
        <div className="space-y-2">
          <ScanInput id="count-scan" label="Escanear (cada escaneo suma 1 al contado)" placeholder="Escanea con el lector o escribe el código y pulsa Enter" onCode={scan} />
          {scanError ? (
            <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-2 text-sm text-destructive">
              {scanError}
            </p>
          ) : null}
          {scanInfo ? (
            <p role="status" className="text-sm text-teal-700 dark:text-teal-300">
              {scanInfo}
            </p>
          ) : null}
          {failedScans.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              {failedScans.length} escaneo(s) sin confirmar.
              <Button type="button" size="sm" variant="outline" onClick={retryFailed}>
                Reintentar
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {hideSystem && inProgress ? (
        <p className="text-xs text-muted-foreground">Conteo ciego: el stock del sistema y las diferencias se ven al cerrar el conteo.</p>
      ) : null}

      <ErrorBox>{actionError}</ErrorBox>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              {validating && access.manage ? <th className="px-3 py-2" aria-label="Recontar" /> : null}
              <th className="px-3 py-2 text-left font-medium">Producto</th>
              {hideSystem ? null : (
                <>
                  <th className="px-3 py-2 text-right font-medium">Foto al iniciar</th>
                  <th className="px-3 py-2 text-right font-medium">Mov. durante</th>
                  <th className="px-3 py-2 text-right font-medium">Esperado</th>
                </>
              )}
              <th className="px-3 py-2 text-right font-medium">Contado</th>
              {showDifference ? (
                <>
                  <th className="px-3 py-2 text-right font-medium">Diferencia</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-left font-medium">Decisión</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const needs = status ? countLineNeedsDecision(line, status) : false;
              const draft = drafts[line.id] ?? emptyDraft(line);
              const edit = edits[line.id];
              return (
                <tr key={line.id} className="border-t align-top" data-testid={`count-line-${line.id}`}>
                  {validating && access.manage ? (
                    <td className="px-3 py-2">
                      {needs ? (
                        <Checkbox
                          aria-label={`Recontar ${lineLabel(line)}`}
                          checked={recount.has(line.id)}
                          onCheckedChange={(checked) =>
                            setRecount((current) => {
                              const next = new Set(current);
                              if (checked === true) next.add(line.id);
                              else next.delete(line.id);
                              return next;
                            })
                          }
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-3 py-2">
                    <p>{lineLabel(line)}</p>
                    <p className="font-mono text-xs text-muted-foreground">{line.sku}</p>
                  </td>
                  {hideSystem ? null : (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">{line.systemInitial ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {typeof line.movementsDuring === "number" ? (line.movementsDuring > 0 ? `+${line.movementsDuring}` : line.movementsDuring) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{line.expected ?? "—"}</td>
                    </>
                  )}
                  <td className="px-3 py-2 text-right">
                    {inProgress && access.operate ? (
                      <Input
                        aria-label={`Contado: ${lineLabel(line)}`}
                        className="ml-auto w-24 text-right"
                        inputMode="numeric"
                        placeholder="—"
                        value={edit ?? (line.counted === null || line.counted === undefined ? "" : String(line.counted))}
                        onChange={(event) => setEdits((current) => ({ ...current, [line.id]: event.target.value }))}
                        onBlur={() => commitEdit(line)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            commitEdit(line);
                          }
                        }}
                      />
                    ) : (
                      <span className="font-semibold tabular-nums">{line.counted ?? "—"}</span>
                    )}
                    {line.recountRequested && line.firstCounted !== null && line.firstCounted !== undefined ? (
                      <p className="text-xs text-muted-foreground">1er conteo: {line.firstCounted}</p>
                    ) : null}
                  </td>
                  {showDifference ? (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.difference === null || line.difference === undefined ? (
                          <span className="text-muted-foreground">Sin contar</span>
                        ) : line.difference === 0 ? (
                          <span className="text-teal-700 dark:text-teal-300">0</span>
                        ) : (
                          <span className={line.difference > 0 ? "text-teal-700 dark:text-teal-300" : "text-destructive"}>
                            {line.difference > 0 ? `+${line.difference}` : line.difference}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{line.difference ? <Money value={"differenceValue" in line ? line.differenceValue : undefined} /> : "—"}</td>
                      <td className="px-3 py-2">
                        {needs && validating && access.manage ? (
                          <div className="space-y-1">
                            <select
                              aria-label={`Decisión: ${lineLabel(line)}`}
                              className={`${SELECT_CLASS} max-w-72`}
                              value={draft.decision}
                              disabled={busy}
                              onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, decision: event.target.value as CountDecision | "" } }))}
                            >
                              <option value="">Elegir…</option>
                              {countDecisionOptions(line.difference ?? 0, courierWarehouse).map((decision) => (
                                <option key={decision} value={decision}>
                                  {COUNT_DECISION_LABEL[decision]}
                                </option>
                              ))}
                            </select>
                            {draft.decision === "pendiente" ? (
                              <div className="flex flex-wrap gap-1">
                                <Input
                                  aria-label={`Responsable: ${lineLabel(line)}`}
                                  placeholder="Responsable"
                                  className="w-36"
                                  value={draft.responsible}
                                  onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, responsible: event.target.value } }))}
                                />
                                <Input
                                  aria-label={`Fecha límite: ${lineLabel(line)}`}
                                  type="date"
                                  className="w-40"
                                  value={draft.dueDate}
                                  onChange={(event) => setDrafts((current) => ({ ...current, [line.id]: { ...draft, dueDate: event.target.value } }))}
                                />
                              </div>
                            ) : null}
                          </div>
                        ) : line.decision === "auto" ? (
                          <span className="text-xs text-teal-700 dark:text-teal-300">Dentro de la tolerancia · se aplica</span>
                        ) : line.decision ? (
                          <span className="text-xs">{COUNT_DECISION_LABEL[line.decision] ?? line.decision}</span>
                        ) : line.difference === 0 ? (
                          <span className="text-xs text-teal-700 dark:text-teal-300">Cuadra</span>
                        ) : needs ? (
                          <span className="text-xs text-amber-700 dark:text-amber-300">Espera decisión</span>
                        ) : null}
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cancelOpen ? (
        <ReasonDialog
          title={`Anular ${count.number}`}
          description="No movió stock: lo contado queda registrado y el conteo, anulado."
          confirmLabel="Anular conteo"
          destructive
          errorFallback="No se pudo anular el conteo."
          onClose={() => setCancelOpen(false)}
          onConfirm={async (reason) => {
            const updated = await cancelCount(countId, reason ? { reason } : {});
            setCancelOpen(false);
            after(updated?.lines ? updated : undefined, `${count.number} anulado`);
          }}
        />
      ) : null}
    </section>
  );
}
