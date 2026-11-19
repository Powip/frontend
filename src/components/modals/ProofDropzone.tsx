"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, FileText, ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface ProofDropzoneProps {
  /** Archivo ya elegido (solo variante "full", muestra vista previa). */
  file?: File | null;
  /** Se llama con el archivo elegido, o con null al quitarlo. */
  onFile: (file: File | null) => void;
  /** Valor para el atributo accept del selector de archivos. */
  accept: string;
  /** Valida tipo y tamaño. Debe avisar con un toast si falla. */
  validate: (file: File) => boolean;
  disabled?: boolean;
  /** Nombre accesible del selector de archivos. */
  inputLabel?: string;
  /** id del selector de archivos. */
  inputId?: string;
  /** Muestra "Subiendo..." (variante compacta, la subida es inmediata). */
  busy?: boolean;
  /** "full": zona grande con vista previa. "compact": botón con arrastrar. */
  variant?: "full" | "compact";
  /** Acepta Ctrl+V en cualquier parte de la pantalla mientras esté montado. */
  globalPaste?: boolean;
}

/** Saca el primer archivo de un DataTransfer (arrastrar o pegar). */
function pickFile(dt: DataTransfer | null): { file: File | null; count: number } {
  if (!dt) return { file: null, count: 0 };
  if (dt.files && dt.files.length > 0) {
    return { file: dt.files[0], count: dt.files.length };
  }
  const files: File[] = [];
  for (const item of Array.from(dt.items || [])) {
    if (item.kind === "file") {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  return { file: files[0] ?? null, count: files.length };
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProofDropzone({
  file = null,
  onFile,
  accept,
  validate,
  disabled = false,
  inputLabel,
  inputId,
  busy = false,
  variant = "full",
  globalPaste = false,
}: ProofDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const accepted = useCallback(
    (candidate: File | null, count = 1) => {
      if (disabled || busy || !candidate) return;
      if (count > 1) {
        toast.info("Se usó solo la primera imagen. Cada pago lleva un comprobante.");
      }
      if (validate(candidate)) onFile(candidate);
    },
    [disabled, busy, validate, onFile],
  );

  // Ctrl+V en cualquier parte: solo actúa si el portapapeles trae un archivo.
  useEffect(() => {
    if (!globalPaste || disabled) return;
    const handler = (e: ClipboardEvent) => {
      const { file: pasted, count } = pickFile(e.clipboardData);
      if (!pasted) return;
      e.preventDefault();
      accepted(pasted, count);
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [globalPaste, disabled, accepted]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const { file: dropped, count } = pickFile(e.dataTransfer);
    if (!dropped) {
      toast.error(
        "No se pudo tomar la imagen arrastrada (WhatsApp Web no entrega el archivo). Copia la imagen (clic derecho → Copiar imagen) y pégala aquí con Ctrl+V.",
      );
      return;
    }
    accepted(dropped, count);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !busy) setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setDragging(false);
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (globalPaste) return; // ya lo maneja el listener global
    const { file: pasted, count } = pickFile(e.clipboardData);
    if (pasted) accepted(pasted, count);
    else toast.error("No hay una imagen en el portapapeles.");
  };

  const handlePasteButton = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) {
          const blob = await item.getType(type);
          accepted(new File([blob], `pegado.${type.split("/")[1]}`, { type }));
          return;
        }
      }
      toast.error("No hay una imagen en el portapapeles.");
    } catch {
      toast.error("No se pudo leer el portapapeles. Usa Ctrl+V.");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    e.target.value = "";
    accepted(selected);
  };

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      id={inputId}
      aria-label={inputLabel}
      accept={accept}
      className="hidden"
      onChange={handleInputChange}
    />
  );

  if (variant === "compact") {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`flex items-center gap-2 rounded-md border border-dashed px-2 py-1 ${
          dragging ? "border-primary bg-primary/10" : "border-muted-foreground/30"
        }`}
      >
        {hiddenInput}
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? (
            <>
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <ImagePlus className="h-3 w-3 mr-1" />
              Agregar comprobante
            </>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">o arrastra la imagen aquí</span>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
        dragging ? "border-primary bg-primary/10" : "border-muted-foreground/30"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {hiddenInput}
      {file ? (
        <div className="flex items-center gap-3 text-left">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Vista previa del comprobante"
              className="h-16 w-16 rounded object-cover border"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded border bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            <p className="text-xs text-muted-foreground">
              Suelta o pega otra imagen para reemplazarla.
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Quitar comprobante"
            disabled={disabled}
            onClick={() => onFile(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-1">
          <UploadCloud className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm">Arrastra aquí la imagen del comprobante</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="h-3 w-3 mr-1" />
              Elegir archivo
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={disabled}
              onClick={handlePasteButton}
            >
              <ClipboardPaste className="h-3 w-3 mr-1" />
              Pegar imagen
            </Button>
          </div>
          {/* Campo editable solo para que el clic derecho muestre «Pegar». No acepta texto. */}
          <div
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-label="Pegar imagen del portapapeles"
            spellCheck={false}
            onBeforeInput={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey) && (e.key.length === 1 || e.key === "Enter")) {
                e.preventDefault();
              }
            }}
            onPaste={handlePasteEvent}
            className="cursor-default select-none caret-transparent text-xs text-muted-foreground outline-none rounded px-2 py-1 focus:bg-muted"
          >
            o copia la imagen y pégala: Ctrl+V, o clic derecho aquí → Pegar
          </div>
        </div>
      )}
    </div>
  );
}
