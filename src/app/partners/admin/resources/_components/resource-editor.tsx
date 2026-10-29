"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AdminResourceOperation } from "@/features/partners/hooks/use-admin-resources";
import type { AdminResource } from "@/features/partners/models/admin-resource";
import {
  adminResourceMetadataCommandSchema,
  adminResourceTransitionCommandSchema,
} from "@/features/partners/schemas/admin-resources.schema";

export function ResourceEditor({
  resource,
  isPending,
  onWrite,
}: {
  resource?: AdminResource;
  isPending: boolean;
  onWrite: (input: AdminResourceOperation) => void;
}) {
  const prefix = `resource-${resource?.id ?? "new"}`;
  const [values, setValues] = useState({
    country: resource?.country ?? "",
    kind: resource?.kind ?? "",
    category: resource?.category ?? "",
    title: resource?.title ?? "",
    description: resource?.description ?? "",
    publicUrl: resource?.publicUrl ?? "",
    sortOrder: resource ? String(resource.sortOrder) : "",
    reason: "",
  });
  const [validation, setValidation] = useState<string | null>(null);
  function field(name: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [name]: value }));
    setValidation(null);
  }
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = adminResourceMetadataCommandSchema.safeParse({
      ...values,
      description: values.description === "" ? null : values.description,
      publicUrl: values.publicUrl === "" ? null : values.publicUrl,
      sortOrder: Number(values.sortOrder),
    });
    if (!/^-?\d+$/.test(values.sortOrder) || !parsed.success) {
      setValidation(
        "Revisá país ISO de 2 letras, tipo, título, categoría, orden entero, URL HTTPS sin credenciales/query/fragmento y motivo obligatorio. El servidor verifica el país y el host autorizado.",
      );
      return;
    }
    onWrite(
      resource
        ? {
            operation: "revise",
            resourceId: resource.id,
            command: { ...parsed.data, expectedVersion: resource.version },
          }
        : { operation: "create", command: parsed.data },
    );
  }
  function transition(operation: "publish" | "unpublish" | "archive") {
    if (!resource) return;
    const parsed = adminResourceTransitionCommandSchema.safeParse({
      expectedVersion: resource.version,
      reason: values.reason,
    });
    if (!parsed.success) {
      setValidation("Escribí un motivo válido antes de cambiar el estado.");
      return;
    }
    onWrite({ operation, resourceId: resource.id, command: parsed.data });
  }
  const editable = !resource || resource.state === "DRAFT";
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">
        {resource
          ? `Recurso ${resource.id} · ${resource.state} · versión ${resource.version}`
          : "Crear recurso DRAFT"}
      </h3>
      {resource?.state === "ARCHIVED" ? (
        <p>El recurso está archivado. No admite cambios.</p>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <fieldset disabled={isPending} className="space-y-3">
            {editable && (
              <>
                {(
                  [
                    ["country", "País ISO", 2],
                    ["category", "Categoría", 80],
                    ["title", "Título", 200],
                    ["publicUrl", "URL pública HTTPS (opcional)", 2048],
                    ["sortOrder", "Orden", 8],
                  ] as const
                ).map(([name, label, maxLength]) => (
                  <div key={name}>
                    <Label htmlFor={`${prefix}-${name}`}>{label}</Label>
                    <Input
                      id={`${prefix}-${name}`}
                      value={values[name]}
                      maxLength={maxLength}
                      required={name !== "publicUrl"}
                      onChange={(event) => field(name, event.target.value)}
                    />
                  </div>
                ))}
                <div>
                  <Label htmlFor={`${prefix}-kind`}>Tipo</Label>
                  <select
                    id={`${prefix}-kind`}
                    required
                    className="ml-2 rounded border p-2"
                    value={values.kind}
                    onChange={(event) => field("kind", event.target.value)}
                  >
                    <option value="">Seleccionar tipo</option>
                    <option value="VIDEO">VIDEO</option>
                    <option value="PDF">PDF</option>
                    <option value="LOGOS">LOGOS</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor={`${prefix}-description`}>Descripción (opcional)</Label>
                  <Textarea
                    id={`${prefix}-description`}
                    maxLength={1000}
                    value={values.description}
                    onChange={(event) => field("description", event.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor={`${prefix}-reason`}>
                Motivo {resource ? "del cambio" : "de creación"}
              </Label>
              <Textarea
                id={`${prefix}-reason`}
                required
                maxLength={2000}
                value={values.reason}
                onChange={(event) => field("reason", event.target.value)}
              />
            </div>
            {validation && (
              <p role="alert" className="text-sm text-destructive">
                {validation}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {editable && (
                <Button type="submit">{resource ? "Guardar revisión DRAFT" : "Crear DRAFT"}</Button>
              )}
              {resource?.state === "DRAFT" && (
                <Button
                  type="button"
                  disabled={!resource.publicUrl}
                  onClick={() => transition("publish")}
                >
                  Publicar recurso
                </Button>
              )}
              {resource?.state === "PUBLISHED" && (
                <Button type="button" onClick={() => transition("unpublish")}>
                  Retirar publicación
                </Button>
              )}
              {resource && (
                <Button type="button" variant="outline" onClick={() => transition("archive")}>
                  Archivar recurso
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      )}
    </section>
  );
}
