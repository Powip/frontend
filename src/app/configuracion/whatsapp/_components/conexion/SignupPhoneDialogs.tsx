"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  waButton,
  waChoice,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waHint,
} from "@/components/whatsapp/ui/wa-classes";
import { cn } from "@/lib/utils";
import {
  formatSignupPhone,
  type SignupPhoneCandidate,
  type SignupPhoneChoice,
  type SignupReassign,
} from "./connection-types";

interface PhoneSelectionDialogProps {
  choice: SignupPhoneChoice | null;
  onCancel: () => void;
  onConfirm: (phoneNumberId: string) => void;
}

/**
 * Meta compartió varios números en «Conectar con Facebook»: la persona elige cuál conectar.
 * POWIP nunca toma el primero de la lista por su cuenta.
 */
export function PhoneSelectionDialog({ choice, onCancel, onConfirm }: PhoneSelectionDialogProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const candidates = choice?.candidates ?? [];
  const severalWabas = new Set(candidates.map((c) => c.wabaId)).size > 1;

  const cancel = () => {
    setPicked(null);
    onCancel();
  };

  return (
    <AlertDialog open={choice !== null} onOpenChange={(next) => !next && cancel()}>
      <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[480px]")}>
        <AlertDialogHeader className={waDialogHeader}>
          <AlertDialogTitle className={waDialogTitle}>¿Qué número quieres conectar?</AlertDialogTitle>
        </AlertDialogHeader>
        <div className={cn(waDialogBody, "space-y-3")}>
          <AlertDialogDescription className="m-0 text-sm text-wa-muted">
            Tu cuenta de Facebook compartió {candidates.length} números. Elige el de esta tienda.
            Todavía no se conectó ninguno.
          </AlertDialogDescription>
          <div role="radiogroup" aria-label="Números compartidos en Meta" className="flex flex-col gap-2">
            {candidates.map((candidate) => (
              <CandidateOption
                key={candidate.phoneNumberId}
                candidate={candidate}
                showWaba={severalWabas}
                checked={picked === candidate.phoneNumberId}
                onPick={() => setPicked(candidate.phoneNumberId)}
              />
            ))}
          </div>
        </div>
        <AlertDialogFooter className={waDialogFooter}>
          <AlertDialogCancel className={waButton()} onClick={cancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            className={waButton({ variant: "primary" })}
            disabled={!picked}
            onClick={() => {
              if (!picked) return;
              const id = picked;
              setPicked(null);
              onConfirm(id);
            }}
          >
            Conectar este número
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CandidateOption({
  candidate,
  showWaba,
  checked,
  onPick,
}: {
  candidate: SignupPhoneCandidate;
  showWaba: boolean;
  checked: boolean;
  onPick: () => void;
}) {
  return (
    <label className={waChoice}>
      <input
        type="radio"
        name="signup-phone"
        className="size-4 accent-wa-whatsapp-dark"
        checked={checked}
        onChange={onPick}
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold">{formatSignupPhone(candidate.displayPhoneNumber)}</span>
        <span className={waHint}>
          {candidate.verifiedName || "Sin nombre visible"}
          {candidate.isOnBizApp === true ? " · en la app WhatsApp Business" : ""}
          {showWaba ? ` · cuenta ${candidate.wabaId}` : ""}
        </span>
      </span>
    </label>
  );
}

interface ReassignDialogProps {
  reassign: SignupReassign | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** El número ya está en otra tienda, o reemplaza al número de la empresa: se pregunta antes. */
export function PhoneReassignDialog({ reassign, onCancel, onConfirm }: ReassignDialogProps) {
  const phone = formatSignupPhone(reassign?.displayPhoneNumber);
  const text =
    reassign?.reason === "replaces_company_default"
      ? `La empresa ya tiene como número principal ${formatSignupPhone(reassign.replacedPhoneNumber)}. Si sigues, ${phone} lo reemplaza.`
      : `${phone} ya está conectado en otra tienda. Si sigues, pasa a esta tienda y deja de estar en la otra.`;
  return (
    <AlertDialog open={reassign !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[460px]")}>
        <AlertDialogHeader className={waDialogHeader}>
          <AlertDialogTitle className={waDialogTitle}>Número ya conectado</AlertDialogTitle>
        </AlertDialogHeader>
        <div className={cn(waDialogBody, "space-y-3")}>
          <AlertDialogDescription className="m-0 text-sm text-wa-muted">
            {text} ¿Deseas continuar?
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className={waDialogFooter}>
          <AlertDialogCancel className={waButton()} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction className={waButton({ variant: "primary" })} onClick={onConfirm}>
            Sí, mover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
