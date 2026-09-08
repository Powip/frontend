"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Order } from "@/features/sales/models/order";
import { SUNAT_DOCUMENT_TYPES } from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import { toCreateSunatDocumentsRequestDto } from "@/features/sunat/sunat-document/mappers/to-create-sunat-documents-request-dto.mapper";
import {
  type CreateSunatDocumentsFormValues,
  createSunatDocumentsSchema,
} from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { buildSunatDocumentFromSale } from "@/features/sunat/sunat-document/utils/build-sunat-document-from-sale";

const PIPELINE_STEPS = [
  "Generando XML UBL 2.1",
  "Firmando digitalmente con certificado P12",
  "Enviando al OSE",
  "Esperando CDR de SUNAT",
];

interface LoteEmisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Order[];
  onEmissionFinished?: (response: unknown) => void;
}

type Step = "review" | "pipeline" | "ok" | "bad";

export default function LoteEmisionModal({
  isOpen,
  onClose,
  sales,
  onEmissionFinished,
}: LoteEmisionModalProps) {
  const createSunatDocuments = useCreateSunatDocuments();

  const [step, setStep] = useState<Step>("review");
  const [pipelineIndex, setPipelineIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Order -> SUNAT document mapping is centralized in the builder.
   *
   * The same builder is used by the single-emission modal.
   */
  const documents = sales.map(buildSunatDocumentFromSale);

  const invoiceCount = documents.filter(
    (document) => document.taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE,
  ).length;

  const salesReceiptCount = documents.filter(
    (document) => document.taxDocumentType === SUNAT_DOCUMENT_TYPES.SALES_RECEIPT,
  ).length;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setStep("review");
    setPipelineIndex(0);
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  function runPipelineAnimation() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setPipelineIndex(0);

    let index = 0;

    timerRef.current = setInterval(() => {
      index += 1;

      if (index >= PIPELINE_STEPS.length - 1) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }

      setPipelineIndex(Math.min(index, PIPELINE_STEPS.length - 1));
    }, 650);
  }

  async function handleSubmit() {
    const payload: CreateSunatDocumentsFormValues = {
      documents,
    };

    /*
     * Bulk emission does not use react-hook-form, so validate
     * the generated payload explicitly before sending it.
     */
    const parsed = createSunatDocumentsSchema.safeParse(payload);

    if (!parsed.success) {
      setStep("bad");
      return;
    }

    setStep("pipeline");
    runPipelineAnimation();

    try {
      // Convert form/schema types to clean API Request DTO (stripping nulls)
      const requestDto = toCreateSunatDocumentsRequestDto(parsed.data);

      const response = await createSunatDocuments.mutateAsync(requestDto);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setPipelineIndex(PIPELINE_STEPS.length);
      setStep("ok");

      /*
       * The API response is already the bulk response:
       *
       * {
       *   results: [
       *     SunatDocumentResponseDto |
       *     SunatDocumentBulkErrorResponseDto
       *   ]
       * }
       *
       * There is no CreateSunatDocumentSuccess.
       */
      onEmissionFinished?.(response);
    } catch {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setStep("bad");
    }
  }

  function handleClose() {
    if (createSunatDocuments.isPending) {
      return;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setStep("review");
    setPipelineIndex(0);

    onClose();
  }

  function handleRetry() {
    setStep("review");
    setPipelineIndex(0);
  }

  const isPending = createSunatDocuments.isPending;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[640px]">
        {step === "review" && (
          <>
            <DialogHeader className="shrink-0 border-b px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Emisión masiva de comprobantes
              </DialogTitle>

              <DialogDescription>
                Se emitirán <span className="font-bold text-foreground">{documents.length}</span>{" "}
                comprobantes electrónicos.
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border bg-muted/30 px-4 py-3">
                    <div className="text-sm text-muted-foreground">Total</div>

                    <div className="mt-1 text-2xl font-bold">{documents.length}</div>
                  </div>

                  <div className="rounded-md border bg-muted/30 px-4 py-3">
                    <div className="text-sm text-muted-foreground">Facturas</div>

                    <div className="mt-1 text-2xl font-bold">{invoiceCount}</div>
                  </div>

                  <div className="rounded-md border bg-muted/30 px-4 py-3">
                    <div className="text-sm text-muted-foreground">Boletas</div>

                    <div className="mt-1 text-2xl font-bold">{salesReceiptCount}</div>
                  </div>
                </div>

                <div className="rounded-md border">
                  <div className="border-b px-4 py-3">
                    <h3 className="font-semibold">Comprobantes a emitir</h3>
                  </div>

                  <div className="divide-y">
                    {documents.map((document) => (
                      <div
                        key={document.orderId}
                        className="flex items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-medium">{document.orderId}</div>

                          <div className="text-sm text-muted-foreground">
                            {document.taxDocumentType === SUNAT_DOCUMENT_TYPES.INVOICE
                              ? "Factura"
                              : "Boleta de Venta"}{" "}
                            · {document.series}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-medium">
                            {document.totals.currency} {document.totals.grandTotal.toFixed(2)}
                          </div>

                          <div className="text-sm text-muted-foreground">
                            {document.items.length} {document.items.length === 1 ? "ítem" : "ítems"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                  <p>
                    Cada comprobante será generado a partir de los datos de su venta
                    correspondiente.
                  </p>

                  <p className="mt-1">
                    Las facturas requieren información del cliente. En las boletas, el cliente es
                    opcional.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || documents.length === 0}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Emitiendo...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Emitir {documents.length} comprobantes
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pipeline" && (
          <>
            <DialogHeader className="px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Emitiendo comprobantes...
              </DialogTitle>

              <DialogDescription>
                Procesando {documents.length} comprobantes. No cierres esta ventana.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
              <EmisionPipeline steps={PIPELINE_STEPS} activeIndex={pipelineIndex} />
            </div>
          </>
        )}

        {step === "ok" && (
          <>
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">Emisión masiva procesada</h3>

              <p className="mt-2 text-sm text-muted-foreground">
                SUNAT/OSE procesó la solicitud de emisión de {documents.length} comprobantes.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button onClick={handleClose}>Ver resultados</Button>
            </DialogFooter>
          </>
        )}

        {step === "bad" && (
          <>
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">No se pudo procesar la emisión</h3>

              <p className="mt-3 text-sm text-red-600">
                Revisa los datos de las ventas seleccionadas e intenta nuevamente.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="ghost" onClick={handleClose}>
                Cerrar
              </Button>

              <Button onClick={handleRetry}>Revisar y reintentar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
