"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasAdminAccess, isSuperadmin } from "@/config/permissions.config";
import { useAuth } from "@/contexts/AuthContext";
import { labelFormatsKey, useLabelFormats } from "@/hooks/useLabelFormats";
import { LABEL_FIELDS, LABEL_FIELD_NAMES, LABEL_OUTPUT_NAMES, type LabelFormat } from "@/lib/labels/types";
import { labelsErrorMessage, setDefaultLabelFormat } from "@/services/labelsService";
import { LabelFormatEditor } from "./LabelFormatEditor";
import { LabelPreview } from "./LabelPreview";
import { PrintLabelsDialog } from "./PrintLabelsDialog";

/**
 * FEAT-24 H7 — Catálogo › Etiquetas: formatos guardados de la empresa, con vista previa; el administrador
 * los crea, edita y elige el predeterminado. Desde acá también se imprime por catálogo, categoría o marca.
 */
export default function LabelFormatsView() {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const canEdit = isSuperadmin(auth?.user?.email) || hasAdminAccess(auth?.user?.role);
  const queryClient = useQueryClient();
  const formats = useLabelFormats();
  /** `undefined` cerrado; `null` formato nuevo. */
  const [editing, setEditing] = useState<LabelFormat | null | undefined>(undefined);
  const [printing, setPrinting] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: labelFormatsKey(companyId) });
  const makeDefault = useMutation({
    mutationFn: setDefaultLabelFormat,
    onSuccess: (format) => {
      toast.success(`«${format.name}» queda como formato predeterminado`);
      void refresh();
    },
    onError: (error) => toast.error(labelsErrorMessage(error, "No se pudo cambiar el formato predeterminado.")),
  });

  return (
    <div className="space-y-4 p-6">
      <HeaderConfig title="Etiquetas" description="Formatos de etiqueta de producto">
        <Button variant="outline" onClick={() => setPrinting(true)} disabled={!formats.data?.length}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir etiquetas
        </Button>
        {canEdit ? (
          <Button onClick={() => setEditing(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo formato
          </Button>
        ) : null}
      </HeaderConfig>
      <p className="text-sm text-muted-foreground">
        Cada formato define el tamaño, la impresora y qué datos lleva la etiqueta. Todas usan el código de la variante (el EAN
        de fábrica o el código POWIP), así lo que se pega es lo mismo que se escanea al recibir, contar, vender y despachar.
        El predeterminado es el que se propone al imprimir.
      </p>

      {formats.isError ? (
        <div role="alert" className="space-x-2">
          <span>{labelsErrorMessage(formats.error, "No se pudieron cargar los formatos.")}</span>
          <Button variant="outline" onClick={() => void formats.refetch()}>
            Reintentar
          </Button>
        </div>
      ) : formats.isPending ? (
        <p role="status">Cargando formatos...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {formats.data.map((format) => (
            <Card key={format.id} data-testid="label-format-card" className={format.isDefault ? "border-primary" : undefined}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{format.name}</h3>
                  <Badge variant="outline">
                    {format.widthMm}×{format.heightMm} mm
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {LABEL_OUTPUT_NAMES[format.output]} ·{" "}
                  {LABEL_FIELDS.filter((field) => format.fields.includes(field))
                    .map((field) => LABEL_FIELD_NAMES[field])
                    .join(" · ")}
                </p>
                <div className="flex justify-center rounded-md bg-muted/40 p-2">
                  <LabelPreview format={format} companyName={auth?.company?.name || "LOGO"} pxPerMm={2.4} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {format.isDefault ? (
                    <Badge>Predeterminado</Badge>
                  ) : canEdit ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={makeDefault.isPending}
                      onClick={() => makeDefault.mutate(format.id)}
                      aria-label={`Usar «${format.name}» para todos`}
                    >
                      Usar para todos
                    </Button>
                  ) : null}
                  {canEdit ? (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(format)} aria-label={`Editar «${format.name}»`}>
                      <Pencil className="mr-1 h-4 w-4" />
                      Editar
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing !== undefined ? (
        <LabelFormatEditor
          key={editing?.id ?? "nuevo"}
          open
          format={editing}
          companyName={auth?.company?.name}
          onClose={() => setEditing(undefined)}
          onSaved={(saved) => {
            toast.success(`Formato «${saved.name}» guardado`);
            setEditing(undefined);
            void refresh();
          }}
        />
      ) : null}
      {printing ? <PrintLabelsDialog open source={{ kind: "catalog" }} onOpenChange={setPrinting} /> : null}
    </div>
  );
}
