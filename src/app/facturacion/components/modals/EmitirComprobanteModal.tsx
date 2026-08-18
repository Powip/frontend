"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, FileText, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { ItemsEditTable } from "@/app/facturacion/components/ItemsEditTable";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
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
import {
  CURRENCIES,
  IDENTITY_DOCUMENT_TYPES,
  SUNAT_DOCUMENT_TYPES,
  SUNAT_TAX_AFFECTATION_TYPES,
  UNIT_CODES,
} from "@/features/sunat/sunat-document/enums/sunat-document.enums";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import type { CreateSunatDocumentsFormValues } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import { createSunatDocumentsSchema } from "@/features/sunat/sunat-document/schemas/create-sunat-documents.schema";
import type { Order } from "@/models/sales/order";

const PIPELINE_STEPS = [
  "Generando XML UBL 2.1",
  "Firmando digitalmente con certificado P12",
  "Enviando al OSE",
  "Esperando CDR de SUNAT",
];

const IGV_RATE = 0.18;

// Rounds to soles-cents. Without this, dividing a tax-inclusive price by
// 1.18 leaves a repeating decimal (e.g. 140 / 1.18 = 118.64406779661017)
// that would otherwise flow untouched into the form, the summary, and
// the request sent to the backend.
function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

interface EmitirComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Order;
  onEmissionFinished?: (response: unknown) => void;
}

type Step = "form" | "pipeline" | "ok" | "bad";

type SunatDocument = CreateSunatDocumentsFormValues["documents"][number];

type SunatItem = SunatDocument["items"][number];

type ItemsEditTableItem = {
  internalCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  unitCode: SunatItem["unitCode"];
  taxType: SunatItem["taxType"];
};

function getDocumentTypeFromSale(sale: Order) {
  const documentNumber = sale.customer?.documentNumber ?? "";

  return documentNumber.length === 11
    ? SUNAT_DOCUMENT_TYPES.INVOICE
    : SUNAT_DOCUMENT_TYPES.SALES_RECEIPT;
}

function getCustomerDocumentType(sale: Order) {
  const documentNumber = sale.customer?.documentNumber ?? "";

  return documentNumber.length === 11 ? IDENTITY_DOCUMENT_TYPES.RUC : IDENTITY_DOCUMENT_TYPES.DNI;
}

function createItems(sale: Order): SunatItem[] {
  // "sale.items[].unitPrice" means two different things depending on how
  // the sale was closed (see registrar-venta/page.tsx: "Si INCLUIDO, los
  // precios ya incluyen impuestos"):
  //   - taxMode "AUTOMATICO": unitPrice is tax-exclusive (base price);
  //     18% IGV gets added on top.
  //   - taxMode "INCLUIDO": unitPrice is tax-inclusive (what the customer
  //     actually paid); IGV is already baked in.
  // SUNAT line items need the tax-exclusive unit price, so for INCLUIDO
  // sales we back the 18% out here — otherwise calculateTotals() below
  // would add a second 18% on top of an already tax-inclusive price and
  // the comprobante's grandTotal would end up ~18% higher than the sale.
  const isTaxIncluded = sale.taxMode === "INCLUIDO";

  const productItems: SunatItem[] = sale.items.map((item) => {
    const quantity = Number(item.quantity);
    const rawUnitPrice = Number(item.unitPrice);

    // Compute the line's net subtotal from the full gross line total,
    // not from quantity × an already-rounded unit price — rounding the
    // unit price first and then multiplying compounds the lost fraction
    // (e.g. 140/1.18 → 118.64 per unit, × 2 = 237.28, a cent short of the
    // correct 237.29 = 280/1.18). The displayed unit price is still
    // rounded for readability; it just isn't what the subtotal is
    // derived from anymore.
    const unitPrice = isTaxIncluded
      ? roundCurrency(rawUnitPrice / (1 + IGV_RATE))
      : rawUnitPrice;
    const subtotal = isTaxIncluded
      ? roundCurrency((rawUnitPrice * quantity) / (1 + IGV_RATE))
      : roundCurrency(rawUnitPrice * quantity);

    return {
      sku: item.sku ?? `PRODUCT-${item.id}`,
      productName: item.productName,
      quantity,
      unitPrice,
      subtotal,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      taxType: SUNAT_TAX_AFFECTATION_TYPES.GRAVADO,
    };
  });

  const shippingTotal = Number(sale.shippingTotal ?? 0);

  if (shippingTotal <= 0) {
    return productItems;
  }

  return [
    ...productItems,
    {
      sku: "DELIVERY",
      productName: "Servicio de entrega",
      quantity: 1,
      unitPrice: shippingTotal,
      subtotal: shippingTotal,
      discountAmount: 0,
      unitCode: UNIT_CODES.UNIT,
      // Shipping is never taxed for this business (see registrar-venta/
      // page.tsx: shippingTotal is added AFTER the tax calc, untouched,
      // regardless of taxMode). Marking it GRAVADO made calculateTotals()
      // below tack another 18% onto it, which it shouldn't get.
      taxType: SUNAT_TAX_AFFECTATION_TYPES.INAFECTO,
    },
  ];
}

function calculateTotals(items: SunatItem[]) {
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.subtotal, 0));

  const discountTotal = roundCurrency(items.reduce((sum, item) => sum + item.discountAmount, 0));

  // Only GRAVADO (taxed) items belong in the IGV base — e.g. shipping is
  // INAFECTO and must not have 18% tacked on top of it.
  const taxableAmount = items
    .filter((item) => item.taxType === SUNAT_TAX_AFFECTATION_TYPES.GRAVADO)
    .reduce((sum, item) => sum + Math.max(item.subtotal - item.discountAmount, 0), 0);

  const taxTotal = roundCurrency(taxableAmount * IGV_RATE);

  const grandTotal = roundCurrency(Math.max(subtotal - discountTotal, 0) + taxTotal);

  return {
    currency: CURRENCIES.PEN,
    subtotal,
    discountTotal,
    shippingTotal: 0,
    taxTotal,
    grandTotal,
  };
}

function toItemsEditTableItems(items: SunatItem[]): ItemsEditTableItem[] {
  return items.map((item) => ({
    internalCode: item.sku,
    description: item.productName,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    unitCode: item.unitCode,
    taxType: item.taxType,
  }));
}

function fromItemsEditTableItems(
  currentItems: SunatItem[],
  nextItems: ItemsEditTableItem[],
): SunatItem[] {
  return nextItems.map((item, index) => {
    const currentItem = currentItems[index];

    const subtotal = roundCurrency(item.quantity * item.unitPrice);

    return {
      sku: item.internalCode,
      productName: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal,
      discountAmount: currentItem?.discountAmount ?? 0,
      unitCode: item.unitCode,
      taxType: item.taxType,
    };
  });
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
      documents: [
        {
          orderId: "",
          taxDocumentType: SUNAT_DOCUMENT_TYPES.SALES_RECEIPT,
          series: "B001",
          customer: undefined,
          totals: {
            currency: CURRENCIES.PEN,
            subtotal: 0,
            discountTotal: 0,
            shippingTotal: 0,
            taxTotal: 0,
            grandTotal: 0,
          },
          items: [],
        },
      ],
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

  const items = useWatch({
    control: form.control,
    name: "documents.0.items",
  });

  const totals = useWatch({
    control: form.control,
    name: "documents.0.totals",
  });

  const isInvoice = documentType === SUNAT_DOCUMENT_TYPES.INVOICE;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const items = createItems(sale);
    const type = getDocumentTypeFromSale(sale);

    form.reset({
      documents: [
        {
          orderId: String(sale.id),

          taxDocumentType: type,

          series: type === SUNAT_DOCUMENT_TYPES.INVOICE ? "F001" : "B001",

          customer: {
            name: sale.customer?.fullName ?? "",
            identityDocumentType: getCustomerDocumentType(sale),
            identityDocumentNumber: sale.customer?.documentNumber ?? "",
            countryCode: "PE",
            address: sale.customer?.address ?? "",
          },

          totals: calculateTotals(items),

          items,
        },
      ],
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
    if (!items) {
      return;
    }

    form.setValue("documents.0.totals", calculateTotals(items), {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [items, form]);

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

    if (documentType === SUNAT_DOCUMENT_TYPES.INVOICE) {
      const customer = form.getValues("documents.0.customer");

      if (!customer) {
        form.setValue("documents.0.customer", {
          name: sale.customer?.fullName ?? "",
          identityDocumentType: getCustomerDocumentType(sale),
          identityDocumentNumber: sale.customer?.documentNumber ?? "",
          countryCode: "PE",
          address: sale.customer?.address ?? "",
        });
      }
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
      const response = await createSunatDocuments.mutateAsync(values);

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
                  {totals?.currency ?? "PEN"} {Number(totals?.grandTotal ?? 0).toFixed(2)}
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

                    {isInvoice && (
                      <>
                        <div className="flex items-center justify-between gap-4">
                          <Label>Datos del cliente</Label>

                          <ProximamenteButton
                            label={
                              <>
                                <Search className="mr-2 h-3.5 w-3.5" />
                                Verificar RENIEC / SUNAT
                              </>
                            }
                            tooltip="La verificación automática con RENIEC/SUNAT está en desarrollo."
                          />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="documents.0.customer.identityDocumentType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo Doc.</FormLabel>

                                <Select value={field.value} onValueChange={field.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Seleccione" />
                                    </SelectTrigger>
                                  </FormControl>

                                  <SelectContent>
                                    <SelectItem value={IDENTITY_DOCUMENT_TYPES.RUC}>RUC</SelectItem>

                                    <SelectItem value={IDENTITY_DOCUMENT_TYPES.DNI}>DNI</SelectItem>

                                    <SelectItem value="4">CE</SelectItem>
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
                                  <Input {...field} placeholder="20601234567" />
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
                                <Input {...field} />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="documents.0.customer.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección Fiscal</FormLabel>

                              <FormControl>
                                <Input {...field} placeholder="Av. Larco 123, Miraflores" />
                              </FormControl>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {!isInvoice && (
                      <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                        Para una boleta, los datos del cliente son opcionales.
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="documents.0.items"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ítems del pedido</FormLabel>

                          <FormControl>
                            <ItemsEditTable
                              items={toItemsEditTableItems(field.value)}
                              onChange={(nextItems) => {
                                field.onChange(fromItemsEditTableItems(field.value, nextItems));
                              }}
                            />
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
                          {totals?.currency ?? "PEN"} {Number(totals?.grandTotal ?? 0).toFixed(2)}
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
