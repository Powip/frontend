"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WaDialogClose } from "@/components/whatsapp/ui/WaDialogClose";
import {
  waButton,
  waDialogBody,
  waDialogContent,
  waDialogHeader,
  waDialogTitle,
  waField,
  waInput,
  waLabel,
} from "@/components/whatsapp/ui/wa-classes";
import { APP_ONLY_LIMITATIONS } from "@/features/whatsapp/constants/whatsapp-connection-catalog";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";
import {
  type ConnectionMutations,
  errorMessage,
  type NumberRole,
  signupReassign,
} from "./connection-types";
import { isRoleComplete, NumberRoleField } from "./NumberRoleField";

interface AppOnlyNumberDialogProps {
  storeId: string;
  storeName: string;
  connectAppOnly: ConnectionMutations["connectAppOnly"];
  agents?: WhatsAppAgentOption[];
  /** La tienda ya envía por la API: este número podría quedar como principal. */
  storeSendsByApi?: boolean;
  onClose: () => void;
}

/** Alta de un número que vive solo en la app del celular: sin Meta ni token. */
export function AppOnlyNumberDialog({
  storeId,
  storeName,
  connectAppOnly,
  agents = [],
  storeSendsByApi = false,
  onClose,
}: AppOnlyNumberDialogProps) {
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"store" | "seller">("store");
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [askReassign, setAskReassign] = useState<string | null>(null);
  const [state, setState] = useState<
    { kind: "idle" | "pending" } | { kind: "error"; message: string }
  >({ kind: "idle" });
  const complete = !!phone.trim() && isRoleComplete(role, sellerId);

  const submit = async (confirmReassign = false) => {
    if (!connectAppOnly || !complete || state.kind === "pending") return;
    setAskReassign(null);
    setState({ kind: "pending" });
    const seller = agents.find((agent) => agent.id === sellerId) ?? null;
    try {
      await connectAppOnly({
        storeId,
        phoneNumber: phone.trim(),
        role,
        seller: role === "seller" && seller ? { id: seller.id, name: seller.name } : null,
        ...(confirmReassign ? { confirmReassign: true } : {}),
      });
      onClose();
    } catch (caught) {
      if (!confirmReassign && signupReassign(caught)) {
        setState({ kind: "idle" });
        setAskReassign(errorMessage(caught, "Ese número ya está en otra tienda."));
        return;
      }
      setState({ kind: "error", message: errorMessage(caught, "No se pudo guardar el número.") });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && state.kind !== "pending" && onClose()}>
      <DialogContent showCloseButton={false} className={cn(waDialogContent, "sm:max-w-[520px]")}>
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Número solo app para {storeName}</DialogTitle>
          <WaDialogClose onClick={onClose} />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex flex-col gap-3.5")}>
          <DialogDescription className="m-0 text-[13px] text-wa-muted">
            El número sigue solo en la app del celular. Powip deja cada aviso escrito en la bandeja
            de envío asistido y una persona lo envía.
          </DialogDescription>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[12.5px]">
            {APP_ONLY_LIMITATIONS.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <X className="mt-[3px] size-3.5 shrink-0 text-wa-red" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          {storeSendsByApi && (
            <p className="m-0 rounded-[10px] border border-wa-border bg-wa-surface-2 p-3 text-[13px]">
              {storeName} ya envía por la API. Si este número queda como principal, los avisos
              dejarán de salir solos y pasarán a la bandeja de envío asistido.
            </p>
          )}
          <label className={waField}>
            <span className={waLabel}>Número de WhatsApp</span>
            <input
              className={waInput}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="987 654 321"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <NumberRoleField
            storeName={storeName}
            role={role}
            roles={["store", "seller"]}
            onRoleChange={(next: NumberRole) => setRole(next === "seller" ? "seller" : "store")}
            sellerId={sellerId}
            onSellerChange={setSellerId}
            agents={agents}
            disabled={state.kind === "pending"}
          />
          {state.kind === "error" && (
            <p role="alert" className="m-0 text-[13px] text-wa-red">
              {state.message}
            </p>
          )}
          {askReassign ? (
            <div role="alert" className="flex flex-col gap-2.5">
              <p className="m-0 text-[13px] text-wa-red">{askReassign}</p>
              <Button
                type="button"
                className={waButton({ variant: "primary" })}
                onClick={() => void submit(true)}
              >
                Sí, mover el número
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              className={waButton({ variant: "primary" })}
              disabled={!complete || state.kind === "pending" || !connectAppOnly}
              onClick={() => void submit()}
            >
              {state.kind === "pending" ? "Guardando…" : "Guardar número"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
