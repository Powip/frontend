"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  LABEL_FIELDS,
  LABEL_FIELD_NAMES,
  LABEL_OUTPUT_NAMES,
  LABEL_SIZES,
  hasScanField,
  type LabelField,
  type LabelFormat,
  type LabelOutput,
} from "@/lib/labels/types";
import { createLabelFormat, labelsErrorMessage, updateLabelFormat } from "@/services/labelsService";
import { LabelPreview } from "./LabelPreview";

const NAME_REQUIRED = "Ponle un nombre al formato.";
const SCAN_REQUIRED = "La etiqueta necesita código de barras o QR para poder escanearse.";

interface LabelFormatEditorProps {
  open: boolean;
  /** `null` crea un formato nuevo. */
  format: LabelFormat | null;
  companyName?: string | null;
  onClose: () => void;
  onSaved: (format: LabelFormat) => void;
}

/** FEAT-24 H7 — crear o editar un formato de etiqueta, con vista previa en vivo. Solo lo abre el administrador. */
export function LabelFormatEditor({ open, format, companyName, onClose, onSaved }: LabelFormatEditorProps) {
  const [name, setName] = useState(format?.name ?? "");
  const [size, setSize] = useState(format ? `${format.widthMm}x${format.heightMm}` : "50x25");
  const [output, setOutput] = useState<LabelOutput>(format?.output ?? "termica");
  const [fields, setFields] = useState<LabelField[]>(format?.fields ?? ["name", "variant", "price", "barcode"]);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [widthMm, heightMm] = size.split("x").map(Number);
  const draft = { name, widthMm, heightMm, output, fields };
  const problem = !name.trim() ? NAME_REQUIRED : !hasScanField(fields) ? SCAN_REQUIRED : null;

  const toggle = (field: LabelField) =>
    setFields((current) =>
      current.includes(field) ? current.filter((f) => f !== field) : LABEL_FIELDS.filter((f) => f === field || current.includes(f)),
    );

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { ...draft, name: name.trim(), isDefault };
      const saved = format ? await updateLabelFormat(format.id, input) : await createLabelFormat(input);
      onSaved(saved);
    } catch (err) {
      setError(labelsErrorMessage(err, "No se pudo guardar el formato."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{format ? "Editar formato" : "Nuevo formato de etiqueta"}</DialogTitle>
          <DialogDescription>Elige qué datos van. Se guarda para futuras impresiones.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="label-format-name">Nombre del formato</Label>
              <Input
                id="label-format-name"
                value={name}
                maxLength={60}
                placeholder="Ej. Precio con logo"
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="label-format-size">Tamaño</Label>
                <select
                  id="label-format-size"
                  className="w-full rounded-md border p-2 text-sm"
                  value={size}
                  onChange={(event) => setSize(event.target.value)}
                >
                  {LABEL_SIZES.map(([w, h]) => (
                    <option key={`${w}x${h}`} value={`${w}x${h}`}>
                      {w}×{h} mm
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="label-format-output">Impresora</Label>
                <select
                  id="label-format-output"
                  className="w-full rounded-md border p-2 text-sm"
                  value={output}
                  onChange={(event) => setOutput(event.target.value as LabelOutput)}
                >
                  {(Object.keys(LABEL_OUTPUT_NAMES) as LabelOutput[]).map((value) => (
                    <option key={value} value={value}>
                      {LABEL_OUTPUT_NAMES[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Qué va en la etiqueta</legend>
              <div className="flex flex-wrap gap-2">
                {LABEL_FIELDS.map((field) => {
                  const active = fields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggle(field)}
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground hover:bg-muted"
                      }`}
                    >
                      {LABEL_FIELD_NAMES[field]}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Ubicación y lote se imprimen cuando el producto los tenga. El logo usa el de la empresa o, si no hay, su nombre.
              </p>
            </fieldset>
            {format?.isDefault ? (
              <p className="text-sm text-muted-foreground">Es el formato predeterminado de la empresa.</p>
            ) : (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
                Usar este formato para todos los productos
              </label>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Vista previa</p>
            <div className="flex min-h-40 items-center justify-center rounded-md bg-muted/40 p-3">
              <LabelPreview format={draft} companyName={companyName || "LOGO"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {widthMm}×{heightMm} mm · {LABEL_OUTPUT_NAMES[output]} · datos de ejemplo
            </p>
          </div>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar formato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
