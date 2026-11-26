"use client";

import { Check, CheckCircle2, ExternalLink, Loader2, TriangleAlert } from "lucide-react";
import { useId, useRef, useState } from "react";
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
  waField,
  waHint,
  waInput,
  waLabel,
} from "@/components/whatsapp/ui/wa-classes";
import { SIGNUP_REQUIREMENTS } from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";
import {
  type ConnectionMutations,
  errorMessage,
  type NumberRole,
  needsCoexistenceConfirmation,
  type SignupPhoneChoice,
  type SignupReassign,
  signupPhoneChoice,
  signupReassign,
  signupSelectionId,
} from "./connection-types";
import { isRoleComplete, NoCoexistenceDialog, NumberRoleField } from "./NumberRoleField";
import { PhoneReassignDialog, PhoneSelectionDialog } from "./SignupPhoneDialogs";

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
  selectSignupPhone?: ConnectionMutations["selectSignupPhone"];
  initialPhase?: SignupPhase;
  agents?: WhatsAppAgentOption[];
  /** Cambio de modo: se vuelve a conectar este número, sin tocar su vendedora ni principal. */
  reconnect?: { phone: string; isCompanyDefault: boolean };
  onClose: () => void;
}

const STEP_LABELS = ["Inicia sesión con Meta", "Elige el número", "Verifica el código"];

export function ConnectNumberDialog({
  storeId,
  storeName,
  mode,
  blockedReason,
  startSignup,
  selectSignupPhone,
  initialPhase = { kind: "intro" },
  agents = [],
  reconnect,
  onClose,
}: ConnectNumberDialogProps) {
  const reasonId = useId();
  const [phase, setPhase] = useState<SignupPhase>(initialPhase);
  const [role, setRole] = useState<NumberRole>(reconnect?.isCompanyDefault ? "company" : "store");
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [askCoexistence, setAskCoexistence] = useState(false);
  const [expectedPhone, setExpectedPhone] = useState("");
  // Conexión con Facebook pendiente en el servidor: el code de Meta ya se usó, así que la
  // lista de números y los avisos se responden sin abrir Meta otra vez.
  const [choice, setChoice] = useState<SignupPhoneChoice | null>(null);
  const [reassign, setReassign] = useState<SignupReassign | null>(null);
  const [coexSelectionId, setCoexSelectionId] = useState<string | null>(null);
  const confirmed = useRef<{ confirmNoCoexistence?: boolean; confirmReassign?: boolean }>({});
  const roleComplete = isRoleComplete(role, sellerId);
  const blocked = !!blockedReason || !startSignup;
  const completedSteps = phase.kind === "success" ? 3 : 1;
  const expectedPhoneId = useId();

  const sellerChoice = () => {
    const seller = agents.find((agent) => agent.id === sellerId) ?? null;
    return role === "seller" && seller ? { id: seller.id, name: seller.name } : null;
  };

  /** Lo que respondió el backend cuando no conectó: lista, aviso o error con su motivo. */
  const handleFailure = (caught: unknown, apiConfirmed: boolean) => {
    const list = signupPhoneChoice(caught);
    if (list) {
      setPhase({ kind: "intro" });
      setChoice(list);
      return;
    }
    const move = signupReassign(caught);
    if (move?.selectionId) {
      setPhase({ kind: "intro" });
      setReassign(move);
      return;
    }
    // Reconexión a «API + app»: sin el número en la app no habría cambio de modo que guardar.
    if (reconnect && mode === "coex" && needsCoexistenceConfirmation(caught)) {
      setPhase({
        kind: "error",
        message:
          "Meta dice que este número no está en la app WhatsApp Business del celular. No se cambió nada.",
      });
      return;
    }
    // Meta dijo que el número no tiene coexistencia: no se conectó nada; se pregunta.
    if (needsCoexistenceConfirmation(caught) && !confirmed.current.confirmNoCoexistence) {
      const selectionId = signupSelectionId(caught);
      if (selectionId || !apiConfirmed) {
        setPhase({ kind: "intro" });
        setCoexSelectionId(selectionId);
        setAskCoexistence(true);
        return;
      }
    }
    setPhase({
      kind: "error",
      message: errorMessage(caught, "No se completó la conexión. No se conectó ningún número."),
    });
  };

  const run = async (confirmNoCoexistence: boolean) => {
    if (blocked || !startSignup || phase.kind === "waiting") return;
    setPhase({ kind: "waiting" });
    confirmed.current = confirmNoCoexistence ? { confirmNoCoexistence: true } : {};
    try {
      await startSignup({
        storeId,
        mode,
        role,
        seller: sellerChoice(),
        ...(reconnect
          ? { expectedPhoneNumber: reconnect.phone, keepRole: true }
          : expectedPhone.trim()
            ? { expectedPhoneNumber: expectedPhone.trim() }
            : {}),
        ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
      });
      setPhase({ kind: "success" });
    } catch (caught) {
      handleFailure(caught, confirmNoCoexistence);
    }
  };

  /** Segundo paso: el número elegido o el mismo número tras confirmar, sin abrir Meta. */
  const select = async (selectionId: string, phoneNumberId?: string) => {
    if (!selectSignupPhone) return;
    setPhase({ kind: "waiting" });
    try {
      await selectSignupPhone({
        storeId,
        selectionId,
        ...(phoneNumberId ? { phoneNumberId } : {}),
        role,
        seller: sellerChoice(),
        ...(reconnect ? { keepRole: true } : {}),
        ...confirmed.current,
      });
      setPhase({ kind: "success" });
    } catch (caught) {
      handleFailure(caught, true);
    }
  };

  const cancelPending = () => {
    setChoice(null);
    setReassign(null);
    setCoexSelectionId(null);
    setPhase({ kind: "error", message: "No se conectó ningún número." });
  };

  // Número dedicado (sin coexistencia): se avisa ANTES de abrir Meta, porque el código de
  // Facebook sirve una sola vez. Con coexistencia se abre Meta y el backend lo confirma.
  const start = () => {
    if (blocked || !roleComplete || phase.kind === "waiting") return;
    // En una reconexión el aviso ya se confirmó al elegir la tarjeta.
    if (mode === "api" && reconnect) {
      void run(true);
      return;
    }
    if (mode === "api") {
      setAskCoexistence(true);
      return;
    }
    void run(false);
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
          <DialogTitle className={waDialogTitle}>
            {reconnect ? `Volver a conectar ${reconnect.phone}` : `Conectar número de ${storeName}`}
          </DialogTitle>
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

          {reconnect && (
            <p className="m-0 text-xs text-wa-muted">
              Elige en Meta el mismo número: {reconnect.phone}. POWIP no conecta otro. Conserva su
              tienda, vendedora y marca de principal.
            </p>
          )}

          {!reconnect && phase.kind !== "success" && (
            <div className={waField}>
              <label className={waLabel} htmlFor={expectedPhoneId}>
                Número que vas a conectar (opcional)
              </label>
              <input
                id={expectedPhoneId}
                className={waInput}
                inputMode="tel"
                autoComplete="off"
                placeholder="+51 987 654 321"
                value={expectedPhone}
                maxLength={32}
                disabled={phase.kind === "waiting"}
                onChange={(event) => setExpectedPhone(event.target.value)}
              />
              <span className={waHint}>
                Si tu cuenta de Facebook tiene varios números, POWIP conecta solo este. Si lo dejas
                vacío y hay varios, te mostramos la lista para elegir.
              </span>
            </div>
          )}

          {!reconnect && phase.kind !== "success" && (
            <NumberRoleField
              storeName={storeName}
              role={role}
              onRoleChange={setRole}
              sellerId={sellerId}
              onSellerChange={setSellerId}
              agents={agents}
              disabled={phase.kind === "waiting"}
            />
          )}

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
              blocked={blocked || !roleComplete || phase.kind === "waiting"}
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
      <NoCoexistenceDialog
        open={askCoexistence}
        onCancel={() => {
          setAskCoexistence(false);
          cancelPending();
        }}
        onConfirm={() => {
          setAskCoexistence(false);
          if (coexSelectionId) {
            const selectionId = coexSelectionId;
            setCoexSelectionId(null);
            confirmed.current = { ...confirmed.current, confirmNoCoexistence: true };
            void select(selectionId);
            return;
          }
          void run(true);
        }}
      />
      <PhoneSelectionDialog
        choice={choice}
        onCancel={cancelPending}
        onConfirm={(phoneNumberId) => {
          const selectionId = choice?.selectionId;
          setChoice(null);
          if (selectionId) void select(selectionId, phoneNumberId);
        }}
      />
      <PhoneReassignDialog
        reassign={reassign}
        onCancel={cancelPending}
        onConfirm={() => {
          const selectionId = reassign?.selectionId;
          setReassign(null);
          confirmed.current = { ...confirmed.current, confirmReassign: true };
          if (selectionId) void select(selectionId);
        }}
      />
    </Dialog>
  );
}
