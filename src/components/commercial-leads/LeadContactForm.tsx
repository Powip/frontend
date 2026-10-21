"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  commercialLeadError,
  createCommercialLead,
  updateCommercialLead,
} from "@/services/commercialLeadsService";
import type {
  CreateLeadInput,
  Lead,
  LeadDetail,
  LeadFieldDefinition,
  LeadType,
} from "@/types/leads";
import { leadCommandId, leadCustomValues } from "./lead-ui";

const control = "w-full rounded-md border bg-background px-3 py-2 text-sm";
export function LeadCustomFields({
  fields,
  values,
  onChange,
  disabled,
}: {
  fields: LeadFieldDefinition[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <Label htmlFor={`lead-field-${field.key}`}>
            {field.label}
            {field.required ? " *" : ""}
          </Label>
          {field.type === "boolean" ? (
            <select
              id={`lead-field-${field.key}`}
              className={control}
              required={field.required}
              disabled={disabled}
              value={values[field.key] == null ? "" : String(values[field.key])}
              onChange={(event) =>
                onChange({ ...values, [field.key]: event.target.value })
              }
            >
              <option value="">Sin indicar</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          ) : (
            <Input
              id={`lead-field-${field.key}`}
              type={
                field.type === "number"
                  ? "number"
                  : field.type === "date"
                    ? "date"
                    : "text"
              }
              step={field.type === "number" ? "any" : undefined}
              required={field.required}
              disabled={disabled}
              maxLength={field.type === "text" ? 2000 : undefined}
              value={String(values[field.key] ?? "")}
              onChange={(event) =>
                onChange({ ...values, [field.key]: event.target.value })
              }
            />
          )}
        </div>
      ))}
    </>
  );
}
export default function LeadContactForm({
  lead,
  types,
  stores,
  defaultStoreId,
  onSaved,
  onCancel,
}: {
  lead?: LeadDetail;
  types: LeadType[];
  stores: Array<{ id: string; name: string }>;
  defaultStoreId?: string | null;
  onSaved: (lead: Lead) => void;
  onCancel: () => void;
}) {
  const [typeCode, setTypeCode] = useState(
    lead?.typeCode ?? types.find((type) => type.active)?.code ?? "",
  );
  const [storeId, setStoreId] = useState(lead?.storeId ?? defaultStoreId ?? "");
  const [name, setName] = useState(lead?.contactName ?? ""),
    [phone, setPhone] = useState(lead?.contactPhone ?? ""),
    [email, setEmail] = useState(lead?.contactEmail ?? "");
  const [amount, setAmount] = useState(lead?.estimatedAmount ?? ""),
    [currency, setCurrency] = useState(lead?.currency ?? ""),
    [channel, setChannel] = useState(lead?.initialChannel ?? "");
  const [customFields, setCustomFields] = useState<Record<string, unknown>>(
    lead?.customFields ?? {},
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [pendingCreate, setPendingCreate] = useState(false);
  const command = useRef<CreateLeadInput | null>(null);
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const fieldsDisabled = busy || pendingCreate;
  const currentType =
    types.find((type) => type.code === typeCode) ?? lead?.type;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    if (!command.current && !name.trim() && !phone.trim() && !email.trim()) {
      setError("Indica un nombre, teléfono o correo del contacto.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const values = {
        contactName: name.trim() || null,
        contactPhone: phone.trim() || null,
        contactEmail: email.trim() || null,
        estimatedAmount: amount === "" ? null : Number(amount),
        currency: currency.trim().toUpperCase() || null,
        customFields: leadCustomValues(currentType?.fields ?? [], customFields),
      };
      if (!lead && !command.current) {
        command.current = {
          captureId: leadCommandId(),
          typeCode,
          storeId: storeId || null,
          initialChannel: channel.trim() || null,
          ...values,
        };
        setPendingCreate(true);
      }
      const saved = lead
        ? await updateCommercialLead(lead.id, {
            version: lead.version,
            ...values,
          })
        : await createCommercialLead(command.current!);
      if (mounted.current) {
        command.current = null;
        setPendingCreate(false);
        onSaved(saved);
      }
    } catch (failure) {
      if (mounted.current) setError(commercialLeadError(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <form
      onSubmit={save}
      className="space-y-5"
      aria-label={lead ? "Editar Lead" : "Crear Lead"}
    >
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {!lead ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="lead-type">Tipo de lead</Label>
            <select
              id="lead-type"
              required
              className={control}
              value={typeCode}
              disabled={fieldsDisabled}
              onChange={(event) => {
                setTypeCode(event.target.value);
                setCustomFields({});
              }}
            >
              <option value="">Selecciona un tipo</option>
              {types
                .filter((type) => type.active)
                .map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="lead-store">Tienda del Lead</Label>
            <select
              id="lead-store"
              className={control}
              value={storeId}
              disabled={fieldsDisabled}
              onChange={(event) => setStoreId(event.target.value)}
            >
              <option value="">Sin tienda asignada</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="lead-name">Nombre del contacto</Label>
          <Input
            id="lead-name"
            maxLength={150}
            value={name}
            disabled={fieldsDisabled}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-phone">Teléfono del contacto</Label>
          <Input
            id="lead-phone"
            type="tel"
            maxLength={40}
            value={phone}
            disabled={fieldsDisabled}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="lead-email">Correo del contacto</Label>
        <Input
          id="lead-email"
          type="email"
          maxLength={254}
          value={email}
          disabled={fieldsDisabled}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="lead-amount">Importe estimado</Label>
          <Input
            id="lead-amount"
            type="number"
            min="0"
            max="9999999999.99"
            step="0.01"
            value={amount}
            disabled={fieldsDisabled}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="lead-currency">Moneda</Label>
          <Input
            id="lead-currency"
            placeholder="PEN, USD…"
            maxLength={3}
            pattern="[A-Z]{3}"
            required={amount !== ""}
            value={currency}
            disabled={fieldsDisabled}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
          />
        </div>
      </div>
      {!lead ? (
        <div className="space-y-1">
          <Label htmlFor="lead-channel">Canal de origen</Label>
          <Input
            id="lead-channel"
            maxLength={100}
            value={channel}
            disabled={fieldsDisabled}
            onChange={(event) => setChannel(event.target.value)}
          />
        </div>
      ) : null}
      <LeadCustomFields
        fields={currentType?.fields ?? []}
        values={customFields}
        onChange={setCustomFields}
        disabled={fieldsDisabled}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button disabled={busy || (!lead && !typeCode)}>
          {busy
            ? "Guardando…"
            : lead
              ? "Guardar datos"
              : pendingCreate
                ? "Reintentar el mismo Lead"
                : "Registrar Lead"}
        </Button>
      </div>
    </form>
  );
}
