"use client";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
  waField,
  waHint,
  waLabel,
  waSelectTriggerSm,
} from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";
import type { NumberRole } from "./connection-types";

const ROLE_OPTIONS: Array<{ value: NumberRole; label: string; hint: string }> = [
  {
    value: "company",
    label: "Número principal de la empresa",
    hint: "Lo usan todas las tiendas que no tienen número propio.",
  },
  {
    value: "store",
    label: "Número principal de la tienda",
    hint: "Envía los avisos automáticos de esta tienda. Sus chats quedan en cola para el equipo.",
  },
  {
    value: "seller",
    label: "Número de vendedora",
    hint: "Los chats de este número le llegan a la vendedora que elijas.",
  },
];

interface NumberRoleFieldProps {
  storeName: string;
  role: NumberRole;
  onRoleChange: (role: NumberRole) => void;
  sellerId: string | null;
  onSellerChange: (sellerId: string) => void;
  agents: WhatsAppAgentOption[];
  disabled?: boolean;
}

/** Tipo de número al darlo de alta: de la empresa, de la tienda o de una vendedora. */
export function NumberRoleField({
  storeName,
  role,
  onRoleChange,
  sellerId,
  onSellerChange,
  agents,
  disabled,
}: NumberRoleFieldProps) {
  const current = ROLE_OPTIONS.find((option) => option.value === role) ?? ROLE_OPTIONS[1];
  return (
    <div className="flex flex-col gap-3">
      <div className={waField}>
        <span className={waLabel} id="number-role-label">
          Tipo de número
        </span>
        <Select
          value={role}
          disabled={disabled}
          onValueChange={(value) => onRoleChange(value as NumberRole)}
        >
          <SelectTrigger className={waSelectTriggerSm} aria-labelledby="number-role-label">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.value === "store" ? `${option.label} (${storeName})` : option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className={cn(waHint, "m-0")}>{current.hint}</span>
      </div>
      {role === "seller" && (
        <div className={waField}>
          <span className={waLabel} id="number-seller-label">
            Vendedora
          </span>
          <Select
            value={sellerId ?? undefined}
            disabled={disabled || agents.length === 0}
            onValueChange={onSellerChange}
          >
            <SelectTrigger className={waSelectTriggerSm} aria-labelledby="number-seller-label">
              <SelectValue placeholder={agents.length ? "Elige la vendedora" : "No hay vendedoras"} />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

/** true cuando el tipo elegido está completo (la vendedora es obligatoria en «seller»). */
export function isRoleComplete(role: NumberRole, sellerId: string | null): boolean {
  return role !== "seller" || !!sellerId;
}

interface NoCoexistenceDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Aviso antes de conectar un número sin coexistencia: deja de funcionar en el celular. */
export function NoCoexistenceDialog({ open, onCancel, onConfirm }: NoCoexistenceDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent className={cn(waDialogContent, "sm:max-w-[460px]")}>
        <AlertDialogHeader className={waDialogHeader}>
          <AlertDialogTitle className={waDialogTitle}>Número sin coexistencia</AlertDialogTitle>
        </AlertDialogHeader>
        <div className={cn(waDialogBody, "space-y-3")}>
          <AlertDialogDescription className="m-0 text-sm text-wa-muted">
            Este número no tiene coexistencia. Si sigues, dejará de funcionar en la app WhatsApp
            Business del celular y solo se podrá usar desde Powip. ¿Deseas continuar?
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className={waDialogFooter}>
          <AlertDialogCancel className={waButton()} onClick={onCancel}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction className={waButton({ variant: "primary" })} onClick={onConfirm}>
            Sí, continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
