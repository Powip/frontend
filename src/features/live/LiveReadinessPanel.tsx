"use client";

import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import type { LiveReadiness } from "./types";

type OpeningInput = {
  readiness?: LiveReadiness;
  purchasesEnabled: boolean;
  canManage: boolean;
  busy: boolean;
};
type OpeningAction = "config" | "products";
export type LiveConfigTarget = "yape" | "shipping" | "purchases";
type CheckCode = LiveReadiness["checks"][number]["code"];
const CHECKS: Record<CheckCode, { label: string; action: OpeningAction | null; button: string }> = {
  YAPE: { label: "Yape", action: "config", button: "Configurar Yape" },
  PRODUCTS: { label: "Productos y precios", action: "products", button: "Agregar productos" },
  STOCK: { label: "Stock disponible", action: "products", button: "Revisar stock" },
  SHIPPING: { label: "Envío", action: "config", button: "Configurar envío" },
  CUSTOMER_REVIEW: { label: "Revisión de datos", action: null, button: "" },
};

export function getLiveOpeningStatus({
  readiness,
  purchasesEnabled,
  canManage,
  busy,
}: OpeningInput): {
  kind: "checking" | "restricted" | "saving" | "incomplete" | "enable-purchases" | "ready";
  title: string;
  message: string;
  actions: OpeningAction[];
} {
  if (!canManage)
    return {
      kind: "restricted",
      title: "Se necesita un Administrador",
      message:
        "El Administrador del negocio puede completar la configuración y abrir el catálogo del Live.",
      actions: [],
    };
  if (busy)
    return {
      kind: "saving",
      title: "Guardando cambios",
      message: "Espera a que termine el guardado para abrir el catálogo.",
      actions: [],
    };
  if (!readiness || (!readiness.ready && readiness.checks.length === 0))
    return {
      kind: "checking",
      title: "Comprueba la preparación",
      message: "Pulsa Actualizar live para comprobar los requisitos de apertura.",
      actions: [],
    };
  const missing = readiness.checks.filter((check) => !check.ready);
  if (!readiness.ready || missing.length) {
    const actions = missing
      .map((check) => CHECKS[check.code]?.action)
      .filter((action): action is OpeningAction => !!action);
    return {
      kind: "incomplete",
      title: "Prepara tu catálogo",
      message: missing.length
        ? `Falta completar: ${missing.map((check) => CHECKS[check.code]?.label || check.code).join(", ")}.`
        : "Hay una comprobación pendiente. Pulsa Actualizar live para revisar el detalle.",
      actions: [...new Set(actions)],
    };
  }
  if (!purchasesEnabled)
    return {
      kind: "enable-purchases",
      title: "Catálogo preparado",
      message:
        "En Configuración, activa Habilitar compras del live y guarda los cambios. Después podrás abrir el catálogo.",
      actions: ["config"],
    };
  return {
    kind: "ready",
    title: "Listo para abrir",
    message: "Las compras están habilitadas. Ya puedes pulsar Estoy en vivo o Abrir catálogo.",
    actions: [],
  };
}

export default function LiveReadinessPanel({
  readiness,
  purchasesEnabled,
  canManage,
  busy,
  onConfigure,
  onProducts,
}: OpeningInput & {
  onConfigure: (target?: LiveConfigTarget) => void;
  onProducts: () => void;
}) {
  const id = useId();
  const status = getLiveOpeningStatus({ readiness, purchasesEnabled, canManage, busy });
  const checks = readiness?.checks.filter((check) => check.code !== "CUSTOMER_REVIEW") ?? [];
  const otherFailures =
    readiness?.checks.filter((check) => check.code === "CUSTOMER_REVIEW" && !check.ready) ?? [];
  const completed = checks.filter((check) => check.ready).length;
  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-summary`}
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="flex items-center gap-2 text-base font-semibold">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {status.title}
          </h2>
          <p
            id={`${id}-summary`}
            role="status"
            className="mt-2 text-sm leading-relaxed text-muted-foreground"
          >
            {status.message}
          </p>
        </div>
        {checks.length ? (
          <span className="self-start rounded-full bg-muted px-3 py-1 text-xs font-medium">
            {completed} de {checks.length}{" "}
            {checks.length === 1 ? "requisito listo" : "requisitos listos"}
          </span>
        ) : null}
      </div>
      {checks.length ? (
        <ul
          aria-label="Preparación del catálogo"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {checks.map((check) => {
            const detail = CHECKS[check.code];
            const messageId = `${id}-${check.code}`;
            return (
              <li key={check.code} className="rounded-xl border bg-background p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {check.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
                  ) : (
                    <Circle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                  )}
                  {detail?.label || check.code}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {check.ready ? "Listo" : "Pendiente"}
                  </span>
                </p>
                <p id={messageId} className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {check.message}
                </p>
                {!check.ready && canManage && detail?.action ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    disabled={busy}
                    aria-describedby={messageId}
                    onClick={() =>
                      detail.action === "config"
                        ? onConfigure(check.code === "YAPE" ? "yape" : "shipping")
                        : onProducts()
                    }
                  >
                    {detail.button}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {otherFailures.map((check) => (
        <p key={check.code} className="rounded-xl border p-3 text-sm">
          <strong>Comprobación pendiente: </strong>
          {check.message}
        </p>
      ))}
      {status.kind === "enable-purchases" ? (
        <Button
          type="button"
          variant="outline"
          aria-describedby={`${id}-summary`}
          onClick={() => onConfigure("purchases")}
        >
          Ir a Configuración
        </Button>
      ) : null}
    </section>
  );
}
