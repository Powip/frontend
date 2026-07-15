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
import { Download, FileText, Mail, Link2, MessageCircle, Printer, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { GATEWAY } from "@/lib/gateway";
import { EstadoBadge } from "@/app/facturacion/components/EstadoBadge";
import { ProximamenteButton } from "@/app/facturacion/components/ProximamenteButton";
import { ComprobanteRow } from "@/hooks/useComprobantesSunat";

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
  if (!row) return null;
  const { sale, log, estado, tipo, fullNumber } = row;

  const compartirWhatsApp = () => {
    const phone = sale.customer.phoneNumber?.replace(/\D/g, "");
    const firstName = (sale.customer.fullName || "").split(" ")[0];
    const msg = encodeURIComponent(
      `Hola ${firstName}, te enviamos tu comprobante de pago:\n${tipo === "01" ? "Factura" : "Boleta"} N° ${fullNumber}\nTotal: S/ ${Number(sale.grandTotal).toFixed(2)}\nValidado por SUNAT`
    );
    if (!phone) {
      toast.error("Esta venta no tiene un teléfono de contacto registrado");
      return;
    }
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank", "noopener,noreferrer");
    onAction?.(sale.id, "wa");
  };

  const imprimir = () => {
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Habilita las ventanas emergentes para imprimir");
      return;
    }
    const itemsRows = (sale.items || [])
      .map(
        (it) =>
          `<tr><td>${it.productName}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">S/ ${Number(it.price).toFixed(2)}</td><td style="text-align:right">S/ ${(it.quantity * Number(it.price)).toFixed(2)}</td></tr>`
      )
      .join("");
    w.document.write(`<html><head><title>${fullNumber || sale.orderNumber}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#101828}
      h1{font-size:18px;margin-bottom:2px} table{width:100%;border-collapse:collapse;margin-top:14px}
      th{background:#f2f4f5;text-align:left;padding:7px 9px;font-size:11px}
      td{padding:7px 9px;font-size:11.5px;border-bottom:1px solid #eee}
    </style></head><body>
    <h1>${tipo === "01" ? "Factura Electrónica" : "Boleta de Venta Electrónica"} ${fullNumber || ""}</h1>
    <div style="color:#667085;font-size:12px">Cliente: ${sale.customer.fullName} · Venta ${sale.orderNumber}</div>
    <table><thead><tr><th>Descripción</th><th>Cant.</th><th>P. Unit.</th><th>Importe</th></tr></thead>
    <tbody>${itemsRows}</tbody></table>
    <div style="text-align:right;margin-top:10px;font-weight:bold">Total: S/ ${Number(sale.grandTotal).toFixed(2)}</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    onAction?.(sale.id, "print");
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
            <div className="font-medium">{new Date(sale.created_at).toLocaleString("es-PE")}</div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs">Total</div>
            <div className="font-bold text-primary">S/ {Number(sale.grandTotal).toFixed(2)}</div>
          </div>
          {log?.sunat_description && (
            <div className="col-span-2">
              <div className="text-muted-foreground text-xs">CDR SUNAT</div>
              <div className="font-medium">{log.sunat_description}</div>
            </div>
          )}
        </div>

        {sale.items?.length ? (
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
                {sale.items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell>{it.productName}</TableCell>
                    <TableCell className="text-center">{it.quantity}</TableCell>
                    <TableCell className="text-right">S/ {Number(it.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right">S/ {(it.quantity * Number(it.price)).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {isFinal && (
          <>
            <div className="text-sm font-semibold mt-2">Compartir con el cliente</div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={compartirWhatsApp}>
                <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
              </Button>
              <Button variant="outline" className="justify-start gap-2" onClick={imprimir}>
                <Printer className="h-4 w-4 text-blue-600" /> Imprimir
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href={`${GATEWAY.integrations}/sunat/pdf/${sale.id}`} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4 text-red-600" /> Descargar PDF
                </a>
              </Button>
              <Button variant="outline" className="justify-start gap-2" asChild>
                <a href={`${GATEWAY.integrations}/sunat/xml/${sale.id}`} target="_blank" rel="noopener noreferrer">
                  <FileText className="h-4 w-4 text-primary" /> Descargar XML
                </a>
              </Button>
              {log?.cdr_url && (
                <Button variant="outline" className="justify-start gap-2" asChild>
                  <a href={log.cdr_url} target="_blank" rel="noopener noreferrer">
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
