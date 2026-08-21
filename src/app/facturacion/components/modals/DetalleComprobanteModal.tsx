"use client";

import { Download, Link2, Loader2, Mail, MessageCircle, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TAX_DOCUMENT_STATUSES,
  type TaxDocumentStatus,
} from "@/features/sunat/shared/types/sunat.types";
import { useSunatDocumentPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-document-pdf";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { getDocumentTypeLabel } from "@/features/sunat/sunat-document/utils/get-document-type-label";
import { formatDateTime } from "@/utils/date";
import { downloadFile } from "@/utils/http/download-file";

interface DetalleComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: TaxDocumentRow | null;
  onGenerarNota: (row: TaxDocumentRow) => void;
  onAction?: (saleId: string, type: "wa" | "print") => void;
}

function getStatus(row: TaxDocumentRow): TaxDocumentStatus {
  return row.taxDocument?.cdrStatus ?? "SIN_EMITIR";
}

function getDocumentNumber(taxDocument: TaxDocumentRow["taxDocument"]): string | null {
  if (!taxDocument) {
    return null;
  }

  return `${taxDocument.series}-${taxDocument.correlative}`;
}

export default function DetalleComprobanteModal({
  isOpen,
  onClose,
  row,
  onGenerarNota,
  onAction,
}: DetalleComprobanteModalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { mutateAsync: downloadSunatDocumentPdf } = useSunatDocumentPdf();

  if (!row) {
    return null;
  }

  const { sale, taxDocument } = row;

  const status = getStatus(row);

  const statusMeta = TAX_DOCUMENT_STATUSES[status];

  const fullNumber = getDocumentNumber(taxDocument);

  const documentType = getDocumentTypeLabel(taxDocument);

  const items =
    taxDocument?.taxDocumentPayload.items.map((item) => ({
      id: item.sku,
      description: item.productName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
    })) ?? [];

  const totals = taxDocument?.taxDocumentPayload.totals;

  const currency = totals?.currency ?? "PEN";

  const subtotal = Number(totals?.subtotal ?? 0);
  const discountTotal = Number(totals?.discountTotal ?? 0);
  const shippingTotal = Number(totals?.shippingTotal ?? 0);
  const taxTotal = Number(totals?.taxTotal ?? 0);
  const total = Number(totals?.grandTotal ?? sale.grandTotal);

  const documentDate = formatDateTime(taxDocument?.issueDate ?? sale.createdAt);

  const isFinal = status === "ACCEPTED" || status === "ACCEPTED_WITH_OBSERVATION";

  const shareWhatsApp = () => {
    const phone = sale.customer.phoneNumber?.replace(/\D/g, "");

    if (!phone) {
      toast.error("Esta venta no tiene un teléfono de contacto registrado");
      return;
    }

    const firstName = sale.customer.fullName?.split(" ")[0] ?? "";

    const documentLabel = taxDocument?.taxDocumentType === "01" ? "Factura" : "Boleta";

    const message = encodeURIComponent(
      [
        `Hola ${firstName}, te enviamos tu comprobante de pago:`,
        `${documentLabel} N° ${fullNumber ?? ""}`,
        `Total: ${currency} ${total.toFixed(2)}`,
        "Validado por SUNAT",
      ].join("\n"),
    );

    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");

    onAction?.(sale.id, "wa");
  };

  const downloadPdf = async () => {
    if (!taxDocument) {
      return;
    }

    setDownloadingPdf(true);

    try {
      const file = await downloadSunatDocumentPdf(taxDocument.id);

      downloadFile(file);

      onAction?.(sale.id, "print");
    } catch (error) {
      console.error("Error downloading SUNAT document PDF:", error);

      toast.error("No se pudo descargar el PDF del comprobante");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5 text-primary" />

            {fullNumber ?? "Comprobante"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusMeta.badgeClassName}`}>
            {statusMeta.label}
          </span>

          <span className="text-sm text-muted-foreground">{documentType}</span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Cliente</div>

            <div className="font-medium">{sale.customer.fullName}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Documento</div>

            <div className="font-medium">{sale.customer.documentNumber || "—"}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Fecha</div>

            <div className="font-medium">{documentDate}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Total</div>

            <div className="font-bold text-primary">
              {currency} {total.toFixed(2)}
            </div>
          </div>

          {taxDocument?.sunatDescription && (
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground">CDR SUNAT</div>

              <div className="font-medium">{taxDocument.sunatDescription}</div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>

                    <TableHead className="text-center">Cant.</TableHead>

                    <TableHead className="text-right">P. Unit.</TableHead>

                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.description}</TableCell>

                      <TableCell className="text-center">{item.quantity}</TableCell>

                      <TableCell className="text-right">
                        {currency} {item.unitPrice.toFixed(2)}
                      </TableCell>

                      <TableCell className="text-right">
                        {currency} {item.subtotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>

                  <span>
                    {currency} {subtotal.toFixed(2)}
                  </span>
                </div>

                {discountTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Descuento</span>

                    <span>
                      -{currency} {discountTotal.toFixed(2)}
                    </span>
                  </div>
                )}

                {shippingTotal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Envío</span>

                    <span>
                      {currency} {shippingTotal.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-muted-foreground">
                  <span>I.G.V.</span>

                  <span>
                    {currency} {taxTotal.toFixed(2)}
                  </span>
                </div>

                <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>

                  <span className="text-primary">
                    {currency} {total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {isFinal && taxDocument && (
          <>
            <div className="mt-2 text-sm font-semibold">Compartir con el cliente</div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={shareWhatsApp}>
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-2"
                disabled={downloadingPdf}
                onClick={downloadPdf}
              >
                {downloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-red-600" />
                )}
                Descargar PDF
              </Button>

              <ProximamenteButton
                label={
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar por Email
                  </>
                }
                tooltip="El envío automático por email todavía no está conectado."
                className="justify-start"
              />

              <ProximamenteButton
                label={
                  <>
                    <Link2 className="mr-2 h-4 w-4" />
                    Copiar link público
                  </>
                }
                tooltip="El link público de consulta del comprobante todavía no está disponible."
                className="col-span-2 justify-start"
              />
            </div>

            <div className="mt-2 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => onGenerarNota(row)}>
                Generar Nota de Crédito
              </Button>

              <ProximamenteButton
                label={
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Anular comprobante (baja)
                  </>
                }
                tooltip="La comunicación de baja ante SUNAT todavía está desconectada."
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
