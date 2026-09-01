"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { ItemsEditTable } from "@/app/facturacion/components/ItemsEditTable";
import { VerifyIdentityButton } from "@/app/facturacion/components/VerifyIdentityButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toIdentityLookupDocumentType } from "@/features/identity-lookup/adapters/to-identity-lookup-document-type.adapter";
import type { IdentityLookupResult } from "@/features/identity-lookup/models/identity-lookup-result.model";
import {
  IDENTITY_DOCUMENT_TYPES,
  SUNAT_DOCUMENT_TYPES,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { createSunatDocumentsSchema } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { buildSunatDocumentFromSale } from "@/features/sunat/sunat-document/utils/build-sunat-document-from-sale";
import type { Order } from "@/models/sales/order";

const PIPELINE_STEPS = [
  "Generando XML UBL 2.1",
  "Firmando digitalmente con certificado P12",
  "Enviando al OSE",
  "Esperando CDR de SUNAT",
];

interface EmitirComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Order;
  onEmissionFinished?: (response: unknown) => void;
}

type Step = "form" | "pipeline" | "ok" | "bad";

function getCustomerFormValues(
  sale: Order,
): NonNullable<CreateSunatDocumentsFormValues["documents"][number]["customer"]> {
  const documentType = sale.customer.documentType;

  const identityDocumentType =
    documentType === "RUC"
      ? IDENTITY_DOCUMENT_TYPES.RUC
      : documentType === "CARNET"
        ? IDENTITY_DOCUMENT_TYPES.CARNET_EXTRANJERIA
        : documentType === "PASAPORTE"
          ? IDENTITY_DOCUMENT_TYPES.PASAPORTE
          : IDENTITY_DOCUMENT_TYPES.DNI;

  return {
    name: sale.customer.fullName,
    identityDocumentType,
    identityDocumentNumber: sale.customer.documentNumber,
    countryCode: "PE",
    address: sale.customer.address,
  };
}

export default function EmitirComprobanteModal({
  isOpen,
  onClose,
  sale,
  onEmissionFinished,
}: EmitirComprobanteModalProps) {
  const createSunatDocuments = useCreateSunatDocuments();

  const form = useForm<CreateSunatDocumentsFormValues>({
    resolver: zodResolver(createSunatDocumentsSchema),
    defaultValues: {
      documents: [buildSunatDocumentFromSale(sale)],
    },
    mode: "onBlur",
  });

  const [step, setStep] = useState<Step>("form");
  const [pipelineIndex, setPipelineIndex] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const documentType = useWatch({
    control: form.control,
    name: "documents.0.taxDocumentType",
  });

  const totals = useWatch({
    control: form.control,
    name: "documents.0.totals",
  });

  const customerIdentityDocumentType = useWatch({
    control: form.control,
    name: "documents.0.customer.identityDocumentType",
  });

  const customerIdentityDocumentNumber = useWatch({
    control: form.control,
    name: "documents.0.customer.identityDocumentNumber",
  });

  const isInvoice = documentType === SUNAT_DOCUMENT_TYPES.INVOICE;
  const grandTotal = Number(totals?.grandTotal ?? 0);
  const isCustomerRequired = isInvoice || grandTotal >= 700;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const document = buildSunatDocumentFromSale(sale);

    form.reset({
      documents: [document],
    });

    setStep("form");
    setPipelineIndex(0);
  }, [isOpen, sale, form]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!documentType) {
      return;
    }

    form.setValue(
      "documents.0.series",
      documentType === SUNAT_DOCUMENT_TYPES.INVOICE ? "F001" : "B001",
      {
        shouldValidate: true,
      },
    );

    const customer = form.getValues("documents.0.customer");
    if (
      !customer &&
      (documentType === SUNAT_DOCUMENT_TYPES.INVOICE || sale.customer?.documentNumber)
    ) {
      form.setValue("documents.0.customer", getCustomerFormValues(sale), {
        shouldValidate: true,
      });
    }
  }, [documentType, form, sale]);

  function runPipelineAnimation() {
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

  async function handleSubmit(values: CreateSunatDocumentsFormValues) {
    setStep("pipeline");
    runPipelineAnimation();

    try {
      // Map null -> undefined for payload compatibility
      const payload = {
        ...values,
        documents: values.documents.map((doc) => ({
          ...doc,
          customer: doc.customer
            ? {
                name: doc.customer.name ?? undefined,
                identityDocumentType: doc.customer.identityDocumentType ?? undefined,
                identityDocumentNumber: doc.customer.identityDocumentNumber ?? undefined,
                countryCode: doc.customer.countryCode ?? undefined,
                address: doc.customer.address ?? undefined,
              }
            : undefined,
        })),
      };

      const response = await createSunatDocuments.mutateAsync(payload);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setPipelineIndex(PIPELINE_STEPS.length);
      setStep("ok");

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

    form.reset();
    setStep("form");
    setPipelineIndex(0);

    onClose();
  }

  function handleRetry() {
    setStep("form");
    setPipelineIndex(0);
  }

  function handleIdentityVerified(result: IdentityLookupResult) {
    form.setValue("documents.0.customer.name", result.fullName, {
      shouldValidate: true,
      shouldDirty: true,
    });

    // Only invoices show/require the address field, and RUC is the only
    // lookup document type that ever returns one - so this only ever
    // fires when it's actually relevant to fill.
    if (result.address) {
      form.setValue("documents.0.customer.address", result.address, {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
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
      <DialogContent className="flex max-h-[90vh] flex-col p-0 sm:max-w-[720px]">
        {step === "form" && (
          <>
            <DialogHeader className="shrink-0 border-b px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Emitir Comprobante Electrónico
              </DialogTitle>

              <DialogDescription>
                Venta <span className="font-bold text-foreground">{sale.orderNumber}</span> — Total{" "}
                <span className="font-bold text-primary">
                  {totals?.currency ?? "PEN"} {grandTotal.toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex min-h-0 flex-1 flex-col"
              >
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <div className="grid gap-5">
                    <FormField
                      control={form.control}
                      name="documents.0.taxDocumentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Comprobante</FormLabel>

                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>

                            <SelectContent>
                              <SelectItem value={SUNAT_DOCUMENT_TYPES.SALES_RECEIPT}>
                                Boleta de Venta
                              </SelectItem>

                              <SelectItem value={SUNAT_DOCUMENT_TYPES.INVOICE}>Factura</SelectItem>
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid gap-5 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="documents.0.series"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Serie</FormLabel>

                            <FormControl>
                              <Input {...field} readOnly />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-2">
                        <Label>Venta</Label>

                        <Input value={sale.orderNumber} readOnly />
                      </div>
                    </div>

                    <div className="space-y-4 rounded-md border p-4">
                      <div className="flex items-center justify-between gap-4">
                        <Label className="font-semibold">
                          Datos del cliente{" "}
                          {!isCustomerRequired && (
                            <span className="text-xs font-normal text-muted-foreground">
                              (Opcional para boletas &lt; S/ 700)
                            </span>
                          )}
                        </Label>

                        <VerifyIdentityButton
                          documentType={toIdentityLookupDocumentType(customerIdentityDocumentType)}
                          documentNumber={customerIdentityDocumentNumber}
                          onVerified={handleIdentityVerified}
                        />
                      </div>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="documents.0.customer.identityDocumentType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo Doc.</FormLabel>

                              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Sin documento" />
                                  </SelectTrigger>
                                </FormControl>

                                <SelectContent>
                                  {isInvoice ? (
                                    <SelectItem value={IDENTITY_DOCUMENT_TYPES.RUC}>RUC</SelectItem>
                                  ) : (
                                    <>
                                      <SelectItem value={IDENTITY_DOCUMENT_TYPES.DNI}>
                                        DNI
                                      </SelectItem>
                                      <SelectItem value={IDENTITY_DOCUMENT_TYPES.RUC}>
                                        RUC
                                      </SelectItem>
                                      <SelectItem
                                        value={IDENTITY_DOCUMENT_TYPES.CARNET_EXTRANJERIA}
                                      >
                                        CE
                                      </SelectItem>
                                      <SelectItem value={IDENTITY_DOCUMENT_TYPES.PASAPORTE}>
                                        Pasaporte
                                      </SelectItem>
                                    </>
                                  )}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="documents.0.customer.identityDocumentNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Número Doc.</FormLabel>

                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder={isInvoice ? "20601234567" : "71234567"}
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="documents.0.customer.name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre / Razón Social</FormLabel>

                            <FormControl>
                              <Input
                                {...field}
                                value={field.value ?? ""}
                                placeholder="Ej. Juan Pérez / Cliente Varios"
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {isInvoice && (
                        <FormField
                          control={form.control}
                          name="documents.0.customer.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección Fiscal</FormLabel>

                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ""}
                                  placeholder="Av. Larco 123, Miraflores"
                                />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>

                    <FormField
                      control={form.control}
                      name="documents.0.items"
                      render={() => (
                        <FormItem>
                          <FormLabel>Ítems del pedido</FormLabel>

                          <FormControl>
                            <ItemsEditTable />
                          </FormControl>

                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span>

                        <span>
                          {totals?.currency ?? "PEN"} {Number(totals?.subtotal ?? 0).toFixed(2)}
                        </span>
                      </div>

                      {Number(totals?.discountTotal ?? 0) > 0 && (
                        <div className="mt-1 flex justify-between text-muted-foreground">
                          <span>Descuento</span>

                          <span>
                            - {totals?.currency ?? "PEN"} {Number(totals.discountTotal).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {Number(totals?.shippingTotal ?? 0) > 0 && (
                        <div className="mt-1 flex justify-between text-muted-foreground">
                          <span>Envío</span>

                          <span>
                            {totals?.currency ?? "PEN"} {Number(totals.shippingTotal).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="mt-1 flex justify-between text-muted-foreground">
                        <span>IGV (18%)</span>

                        <span>
                          {totals?.currency ?? "PEN"} {Number(totals?.taxTotal ?? 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                        <span>Total</span>

                        <span className="text-primary">
                          {totals?.currency ?? "PEN"} {grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <DialogFooter className="shrink-0 border-t px-6 py-4">
                  <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
                    Cancelar
                  </Button>

                  <Button type="submit" disabled={isPending}>
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Emitiendo...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Emitir a SUNAT
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}

        {step === "pipeline" && (
          <>
            <DialogHeader className="px-6 py-5">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Emitiendo comprobante...
              </DialogTitle>

              <DialogDescription>
                Venta {sale.orderNumber} — no cierres esta ventana
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

              <h3 className="text-lg font-bold">¡Comprobante enviado correctamente!</h3>

              <p className="mt-2 text-sm text-muted-foreground">
                SUNAT/OSE procesó la solicitud de emisión.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="ghost" onClick={handleClose}>
                Cerrar
              </Button>

              <Button onClick={handleClose}>Ver comprobante completo</Button>
            </DialogFooter>
          </>
        )}

        {step === "bad" && (
          <>
            <div className="px-6 py-8 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">No se pudo emitir el comprobante</h3>

              <p className="mt-3 text-sm text-red-600">
                SUNAT/OSE rechazó o no pudo procesar la solicitud.
              </p>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="ghost" onClick={handleClose}>
                Cerrar
              </Button>

              <Button onClick={handleRetry}>Corregir datos y reintentar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
