"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import { isAxiosError } from "axios";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InventoryItemForSale } from "@/interfaces/IProduct";
import {
  updateProductImage,
  validateProductImage,
} from "@/services/productImageService";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

interface Props {
  item: InventoryItemForSale;
  onClose: () => void;
  onSuccess: (imageUrl: string) => void | Promise<void>;
  onCloseAutoFocus?: () => void;
}

export default function EditProductImageModal({ item, onClose, onSuccess, onCloseAutoFocus }: Props) {
  const inputId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleSave = async () => {
    if (!file || isSaving) return;
    setIsSaving(true);
    setError(null);
    let imageUrl: string;
    try {
      imageUrl = await updateProductImage({
        productId: item.productId,
        variantId: item.variantId,
        file,
      });
    } catch (err) {
      const serverMessage = isAxiosError(err)
        ? err.response?.data?.message
        : err instanceof Error ? err.message : null;
      const message = typeof serverMessage === "string"
        ? serverMessage
        : "No se pudo cambiar la imagen. Intenta nuevamente.";
      setError(message);
      toast.error(message);
      setIsSaving(false);
      return;
    }
    try {
      await onSuccess(imageUrl);
      toast.success("Imagen del producto actualizada");
    } catch {
      toast.warning("Imagen guardada, pero no se pudo actualizar el almacén. Recarga la página.");
    } finally {
      setIsSaving(false);
      onClose();
    }
  };

  const displayedImage = previewUrl || item.imageUrl;

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent
        className="max-w-md"
        aria-busy={isSaving}
        showCloseButton={!isSaving}
        onEscapeKeyDown={(event) => isSaving && event.preventDefault()}
        onInteractOutside={(event) => isSaving && event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (onCloseAutoFocus) {
            event.preventDefault();
            onCloseAutoFocus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Cambiar imagen</DialogTitle>
          <DialogDescription>
            {item.productName}. La imagen se actualizará para todas las variantes
            y almacenes de este producto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex h-48 items-center justify-center rounded-md bg-muted">
            {displayedImage ? (
              <Image
                src={displayedImage}
                alt={`Vista previa de ${item.productName}`}
                width={240}
                height={192}
                unoptimized
                className="h-full w-full rounded-md object-contain"
              />
            ) : (
              <ImagePlus className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={inputId}>Seleccionar nueva imagen</Label>
            <Input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={isSaving}
              aria-describedby={`${inputId}-help${error ? ` ${inputId}-error` : ""}`}
              aria-invalid={Boolean(error)}
              onChange={(event) => {
                const selectedFile = event.target.files?.[0] ?? null;
                const validationError = selectedFile ? validateProductImage(selectedFile) : null;
                setError(validationError);
                setFile(validationError ? null : selectedFile);
                if (validationError) event.target.value = "";
              }}
            />
            <p id={`${inputId}-help`} className="text-xs text-muted-foreground">
              JPG, PNG, WebP o GIF. Máximo 5 MB.
            </p>
            {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!file || isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {isSaving ? "Guardando..." : "Guardar imagen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
