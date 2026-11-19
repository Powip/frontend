"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import { PAYMENT_TERMS, PAYMENT_TERMS_LABEL } from "@/lib/purchaseOrders";
import { isValidRuc } from "@/lib/ruc";
import {
  createPurchaseSupplier,
  updatePurchaseSupplier,
  type PurchaseSupplier,
  type SaveSupplierBody,
  type SupplierPaymentTerms,
} from "@/services/purchasesService";
import { SELECT_CLASS } from "./PurchaseBits";

// FEAT-24 H3-E — alta y edición de un proveedor de compras (mockup mProv): RUC
// (opcional, pero si se escribe tiene que ser válido), razón social, nombre
// comercial, dirección fiscal, contacto y condición de pago. Con compras no se
// borra: se desactiva.

interface Props {
  supplier: PurchaseSupplier | null;
  onClose: () => void;
  onSaved: (supplier: PurchaseSupplier) => void;
}

interface Form {
  ruc: string;
  businessName: string;
  tradeName: string;
  fiscalAddress: string;
  contactPerson: string;
  phone: string;
  email: string;
  paymentTerms: SupplierPaymentTerms;
  active: boolean;
}

const nullable = (value: string) => (value.trim() === "" ? null : value.trim());

export function supplierFormProblem(form: Form): string | null {
  const ruc = form.ruc.trim();
  if (ruc && !isValidRuc(ruc)) return "El RUC no es válido.";
  if (!form.businessName.trim() && !form.tradeName.trim()) return "Escribe la razón social o el nombre comercial.";
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Revisa el correo.";
  return null;
}

export default function SupplierFormDialog({ supplier, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Form>(() => ({
    ruc: supplier?.ruc ?? "",
    businessName: supplier?.businessName ?? (supplier && !supplier.tradeName ? supplier.name : ""),
    tradeName: supplier?.tradeName ?? "",
    fiscalAddress: supplier?.fiscalAddress ?? "",
    contactPerson: supplier?.contactPerson ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    paymentTerms: supplier?.paymentTerms ?? "contado",
    active: supplier?.active ?? true,
  }));
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (patch: Partial<Form>) => {
    setError(null);
    setForm((current) => ({ ...current, ...patch }));
  };
  const problem = supplierFormProblem(form);
  const rucProblem = form.ruc.trim() && !isValidRuc(form.ruc.trim()) ? "El RUC no es válido." : null;

  const save = useMutation({
    mutationFn: () => {
      const body: SaveSupplierBody = {
        name: form.tradeName.trim() || form.businessName.trim(),
        businessName: nullable(form.businessName),
        tradeName: nullable(form.tradeName),
        ruc: nullable(form.ruc),
        fiscalAddress: nullable(form.fiscalAddress),
        contactPerson: nullable(form.contactPerson),
        phone: nullable(form.phone),
        email: nullable(form.email),
        paymentTerms: form.paymentTerms,
      };
      return supplier ? updatePurchaseSupplier(supplier.id, { ...body, active: form.active }) : createPurchaseSupplier(body);
    },
    onSuccess: (saved) => {
      toast.success(supplier ? "Proveedor actualizado" : "Proveedor creado");
      onSaved(saved);
    },
    onError: (failure) => setError(warehouseErrorMessage(failure, "No se pudo guardar el proveedor. Inténtalo de nuevo.")),
  });
  const busy = save.isPending;

  const field = (id: keyof Form, label: string, props: { placeholder?: string; maxLength?: number; mono?: boolean; type?: string } = {}) => (
    <div className="space-y-1">
      <Label htmlFor={`supplier-${id}`}>{label}</Label>
      <Input
        id={`supplier-${id}`}
        className={props.mono ? "font-mono" : undefined}
        type={props.type}
        placeholder={props.placeholder}
        maxLength={props.maxLength ?? 255}
        value={form[id] as string}
        disabled={busy}
        onChange={(e) => change({ [id]: e.target.value } as Partial<Form>)}
      />
    </div>
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
          <DialogDescription>Con RUC para el registro de compras.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="supplier-ruc">RUC (opcional)</Label>
            <Input
              id="supplier-ruc"
              className="font-mono"
              inputMode="numeric"
              maxLength={11}
              placeholder="20xxxxxxxxx"
              value={form.ruc}
              disabled={busy}
              aria-invalid={rucProblem ? true : undefined}
              onChange={(e) => change({ ruc: e.target.value.replace(/\D/g, "") })}
            />
            {rucProblem ? <p className="text-xs text-destructive">{rucProblem}</p> : null}
          </div>
          {field("businessName", "Razón social")}
          {field("tradeName", "Nombre comercial")}
          {field("fiscalAddress", "Dirección fiscal", { maxLength: 500 })}
          {field("contactPerson", "Contacto")}
          {field("phone", "Teléfono", { maxLength: 50 })}
          {field("email", "Correo", { type: "email" })}
          <div className="space-y-1">
            <Label htmlFor="supplier-terms">Condición de pago</Label>
            <select
              id="supplier-terms"
              className={SELECT_CLASS}
              value={form.paymentTerms}
              disabled={busy}
              onChange={(e) => change({ paymentTerms: e.target.value as SupplierPaymentTerms })}
            >
              {PAYMENT_TERMS.map((terms) => (
                <option key={terms} value={terms}>
                  {PAYMENT_TERMS_LABEL[terms]}
                </option>
              ))}
            </select>
          </div>
          {supplier ? (
            <div className="flex items-center gap-3 pt-6">
              <Switch id="supplier-active" checked={form.active} disabled={busy} onCheckedChange={(active) => change({ active })} />
              <Label htmlFor="supplier-active">Activo</Label>
            </div>
          ) : null}
        </div>

        {touched && problem && problem !== rucProblem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || !!rucProblem}
            onClick={() => {
              setTouched(true);
              if (!problem) save.mutate();
            }}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
