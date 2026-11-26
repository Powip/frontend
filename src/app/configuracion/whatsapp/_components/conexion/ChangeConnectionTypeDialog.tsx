"use client";

import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogFooter,
  waDialogHeader,
  waDialogTitle,
} from "@/components/whatsapp/ui/wa-classes";
import { getConnectionTypeDefinition } from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import {
  WHATSAPP_CONNECTION_TYPES,
  type WhatsAppConnectionType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppAccount } from "@/features/whatsapp/models/connection.model";
import { cn } from "@/lib/utils";
import { errorMessage } from "./connection-types";

const { API, COEXISTENCE, APP_MANUAL } = WHATSAPP_CONNECTION_TYPES;
const PHONE_PATH = "Ajustes › Cuenta › Plataforma de WhatsApp Business › Desconectar";

/**
 * What is lost when a number changes its connection type. An empty list means nothing is lost,
 * so Meta's window opens without asking.
 */
export function changeWarnings(from: WhatsAppConnectionType | null, to: WhatsAppConnectionType) {
  if (to === APP_MANUAL) {
    return [
      "Powip deja de enviar solo y de recibir mensajes de este número. Sin Bandeja, Pau ni estados entregado o leído.",
      "Los avisos automáticos pasan a envío a mano.",
      "Powip borra la llave de Meta. Para volver a la API hay que conectarlo otra vez con Facebook.",
      from === COEXISTENCE
        ? `Powip no toca el celular. Desconéctalo tú en la app WhatsApp Business: ${PHONE_PATH}.`
        : "Powip no lo quita de Meta. Para usarlo en la app del celular, primero elimínalo en WhatsApp Manager.",
    ];
  }
  if (to === API) {
    const base = ["El número deja de funcionar en la app WhatsApp Business del celular."];
    if (from === APP_MANUAL) {
      return [
        ...base,
        "Meta pide borrar antes la cuenta de WhatsApp en ese celular: los chats del celular se pierden.",
      ];
    }
    return [
      ...base,
      `Meta puede pedir desconectarlo antes desde el celular (${PHONE_PATH}). Desde ese momento hasta terminar, Powip no envía ni recibe por este número.`,
    ];
  }
  if (from === API) {
    return [
      "Meta pide quitar antes el número de la API (WhatsApp Manager) y registrarlo en la app WhatsApp Business del celular.",
      "Desde que lo quites hasta terminar la reconexión, no salen avisos ni entran mensajes en Powip.",
    ];
  }
  return [];
}

interface ChangeConnectionTypeDialogProps {
  storeName: string;
  target: WhatsAppConnectionType;
  /** Numbers of the store that are not of the target type yet. */
  candidates: WhatsAppAccount[];
  /** The store has more than one number: the person says which one, Powip never guesses. */
  askWhich: boolean;
  switchToApp?: (accountId: string) => Promise<void>;
  /** Meta has to take part: opens the reconnection window for that number. */
  onReconnect: (account: WhatsAppAccount) => void;
  onClose: () => void;
}

export function ChangeConnectionTypeDialog({
  storeName,
  target,
  candidates,
  askWhich,
  switchToApp,
  onReconnect,
  onClose,
}: ChangeConnectionTypeDialogProps) {
  const groupId = useId();
  const [pickedId, setPickedId] = useState<string | null>(askWhich ? null : candidates[0].id);
  const [chosen, setChosen] = useState(!askWhich);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const account = candidates.find((item) => item.id === pickedId) ?? null;
  const { title } = getConnectionTypeDefinition(target);
  const warnings = changeWarnings(account?.connectionType ?? null, target);
  const toApp = target === APP_MANUAL;

  const confirm = async () => {
    if (!account || saving) return;
    if (!toApp) {
      onReconnect(account);
      return;
    }
    if (!switchToApp) return;
    setSaving(true);
    setError(null);
    try {
      await switchToApp(account.id);
      onClose();
    } catch (caught) {
      setError(errorMessage(caught, "No se guardó el cambio. El número sigue como estaba."));
      setSaving(false);
    }
  };

  // Nothing to lose: the chosen number goes straight to Meta's window.
  const next = () => {
    if (!account) return;
    if (!changeWarnings(account.connectionType, target).length) onReconnect(account);
    else setChosen(true);
  };

  return (
    <AlertDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <AlertDialogContent
        className={cn(waDialogContent, "max-h-[calc(100dvh-2rem)] sm:max-w-[480px]")}
      >
        <AlertDialogHeader className={waDialogHeader}>
          <AlertDialogTitle className={waDialogTitle}>
            {chosen ? `Cambiar a «${title}»` : "¿Qué número quieres cambiar?"}
          </AlertDialogTitle>
        </AlertDialogHeader>
        <div className={cn(waDialogBody, "space-y-3 overflow-y-auto")}>
          <AlertDialogDescription className="m-0 text-sm text-wa-muted">
            {chosen
              ? `Número ${account?.phone ?? ""} de ${storeName}. Antes de seguir:`
              : `${storeName} tiene varios números. Elige cuál pasa a «${title}».`}
          </AlertDialogDescription>
          {chosen ? (
            <>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm text-wa-fg">
                {warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
                {account?.isCompanyDefault && (
                  <li>
                    Es el número de la empresa: el cambio afecta a todas las tiendas sin número
                    propio.
                  </li>
                )}
              </ul>
              {!toApp && (
                <p className="m-0 text-xs text-wa-muted">
                  La tarjeta marcada no cambia hasta que la reconexión termine.
                </p>
              )}
            </>
          ) : (
            <fieldset className="m-0 space-y-2 border-0 p-0">
              <legend className="sr-only">Número a cambiar</legend>
              {candidates.map((item) => (
                <label key={item.id} className="flex items-center gap-2.5 text-sm text-wa-fg">
                  <input
                    type="radio"
                    name={groupId}
                    checked={pickedId === item.id}
                    onChange={() => setPickedId(item.id)}
                  />
                  <span>
                    {item.phone ?? "Número sin teléfono informado"}
                    {item.connectionType &&
                      ` · ${getConnectionTypeDefinition(item.connectionType).title}`}
                    {item.assignedUserName && ` · ${item.assignedUserName}`}
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {error && (
            <p role="alert" className="m-0 text-sm text-wa-red">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter className={waDialogFooter}>
          <AlertDialogCancel className={waButton()} disabled={saving} onClick={onClose}>
            Cancelar
          </AlertDialogCancel>
          <Button
            type="button"
            className={waButton({ variant: "primary" })}
            disabled={!account || saving || (chosen && toApp && !switchToApp)}
            onClick={chosen ? confirm : next}
          >
            {!chosen
              ? "Seguir"
              : saving
                ? "Guardando…"
                : toApp
                  ? "Sí, cambiar"
                  : "Sí, volver a conectar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
