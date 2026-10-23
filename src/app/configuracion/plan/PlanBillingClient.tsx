"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { formatLimaDate } from "@/lib/flowMigration";
import {
  addAddOn,
  billingErrorMessage,
  cancelSubscription,
  changePlan,
  fetchPlanBilling,
  previewPlanChange,
  removeAddOn,
  undoPlanChange,
} from "@/services/planBillingService";
import type {
  BillingAvailableAddOn,
  BillingPlan,
  PlanBilling,
  PlanChangePreview,
} from "@/types/planBilling";

export const money = (amount: number | null | undefined) =>
  amount == null ? "—" : `S/ ${amount.toFixed(2)}`;

const day = (iso: string | null | undefined) => (iso ? formatLimaDate(iso.slice(0, 10)) : "—");

type Dialogs =
  | { kind: "none" }
  | { kind: "plan"; selected: BillingPlan | null; preview: PlanChangePreview | null; loading: boolean }
  | { kind: "add"; addOn: BillingAvailableAddOn }
  | { kind: "remove"; addOnId: string; name: string; amount: number }
  | { kind: "cancel" };

/** "Plan y facturación" (FEAT-25 E2.2): plan, add-ons, próximo cobro y operaciones sobre Flow. */
export default function PlanBillingClient() {
  const { auth } = useAuth();
  const [billing, setBilling] = useState<PlanBilling | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });
  const isAdmin = auth?.user?.role === "ADMINISTRADOR";

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setBilling(await fetchPlanBilling());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!auth) return null;
  if (!isAdmin) {
    return (
      <main className="flex-1 p-8">
        <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />
        <p className="p-6 text-sm text-gray-600">Solo el administrador de la cuenta puede ver el plan.</p>
      </main>
    );
  }

  const run = async (op: () => Promise<PlanBilling>, success: string) => {
    setBusy(true);
    try {
      setBilling(await op());
      setDialog({ kind: "none" });
      toast.success(success);
    } catch (err) {
      toast.error(billingErrorMessage(err));
      // Flow pudo haber aplicado el cambio aunque la respuesta falló: se vuelve a leer.
      void load();
    } finally {
      setBusy(false);
    }
  };

  const openPlanDialog = () => setDialog({ kind: "plan", selected: null, preview: null, loading: false });

  const selectPlan = async (plan: BillingPlan) => {
    if (!billing) return;
    setDialog({ kind: "plan", selected: plan, preview: null, loading: billing.mode === "FLOW_ACTIVE" });
    if (billing.mode !== "FLOW_ACTIVE") return;
    try {
      const preview = await previewPlanChange(plan.id);
      setDialog({ kind: "plan", selected: plan, preview, loading: false });
    } catch (err) {
      toast.error(billingErrorMessage(err));
      setDialog({ kind: "plan", selected: null, preview: null, loading: false });
    }
  };

  if (loadError) {
    return (
      <main className="flex-1 p-8">
        <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />
        <div className="space-y-3 p-6">
          <p className="text-sm text-gray-600">No pudimos cargar tu plan.</p>
          <Button variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      </main>
    );
  }
  if (!billing) {
    return (
      <main className="flex-1 p-8">
        <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />
        <p className="p-6 text-sm text-gray-500">Cargando...</p>
      </main>
    );
  }

  const operable = billing.mode === "FLOW_ACTIVE" || billing.mode === "FLOW_SCHEDULED";
  const nextTotal = billing.nextChargeTotal ?? 0;
  const chargeDate = billing.mode === "FLOW_SCHEDULED" ? billing.firstChargeDate : billing.nextChargeDate;

  return (
    <main className="flex-1 space-y-6 p-8">
      <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />

      <Card>
        <CardHeader>
          <CardTitle>{billing.plan ? `Plan ${billing.plan.name}` : "Sin plan vigente"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {billing.plan && (
            <p>
              {money(billing.plan.price)} por {billing.plan.durationInDays >= 365 ? "año" : "mes"}
            </p>
          )}
          {billing.mode === "FLOW_ACTIVE" && (
            <>
              <p>
                Próximo cobro: <strong>{day(billing.nextChargeDate)}</strong> · {money(billing.nextChargeTotal)}
              </p>
              <p className="text-gray-600">Pagas con Flow.</p>
            </>
          )}
          {billing.mode === "FLOW_SCHEDULED" && (
            <p>
              Tu primer cobro con Flow es el <strong>{day(billing.firstChargeDate)}</strong> · {money(billing.nextChargeTotal)}.
              Hoy no se cobra nada.
            </p>
          )}
          {billing.mode === "FLOW_CANCELING" && (
            <p>
              Tu suscripción termina el <strong>{day(billing.paidUntil)}</strong>. No se te cobra más.
            </p>
          )}
          {billing.mode === "NO_FLOW" && (
            <p>
              {billing.paidUntil ? `Pagado hasta el ${day(billing.paidUntil)}. ` : ""}
              Todavía no registraste tu tarjeta.
            </p>
          )}
          {billing.mode === "EXEMPT" && <p className="text-gray-600">Tu cuenta no tiene cobros pendientes.</p>}

          {billing.pendingPlan && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p>
                El {day(billing.pendingPlan.startsOn)} pasas a {billing.pendingPlan.name} (
                {money(billing.pendingPlan.price)}). Hasta ese día sigues con {billing.plan?.name}.
              </p>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void run(undoPlanChange, "Cambio de plan deshecho")}
              >
                Deshacer
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {operable && billing.availablePlans.length > 0 && (
              <Button variant="outline" onClick={openPlanDialog} disabled={busy}>
                Cambiar plan
              </Button>
            )}
            {(billing.mode === "NO_FLOW" || billing.mode === "FLOW_CANCELING") &&
              (billing.isOwner ? (
                <Button asChild className="bg-teal-600 hover:bg-teal-700">
                  <Link href="/pasate-a-flow">Pasarme a Flow</Link>
                </Button>
              ) : (
                <p className="text-gray-600">Lo tiene que hacer el dueño de la cuenta.</p>
              ))}
          </div>
        </CardContent>
      </Card>

      {billing.mode !== "NO_FLOW" && billing.mode !== "FLOW_CANCELING" && billing.mode !== "EXEMPT" && (
        <Card>
          <CardHeader>
            <CardTitle>Add-ons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {billing.addOns.length === 0 && <p className="text-gray-600">No tienes add-ons contratados.</p>}
            {billing.addOns.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="text-gray-600">
                    {money(a.amount)}
                    {a.endsOn ? ` · Lo tienes hasta el ${day(a.endsOn)}` : ""}
                  </p>
                </div>
                {a.endsOn ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run(() => addAddOn(a.id), `${a.name} se mantiene`)}
                  >
                    Deshacer
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDialog({ kind: "remove", addOnId: a.id, name: a.name, amount: a.amount })}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            ))}
            {billing.availableAddOns.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">Disponibles</p>
                {billing.availableAddOns.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-gray-600">{money(a.amount)}</p>
                    </div>
                    <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "add", addOn: a })}>
                      Agregar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {billing.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos cobros</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {billing.payments.map((p) => (
                <li key={`${p.date}-${p.amount}-${p.status}`} className="flex justify-between py-2">
                  <span>{day(p.date)}</span>
                  <span>{money(p.amount)}</span>
                  <span className={p.status === "PAID" ? "text-teal-700" : "text-red-600"}>
                    {p.status === "PAID" ? "Pagado" : "Rechazado"}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {billing.mode === "FLOW_ACTIVE" && (
        <div className="flex justify-end">
          <Button variant="destructive" disabled={busy} onClick={() => setDialog({ kind: "cancel" })}>
            Darse de baja
          </Button>
        </div>
      )}

      {/* Cambiar plan */}
      <Dialog open={dialog.kind === "plan"} onOpenChange={(open) => !open && setDialog({ kind: "none" })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar plan</DialogTitle>
            <DialogDescription>Elige el plan al que quieres pasar.</DialogDescription>
          </DialogHeader>
          {dialog.kind === "plan" && (
            <div className="space-y-3">
              {billing.availablePlans.map((p) => (
                <Button
                  key={p.id}
                  variant={dialog.selected?.id === p.id ? "default" : "outline"}
                  className="w-full justify-between"
                  disabled={busy}
                  onClick={() => void selectPlan(p)}
                >
                  <span>{p.name}</span>
                  <span>{money(p.price)}</span>
                </Button>
              ))}
              {dialog.loading && <p className="text-sm text-gray-500">Calculando...</p>}
              {dialog.selected && !dialog.loading && (
                <PlanChangeSummary
                  billing={billing}
                  selected={dialog.selected}
                  preview={dialog.preview}
                />
              )}
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                disabled={busy || dialog.loading || !dialog.selected}
                onClick={() => {
                  const target = dialog.selected;
                  if (target) void run(() => changePlan(target.id), "Plan actualizado");
                }}
              >
                Confirmar cambio
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Agregar add-on */}
      <Dialog open={dialog.kind === "add"} onOpenChange={(open) => !open && setDialog({ kind: "none" })}>
        <DialogContent className="max-w-md">
          {dialog.kind === "add" && (
            <>
              <DialogHeader>
                <DialogTitle>Agregar {dialog.addOn.name}</DialogTitle>
                <DialogDescription>
                  Hoy no se cobra nada: se suma a tu próximo cobro ({day(chargeDate)}), que pasa de {money(nextTotal)}{" "}
                  a {money(nextTotal + dialog.addOn.amount)}.
                </DialogDescription>
              </DialogHeader>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                disabled={busy}
                onClick={() => {
                  const target = dialog.addOn;
                  void run(() => addAddOn(target.id), `${target.name} agregado`);
                }}
              >
                Agregar
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quitar add-on */}
      <Dialog open={dialog.kind === "remove"} onOpenChange={(open) => !open && setDialog({ kind: "none" })}>
        <DialogContent className="max-w-md">
          {dialog.kind === "remove" && (
            <>
              <DialogHeader>
                <DialogTitle>Quitar {dialog.name}</DialogTitle>
                <DialogDescription>
                  {billing.mode === "FLOW_SCHEDULED"
                    ? `Sale de tu primer cobro: pasa de ${money(nextTotal)} a ${money(nextTotal - dialog.amount)}.`
                    : `Lo sigues teniendo hasta el ${day(billing.paidUntil)}. Desde el ${day(billing.nextChargeDate)} tu cobro pasa de ${money(nextTotal)} a ${money(nextTotal - dialog.amount)}. La integración deja de funcionar al terminar ese día.`}
                </DialogDescription>
              </DialogHeader>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  const target = dialog;
                  void run(() => removeAddOn(target.addOnId), `${target.name} quitado`);
                }}
              >
                Quitar add-on
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Darse de baja */}
      <Dialog open={dialog.kind === "cancel"} onOpenChange={(open) => !open && setDialog({ kind: "none" })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar suscripción</DialogTitle>
            <DialogDescription>
              No se te cobra más. Sigues usando Powip hasta el {day(billing.paidUntil)}. Desde el día siguiente la
              cuenta queda suspendida para todo tu equipo hasta que vuelvas a registrar una tarjeta.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setDialog({ kind: "none" })}>
              Mantener suscripción
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={busy}
              onClick={() => void run(cancelSubscription, "Suscripción cancelada")}
            >
              Cancelar suscripción
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlanChangeSummary({
  billing,
  selected,
  preview,
}: {
  billing: PlanBilling;
  selected: BillingPlan;
  preview: PlanChangePreview | null;
}) {
  if (billing.mode === "FLOW_SCHEDULED") {
    return (
      <p className="text-sm text-gray-700">
        Se aplica a tu primer cobro del {day(billing.firstChargeDate)}. Hoy no se cobra nada.
      </p>
    );
  }
  if (!preview) return null;
  if (preview.direction === "UP") {
    return (
      <p className="text-sm text-gray-700">
        Hoy se cobran <strong>{money(preview.balance)}</strong> por los días que quedan. Desde el{" "}
        {day(billing.nextChargeDate)}: {money(preview.nextChargeTotal)} al mes.
      </p>
    );
  }
  return (
    <p className="text-sm text-gray-700">
      Hoy no se cobra ni se devuelve nada. El {day(preview.startsOn ?? billing.nextChargeDate)} pasas a{" "}
      {selected.name} ({money(selected.price)}). Hasta ese día sigues con {billing.plan?.name}.
    </p>
  );
}
