"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  bootstrapCommercialLeadTypes,
  commercialLeadError,
  createCommercialLeadType,
  updateCommercialLeadType,
} from "@/services/commercialLeadsService";
import type { LeadFieldDefinition, LeadType } from "@/types/leads";

export default function LeadTypeCatalog({
  types,
  onChanged,
}: {
  types: LeadType[];
  onChanged: () => void;
}) {
  const [name, setName] = useState(""),
    [code, setCode] = useState("");
  const [fields, setFields] = useState<LeadFieldDefinition[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function mutate(action: () => Promise<unknown>, after?: () => void) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (mounted.current) {
        after?.();
        onChanged();
      }
    } catch (failure) {
      if (mounted.current) setError(commercialLeadError(failure));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    await mutate(
      () => createCommercialLeadType({ code, name, fields }),
      () => {
        setCode("");
        setName("");
        setFields([]);
      },
    );
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Los tipos se configuran para este negocio. Desactivar un tipo conserva
        sus Leads y su historial. Los campos se definen al crearlo.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        {types.map((type) => (
          <div
            key={type.code}
            className="flex items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div>
              <p className="font-medium">{type.name}</p>
              <p className="text-xs text-muted-foreground">
                {type.code} · {type.fields.length} campos ·{" "}
                {type.active ? "Activo" : "Inactivo"}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() =>
                void mutate(() =>
                  updateCommercialLeadType(type.code, { active: !type.active }),
                )
              }
            >
              {type.active ? "Desactivar" : "Activar"} {type.name}
            </Button>
          </div>
        ))}
      </div>
      {!types.length ? (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => void mutate(bootstrapCommercialLeadTypes)}
        >
          Instalar tipos iniciales
        </Button>
      ) : null}
      <form
        onSubmit={create}
        className="space-y-4 border-t pt-5"
        aria-label="Crear tipo de lead"
      >
        <h3 className="font-semibold">Nuevo tipo</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="type-name">Nombre del tipo</Label>
            <Input
              id="type-name"
              required
              maxLength={100}
              disabled={busy}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="type-code">Código del tipo</Label>
            <Input
              id="type-code"
              required
              pattern="[A-Z][A-Z0-9_]{0,59}"
              maxLength={60}
              placeholder="EVENTO_LOCAL"
              disabled={busy}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </div>
        </div>
        {fields.map((field, index) => (
          <fieldset key={index} className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm">Campo {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor={`field-label-${index}`}>Etiqueta</Label>
                <Input
                  id={`field-label-${index}`}
                  required
                  disabled={busy}
                  value={field.label}
                  onChange={(event) =>
                    setFields(
                      fields.map((v, i) =>
                        i === index ? { ...v, label: event.target.value } : v,
                      ),
                    )
                  }
                />
              </div>
              <div>
                <Label htmlFor={`field-key-${index}`}>Clave</Label>
                <Input
                  id={`field-key-${index}`}
                  required
                  pattern="[a-z][a-zA-Z0-9_]{0,59}"
                  disabled={busy}
                  value={field.key}
                  onChange={(event) =>
                    setFields(
                      fields.map((v, i) =>
                        i === index ? { ...v, key: event.target.value } : v,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm">
                Tipo de campo{" "}
                <select
                  className="rounded-md border bg-background p-2"
                  disabled={busy}
                  value={field.type}
                  onChange={(event) =>
                    setFields(
                      fields.map((v, i) =>
                        i === index
                          ? {
                              ...v,
                              type: event.target
                                .value as LeadFieldDefinition["type"],
                            }
                          : v,
                      ),
                    )
                  }
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="boolean">Sí / No</option>
                  <option value="date">Fecha</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={field.required ?? false}
                  onChange={(event) =>
                    setFields(
                      fields.map((v, i) =>
                        i === index
                          ? { ...v, required: event.target.checked }
                          : v,
                      ),
                    )
                  }
                />
                Obligatorio
              </label>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setFields(fields.filter((_, i) => i !== index))}
              >
                Quitar campo {index + 1}
              </Button>
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={busy || fields.length >= 30}
            onClick={() =>
              setFields([
                ...fields,
                { key: "", label: "", type: "text", required: false },
              ])
            }
          >
            Añadir campo
          </Button>
          <Button disabled={busy}>{busy ? "Guardando…" : "Crear tipo"}</Button>
        </div>
      </form>
    </div>
  );
}
