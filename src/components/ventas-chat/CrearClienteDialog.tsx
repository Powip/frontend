"use client";
import { useState } from "react";
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
import { PhoneInput } from "@/components/shared/PhoneInput";
import { toLocalPhone } from "@/lib/crmPhone";
import { createClient } from "@/services/clients.service";
import type { Client } from "@/interfaces/ICliente";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  /** Teléfono de la conversación (con código de país, solo dígitos). */
  phone: string;
  /** Nombre del perfil de WhatsApp, si lo hay. */
  name: string | null;
  onCreated: (client: Client) => void;
}

type TextField = "fullName" | "city" | "province" | "district" | "address";

/**
 * Alta mínima de cliente desde el chat: solo los campos obligatorios del DTO
 * de ms-ventas (nombre, teléfono, departamento, provincia, distrito, dirección).
 */
export default function CrearClienteDialog({
  open,
  onOpenChange,
  companyId,
  phone,
  name,
  onCreated,
}: Props) {
  const [form, setForm] = useState({
    fullName: name?.trim() ?? "",
    phoneNumber: toLocalPhone(phone),
    city: "",
    province: "",
    district: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const missing = (
    ["fullName", "phoneNumber", "city", "province", "district", "address"] as const
  ).filter((k) => !form[k].trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing.length > 0 || saving) return;
    setSaving(true);
    try {
      const client = await createClient({
        companyId,
        fullName: form.fullName.trim(),
        phoneNumber: form.phoneNumber,
        clientType: "TRADICIONAL",
        city: form.city.trim(),
        province: form.province.trim(),
        district: form.district.trim(),
        address: form.address.trim(),
      });
      toast.success("Cliente creado");
      onCreated(client);
      onOpenChange(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? "No se pudo crear el cliente";
      toast.error(Array.isArray(msg) ? msg.join(", ") : msg);
    } finally {
      setSaving(false);
    }
  };

  const field = (k: TextField, label: string) => (
    <div className="space-y-1">
      <Label htmlFor={`crm-cli-${k}`}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Input
        id={`crm-cli-${k}`}
        value={form[k]}
        onChange={(e) => set(k)(e.target.value)}
        maxLength={k === "address" || k === "fullName" ? 150 : 50}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-3">
          <DialogHeader>
            <DialogTitle>Crear cliente</DialogTitle>
            <DialogDescription>
              Se guarda en Clientes con el teléfono de esta conversación.
            </DialogDescription>
          </DialogHeader>
          {field("fullName", "Nombre completo")}
          <div className="space-y-1">
            <Label htmlFor="crm-cli-phone">
              Teléfono <span className="text-destructive">*</span>
            </Label>
            <PhoneInput
              id="crm-cli-phone"
              value={form.phoneNumber}
              onChange={set("phoneNumber")}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {field("city", "Departamento")}
            {field("province", "Provincia")}
            {field("district", "Distrito")}
          </div>
          {field("address", "Dirección")}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={missing.length > 0 || saving}>
              {saving && <Loader2 className="animate-spin" />} Crear cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
