"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { toast } from "sonner";
import { generateManualInvoice } from "@/api/Facturacion";
import { Loader2, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: any;
  onSuccess: () => void;
}

export default function InvoiceModal({
  isOpen,
  onClose,
  sale,
  onSuccess,
}: InvoiceModalProps) {
  const [documentType, setDocumentType] = useState<"01" | "03">("03"); // Default Boleta
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerName: "",
    customerDocNumber: "",
    customerAddress: "",
    customerDocType: "1", // 1: DNI, 6: RUC
  });

  useEffect(() => {
    if (sale) {
      setFormData({
        customerName: sale.customer?.fullName || "",
        customerDocNumber: sale.customer?.documentNumber || "",
        customerAddress: "", // Reset address as it might be new
        customerDocType: sale.customer?.documentType === "RUC" ? "6" : "1",
      });
      // Auto-detect document type
      if (sale.customer?.documentType === "RUC" || sale.customer?.documentNumber?.length === 11) {
        setDocumentType("01");
        setFormData(prev => ({ ...prev, customerDocType: "6" }));
      } else {
        setDocumentType("03");
        setFormData(prev => ({ ...prev, customerDocType: "1" }));
      }
    }
  }, [sale, isOpen]);

  const handleDocumentTypeChange = (val: "01" | "03") => {
    setDocumentType(val);
    if (val === "01") {
      setFormData(prev => ({ ...prev, customerDocType: "6" }));
    } else {
      setFormData(prev => ({ ...prev, customerDocType: "1" }));
    }
  };

  const handleSubmit = async () => {
    if (!sale) return;

    // Limpieza de strings antes de enviar
    const cleanCustomerName = formData.customerName.trim();
    const cleanDocNumber = formData.customerDocNumber.trim();
    const cleanAddress = formData.customerAddress.trim();

    // Validaciones estrictas
    if (documentType === "01") {
      const isRucValid = /^(10|20)\d{9}$/.test(cleanDocNumber);
      if (!isRucValid) {
        return toast.error("Para Facturas se requiere un RUC válido (11 dígitos, empieza con 10 o 20)");
      }
      if (!cleanCustomerName) {
        return toast.error("La Razón Social es obligatoria");
      }
      if (!cleanAddress) {
        return toast.error("La Dirección Fiscal es obligatoria para Facturas");
      }
    } else if (documentType === "03") {
      // Boleta: validar DNI (8) o RUC (11)
      if (formData.customerDocType === "1" && cleanDocNumber.length !== 8) {
        return toast.error("El DNI debe tener 8 dígitos");
      }
      if (formData.customerDocType === "6" && cleanDocNumber.length !== 11) {
        return toast.error("El RUC debe tener 11 dígitos");
      }
    }

    try {
      setLoading(true);
      const payload = {
        externalId: String(sale.id),
        documentType,
        customerName: cleanCustomerName,
        customerDocType: String(formData.customerDocType) as any,
        customerDocNumber: String(cleanDocNumber),
        customerAddress: cleanAddress || undefined,
        totalTax: Number((Number(sale.grandTotal) * 0.18 / 1.18).toFixed(2)), 
        totalValue: Number((Number(sale.grandTotal) / 1.18).toFixed(2)),
        totalPrice: Number(Number(sale.grandTotal).toFixed(2)),
        items: (sale.items || []).map((d: any) => ({
          internalCode: String(d.sku || "PROD001"),
          description: String(d.productName || "Producto"),
          quantity: Number(d.quantity || 1),
          unitPrice: Number(d.price || 0),
          unitCode: "NIU",
          taxType: "10", 
        })),
      };

      const res = await generateManualInvoice(payload);

      if (res.success) {
        const isObserved = res.data?.status === 'OBSERVED';
        const msg = isObserved 
          ? `Comprobante ${res.data.series}-${res.data.correlative} generado con observaciones.`
          : `Comprobante ${res.data.series}-${res.data.correlative} generado con éxito.`;
        
        toast.success(msg, {
          description: res.message || "SUNAT ha aceptado el comprobante.",
        });
        onSuccess();
      } else {
        toast.error(res.message || "Error al generar comprobante");
      }
    } catch (error: any) {
      console.error("Error emitting invoice:", error);
      const serverMessage = error.response?.data?.message;
      const displayMessage = Array.isArray(serverMessage) 
        ? serverMessage.join(", ") 
        : serverMessage || "Error de conexión con el servidor";
      
      toast.error("Error 400: Validación fallida", {
        description: displayMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Emitir Comprobante Electrónico
          </DialogTitle>
          <DialogDescription>
            Venta: <span className="font-bold text-foreground">{sale?.orderNumber}</span> - Total: <span className="font-bold text-primary">S/ {Number(sale?.grandTotal || 0).toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="docType">Tipo de Comprobante</Label>
            <Select value={documentType} onValueChange={handleDocumentTypeChange}>
              <SelectTrigger id="docType" className="bg-gray-50 border-none">
                <SelectValue placeholder="Selecciona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="03">Boleta de Venta (B001)</SelectItem>
                <SelectItem value="01">Factura (F001)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="customerDocType">Tipo Doc. Cliente</Label>
              <Select 
                value={formData.customerDocType} 
                onValueChange={(val) => setFormData(prev => ({ ...prev, customerDocType: val }))}
                disabled={documentType === "01"}
              >
                <SelectTrigger id="customerDocType" className="bg-gray-50 border-none">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">DNI</SelectItem>
                  <SelectItem value="6">RUC</SelectItem>
                  <SelectItem value="4">Carnet Ext.</SelectItem>
                  <SelectItem value="7">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="docNumber">{documentType === "01" ? "RUC" : "Número Doc."}</Label>
              <Input
                id="docNumber"
                placeholder="Ej. 20601234567"
                value={formData.customerDocNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, customerDocNumber: e.target.value }))}
                className="bg-gray-50 border-none"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="customerName">{documentType === "01" ? "Razón Social" : "Nombre del Cliente"}</Label>
            <Input
              id="customerName"
              placeholder="Ej. Juan Perez S.A.C."
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              className="bg-gray-50 border-none"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">Dirección Fiscal {documentType === "01" && <span className="text-red-500">*</span>}</Label>
            <Input
              id="address"
              placeholder="Ej. Av. Larco 123, Miraflores"
              value={formData.customerAddress}
              onChange={(e) => setFormData(prev => ({ ...prev, customerAddress: e.target.value }))}
              className="bg-gray-50 border-none"
            />
            {documentType === "01" && !formData.customerAddress && (
              <p className="text-[10px] text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Requerido para facturas
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white min-w-[140px]"
          >
            {loading ? (
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
      </DialogContent>
    </Dialog>
  );
}
