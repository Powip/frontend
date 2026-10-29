"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, CreditCard, Link2, Lock } from "lucide-react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { formatLimaDate } from "@/lib/flowMigration";
import {
  ADDON_CARDS,
  type AddOnCard,
  CORE_MODULES,
  FREE_TOOLS,
  type FeatureItem,
  FUTURE_ADDONS,
  planOrderCap,
} from "@/lib/planCommercial";
import { fetchAddOns, fetchPlans } from "@/services/onboardingService";
import type { BackendAddOn, BackendPlan } from "@/types/onboarding";
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
  | { kind: "cancel" }
  | { kind: "info"; card: AddOnCard };

/** "Plan y facturación" (FEAT-25 E2.2): plan, add-ons, próximo cobro y operaciones sobre Flow. */
export default function PlanBillingClient() {
  const { auth } = useAuth();
  const [billing, setBilling] = useState<PlanBilling | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialogs>({ kind: "none" });
  const [catalog, setCatalog] = useState<{ plans: BackendPlan[]; addOns: BackendAddOn[] } | null>(null);
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

  // Catálogo público: para mostrar planes y add-ons aunque la cuenta todavía no esté en Flow.
  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    Promise.all([fetchPlans().catch(() => []), fetchAddOns().catch(() => [])]).then(([plans, addOns]) => {
      if (active) setCatalog({ plans, addOns });
    });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  if (!auth) return null;
  if (!isAdmin) {
    return (
      <main className="flex-1 p-8">
        <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />
        <p className="p-6 text-sm text-muted-foreground">Solo el administrador de la cuenta puede ver el plan.</p>
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

  const openPlanDialog = async (plan?: BillingPlan) => {
    setDialog({ kind: "plan", selected: null, preview: null, loading: false });
    if (plan) await selectPlan(plan);
  };

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
          <p className="text-sm text-muted-foreground">No pudimos cargar tu plan.</p>
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
        <p className="p-6 text-sm text-muted-foreground">Cargando...</p>
      </main>
    );
  }

  const operable = billing.mode === "FLOW_ACTIVE" || billing.mode === "FLOW_SCHEDULED";
  const nextTotal = billing.nextChargeTotal ?? 0;
  const chargeDate = billing.mode === "FLOW_SCHEDULED" ? billing.firstChargeDate : billing.nextChargeDate;
  const needsFlow = billing.mode === "NO_FLOW" || billing.mode === "FLOW_CANCELING";
  const keptAddOns = billing.addOns.filter((a) => !a.endsOn);
  const monthlyTotal = billing.nextChargeTotal ?? (billing.plan?.price ?? 0) + keptAddOns.reduce((n, a) => n + a.amount, 0);

  // Planes que se ofrecen: los de Flow si se puede operar; si no, el catálogo del mismo ciclo (solo para informar).
  const duration = billing.plan?.durationInDays ?? 30;
  const plansToShow: BillingPlan[] = operable
    ? [...(billing.plan ? [billing.plan] : []), ...billing.availablePlans]
    : (catalog?.plans ?? [])
        .filter((p) => p.durationInDays === duration && planOrderCap(p.name) !== null)
        .map((p) => ({ id: p.id, name: p.name, price: p.price, durationInDays: p.durationInDays }));
  plansToShow.sort((a, b) => a.price - b.price);
  const planCap = billing.plan ? planOrderCap(billing.plan.name) : null;

  const addOnStatus = (card: AddOnCard) => {
    const active = card.code ? billing.addOns.find((a) => a.code === card.code) : undefined;
    const fromCatalog = card.code && !operable ? catalog?.addOns.find((a) => a.code === card.code && a.active !== false) : undefined;
    const available: BillingAvailableAddOn | undefined = card.code
      ? (billing.availableAddOns.find((a) => a.code === card.code) ??
        (fromCatalog
          ? { id: fromCatalog.id, code: fromCatalog.code, name: fromCatalog.name, description: fromCatalog.description ?? null, amount: fromCatalog.amount }
          : undefined))
      : undefined;
    const price = active?.amount ?? available?.amount ?? card.price;
    const status: "active" | "available" | "soon" = active ? "active" : available ? "available" : "soon";
    return { active, available, price, status };
  };

  return (
    <main className="flex-1 space-y-8 p-8">
      <HeaderConfig title="Plan y facturación" description="Tu plan, add-ons y cobros" />

      <div>
        <h1 className="text-2xl font-semibold text-foreground">Mi plan y add-ons</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Activa lo que tu negocio necesita. Los add-ons se suman a tu próximo cobro: al agregarlos hoy no se cobra
          nada.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tu plan</p>
                <CardTitle className="mt-1 text-2xl">{billing.plan ? `Plan ${billing.plan.name}` : "Sin plan vigente"}</CardTitle>
              </div>
              {billing.plan && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                  {billing.mode === "FLOW_CANCELING" ? "Termina pronto" : "Activo"}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {billing.plan && (
              <p className="text-base">
                <strong>{money(billing.plan.price)}</strong>{" "}
                <span className="text-muted-foreground">/ {billing.plan.durationInDays >= 365 ? "año" : "mes"}</span>
              </p>
            )}
            {planCap && (
              <p className="text-muted-foreground">
                Hasta {planCap.toLocaleString("en-US")} pedidos al mes. Todos los planes traen los mismos módulos: solo
                cambia cuántos pedidos puedes registrar.
              </p>
            )}
            {billing.mode === "FLOW_ACTIVE" && (
              <p>
                Próximo cobro: <strong>{day(billing.nextChargeDate)}</strong> · {money(billing.nextChargeTotal)}
              </p>
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
              <p>{billing.paidUntil ? `Pagado hasta el ${day(billing.paidUntil)}.` : "Sin pago vigente."}</p>
            )}
            {billing.mode === "EXEMPT" && <p className="text-muted-foreground">Tu cuenta no tiene cobros pendientes.</p>}

            {billing.pendingPlan && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10 p-3">
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

            {plansToShow.length > 0 && billing.mode !== "EXEMPT" && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cambiar plan</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {plansToShow.map((p) => {
                    const current = p.id === billing.plan?.id;
                    const cap = planOrderCap(p.name);
                    const body = (
                      <>
                        <span className="block font-semibold">
                          {p.name} · {money(p.price).replace(".00", "")}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {cap ? `hasta ${cap.toLocaleString("en-US")} pedidos` : "pedidos a medida"}
                        </span>
                        {current && <span className="mt-1 block text-xs font-semibold text-teal-700 dark:text-teal-300">Plan actual</span>}
                      </>
                    );
                    const cls = `rounded-xl border p-3 text-left text-sm ${current ? "border-teal-600 dark:border-teal-400 bg-teal-50 dark:bg-teal-500/15" : "bg-card hover:border-teal-600 dark:hover:border-teal-400"}`;
                    if (operable) {
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={cls}
                          disabled={busy || current}
                          aria-pressed={current}
                          onClick={() => void openPlanDialog(p)}
                        >
                          {body}
                        </button>
                      );
                    }
                    return billing.isOwner ? (
                      <Link key={p.id} href="/pasate-a-flow" className={cls}>
                        {body}
                      </Link>
                    ) : (
                      <div key={p.id} className={cls}>
                        {body}
                      </div>
                    );
                  })}
                </div>
                {!operable && (
                  <p className="text-xs text-muted-foreground">
                    Para cambiar de plan primero tienes que pasarte a Flow; ahí eliges el plan y tus add-ons.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-muted-foreground">
              <CreditCard className="h-4 w-4" aria-hidden />
              {operable || billing.mode === "EXEMPT" ? (
                <span>{billing.mode === "EXEMPT" ? "Sin cobros" : "Pagas con Flow"}</span>
              ) : (
                <>
                  <span className="text-red-600 dark:text-red-400">Sin tarjeta registrada</span>
                  {billing.isOwner && (
                    <Link href="/pasate-a-flow" className="font-medium text-teal-700 dark:text-teal-300 underline">
                      Registrar tarjeta
                    </Link>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {operable && billing.availablePlans.length > 0 && (
                <Button variant="outline" onClick={() => void openPlanDialog()} disabled={busy}>
                  Cambiar plan
                </Button>
              )}
              {needsFlow &&
                (billing.isOwner ? (
                  <Button asChild className="bg-teal-600 hover:bg-teal-700">
                    <Link href="/pasate-a-flow">Pasarme a Flow</Link>
                  </Button>
                ) : (
                  <p className="text-muted-foreground">Lo tiene que hacer el dueño de la cuenta.</p>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tu mensualidad{chargeDate ? ` desde el ${day(chargeDate)}` : ""}
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {billing.plan ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Plan {billing.plan.name}</span>
                  <span>{money(billing.pendingPlan?.price ?? billing.plan.price)}</span>
                </div>
                {keptAddOns.map((a) => (
                  <div key={a.id} className="flex justify-between">
                    <span>{a.name}</span>
                    <span>{money(a.amount)}</span>
                  </div>
                ))}
                {keptAddOns.length === 0 && <p className="text-muted-foreground">Sin add-ons activos</p>}
                <div className="flex justify-between border-t pt-2 text-base font-semibold">
                  <span>Total al {billing.plan.durationInDays >= 365 ? "año" : "mes"}</span>
                  <span>{money(monthlyTotal)}</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">Todavía no tienes un plan vigente.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Los cobros en línea por tu POWIP Link tienen la tarifa de pasarela de 3.5% por pago y no van en esta
              cuenta.
            </p>

            {billing.payments.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Historial de pagos</p>
                <ul className="divide-y text-sm">
                  {billing.payments.map((p) => (
                    <li key={`${p.date}-${p.amount}-${p.status}`} className="flex justify-between py-2">
                      <span>{day(p.date)}</span>
                      <span>{money(p.amount)}</span>
                      <span className={p.status === "PAID" ? "text-teal-700 dark:text-teal-400" : "text-red-600 dark:text-red-400"}>
                        {p.status === "PAID" ? "Pagado" : "Rechazado"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Add-ons</h2>
          <p className="text-sm text-muted-foreground">
            Se activan sobre cualquier plan y aparecen en el menú donde se usan. Puedes quitarlos cuando quieras.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {ADDON_CARDS.map((card) => {
            const { active, available, price, status } = addOnStatus(card);
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${status === "active" ? "border-teal-600 dark:border-teal-400" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{card.name}</h3>
                    <p className="text-xs text-muted-foreground">{card.where}</p>
                  </div>
                  <p className="text-right font-semibold">
                    {price == null ? "—" : money(price).replace(".00", "")}
                    <span className="block text-xs font-normal text-muted-foreground">/ mes</span>
                  </p>
                </div>
                <p className="flex-1 text-sm text-foreground/80">
                  {available?.description && !card.bullets.length ? available.description : card.tag}
                  {card.note && <span className="mt-1 block text-xs text-foreground">{card.note}</span>}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {status === "active" && active && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                        <Check className="h-3 w-3" aria-hidden />
                        {active.endsOn ? `Hasta el ${day(active.endsOn)}` : "Activo"}
                      </span>
                      {operable &&
                        (active.endsOn ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void run(() => addAddOn(active.id), `${active.name} se mantiene`)}
                          >
                            Deshacer
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setDialog({ kind: "remove", addOnId: active.id, name: active.name, amount: active.amount })
                            }
                          >
                            Quitar
                          </Button>
                        ))}
                    </>
                  )}
                  {status === "available" && available && (
                    <>
                      {operable ? (
                        <Button size="sm" disabled={busy} onClick={() => setDialog({ kind: "add", addOn: available })}>
                          Agregar
                        </Button>
                      ) : billing.isOwner && billing.mode !== "EXEMPT" ? (
                        <Link
                          href="/pasate-a-flow"
                          className="rounded-md border px-3 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-500/15"
                        >
                          Activar al pasarte a Flow
                        </Link>
                      ) : null}
                    </>
                  )}
                  {status === "soon" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                      <Lock className="h-3 w-3" aria-hidden />
                      Próximamente
                    </span>
                  )}
                  {(card.bullets.length > 0 || card.roi) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setDialog({ kind: "info", card })}
                    >
                      Ver qué incluye
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {FUTURE_ADDONS.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.key} aria-disabled="true" className="flex flex-col gap-3 rounded-xl border border-dashed bg-muted/50 p-4 opacity-70">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold">{f.name}</h3>
                    <p className="text-xs text-muted-foreground">{f.where}</p>
                  </div>
                </div>
                <p className="flex-1 text-sm text-muted-foreground">{f.tag}</p>
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden />
                    Próximamente
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Incluido en todos los planes</h2>
          <p className="text-sm text-muted-foreground">
            Todos los planes traen los mismos módulos. Basic, Medium y Scale solo cambian en cuántos pedidos al mes
            puedes registrar.
          </p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Módulos de tu plan</p>
        <FeatureGrid items={CORE_MODULES} />
        <p className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Herramientas gratis para vender y cobrar
        </p>
        <FeatureGrid items={FREE_TOOLS} />
      </section>

      <div className="flex items-start gap-3 rounded-xl bg-teal-50 dark:bg-teal-500/15 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-card text-teal-700 dark:text-teal-300">
          <Link2 className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h3 className="font-semibold text-foreground">Cobra con Yape y Mercado Pago desde tu POWIP Link</h3>
          <p className="text-sm text-foreground/80">
            Tarifa de pasarela: 3.5% por pago. El adelanto o el total se valida solo y queda conciliado con el pedido.
          </p>
        </div>
      </div>

      {billing.mode === "FLOW_ACTIVE" && (
        <div className="flex justify-end">
          <Button variant="destructive" disabled={busy} onClick={() => setDialog({ kind: "cancel" })}>
            Darse de baja
          </Button>
        </div>
      )}

      {/* Qué incluye un add-on */}
      <Dialog open={dialog.kind === "info"} onOpenChange={(open) => !open && setDialog({ kind: "none" })}>
        <DialogContent className="max-w-lg">
          {dialog.kind === "info" && (
            <>
              <DialogHeader>
                <DialogTitle>{dialog.card.name}</DialogTitle>
                <DialogDescription>{dialog.card.tag}</DialogDescription>
              </DialogHeader>
              {dialog.card.bullets.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {dialog.card.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {dialog.card.roi && (
                <div className="rounded-lg bg-violet-100 p-3 text-sm text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  <p className="font-semibold">Se paga solo</p>
                  <p>{dialog.card.roi}</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

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
              {dialog.loading && <p className="text-sm text-muted-foreground">Calculando...</p>}
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

function FeatureGrid({ items }: { items: FeatureItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {items.map(({ icon: Icon, title, text }) => (
        <div key={title} className="flex gap-3 rounded-lg border bg-card p-3">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" aria-hidden />
          <div>
            <p className="text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">{text}</p>
          </div>
        </div>
      ))}
    </div>
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
      <p className="text-sm text-foreground/80">
        Se aplica a tu primer cobro del {day(billing.firstChargeDate)}. Hoy no se cobra nada.
      </p>
    );
  }
  if (!preview) return null;
  if (preview.direction === "UP") {
    return (
      <p className="text-sm text-foreground/80">
        Hoy se cobran <strong>{money(preview.balance)}</strong> por los días que quedan. Desde el{" "}
        {day(billing.nextChargeDate)}: {money(preview.nextChargeTotal)} al mes.
      </p>
    );
  }
  return (
    <p className="text-sm text-foreground/80">
      Hoy no se cobra ni se devuelve nada. El {day(preview.startsOn ?? billing.nextChargeDate)} pasas a{" "}
      {selected.name} ({money(selected.price)}). Hasta ese día sigues con {billing.plan?.name}.
    </p>
  );
}
