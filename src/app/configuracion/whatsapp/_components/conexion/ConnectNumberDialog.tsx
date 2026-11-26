"use client";

import { Check, CheckCircle2, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlockedActionButton } from "@/components/whatsapp/BlockedActionButton";
import { WaCallout } from "@/components/whatsapp/ui/WaCallout";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import { SIGNUP_REQUIREMENTS } from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import { cn } from "@/lib/utils";
import { type ConnectionMutations, errorMessage } from "./connection-types";

export type SignupPhase =
  | { kind: "intro" }
  | { kind: "waiting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

interface ConnectNumberDialogProps {
  storeId: string;
  storeName: string;
  mode: "api" | "coex";
  blockedReason: string | null;
  startSignup: ConnectionMutations["startSignup"];
  initialPhase?: SignupPhase;
  onClose: () => void;
}

const STEP_LABELS = ["Inicia sesión con Meta", "Elige el número", "Verifica el código"];

export function ConnectNumberDialog({
  storeId,
  storeName,
  mode,
  blockedReason,
  startSignup,
  initialPhase = { kind: "intro" },
  onClose,
}: ConnectNumberDialogProps) {
  const reasonId = useId();
  const [phase, setPhase] = useState<SignupPhase>(initialPhase);
  const blocked = !!blockedReason || !startSignup;
  const completedSteps = phase.kind === "success" ? 3 : 1;

  const start = async () => {
    if (blocked || !startSignup || phase.kind === "waiting") return;
    setPhase({ kind: "waiting" });
    try {
      await startSignup({ storeId, mode });
      setPhase({ kind: "success" });
    } catch (caught) {
      setPhase({
        kind: "error",
        message: errorMessage(caught, "No se completó la conexión. No se conectó ningún número."),
      });
    }
  };

  const close = () => {
    if (phase.kind !== "waiting") onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        showCloseButton={false}
        className={cn(waDialogContent, "max-h-[calc(100dvh-2rem)] sm:max-w-[560px]")}
      >
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Conectar número de {storeName}</DialogTitle>
          <WaDialogClose onClick={close} />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex flex-col gap-3.5 overflow-y-auto")}>
          <ol className="m-0 mb-1.5 flex list-none gap-2 p-0" aria-label="Pasos de la conexión">
            {STEP_LABELS.map((label, index) => (
              <li
                key={label}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  index < completedSteps ? "bg-wa-whatsapp" : "bg-wa-border",
                )}
              >
                <span className="sr-only">
                  {index + 1}. {label}
                </span>
              </li>
            ))}
          </ol>
          <DialogDescription className="sr-only">
            {mode === "coex"
              ? "Conecta el número que ya usas en la app WhatsApp Business."
              : "Conecta un número dedicado a la API oficial de WhatsApp."}
          </DialogDescription>

          <b className="font-semibold">1. Inicia sesión con Meta</b>
          <p className="m-0 text-wa-muted">
            Usarás la cuenta de Facebook que administra el negocio de {storeName}. Meta te pedirá
            crear o elegir tu cuenta de WhatsApp Business.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-xs">
            {SIGNUP_REQUIREMENTS.map((requirement) => (
              <li key={requirement} className="flex items-center gap-2.5">
                <Check className="size-[18px] shrink-0 text-wa-green" aria-hidden="true" />
                {requirement}
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs text-wa-muted">
            Los pasos 2 y 3 (elegir el número, el nombre visible y el código por SMS o llamada)
            ocurren en la ventana de Meta, no en POWIP.
          </p>

          {phase.kind === "waiting" && (
            <WaCallout icon={Loader2} className="[&>svg]:animate-spin" role="status">
              Completa los pasos en la ventana de Meta. Cuando termines, POWIP confirmará la
              conexión.
            </WaCallout>
          )}

          {phase.kind === "success" && (
            <div role="status">
              <WaCallout tone="teal" icon={CheckCircle2}>
                POWIP confirmó la conexión. Meta está revisando el nombre: puedes enviar mientras
                tanto.
              </WaCallout>
            </div>
          )}

          {phase.kind === "error" && (
            <div role="alert">
              <WaCallout tone="red" icon={TriangleAlert}>
                {phase.message}
              </WaCallout>
            </div>
          )}

          {phase.kind === "success" ? (
            <Button type="button" className={waButton({ variant: "whatsapp" })} onClick={onClose}>
              Listo
            </Button>
          ) : (
            <BlockedActionButton
              className={waButton({ variant: "facebook" })}
              blocked={blocked || phase.kind === "waiting"}
              blockedReasonId={reasonId}
              onClick={start}
            >
              <ExternalLink aria-hidden="true" />
              {phase.kind === "error" ? "Intentar de nuevo" : "Continuar con Facebook"}
            </BlockedActionButton>
          )}
          {blocked && phase.kind !== "success" && (
            <p id={reasonId} className="m-0 text-xs text-wa-muted">
              {blockedReason}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
