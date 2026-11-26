"use client";

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
  waHint,
  waInput,
  waLabel,
} from "@/components/whatsapp/ui/wa-classes";
import type { WhatsAppAgentOption } from "@/features/whatsapp/models/conversation.model";
import { cn } from "@/lib/utils";
import {
  type ConnectionMutations,
  errorMessage,
  needsCoexistenceConfirmation,
  type NumberRole,
} from "./connection-types";
import { isRoleComplete, NoCoexistenceDialog, NumberRoleField } from "./NumberRoleField";

interface ManualNumberDialogProps {
  storeId: string;
  storeName: string;
  connectManual: ConnectionMutations["connectManual"];
  agents?: WhatsAppAgentOption[];
  onClose: () => void;
}

const FIELDS = [
  { key: "businessPhoneNumber", label: "Número (con código de país)", placeholder: "51987654321" },
  { key: "phoneNumberId", label: "Phone number ID", placeholder: "Desde WhatsApp Manager" },
  { key: "wabaId", label: "WABA ID", placeholder: "Cuenta de WhatsApp Business" },
  { key: "accessToken", label: "Token de acceso", placeholder: "Token del usuario del sistema" },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

/** Alta manual de un número (sin Facebook): datos de WhatsApp Manager. Suma un número, no reemplaza. */
export function ManualNumberDialog({
  storeId,
  storeName,
  connectManual,
  agents = [],
  onClose,
}: ManualNumberDialogProps) {
  const [role, setRole] = useState<NumberRole>("store");
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [askCoexistence, setAskCoexistence] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    businessPhoneNumber: "",
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
  });
  const [state, setState] = useState<
    { kind: "idle" | "pending" } | { kind: "error"; message: string }
  >({
    kind: "idle",
  });
  const complete =
    FIELDS.every((field) => values[field.key].trim()) && isRoleComplete(role, sellerId);

  // Primero se consulta a Meta (en el backend): si el número no tiene coexistencia, el
  // backend responde sin conectar nada y aquí se pregunta antes de volver a enviar.
  const submit = async (confirmNoCoexistence = false) => {
    if (!connectManual || !complete || state.kind === "pending") return;
    setState({ kind: "pending" });
    const seller = agents.find((agent) => agent.id === sellerId) ?? null;
    try {
      await connectManual({
        storeId,
        businessPhoneNumber: values.businessPhoneNumber.replace(/\D/g, ""),
        phoneNumberId: values.phoneNumberId.trim(),
        wabaId: values.wabaId.trim(),
        accessToken: values.accessToken.trim(),
        role,
        seller: role === "seller" && seller ? { id: seller.id, name: seller.name } : null,
        ...(confirmNoCoexistence ? { confirmNoCoexistence: true } : {}),
      });
      onClose();
    } catch (caught) {
      if (!confirmNoCoexistence && needsCoexistenceConfirmation(caught)) {
        setState({ kind: "idle" });
        setAskCoexistence(true);
        return;
      }
      setState({ kind: "error", message: errorMessage(caught, "No se pudo agregar el número.") });
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && state.kind !== "pending" && onClose()}>
      <DialogContent showCloseButton={false} className={cn(waDialogContent, "sm:max-w-[520px]")}>
        <DialogHeader className={waDialogHeader}>
          <DialogTitle className={waDialogTitle}>Agregar número manual a {storeName}</DialogTitle>
          <WaDialogClose onClick={onClose} />
        </DialogHeader>
        <div className={cn(waDialogBody, "flex flex-col gap-3.5")}>
          <DialogDescription className="m-0 text-[13px] text-wa-muted">
            Copia los datos desde WhatsApp Manager. El número se suma a los que ya tiene la tienda;
            no reemplaza a ninguno.
          </DialogDescription>
          {FIELDS.map((field) => (
            <label key={field.key} className={waField}>
              <span className={waLabel}>{field.label}</span>
              <input
                className={waInput}
                type={field.key === "accessToken" ? "password" : "text"}
                autoComplete="off"
                placeholder={field.placeholder}
                value={values[field.key]}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            </label>
          ))}
          <NumberRoleField
            storeName={storeName}
            role={role}
            onRoleChange={setRole}
            sellerId={sellerId}
            onSellerChange={setSellerId}
            agents={agents}
            disabled={state.kind === "pending"}
          />
          <p className={cn(waHint, "m-0")}>
            El token se guarda cifrado en POWIP y no se vuelve a mostrar.
          </p>
          {state.kind === "error" && (
            <p role="alert" className="m-0 text-[13px] text-wa-red">
              {state.message}
            </p>
          )}
          <Button
            type="button"
            className={waButton({ variant: "primary" })}
            disabled={!complete || state.kind === "pending" || !connectManual}
            onClick={() => void submit()}
          >
            {state.kind === "pending" ? "Agregando…" : "Agregar número"}
          </Button>
        </div>
      </DialogContent>
      <NoCoexistenceDialog
        open={askCoexistence}
        onCancel={() => {
          setAskCoexistence(false);
          setState({ kind: "error", message: "No se conectó el número." });
        }}
        onConfirm={() => {
          setAskCoexistence(false);
          void submit(true);
        }}
      />
    </Dialog>
  );
}
