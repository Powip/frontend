"use client";

import axios from "axios";
import { Camera, ImageIcon, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface OrderEvidence {
  id: string;
  orderId: string;
  type: "PREPARATION" | "DISPATCH";
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedByEmail: string;
  createdAt: string;
}

const MAX_FILES = 10;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface Props {
  orderId: string;
  canUpload?: boolean;
  accessToken?: string;
}

export function OrderEvidenceSection({ orderId, canUpload = false, accessToken }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const uploadSequence = useRef(0);
  const activeOrderId = useRef(orderId);
  activeOrderId.current = orderId;
  const [evidence, setEvidence] = useState<OrderEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<OrderEvidence | null>(null);

  const fetchEvidence = useCallback(async () => {
    const requestId = ++requestSequence.current;
    if (!orderId || !accessToken) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await axios.get<OrderEvidence[]>(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/evidence`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (requestId === requestSequence.current) {
        setEvidence(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      if (requestId === requestSequence.current) {
        console.error("Error cargando evidencia del pedido", error);
        toast.error("No se pudo cargar la evidencia de despacho");
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [accessToken, orderId]);

  useEffect(() => {
    setEvidence([]);
    setPreview(null);
    setUploading(false);
    fetchEvidence();
    return () => {
      requestSequence.current += 1;
      uploadSequence.current += 1;
    };
  }, [fetchEvidence]);

  const handleFiles = async (selected: FileList | null) => {
    const files = Array.from(selected ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;

    if (!accessToken) {
      toast.error("Tu sesión expiró. Vuelve a iniciar sesión para adjuntar fotos");
      return;
    }

    if (evidence.length + files.length > MAX_FILES) {
      toast.error(`El pedido admite como máximo ${MAX_FILES} evidencias`);
      return;
    }

    const invalidType = files.find((file) => !ALLOWED_MIME_TYPES.has(file.type));
    if (invalidType) {
      toast.error("Usa imágenes JPEG, PNG o WebP");
      return;
    }

    const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) {
      toast.error("Cada imagen debe pesar como máximo 5 MB");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("type", "DISPATCH");
    const uploadRequestId = ++uploadSequence.current;
    const uploadOrderId = orderId;

    try {
      setUploading(true);
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${uploadOrderId}/evidence`,
        formData,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (uploadRequestId !== uploadSequence.current || uploadOrderId !== activeOrderId.current) {
        return;
      }
      toast.success(
        files.length === 1 ? "Evidencia adjuntada" : `${files.length} evidencias adjuntadas`,
      );
      await fetchEvidence();
    } catch (error: unknown) {
      if (uploadRequestId === uploadSequence.current && uploadOrderId === activeOrderId.current) {
        const responseMessage = axios.isAxiosError<{ message?: string }>(error)
          ? error.response?.data?.message
          : undefined;
        toast.error(responseMessage || "No se pudo adjuntar la evidencia");
      }
    } finally {
      if (uploadRequestId === uploadSequence.current) {
        setUploading(false);
      }
    }
  };

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Camera className="h-5 w-5" /> Evidencia de despacho
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Fotografías del paquete preparado para este pedido.
          </p>
        </div>

        {canUpload && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              aria-label="Tomar o subir fotos de evidencia"
              onChange={(event) => handleFiles(event.target.files)}
            />
            <Button
              type="button"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={!accessToken || uploading || evidence.length >= MAX_FILES}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              {uploading ? "Subiendo..." : "Tomar o subir fotos"}
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando evidencia...
        </div>
      ) : evidence.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-muted/60 px-3 py-4 text-sm text-muted-foreground">
          <ImageIcon className="h-4 w-4" /> Este pedido aún no tiene fotografías.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {evidence.map((item) => (
            <button
              type="button"
              key={item.id}
              className="overflow-hidden rounded-md border bg-muted text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              onClick={() => setPreview(item)}
              aria-label={`Ver evidencia ${item.originalName}`}
            >
              {/* URL firmada y host configurable: <img> evita acoplarla a la
                  lista estática de dominios de next/image. */}
              {/* biome-ignore lint/performance/noImgElement: la URL firmada usa un host configurable */}
              <img
                src={item.url}
                alt={`Evidencia de despacho: ${item.originalName}`}
                className="aspect-square w-full object-cover"
              />
              <span className="block truncate px-2 pt-2 text-xs font-medium">
                {item.originalName}
              </span>
              <span className="block px-2 pb-2 text-[10px] text-muted-foreground">
                {new Date(item.createdAt).toLocaleString("es-PE")}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Evidencia de despacho</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-2">
              {/* biome-ignore lint/performance/noImgElement: la URL firmada usa un host configurable */}
              <img
                src={preview.url}
                alt={`Evidencia de despacho: ${preview.originalName}`}
                className="max-h-[70vh] w-full rounded-md object-contain"
              />
              <p className="text-xs text-muted-foreground">
                Subida por {preview.uploadedByEmail} el{" "}
                {new Date(preview.createdAt).toLocaleString("es-PE")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
