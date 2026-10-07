"use client";

import { useId, useState } from "react";
import { Clock, CreditCard } from "lucide-react";
import { PendingBackendNotice } from "../PendingBackendNotice";
import { usersTheme } from "../usersTheme";
import { BankAccountForm } from "./BankAccountForm";
import { WalletForm } from "./WalletForm";

type RewardMode = "discount" | "cash";

const FLOW_STEPS = [
  { title: "Compartes tu link", detail: "Link único generado de tu empresa" },
  { title: "Se activa el plan", detail: "Tu referido activa cualquier plan de pago" },
  { title: "Powip confirma", detail: "Verificamos el pago dentro de 24h" },
  { title: "Recibes tu recompensa", detail: "El 1ro de cada mes se procesan todos los abonos" },
];

const CASH_STEPS = [
  {
    title: "Registras tu cuenta bancaria",
    detail: "BCP, Interbank, BBVA, Scotiabank, Yape o Plin. Solo necesitas el número de cuenta o número de celular.",
  },
  {
    title: "Se activa un referido",
    detail: "Powip detecta que alguien usó tu link y activó un plan de pago. Recibes notificación por WhatsApp.",
    badge: "Notificación automática por WA",
  },
  {
    title: "Esperas hasta el 1ro del mes",
    detail: "Todos los referidos del mes anterior se procesan juntos para hacer un solo abono.",
  },
  {
    title: "Powip hace el abono",
    detail:
      "Transferencia bancaria directa o depósito en Yape/Plin según lo que hayas registrado. Mínimo para cobrar: S/50.",
    badge: "Confirmación por email y WA",
  },
];

const PAYOUT_METHODS = [
  { id: "bcp", label: "BCP", icon: "🏦", kind: "bank" },
  { id: "interbank", label: "Interbank", icon: "🏦", kind: "bank" },
  { id: "bbva", label: "BBVA", icon: "🏦", kind: "bank" },
  { id: "scotiabank", label: "Scotiabank", icon: "🏦", kind: "bank" },
  { id: "yape", label: "Yape", icon: "💜", kind: "wallet" },
  { id: "plin", label: "Plin", icon: "💚", kind: "wallet" },
  { id: "nacion", label: "Nación", icon: "🏦", kind: "bank" },
  { id: "otro", label: "Otro", icon: "➕", kind: "bank" },
] as const;

const STATS = ["Referidos activos", "Ganado este mes", "Total histórico", "Descuento acumulado"];

export function ReferralsTab() {
  const fieldId = useId();
  const pendingNoticeId = `${fieldId}-pending`;
  const payoutNoticeId = `${fieldId}-payout-pending`;
  const [rewardMode, setRewardMode] = useState<RewardMode>("discount");
  const [methodId, setMethodId] = useState<(typeof PAYOUT_METHODS)[number]["id"]>("bcp");
  const method = PAYOUT_METHODS.find((option) => option.id === methodId) ?? PAYOUT_METHODS[0];

  return (
    <div className="space-y-3.5">
      <PendingBackendNotice
        id={pendingNoticeId}
        title="Programa de referidos todavía no disponible"
      >
        Los beneficios, plazos y montos son una propuesta y todavía no están confirmados. Nada de lo que elijas o
        completes aquí se guarda.
      </PendingBackendNotice>

      <section aria-labelledby={`${fieldId}-flow`} className={`${usersTheme.card} p-5`}>
        <h2
          id={`${fieldId}-flow`}
          className="mb-3.5 flex items-center gap-[7px] text-sm font-bold text-[#0e0b1f] dark:text-foreground"
        >
          <Clock className="h-3.5 w-3.5 text-[#8b87a3]" aria-hidden="true" />
          ¿Cómo funciona el cobro de referidos?
        </h2>
        <ol className="relative mb-5 grid grid-cols-2 gap-4 sm:flex sm:gap-0 sm:before:absolute sm:before:left-5 sm:before:right-5 sm:before:top-5 sm:before:h-0.5 sm:before:bg-gradient-to-r sm:before:from-[#4C2FB5] sm:before:to-[#027778] sm:before:content-['']">
          {FLOW_STEPS.map((step, index) => (
            <li key={step.title} className="relative z-[1] flex-1 text-center">
              <span
                aria-hidden="true"
                className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#4C2FB5] bg-white text-xs font-bold text-[#4C2FB5] dark:bg-card"
              >
                {index + 1}
              </span>
              <p className="mb-[3px] text-xs font-semibold text-[#0e0b1f] dark:text-foreground">{step.title}</p>
              <p className="text-[11px] leading-snug text-[#8b87a3]">{step.detail}</p>
            </li>
          ))}
        </ol>
        <fieldset>
          <legend className="sr-only">Tipo de recompensa</legend>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                value: "discount" as const,
                icon: "💰",
                title: "Descuento en tu suscripción",
                detail:
                  "Descuento permanente acumulable. Si tienes 3 referidos activos, ese descuento se mantiene mientras ellos estén suscritos.",
                amount: "10% OFF por referido",
              },
              {
                value: "cash" as const,
                icon: "🎁",
                title: "Monto en efectivo — necesita cuenta bancaria",
                detail:
                  "S/50 por cada referido que active un plan. Se acumula y el abono se hace el 1ro de cada mes a tu cuenta registrada.",
                amount: "S/ 50 por referido activado",
              },
            ].map((option) => (
              <label
                key={option.value}
                className="group relative block cursor-pointer rounded-[11px] border-2 border-[#e8e4f8] bg-white p-4 transition-colors hover:border-[#4C2FB5] has-[:checked]:border-[#4C2FB5] has-[:checked]:bg-[#f0eeff] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4C2FB5]/40 dark:border-border dark:bg-transparent"
              >
                <input
                  type="radio"
                  name={`${fieldId}-reward`}
                  value={option.value}
                  checked={rewardMode === option.value}
                  onChange={() => setRewardMode(option.value)}
                  className="sr-only"
                />
                <span aria-hidden="true" className="mb-2 block text-2xl">
                  {option.icon}
                </span>
                <span className="mb-1 block text-sm font-bold text-[#0e0b1f] group-has-[:checked]:text-[#4C2FB5] dark:text-foreground">
                  {option.title}
                </span>
                <span className="block text-xs leading-relaxed text-[#8b87a3]">{option.detail}</span>
                <span className="mt-2 block text-lg font-extrabold text-[#22c55e] group-has-[:checked]:text-[#4C2FB5]">
                  {option.amount}
                </span>
                <span className="mt-1 block text-[10px] text-[#8b87a3]">Condición propuesta, pendiente de confirmación</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {rewardMode === "cash" && (
        <div className="space-y-3.5">
          <section aria-labelledby={`${fieldId}-cash`} className="rounded-[10px] bg-[#f7f6ff] px-4 py-3.5 dark:bg-muted">
            <h2 id={`${fieldId}-cash`} className="mb-2.5 text-[13px] font-bold text-[#0e0b1f] dark:text-foreground">
              📋 Proceso de cobro en efectivo
            </h2>
            <ol>
              {CASH_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex items-start gap-2.5 border-b border-[#e8e4f8] py-[7px] last:border-b-0 dark:border-border"
                >
                  <span
                    aria-hidden="true"
                    className="mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#4C2FB5] text-[10px] font-bold text-white"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-[#0e0b1f] dark:text-foreground">{step.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#8b87a3]">{step.detail}</p>
                    {step.badge && (
                      <span className="mt-1 inline-block rounded-lg bg-[#dcfce7] px-2 py-0.5 text-[10px] font-bold text-[#15803d]">
                        {step.badge} · propuesta
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section
            aria-labelledby={`${fieldId}-payout`}
            className="rounded-[11px] border border-[#ddd6fe] bg-gradient-to-br from-[#f0eeff] to-[#e6f7f7] p-4 dark:border-border dark:from-muted dark:to-muted"
          >
            <h2 id={`${fieldId}-payout`} className="mb-3 flex items-center gap-1.5 text-[13px] font-bold text-[#4C2FB5]">
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Registrar cuenta para recibir pagos
            </h2>
            <fieldset className="mb-3">
              <legend className="sr-only">Método de cobro</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PAYOUT_METHODS.map((option) => (
                  <label
                    key={option.id}
                    className="relative cursor-pointer rounded-[9px] border-2 border-[#4C2FB5]/15 bg-white/70 px-2 py-2.5 text-center transition-colors hover:border-[#4C2FB5] has-[:checked]:border-[#4C2FB5] has-[:checked]:bg-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#4C2FB5]/40 dark:bg-transparent"
                  >
                    <input
                      type="radio"
                      name={`${fieldId}-method`}
                      value={option.id}
                      checked={methodId === option.id}
                      onChange={() => setMethodId(option.id)}
                      className="sr-only"
                    />
                    <span aria-hidden="true" className="mb-1 block text-xl">
                      {option.icon}
                    </span>
                    <span className="text-[11px] font-bold text-[#0e0b1f] dark:text-foreground">{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <PendingBackendNotice
              id={payoutNoticeId}
              className="mb-3"
              title="Registro de cuentas todavía no habilitado"
            >
              Todavía no se pueden guardar datos de cobro. Lo que escribas no se envía.
            </PendingBackendNotice>
            {method.kind === "wallet" ? (
              <WalletForm
                key={method.id}
                walletLabel={method.label as "Yape" | "Plin"}
                pendingNoticeId={payoutNoticeId}
              />
            ) : (
              <BankAccountForm key={method.id} bankLabel={method.label} pendingNoticeId={payoutNoticeId} />
            )}
          </section>
        </div>
      )}

      <section aria-labelledby={`${fieldId}-stats`} className={`${usersTheme.card} p-5`}>
        <h2 id={`${fieldId}-stats`} className="mb-3.5 text-sm font-bold text-[#0e0b1f] dark:text-foreground">
          📊 Tus estadísticas de referidos
        </h2>
        <ul className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {STATS.map((label) => (
            <li
              key={label}
              className="rounded-[9px] border border-[#e8e4f8] bg-white p-3 text-center dark:border-border dark:bg-transparent"
            >
              <p className="text-xl font-extrabold text-[#8b87a3]">—</p>
              <p className="mt-0.5 text-[11px] text-[#8b87a3]">{label}</p>
            </li>
          ))}
        </ul>
        <p className="mb-2 text-[13px] font-semibold text-[#2D2A45] dark:text-foreground">Tu link de referido</p>
        <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-[9px] bg-[#f7f6ff] px-[13px] py-2.5 dark:bg-muted">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#8b87a3]">Link no disponible todavía</span>
          <button
            type="button"
            disabled
            aria-describedby={pendingNoticeId}
            className="rounded-[7px] bg-[#4C2FB5] px-3.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Copiar
          </button>
          <button
            type="button"
            disabled
            aria-describedby={pendingNoticeId}
            className="rounded-[7px] bg-[#25d366] px-3.5 py-1.5 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Compartir WA
          </button>
        </div>
        <p className="rounded-[9px] bg-[#f7f6ff] px-3.5 py-3 text-center text-[13px] text-[#8b87a3] dark:bg-muted">
          Las estadísticas y el link aparecerán cuando el programa de referidos esté disponible.
        </p>
      </section>
    </div>
  );
}
