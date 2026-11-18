"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { hasAdminAccess } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { inventoryRulesChanged, parseReleaseDays, releaseDaysToText } from "@/lib/stockRules";
import { DEFAULT_COVERAGE_DAYS, parseDays } from "@/lib/suggestedPurchase";
import { getInventoryRules, saveInventoryRules, type InventoryRules } from "@/services/warehousesService";

// FEAT-24 H2-F — Configuración › Tiendas y almacenes › «Reglas de inventario»:
// liberar reservas viejas y exigir el picking con escaneo. Solo un administrador edita.
// FEAT-24 H3 — suma las dos reglas de compras: si la empresa está afecta al IGV
// y si se puede comprar directo a un almacén courier.
// FEAT-24 H13 — suma los días de venta que cubre el pedido sugerido.

interface Form {
  releaseDays: string;
  pickingRequired: boolean;
  igvAffected: boolean;
  allowPurchaseToCourier: boolean;
  /** FEAT-24 H13: días de cobertura objetivo, como se tipean. */
  coverageDays: string;
}

export default function InventoryRulesSection() {
  const { auth } = useAuth();
  const queryClient = useQueryClient();
  const companyId = auth?.company?.id;
  const enabled = Boolean(companyId && auth?.accessToken);
  const isAdmin = hasAdminAccess(auth?.user?.role);

  const rulesKey = useMemo(() => ["inventory-rules", companyId], [companyId]);
  const rulesQuery = useQuery({ queryKey: rulesKey, queryFn: () => getInventoryRules(), enabled, retry: false, staleTime: 0 });
  const saved: InventoryRules | undefined = rulesQuery.data;
  const savedCoverageDays = saved?.defaultCoverageDays ?? DEFAULT_COVERAGE_DAYS;

  // `null` = sin cambios en pantalla: se muestra lo guardado.
  const [edited, setEdited] = useState<Form | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const form: Form = edited ?? {
    releaseDays: releaseDaysToText(saved?.releaseAfterDays ?? null),
    pickingRequired: saved?.pickingRequired ?? false,
    igvAffected: saved?.igvAffected ?? true,
    allowPurchaseToCourier: saved?.allowPurchaseToCourier ?? false,
    coverageDays: String(savedCoverageDays),
  };
  const parsed = parseReleaseDays(form.releaseDays);
  const coverageDays = parseDays(form.coverageDays);
  const dirty =
    saved !== undefined &&
    edited !== null &&
    (inventoryRulesChanged(edited, saved) ||
      edited.igvAffected !== saved.igvAffected ||
      edited.allowPurchaseToCourier !== saved.allowPurchaseToCourier ||
      coverageDays !== savedCoverageDays);

  const save = useMutation({
    mutationFn: (rules: InventoryRules) => saveInventoryRules(rules),
    onSuccess: (rules) => {
      queryClient.setQueryData(rulesKey, rules);
      setEdited(null);
      setServerError(null);
      toast.success("Reglas de inventario guardadas");
    },
    onError: (error) => {
      const message = warehouseErrorMessage(error, "No se pudieron guardar las reglas. Inténtalo de nuevo.");
      setServerError(message);
      toast.error(message);
    },
  });

  if (!companyId) return null;

  const change = (next: Partial<Form>) => {
    setServerError(null);
    setEdited({ ...form, ...next });
  };
  const disabled = !isAdmin || save.isPending;

  return (
    <section aria-labelledby="inventory-rules-title" className="space-y-4 rounded-lg border bg-card p-6">
      <div>
        <h3 id="inventory-rules-title" className="text-lg font-medium">
          Reglas de inventario
        </h3>
        <p className="text-sm text-muted-foreground">Cómo se cuidan las reservas y el despacho de los pedidos, y cómo se registran las compras.</p>
        {!isAdmin ? <p className="mt-1 text-xs text-muted-foreground">Solo un administrador puede cambiar estas reglas.</p> : null}
      </div>

      {rulesQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Cargando reglas…</p>
      ) : rulesQuery.isError ? (
        <div role="alert" className="space-y-2 rounded-md border border-dashed p-4 text-sm">
          <p className="font-medium">No se pudieron cargar las reglas de inventario</p>
          <p className="text-muted-foreground">{warehouseErrorMessage(rulesQuery.error, "Inténtalo de nuevo en unos minutos.")}</p>
          <Button variant="outline" size="sm" onClick={() => void rulesQuery.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="release-after-days">Liberar reservas sin despachar después de</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="release-after-days"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-24"
                  placeholder="Nunca"
                  value={form.releaseDays}
                  disabled={disabled}
                  aria-invalid={!parsed.ok || undefined}
                  aria-describedby="release-after-days-help"
                  onChange={(e) => change({ releaseDays: e.target.value })}
                />
                <span className="text-sm">días</span>
              </div>
              <p id="release-after-days-help" className="text-xs text-muted-foreground">
                Vacío = nunca (de 1 a 365 días). El pedido no se anula: pasa a «Sin reserva» para que Operaciones decida.
              </p>
              {!parsed.ok ? <p className="text-xs text-destructive">{parsed.error}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="picking-required"
                  checked={form.pickingRequired}
                  disabled={disabled}
                  aria-describedby="picking-required-note"
                  onCheckedChange={(pickingRequired) => change({ pickingRequired })}
                />
                <Label htmlFor="picking-required">Exigir picking con escaneo</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Prendido, ningún pedido se despacha sin escanear cada producto. Apagado, se puede confirmar una línea sin
                escanear (queda registrado).
              </p>
              <div
                id="picking-required-note"
                className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Hoy muy pocos productos tienen código impreso. Conviene prenderlo recién cuando tengas las etiquetas
                  pegadas: si no, los despachos se frenan.
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-6 border-t pt-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="igv-affected"
                  checked={form.igvAffected}
                  disabled={disabled}
                  onCheckedChange={(igvAffected) => change({ igvAffected })}
                />
                <Label htmlFor="igv-affected">La empresa está afecta al IGV</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Prendido, las órdenes de compra separan el IGV (18 %) y el costo se guarda sin IGV. Apagado (RUS o sin
                crédito fiscal), la compra no separa IGV y el costo es lo que pagas.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="allow-purchase-to-courier"
                  checked={form.allowPurchaseToCourier}
                  disabled={disabled}
                  onCheckedChange={(allowPurchaseToCourier) => change({ allowPurchaseToCourier })}
                />
                <Label htmlFor="allow-purchase-to-courier">Permitir compras directas a un almacén courier</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Prendido, una orden de compra puede llegar directo al almacén de un courier. Apagado, solo a almacenes
                propios o tiendas.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default-coverage-days">Días de cobertura objetivo</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="default-coverage-days"
                  inputMode="numeric"
                  autoComplete="off"
                  className="w-24"
                  value={form.coverageDays}
                  disabled={disabled}
                  aria-invalid={coverageDays === null || undefined}
                  aria-describedby="default-coverage-days-help"
                  onChange={(e) => change({ coverageDays: e.target.value })}
                />
                <span className="text-sm">días de venta</span>
              </div>
              <p id="default-coverage-days-help" className="text-xs text-muted-foreground">
                Cuántos días de venta cubre el pedido sugerido (de 1 a 365). En Stock, la cobertura menor a estos días se marca en
                ámbar.
              </p>
              {coverageDays === null ? <p className="text-xs text-destructive">Escribe un número entero de 1 a 365.</p> : null}
            </div>
          </div>

          {serverError ? (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
              {serverError}
            </div>
          ) : null}

          {isAdmin ? (
            <div className="flex flex-wrap justify-end gap-2">
              {dirty ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => {
                    setServerError(null);
                    setEdited(null);
                  }}
                >
                  Descartar cambios
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={!dirty || !parsed.ok || coverageDays === null || save.isPending}
                onClick={() => {
                  if (!parsed.ok || coverageDays === null) return;
                  save.mutate({
                    releaseAfterDays: parsed.value,
                    pickingRequired: form.pickingRequired,
                    igvAffected: form.igvAffected,
                    allowPurchaseToCourier: form.allowPurchaseToCourier,
                    // Solo si cambió: sin el campo, el servidor lo deja como estaba.
                    ...(coverageDays !== savedCoverageDays ? { defaultCoverageDays: coverageDays } : {}),
                  });
                }}
              >
                {save.isPending ? "Guardando…" : "Guardar reglas de inventario"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
