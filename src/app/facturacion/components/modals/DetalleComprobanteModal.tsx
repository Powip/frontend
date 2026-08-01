"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Loader2, Mail, Link2, MessageCircle, Printer, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EstadoBadge } from "@/app/facturacion/components/EstadoBadge";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";
import { useDownloadTaxDocument } from "@/hooks/sunat/sunat-document/use-download-tax-document";
import { formatDateTime } from "@/utils/date";

interface DetalleComprobanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: ComprobanteRow | null;
  onGenerarNota: (row: ComprobanteRow) => void;
  onAction?: (saleId: string, type: "wa" | "print") => void;
}

export default function DetalleComprobanteModal({
  isOpen,
  onClose,
  row,
  onGenerarNota,
  onAction,
}: DetalleComprobanteModalProps) {
  const { downloadPdf, downloadXml, isDownloading } = useDownloadTaxDocument();

  if (!row) return null;
  const { sale, document: sunatDoc, estado, tipo, fullNumber } = row;

  // Single source of truth for displayed items
  const invoiceItems =
    sunatDoc?.invoicePayload?.items?.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })) ??
    sale.items.map((item) => ({
      description: item.productName,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    }));

  // Use invoice payload for total when available
  const total =
    sunatDoc?.invoicePayload?.totals?.totalPrice ??
    Number(sale.grandTotal);

  const invoiceTotals =
    sunatDoc?.invoicePayload?.totals ?? {
      totalValue: 0,
      totalTax: 0,
      totalPrice: Number(sale.grandTotal),
      currency: "PEN",
    };

  const documentDate = formatDateTime(
    sunatDoc?.issueDate ?? sale.createdAt
  );

  const compartirWhatsApp = () => {
    const phone = sale.customer.phoneNumber?.replace(/\D/g, "");
    const firstName = (sale.customer.fullName || "").split(" ")[0];
    const msg = encodeURIComponent(
      `Hola ${firstName}, te enviamos tu comprobante de pago:\n${tipo === "01" ? "Factura" : "Boleta"} N° ${fullNumber}\nTotal: S/ ${total.toFixed(2)}\nValidado por SUNAT`
    );
    if (!phone) {
      toast.error("Esta venta no tiene un teléfono de contacto registrado");
      return;
    }
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener,noreferrer");
    onAction?.(sale.id, "wa");
  };

  const imprimir = () => {
    try {
      // Create a new window
      const printWindow = window.open("", "_blank", "width=800,height=600");
      if (!printWindow) {
        toast.error("Habilita las ventanas emergentes para imprimir");
        return;
      }

      // Build the HTML content as a string using invoiceItems
      const itemsRows = invoiceItems
        .map(
          (it) =>
            `<tr><td>${it.description}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">S/ ${it.unitPrice.toFixed(2)}</td><td style="text-align:right">S/ ${(it.quantity * it.unitPrice).toFixed(2)}</td></tr>`
        )
        .join("");

      // Create the document structure
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${fullNumber || sale.orderNumber}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #101828;
                margin: 0;
              }
              h1 {
                font-size: 18px;
                margin-bottom: 2px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 14px;
              }
              th {
                background: #f2f4f5;
                text-align: left;
                padding: 7px 9px;
                font-size: 11px;
                font-weight: 600;
              }
              td {
                padding: 7px 9px;
                font-size: 11.5px;
                border-bottom: 1px solid #eee;
              }
              .subtitle {
                color: #667085;
                font-size: 12px;
                margin-bottom: 8px;
              }
              .total {
                text-align: right;
                margin-top: 10px;
                font-weight: bold;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <h1>${tipo === "01" ? "Factura Electrónica" : "Boleta de Venta Electrónica"} ${fullNumber || ""}</h1>
            <div class="subtitle">Cliente: ${sale.customer.fullName} · Venta ${sale.orderNumber}</div>
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style="text-align:center">Cant.</th>
                  <th style="text-align:right">P. Unit.</th>
                  <th style="text-align:right">Importe</th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>
            <div class="total">Total: S/ ${total.toFixed(2)}</div>
          </body>
        </html>
      `;

      // Modern approach: Use DOMParser to create a document
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, "text/html");
      
      // Replace the content of the new window with our parsed document
      printWindow.document.replaceChild(
        doc.documentElement,
        printWindow.document.documentElement
      );

      // Focus and trigger print after content loads
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        // Optionally close the window after printing
        // printWindow.close();
      }, 500);

      onAction?.(sale.id, "print");
    } catch (error) {
      console.error("Error printing:", error);
      toast.error("Error al generar la vista previa de impresión");
    }
  };

  const isFinal = estado === "ACEPTADO" || estado === "ACEPTADO_CON_OBS";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Receipt className="h-5 w-5 text-primary" />
            {fullNumber || "Comprobante"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <EstadoBadge estado={estado} />
          <span className="text-sm text-muted-foreground">
            {tipo === "01" ? "Factura Electrónica" : "Boleta de Venta Electrónica"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <div className="text-muted-foreground text-xs">Cliente</div>
            <div className="font-medium">{sale.customer.fullName}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Documento</div>
            <div className="font-medium">{sale.customer.documentNumber || "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Fecha</div>
            <div className="font-medium">{formatDateTime(sunatDoc?.issueDate ?? sale.createdAt)}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="font-bold text-primary">S/ {total.toFixed(2)}</div>
          </div>
          {sunatDoc?.sunatDescription && (
            <div className="col-span-2">
              <div className="text-muted-foreground text-xs">CDR SUNAT</div>
              <div className="font-medium">{sunatDoc.sunatDescription}</div>
            </div>
          )}
        </div>

        {invoiceItems.length > 0 && (
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
                  {invoiceItems.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell>{it.description}</TableCell>
                      <TableCell className="text-center">
                        {it.quantity}
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {it.unitPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        S/ {(it.quantity * it.unitPrice).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Op. Gravada</span>
                  <span>S/ {invoiceTotals.totalValue.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-muted-foreground">
                  <span>I.G.V. 18%</span>
                  <span>S/ {invoiceTotals.totalTax.toFixed(2)}</span>
                </div>

                <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold">
                  <span>Total</span>
                  <span className="text-primary">
                    S/ {invoiceTotals.totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}

        {isFinal && sunatDoc && (
          <>
            <div className="text-sm font-semibold mt-2">Compartir con el cliente</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={compartirWhatsApp}>
                <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={imprimir}>
                <Printer className="h-4 w-4 text-blue-600" /> Imprimir
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                disabled={isDownloading(sale.id, "pdf")}
                onClick={() => downloadPdf(sunatDoc)}
              >
                {isDownloading(sale.id, "pdf") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 text-red-600" />
                )}
                Descargar PDF
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2"
                disabled={isDownloading(sale.id, "xml")}
                onClick={() => downloadXml(sunatDoc)}
              >
                {isDownloading(sale.id, "xml") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 text-primary" />
                )}
                Descargar XML
              </Button>
              {sunatDoc?.cdrUrl && (
                <Button variant="outline" className="justify-start gap-2" asChild>
                  <a href={sunatDoc.cdrUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4 text-green-600" /> Descargar CDR
                  </a>
                </Button>
              )}
              <ProximamenteButton
                label={
                  <>
                    <Mail className="mr-2 h-4 w-4" /> Enviar por Email
                  </>
                }
                tooltip="El envío automático por email todavía no está conectado."
                className="justify-start"
              />
              <ProximamenteButton
                label={
                  <>
                    <Link2 className="mr-2 h-4 w-4" /> Copiar link público
                  </>
                }
                tooltip="El link público de consulta del comprobante todavía no está disponible."
                className="justify-start col-span-2"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => onGenerarNota(row)}>
                Generar Nota de Crédito
              </Button>
              <ProximamenteButton
                label={
                  <>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Anular comprobante (baja)
                  </>
                }
                tooltip="La comunicación de baja ante SUNAT todavía no está conectada."
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
