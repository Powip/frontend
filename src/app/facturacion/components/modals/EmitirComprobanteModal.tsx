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
import { toast } from "sonner";
import { generateManualInvoice, IManualInvoicePayload } from "@/api/Facturacion";
import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { ItemsEditTable } from "@/app/facturacion/components/ItemsEditTable";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
import { ErrorSunat, ItemComprobante } from "@/types/facturacion";
import { Sale } from "@/hooks/useComprobantesSunat";

const PIPELINE_STEPS = [
  "Generando XML UBL 2.1",
  "Firmando digitalmente con certificado P12",
  "Enviando al OSE",
  "Esperando CDR de SUNAT",
];

interface EmitirComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale;
  onSuccess: () => void;
}

type Step = "form" | "pipeline" | "ok" | "bad";

export default function EmitirComprobanteModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
}: EmitirComprobanteModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [documentType, setDocumentType] = useState<"01" | "03">("03");
  const [customerDocType, setCustomerDocType] = useState("1");
  const [customerDocNumber, setCustomerDocNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [items, setItems] = useState<ItemComprobante[]>([]);
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [okResult, setOkResult] = useState<{ series: string; correlative: number | string; message: string } | null>(null);
  const [badResult, setBadResult] = useState<ErrorSunat | { code: string; desc: string; sol: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen || !sale) return;
    setStep("form");
    const docNumber = sale.customer?.documentNumber || "";
    const isRuc = docNumber.length === 11;
    setDocumentType(isRuc ? "01" : "03");
    setCustomerDocType(isRuc ? "6" : "1");
    setCustomerDocNumber(docNumber);
    setCustomerName(sale.customer?.fullName || "");
    setCustomerAddress(sale.customer?.address || "");
    setItems(
      (sale.items || []).map((it) => ({
        desc: it.productName,
        qty: it.quantity,
        price: Number(it.price),
      }))
    );
  }, [isOpen, sale]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleTipoChange = (val: "01" | "03") => {
    setDocumentType(val);
    setCustomerDocType(val === "01" ? "6" : "1");
  };

  const total = items.reduce((s, it) => s + it.qty * it.price, 0);
  const opGravada = total / 1.18;
  const igv = total - opGravada;

  const validate = () => {
    const cleanName = customerName.trim();
    const cleanDoc = customerDocNumber.trim();
    const cleanAddress = customerAddress.trim();

    if (documentType === "01") {
      if (!/^(10|20)\d{9}$/.test(cleanDoc)) {
        toast.error("Para Facturas se requiere un RUC válido (11 dígitos, empieza con 10 o 20)");
        return null;
      }
      if (!cleanName) {
        toast.error("La Razón Social es obligatoria");
        return null;
      }
      if (!cleanAddress) {
        toast.error("La Dirección Fiscal es obligatoria para Facturas");
        return null;
      }
    } else {
      if (customerDocType === "1" && cleanDoc.length !== 8) {
        toast.error("El DNI debe tener 8 dígitos");
        return null;
      }
      if (customerDocType === "6" && cleanDoc.length !== 11) {
        toast.error("El RUC debe tener 11 dígitos");
        return null;
      }
    }
    if (!items.length || total <= 0) {
      toast.error("Agrega al menos un ítem con importe mayor a cero");
      return null;
    }

    const payload: IManualInvoicePayload = {
      externalId: String(sale.id),
      documentType,
      customerName: cleanName,
      customerDocType: customerDocType as "1" | "6" | "7",
      customerDocNumber: cleanDoc,
      customerAddress: cleanAddress || undefined,
      totalTax: Number(igv.toFixed(2)),
      totalValue: Number(opGravada.toFixed(2)),
      totalPrice: Number(total.toFixed(2)),
      items: items.map((it, i) => ({
        internalCode: String(sale.items?.[i]?.sku || "PROD001"),
        description: it.desc,
        quantity: it.qty,
        unitPrice: it.price,
        unitCode: "NIU",
        taxType: "10",
      })),
    };
    return payload;
  };

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

  const handleSubmit = async () => {
    const payload = validate();
    if (!payload) return;

    setStep("pipeline");
    runPipelineAnimation();

    try {
      const res = await generateManualInvoice(payload);
      if (timerRef.current) clearInterval(timerRef.current);
      setPipelineIndex(PIPELINE_STEPS.length);

      setTimeout(() => {
        if (res.success) {
          setOkResult({
            series: res.data?.series,
            correlative: res.data?.correlative,
            message:
              res.data?.status === "OBSERVED"
                ? "SUNAT aceptó el comprobante con observaciones."
                : "SUNAT ha aceptado el comprobante.",
          });
          setStep("ok");
          onSuccess();
        } else {
          setBadResult({ code: "—", desc: res.message || "Error al generar comprobante", sol: "Revisa los datos e intenta nuevamente." });
          setStep("bad");
        }
      }, 400);
    } catch (error: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      const serverMessage = error.response?.data?.message;
      const displayMessage = Array.isArray(serverMessage)
        ? serverMessage.join(", ")
        : serverMessage || "Error de conexión con el servidor";
      setTimeout(() => {
        setBadResult({ code: String(error.response?.status || "—"), desc: displayMessage, sol: "Corrige los datos del cliente o los ítems y vuelve a intentar." });
        setStep("bad");
      }, 400);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <FileText className="h-5 w-5 text-primary" />
                Emitir Comprobante Electrónico
              </DialogTitle>
              <DialogDescription>
                Venta: <span className="font-bold text-foreground">{sale?.orderNumber}</span> — Total:{" "}
                <span className="font-bold text-primary">S/ {total.toFixed(2)}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-5 py-2">
              <div className="grid gap-2">
                <Label>Tipo de Comprobante</Label>
                <Select value={documentType} onValueChange={handleTipoChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="03">Boleta de Venta (B001)</SelectItem>
                    <SelectItem value="01">Factura (F001)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Tipo Doc. Cliente</Label>
                  <Select value={customerDocType} onValueChange={setCustomerDocType} disabled={documentType === "01"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentType === "01" ? (
                        <SelectItem value="6">RUC</SelectItem>
                      ) : (
                        <>
                          <SelectItem value="1">DNI</SelectItem>
                          <SelectItem value="0">Sin documento</SelectItem>
                          <SelectItem value="4">CE</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{documentType === "01" ? "RUC" : "Número Doc."}</Label>
                  <Input
                    placeholder="Ej. 20601234567"
                    value={customerDocNumber}
                    onChange={(e) => setCustomerDocNumber(e.target.value)}
                  />
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
                <Label>{documentType === "01" ? "Razón Social" : "Nombre del Cliente"}</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>
                  Dirección Fiscal {documentType === "01" && <span className="text-red-500">*</span>}
                </Label>
                <Input
                  placeholder="Ej. Av. Larco 123, Miraflores"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
                {documentType === "01" && !customerAddress && (
                  <p className="text-[11px] text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Requerido para facturas
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Ítems del pedido</Label>
                <ItemsEditTable items={items} onChange={setItems} />
              </div>

              <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Op. gravada</span>
                  <span>S/ {opGravada.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground mt-1">
                  <span>IGV (18%)</span>
                  <span>S/ {igv.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base mt-2 pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">S/ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-white">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Emitir a SUNAT
              </Button>
            </DialogFooter>
          </>
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

        {step === "ok" && okResult && (
          <>
            <div className="text-center py-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">¡Comprobante aceptado por SUNAT!</h3>
              <div className="text-primary font-bold mt-1">
                {okResult.series}-{String(okResult.correlative).padStart(8, "0")}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{okResult.message}</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-white">
                Ver comprobante completo
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "bad" && badResult && (
          <>
            <div className="text-center py-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">SUNAT rechazó el comprobante</h3>
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-left text-sm">
                <div className="font-bold text-red-600 dark:text-red-400">
                  Código {badResult.code} — {badResult.desc}
                </div>
                <div className="mt-1 text-red-800 dark:text-red-300">
                  <b>Solución:</b> {badResult.sol}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>
              <Button onClick={() => setStep("form")} className="bg-primary hover:bg-primary/90 text-white">
                Corregir datos y reintentar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
