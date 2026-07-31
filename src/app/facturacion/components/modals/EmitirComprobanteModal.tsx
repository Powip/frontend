"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, FileText, Loader2, Search } from "lucide-react";
import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { ItemsEditTable } from "@/app/facturacion/components/ItemsEditTable";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
import { Order } from "@/models/sales/order";
import { useCreateManualInvoice } from "@/hooks/sunat/sunat-document/use-create-manual-invoice";
import { useForm } from "react-hook-form";
import { CreateManualInvoiceInput, createManualInvoiceSchema } from "@/schemas/sunat/create-manual-invoice.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { CURRENCIES, DOCUMENT_TYPES, IDENTITY_DOCUMENT_TYPES, TAX_TYPES, UNIT_CODES } from "@/api/sunat/types/sunat-document.types";
import { CreateManualInvoiceResponseDto } from "@/api/sunat/dto/sunat-document.dto";
import { ItemComprobante } from "@/types/facturacion";
import { computeInvoiceTotals } from "@/utils/sunat/compute-invoice-totals";

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
  onEmissionFinished: (
    response: CreateManualInvoiceResponseDto
  ) => void;
}

type Step = "form" | "pipeline" | "ok" | "bad";

export default function EmitirComprobanteModal({
  isOpen,
  onClose,
  sale,
  onEmissionFinished,
}: EmitirComprobanteModalProps) {
  // React Query
  const {
    mutateAsync: createInvoice,
    isPending
  } = useCreateManualInvoice();


  // Form
  const form = useForm<CreateManualInvoiceInput>({
    resolver: zodResolver(createManualInvoiceSchema),
    defaultValues: {
      externalId: "",
      documentType: DOCUMENT_TYPES.BOLETA,
      customer: {
        name: "",
        documentType: "1",
        documentNumber: "",
        address: "",
      },
      totals: {
        totalTax: 0,
        totalValue: 0,
        totalPrice: 0,
        currency: "PEN",
      },
      items: [],
    },
  });

  // UI flow
  const [step, setStep] = useState<Step>("form");
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [invoiceResult, setInvoiceResult]
    = useState<CreateManualInvoiceResponseDto | null>(null);

  // animation only
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;

    const docNumber = sale.customer?.documentNumber ?? "";

    const isRuc = docNumber.length === 11;

    const productItems = sale.items.map((item) => ({
      internalCode: item.sku ?? "PROD001",
      description: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      unitCode: UNIT_CODES.UNIT,
      taxType: TAX_TYPES.GRAVADO,
    }));

    // Delivery/shipping is charged as part of the sale but was never
    // represented as its own line — it was only folded into
    // totals.totalPrice via sale.grandTotal, which meant it was never
    // actually invoiced at all (the backend computes totals strictly
    // from items, see invoice.template.ts). Represent it as its own
    // item so it's properly taxed and included in what SUNAT receives.
    const shippingAmount = Number(sale.shippingTotal ?? 0);

    const items =
      shippingAmount > 0
        ? [
            ...productItems,
            {
              internalCode: "DELIVERY",
              description: "Servicio de entrega",
              quantity: 1,
              unitPrice: shippingAmount,
              unitCode: UNIT_CODES.UNIT,
              taxType: TAX_TYPES.GRAVADO,
            },
          ]
        : productItems;

    form.reset({
      externalId: String(sale.id),

      documentType: isRuc
        ? DOCUMENT_TYPES.FACTURA
        : DOCUMENT_TYPES.BOLETA,

      customer: {
        name: sale.customer?.fullName ?? "",

        documentType: isRuc
          ? IDENTITY_DOCUMENT_TYPES.RUC
          : IDENTITY_DOCUMENT_TYPES.DNI,

        documentNumber: docNumber,

        address: sale.customer?.address ?? "",
      },

      // Always derived from items — never set independently. See the
      // recompute in the items onChange handler below, which keeps
      // this in sync any time the user edits an item in the table.
      totals: {
        ...computeInvoiceTotals(items),
        currency: CURRENCIES.PEN,
      },

      items,
    });

    setStep("form");

  }, [isOpen, sale, form]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const runPipelineAnimation = () => {
    setPipelineIndex(0);
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      if (i >= PIPELINE_STEPS.length - 1) {
        if (timerRef.current) clearInterval(timerRef.current);
      }
      setPipelineIndex(Math.min(i, PIPELINE_STEPS.length - 1));
    }, 650);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    setStep("pipeline");
    runPipelineAnimation();

    try {
      const response = await createInvoice(values);

      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      setPipelineIndex(PIPELINE_STEPS.length);

      setInvoiceResult(response);

      if (
        response.success &&
        response.data.cdr.accepted
      ) {
        setStep("ok");
      } else {
        setStep("bad");
      }

      onEmissionFinished(response);

    } catch (error) {
      setStep("bad");
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {step === "form" && (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Emitir Comprobante Electrónico
              </DialogTitle>

              <DialogDescription>
                Venta:{" "}
                <span className="font-bold text-foreground">
                  {sale?.orderNumber}
                </span>{" "}
                — Total:{" "}
                <span className="font-bold text-primary">
                  S/ {Number(form.getValues("totals.totalPrice")).toFixed(2)}
                </span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-2">
              <div className="grid gap-2">
                <Label>Tipo de Comprobante</Label>
                <Select
                  value={form.getValues("documentType")}
                  onValueChange={(value) =>
                    form.setValue(
                      "documentType",
                      value as CreateManualInvoiceInput["documentType"],
                      {
                        shouldValidate: true,
                      }
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo de comprobante" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DOCUMENT_TYPES.BOLETA}>
                      Boleta de Venta (B001)
                    </SelectItem>

                    <SelectItem value={DOCUMENT_TYPES.FACTURA}>
                      Factura (F001)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo Doc. Cliente</Label>
                  <Select
                    value={form.getValues("customer.documentType")}
                    onValueChange={(value) =>
                      form.setValue(
                        "customer.documentType",
                        value as CreateManualInvoiceInput["customer"]["documentType"],
                        {
                          shouldValidate: true,
                        }
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={IDENTITY_DOCUMENT_TYPES.DNI}>
                        DNI
                      </SelectItem>

                      <SelectItem value={IDENTITY_DOCUMENT_TYPES.RUC}>
                        RUC
                      </SelectItem>

                      <SelectItem value="0">
                        Sin documento
                      </SelectItem>

                      <SelectItem value="4">
                        CE
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Número Doc.</Label>

                  <Input
                    placeholder="Ej. 20601234567"
                    {...form.register(
                      "customer.documentNumber"
                    )}
                  />

                  {form.formState.errors.customer?.documentNumber && (
                    <p className="text-sm text-red-500">
                      {form.formState.errors.customer.documentNumber.message}
                    </p>
                  )}
                </div>
              </div>

              <ProximamenteButton
                label={
                  <>
                    <Search className="mr-2 h-3.5 w-3.5" /> Verificar con RENIEC / SUNAT
                  </>
                }
                tooltip="La verificación automática con RENIEC/SUNAT está en desarrollo. Por ahora, confirma los datos del cliente manualmente."
                className="w-full justify-center"
              />

              <div className="grid gap-2">
                <Label>
                  Nombre del Cliente
                </Label>

                <Input
                  {...form.register("customer.name")}
                />

                {form.formState.errors.customer?.name && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.customer.name.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>
                  Dirección Fiscal
                </Label>

                <Input
                  placeholder="Ej. Av. Larco 123, Miraflores"
                  {...form.register("customer.address")}
                />

                {form.formState.errors.customer?.address && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.customer.address.message}
                  </p>
                )}
              </div>

              <div className="grid gap-2">

                <Label>
                  Ítems del pedido
                </Label>

                <ItemsEditTable
                  items={form.getValues("items")}
                  onChange={(items) => {
                    form.setValue("items", items, {
                      shouldValidate: true,
                    });

                    // Keep totals in lockstep with items — this was
                    // the actual bug before: totals stayed frozen at
                    // whatever form.reset set initially, so editing
                    // items here never updated the IGV/Total summary
                    // shown below, nor what got submitted.
                    form.setValue(
                      "totals",
                      {
                        ...computeInvoiceTotals(items),
                        currency: form.getValues("totals.currency"),
                      },
                      { shouldValidate: true }
                    );
                  }}
                />

              </div>

              <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Op. gravada</span>

                  <span>
                    S/{" "}
                    {(
                      form.getValues("totals.totalValue") ?? 0
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>IGV (18%)</span>

                  <span>
                    S/{" "}
                    {(
                      form.getValues("totals.totalTax") ?? 0
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t">
                  <span>Total</span>

                  <span className="text-primary">
                    S/{" "}
                    {(
                      form.getValues("totals.totalPrice") ?? 0
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white"
                disabled={isPending}
              >
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
        )}

        {step === "pipeline" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Emitiendo comprobante...
              </DialogTitle>
              <DialogDescription>
                Venta {sale?.orderNumber} — no cierres esta ventana
              </DialogDescription>
            </DialogHeader>
            <EmisionPipeline steps={PIPELINE_STEPS} activeIndex={pipelineIndex} />
          </>
        )}

        {step === "ok" && invoiceResult?.data && (
          <>
            <div className="text-center py-2">

              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">
                ¡Comprobante aceptado por SUNAT!
              </h3>

              <div className="text-primary font-bold mt-1">
                {invoiceResult.data.series}-
                {String(invoiceResult.data.correlative).padStart(8, "0")}
              </div>

              <p className="text-xs text-muted-foreground mt-1">
                {invoiceResult.message}
              </p>

            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>

              <Button onClick={onClose}>
                Ver comprobante completo
              </Button>
            </DialogFooter>
          </>
        )}

      {step === "bad" && (
        <>
          <div className="text-center py-2">

            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
              <AlertCircle className="h-7 w-7" />
            </div>

            <h3 className="text-lg font-bold">
              SUNAT rechazó el comprobante
            </h3>

            <p className="mt-3 text-sm text-red-600">
              Ocurrió un error al emitir el comprobante.
            </p>

          </div>


          <DialogFooter>

            <Button
              variant="ghost"
              onClick={onClose}
            >
              Cerrar
            </Button>

            <Button
              onClick={() => setStep("form")}
            >
              Corregir datos y reintentar
            </Button>

          </DialogFooter>
        </>
      )}
      </DialogContent>
    </Dialog>
  );
}
