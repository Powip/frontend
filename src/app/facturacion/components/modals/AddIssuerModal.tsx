"use client";

import { Building2, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { VerifyIdentityButton } from "@/app/facturacion/components/VerifyIdentityButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IDENTITY_LOOKUP_DOCUMENT_TYPES } from "@/features/identity-lookup/enums/identity-lookup.enums";
import { formatSoles } from "@/features/sunat/extra-ruc/utils/ruc-slots";

/** El RUC de SUNAT: 11 dígitos y empieza con 10 o 20 (igual que el mockup). */
const RUC_PATTERN = /^(10|20)\d{9}$/;

export interface AddIssuerValues {
  ruc: string;
  razonSocial: string;
}

function formatIsoDay(value: string): string {
  const [year, month, day] = value.split("-");

  return `${day}/${month}/${year}`;
}

interface AddIssuerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: AddIssuerValues) => void;
  /** Precio mensual de cada RUC extra. */
  pricePerRuc: number;
  /**
   * true: este RUC se paga (add-on de S/ 30/mes, por adelantado con la pasarela).
   * false: hay un RUC incluido libre, no cuesta. null: no se sabe (lo decide el servidor al crearlo).
   */
  requiresPayment: boolean | null;
  /** RUC extra que ya se cobran cada mes; con este serían uno más. */
  renewingRucs: number;
  /** RUC ya conectados, para avisar que el RUC está repetido. */
  existingRucs: string[];
  /** Mientras se pide el pago a Flow. */
  isSubmitting?: boolean;
  /** Para activar un RUC que ya existe: se cargan sus datos y no se pueden cambiar. */
  initialValues?: AddIssuerValues;
  /** Renovar un cupo dado de baja que aún está pagado (yyyy-MM-dd): el mes nuevo empieza ese día. */
  paidUntil?: string | null;
}

/**
 * Modal "Agregar RUC emisor" del mockup: RUC, razón social (se completa al verificar), el aviso del add-on y los
 * botones Cancelar / Agregar RUC. Si el RUC se paga, al confirmar la pantalla lleva a la pasarela.
 * Con un RUC que ya existe (initialValues) los textos hablan de activarlo o de pagar su cupo, no de agregarlo.
 */
export function AddIssuerModal({
  isOpen,
  onClose,
  onConfirm,
  pricePerRuc,
  requiresPayment,
  renewingRucs,
  existingRucs,
  isSubmitting = false,
  initialValues,
  paidUntil = null,
}: AddIssuerModalProps) {
  const [ruc, setRuc] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRuc(initialValues?.ruc ?? "");
      setRazonSocial(initialValues?.razonSocial ?? "");
      setError(null);
    }
  }, [isOpen, initialValues]);

  const price = formatSoles(pricePerRuc);
  const afterCount = renewingRucs + 1;
  const locked = Boolean(initialValues);

  function handleSubmit() {
    const cleanRuc = ruc.trim();
    const cleanName = razonSocial.trim();

    if (!RUC_PATTERN.test(cleanRuc)) {
      setError("El RUC debe tener 11 dígitos y empezar con 10 o 20.");
      return;
    }

    if (!locked && existingRucs.includes(cleanRuc)) {
      setError("Ese RUC ya está conectado. Si está desactivado, actívalo desde Emisores (RUC).");
      return;
    }

    if (cleanName.length === 0) {
      setError("Verifica el RUC para completar la razón social.");
      return;
    }

    setError(null);
    onConfirm({ ruc: cleanRuc, razonSocial: cleanName });
  }

  const paysExisting = locked && requiresPayment !== false;
  const title = paidUntil
    ? "Renovar cupo del RUC"
    : paysExisting
      ? "Pagar cupo del RUC"
      : locked
        ? "Activar RUC emisor"
        : "Agregar RUC emisor";
  const description = paidUntil
    ? "Este RUC sigue activo. Renueva su cupo para que no se apague al terminar el mes pagado."
    : paysExisting
      ? "Paga el cupo mensual de este RUC para volver a emitir con él."
      : locked
        ? "Vuelve a activar este RUC para emitir con él."
        : "Conecta otra razón social para emitir los pedidos de tus tiendas. Después sube su certificado digital.";
  const confirmLabel = paysExisting
    ? `Pagar cupo (+S/ ${price}/mes)`
    : locked
      ? "Activar RUC (incluido)"
      : requiresPayment === false
        ? "Agregar RUC (incluido)"
        : `Agregar RUC (+S/ ${price}/mes)`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>

          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-issuer-ruc">RUC</Label>
            <Input
              id="add-issuer-ruc"
              value={ruc}
              inputMode="numeric"
              maxLength={11}
              placeholder="20xxxxxxxxx"
              readOnly={locked}
              onChange={(event) => {
                setRuc(event.target.value.replace(/\D/g, ""));
                setError(null);
              }}
            />
          </div>

          {!locked && (
            <VerifyIdentityButton
              documentType={IDENTITY_LOOKUP_DOCUMENT_TYPES.RUC}
              documentNumber={ruc}
              onVerified={(result) => {
                setRazonSocial(result.fullName);
                setError(null);
              }}
            />
          )}

          <div className="space-y-2">
            <Label htmlFor="add-issuer-razon">Razón social</Label>
            <Input
              id="add-issuer-razon"
              value={razonSocial}
              placeholder="Se completa al verificar"
              readOnly={locked}
              onChange={(event) => {
                setRazonSocial(event.target.value);
                setError(null);
              }}
            />
          </div>

          {requiresPayment !== false && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Este RUC es un <b>add-on de S/ {price}/mes</b>.
                {requiresPayment
                  ? ` Con él pasarías a pagar S/ ${formatSoles(afterCount * pricePerRuc)}/mes por RUC adicionales (${afterCount} adicional${afterCount === 1 ? "" : "es"}). `
                  : " "}
                Se paga <b>por adelantado</b>: al continuar vas a la pasarela de pago
                {paidUntil
                  ? "."
                  : " y, cuando se confirma, ya puedes subir su certificado y usarlo."}
              </p>
            </div>
          )}

          {paidUntil && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Este RUC ya está pagado hasta el <b>{formatIsoDay(paidUntil)}</b>. No se cobra dos
              veces: este pago cubre el mes siguiente, desde esa fecha, y vuelve a renovarse cada
              mes.
            </p>
          )}

          {requiresPayment === false && (
            <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              Tu plan incluye este RUC: no tiene costo. Después subes su certificado digital.
            </p>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? "Yendo a la pasarela…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
