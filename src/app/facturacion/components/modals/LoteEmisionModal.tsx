"use client";

import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { IssuerSelectField } from "@/app/facturacion/components/IssuerSelectField";
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
import {
  describeLinesWithoutValue,
  findLinesWithoutValue,
} from "@/features/sunat/sunat-document/utils/find-lines-without-value";
import { getEmissionErrorMessage } from "@/features/sunat/sunat-document/utils/get-emission-error-message";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import { useIssuerSelection } from "@/features/sunat/sunat-profile/hooks/use-issuer-selection";

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
  /** Multi-RUC: RUC preselected in the facturación bar. Default profile otherwise. */
  issuerProfileId?: string;
}

type Step = "review" | "pipeline" | "ok" | "bad";

export default function LoteEmisionModal({
  isOpen,
  onClose,
  sales,
  onEmissionFinished,
  issuerProfileId,
}: LoteEmisionModalProps) {
  const createSunatDocuments = useCreateSunatDocuments();

  // Multi-RUC: every document of the batch is signed, numbered and sent with
  // this RUC, using that RUC's default series.
  const issuer = useIssuerSelection(issuerProfileId, isOpen);
  const { data: sequences = [], isLoading: isLoadingSequences } = useSunatDocumentSequences(
    issuer.selected?.id,
    { enabled: isOpen && !issuer.isLoading },
  );

  const [step, setStep] = useState<Step>("review");
  const [pipelineIndex, setPipelineIndex] = useState(0);
  // Outcome of the last submission. It is kept apart from `sales` because
  // the parent clears the selection as soon as the emission finishes.
  const [outcome, setOutcome] = useState<{ issued: number; failures: string[] }>({
    issued: 0,
    failures: [],
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Order -> SUNAT document mapping is centralized in the builder.
   *
   * The same builder is used by the single-emission modal.
   */
  const allDocuments = sales.map((sale) => {
    const document = buildSunatDocumentFromSale(sale);
    const defaultSequence = sequences.find(
      (sequence) => sequence.taxDocumentType === document.taxDocumentType && sequence.isDefault,
    );

    return {
      ...document,
      // Same rule as the single-emission modal: the RUC's default series,
      // falling back to the builder's canonical series (F001/B001).
      series: defaultSequence?.series ?? document.series,
      sunatProfileId: issuer.selected?.id,
    };
  });

  /*
   * Sales SUNAT would reject for a line worth S/ 0.00 (error 3105) are left
   * out of the batch instead of blocking it: the rest is issued, and these
   * are listed with their reason. Sending them would spend a number each.
   */
  const skippedSales = allDocuments.flatMap((document) => {
    const lines = findLinesWithoutValue(document.items);

    if (lines.length === 0) {
      return [];
    }

    const sale = sales.find((candidate) => candidate.id === document.orderId);

    return [
      { orderId: document.orderId, orderNumber: sale?.orderNumber ?? document.orderId, lines },
    ];
  });

  const documents = allDocuments.filter(
    (document) => !skippedSales.some((skipped) => skipped.orderId === document.orderId),
  );

  // A second RUC has no series until they're configured for it: block
  // instead of letting every document fail on the backend.
  const missingSeriesTypes = issuer.isMultiRuc
    ? [...new Set(documents.map((document) => document.taxDocumentType))].filter(
        (type) =>
          !sequences.some((sequence) => sequence.taxDocumentType === type && sequence.isDefault),
      )
    : [];
  const isMissingSeries = !isLoadingSequences && missingSeriesTypes.length > 0;
  const isIssuerBlocked = issuer.blockReason !== null;

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

      // The endpoint answers 201 even when some documents were not created:
      // each failure travels inside the response with its own reason.
      const failures = response.errors.map((failure) => {
        const sale = sales.find((candidate) => candidate.id === failure.orderId);

        return `${sale?.orderNumber ?? failure.orderId}: ${getEmissionErrorMessage(failure)}`;
      });

      setOutcome({ issued: response.documents.length, failures });
      setPipelineIndex(PIPELINE_STEPS.length);
      setStep(response.documents.length > 0 ? "ok" : "bad");

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

      setOutcome({ issued: 0, failures: [] });
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
                <IssuerSelectField
                  selection={issuer}
                  disabled={isPending}
                  hint={
                    issuer.isMultiRuc
                      ? "Todos los comprobantes del lote se emitirán con este RUC."
                      : undefined
                  }
                />

                {skippedSales.length > 0 && (
                  <div
                    role="alert"
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm dark:border-red-900 dark:bg-red-950/40"
                  >
                    <p className="font-semibold">
                      {skippedSales.length === 1
                        ? "1 venta no se emitirá en este lote porque tiene una línea en S/ 0.00:"
                        : `${skippedSales.length} ventas no se emitirán en este lote porque tienen una línea en S/ 0.00:`}
                    </p>

                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {skippedSales.map((skipped) => (
                        <li key={skipped.orderId}>
                          {skipped.orderNumber}: {describeLinesWithoutValue(skipped.lines)}
                        </li>
                      ))}
                    </ul>

                    <p className="mt-1">
                      SUNAT rechaza el comprobante completo cuando una línea no tiene valor (error
                      3105) y el número se pierde. Emítelas una por una para corregir esa línea.
                    </p>
                  </div>
                )}

                {isMissingSeries && (
                  <div
                    role="alert"
                    className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <span className="font-semibold">
                      El RUC {issuer.selected?.ruc} no tiene serie predeterminada para{" "}
                      {missingSeriesTypes
                        .map((type) =>
                          type === SUNAT_DOCUMENT_TYPES.INVOICE ? "Factura" : "Boleta",
                        )
                        .join(" y ")}
                      .{" "}
                    </span>
                    Configúrala en la pestaña &quot;Series y Correlativos&quot; antes de emitir.
                  </div>
                )}

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
                disabled={isPending || documents.length === 0 || isMissingSeries || isIssuerBlocked}
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
                {outcome.issued === 1
                  ? "Se envió 1 comprobante a SUNAT."
                  : `Se enviaron ${outcome.issued} comprobantes a SUNAT.`}
              </p>

              {outcome.failures.length > 0 && (
                <div className="mt-4 text-left text-sm text-red-600">
                  <p className="font-medium">
                    {outcome.failures.length === 1
                      ? "1 venta no se pudo emitir:"
                      : `${outcome.failures.length} ventas no se pudieron emitir:`}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {outcome.failures.map((failure) => (
                      <li key={failure}>{failure}</li>
                    ))}
                  </ul>
                </div>
              )}
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

              {outcome.failures.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-left text-sm text-red-600">
                  {outcome.failures.map((failure) => (
                    <li key={failure}>{failure}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-red-600">
                  Revisa los datos de las ventas seleccionadas e intenta nuevamente.
                </p>
              )}
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
