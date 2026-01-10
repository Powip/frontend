"use client";

import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  MapPin,
  Truck,
  FileText,
  MessageCircle,
  DollarSign,
  Clock,
  Eye,
  Copy,
  Loader2,
  Upload,
  Key,
  Building,
  Package,
  Check,
  X,
} from "lucide-react";
import { OrderHeader } from "@/interfaces/IOrder";
import PaymentVerificationModal from "@/components/modals/PaymentVerificationModal";
import OrderReceiptModal from "@/components/modals/orderReceiptModal";

interface ShippingGuide {
  id: string;
  guideNumber: string;
  storeId: string;
  courierId?: string | null;
  courierName?: string | null;
  orderIds: string[];
  status: string;
  chargeType?: string | null;
  amountToCollect?: number | null;
  scheduledDate?: Date | null;
  deliveryZone: string;
  deliveryType: string;
  deliveryAddress?: string | null;
  notes?: string | null;
  trackingUrl?: string | null;
  externalCarrierId?: string | null;
  externalGuideReference?: string | null;
  shippingKey?: string | null;
  shippingOffice?: string | null;
  shippingProofUrl?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnvioItem {
  order: OrderHeader;
  guide?: ShippingGuide | null;
  daysSinceCreated: number;
}

interface ProvinciaShipmentModalProps {
  open: boolean;
  onClose: () => void;
  envioItem: EnvioItem | null;
  onUpdate: () => void;
}

// Helper to calculate pending payment
const calculatePendingPayment = (order: OrderHeader): number => {
  const grandTotal = parseFloat(order.grandTotal) || 0;
  const totalPaid = order.payments
    .filter(p => p.status === "PAID")
    .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  return grandTotal - totalPaid;
};

export default function ProvinciaShipmentModal({
  open,
  onClose,
  envioItem,
  onUpdate,
}: ProvinciaShipmentModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Editable fields
  const [externalGuideReference, setExternalGuideReference] = useState("");
  const [shippingKey, setShippingKey] = useState("");
  const [shippingOffice, setShippingOffice] = useState("");
  const [shippingProofUrl, setShippingProofUrl] = useState("");
  
  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  
  // Receipt modal state (for printing order label)
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  
  // File upload state
  const [uploadingProof, setUploadingProof] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when envioItem changes
  useEffect(() => {
    if (envioItem?.guide) {
      setExternalGuideReference(envioItem.guide.externalGuideReference || "");
      setShippingKey(envioItem.guide.shippingKey || "");
      setShippingOffice(envioItem.guide.shippingOffice || "");
      setShippingProofUrl(envioItem.guide.shippingProofUrl || "");
    }
  }, [envioItem]);

  if (!envioItem) return null;

  const { order, guide, daysSinceCreated } = envioItem;
  const pendingPayment = calculatePendingPayment(order);
  const isPaid = pendingPayment <= 0;
  const isProvincia = order.salesRegion === "PROVINCIA";

  const handleSave = async () => {
    if (!guide) return;

    setSaving(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}`,
        {
          externalGuideReference,
          shippingKey,
          shippingOffice,
          shippingProofUrl,
        }
      );
      toast.success("Datos de envío actualizados");
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error al guardar";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadProof = async (file: File) => {
    if (!guide) return;

    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_COURIER}/shipping-guides/${guide.id}/upload-proof`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success("Comprobante subido correctamente");
      onUpdate();
    } catch (error: any) {
      const message = error?.response?.data?.message || "Error al subir comprobante";
      toast.error(message);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleUploadProof(file);
    }
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getDaysColor = (days: number) => {
    if (days <= 7) return "text-green-600";
    if (days <= 15) return "text-amber-600";
    if (days <= 30) return "text-orange-600";
    return "text-red-600";
  };

  const handleWhatsApp = () => {
    const phone = order.customer?.phoneNumber?.replace(/\D/g, "") || "";
    const countryCode = phone.startsWith("51") ? "" : "51";
    
    // Build message with tracking info
    let message = `Hola ${order.customer?.fullName || ""},\n\n`;
    message += `Tu pedido #${order.orderNumber} está en camino.\n\n`;
    
    if (guide?.courierName) {
      message += `📦 Empresa: ${guide.courierName}\n`;
    }
    if (shippingOffice || guide?.shippingOffice) {
      message += `🏢 Oficina: ${shippingOffice || guide?.shippingOffice}\n`;
    }
    if (externalGuideReference || guide?.externalGuideReference) {
      message += `🔢 Tracking: ${externalGuideReference || guide?.externalGuideReference}\n`;
    }
    // Only include shipping key if paid
    if (isPaid && (shippingKey || guide?.shippingKey)) {
      message += `🔑 Clave de envío: ${shippingKey || guide?.shippingKey}\n`;
    }
    
    if (order.customer?.district) {
      message += `📍 Distrito: ${order.customer.district}\n`;
    }

    const whatsappUrl = `https://wa.me/${countryCode}${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleViewProof = () => {
    const proofUrl = shippingProofUrl || guide?.shippingProofUrl;
    if (proofUrl) {
      window.open(proofUrl, "_blank");
    } else {
      toast.info("No hay comprobante de envío cargado");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`);
  };

  const handlePrintShippingLabel = () => {
    // Print a simple shipping label with client and tracking info
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      toast.error("No se pudo abrir la ventana de impresión");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Etiqueta de Envío - ${order.orderNumber}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 12px; 
            padding: 20px;
            max-width: 300px;
            margin: 0 auto;
          }
          .header { 
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #333;
          }
          .order-num { font-size: 18px; font-weight: bold; }
          .section { margin-bottom: 12px; }
          .section-title { 
            font-weight: bold; 
            font-size: 11px;
            text-transform: uppercase;
            margin-bottom: 5px;
            background: #f0f0f0;
            padding: 3px 5px;
          }
          .field { margin-bottom: 4px; }
          .label { color: #666; font-size: 10px; }
          .value { font-weight: 500; }
          .tracking-box {
            border: 2px dashed #333;
            padding: 10px;
            text-align: center;
            margin-top: 10px;
          }
          .tracking-num { font-size: 16px; font-weight: bold; }
          @media print {
            body { padding: 10px; }
            @page { margin: 5mm; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="order-num">ORDEN #${order.orderNumber}</div>
          <div>${order.salesRegion}</div>
        </div>

        <div class="section">
          <div class="section-title">Destinatario</div>
          <div class="field"><span class="label">Nombre:</span> <span class="value">${order.customer?.fullName || '-'}</span></div>
          <div class="field"><span class="label">Teléfono:</span> <span class="value">${order.customer?.phoneNumber || '-'}</span></div>
          <div class="field"><span class="label">DNI:</span> <span class="value">${order.customer?.documentNumber || '-'}</span></div>
        </div>

        <div class="section">
          <div class="section-title">Dirección de Entrega</div>
          <div class="field"><span class="value">${order.customer?.address || '-'}</span></div>
          <div class="field">${order.customer?.district || '-'}, ${order.customer?.city || '-'}</div>
          <div class="field">${order.customer?.province || '-'}</div>
        </div>

        ${guide ? `
        <div class="section">
          <div class="section-title">Transporte</div>
          <div class="field"><span class="label">Empresa:</span> <span class="value">${guide.courierName || order.courier || '-'}</span></div>
          <div class="field"><span class="label">Oficina:</span> <span class="value">${guide.shippingOffice || '-'}</span></div>
        </div>

        <div class="tracking-box">
          <div class="label">TRACKING</div>
          <div class="tracking-num">${guide.externalGuideReference || '-'}</div>
        </div>
        ` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Detalle de Envío - {isProvincia ? "PROVINCIA" : "LIMA"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-red-600 flex items-center gap-2">
                <User className="h-4 w-4" />
                Datos del cliente:
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Nombre:</span>
                  <span className="font-medium">{order.customer?.fullName || "-"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(order.customer?.fullName || "", "Nombre")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">DNI:</span>
                  <span className="font-medium">{order.customer?.documentNumber || "-"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(order.customer?.documentNumber || "", "DNI")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Teléfono:</span>
                  <span className="font-medium">{order.customer?.phoneNumber || "-"}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(order.customer?.phoneNumber || "", "Teléfono")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Dirección:
              </h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-muted-foreground">Departamento:</span> <span className="font-medium">{order.customer?.province || "-"}</span></div>
                <div><span className="text-muted-foreground">Provincia:</span> <span className="font-medium">{order.customer?.city || "-"}</span></div>
                <div><span className="text-muted-foreground">Distrito:</span> <span className="font-medium">{order.customer?.district || "-"}</span></div>
                <div><span className="text-muted-foreground">Dirección:</span> <span className="font-medium">{order.customer?.address || "-"}</span></div>
              </div>
            </div>
          </div>

          {/* Transport Info */}
          <div className="border-t pt-4">
            <h4 className="font-semibold text-red-600 flex items-center gap-2 mb-3">
              <Package className="h-4 w-4" />
              Datos de transporte:
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Fecha de envío:</span>{" "}
                <span className="font-medium">{formatDate(guide?.created_at)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Empresa:</span>{" "}
                <span className="font-medium">{guide?.courierName || order.courier || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Orden:</span>{" "}
                <span className="font-medium">{order.orderNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Guía:</span>{" "}
                <span className="font-medium">{guide?.guideNumber || order.guideNumber || "-"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Estado:</span>{" "}
                <Badge 
                  variant="outline"
                  className={guide?.status === "ENTREGADA" ? "bg-green-100 text-green-800" : 
                             guide?.status === "EN_RUTA" ? "bg-blue-100 text-blue-800" :
                             guide?.status === "FALLIDA" || guide?.status === "CANCELADA" ? "bg-red-100 text-red-800" :
                             "bg-gray-100 text-gray-800"}
                >
                  {guide?.status || "-"}
                </Badge>
              </div>
            </div>

            {/* Editable fields for PROVINCIA */}
            {isProvincia && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Building className="h-3 w-3" /> Oficina de envío
                    </Label>
                    {isEditing ? (
                      <Input
                        value={shippingOffice}
                        onChange={(e) => setShippingOffice(e.target.value)}
                        placeholder="Ej: Agencia Central Lima"
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{guide?.shippingOffice || "-"}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Tracking / Referencia
                    </Label>
                    {isEditing ? (
                      <Input
                        value={externalGuideReference}
                        onChange={(e) => setExternalGuideReference(e.target.value)}
                        placeholder="Ej: FRE-444"
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{guide?.externalGuideReference || "-"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Key className="h-3 w-3" /> Clave de envío
                    </Label>
                    {isEditing ? (
                      <Input
                        value={shippingKey}
                        onChange={(e) => setShippingKey(e.target.value)}
                        placeholder="Ej: 1612"
                        className="h-8"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <span className="font-medium text-lg">{guide?.shippingKey || "-"}</span>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800">
                            Pago pendiente - Clave oculta
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs flex items-center gap-1">
                      <Upload className="h-3 w-3" /> Estado de comprobante
                    </Label>
                    <div className="flex items-center gap-2">
                      {guide?.shippingProofUrl ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1 px-3 py-1">
                          <Check className="h-3 w-3" /> Comprobante Cargado
                        </Badge>
                      ) : uploadingProof ? (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 px-3 py-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Subiendo...
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1 px-3 py-1">
                          <X className="h-3 w-3" /> Sin Comprobante
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Days & Payment Status */}
          <div className="border-t pt-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">DÍAS TRANSCURRIDOS:</span>
                <span className={`text-lg font-bold ${getDaysColor(daysSinceCreated)}`}>
                  {daysSinceCreated} DÍAS
                </span>
              </div>
            </div>

            <div>
              {!isPaid ? (
                <Badge className="bg-amber-100 text-amber-800 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Pago Pendiente: S/ {pendingPayment.toFixed(2)}
                </Badge>
              ) : (
                <Badge className="bg-green-100 text-green-800 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  Pagado Completo
                </Badge>
              )}
            </div>
          </div>

          {/* Action Buttons Row 1 */}
          <div className="border-t pt-4 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleWhatsApp}
              className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
            >
              <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              className={isPaid 
                ? "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                : "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
              }
              onClick={() => setPaymentModalOpen(true)}
            >
              <DollarSign className="h-4 w-4 mr-1" /> 
              {isPaid ? "Ver Pagos" : "Gestionar Pagos"}
            </Button>

            {/* Ver Comprobante de Envío */}
            <div className="flex flex-col items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleViewProof}
                disabled={!guide?.shippingProofUrl}
              >
                <Eye className="h-4 w-4 mr-1" /> Ver Comprobante
              </Button>
              {!guide?.shippingProofUrl && (
                <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">Sin comprobante</span>
              )}
            </div>
          </div>

          {/* Action Buttons Row 2 - Print/Upload (Pyramid Layout) */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintShippingLabel}
              >
                <Truck className="h-4 w-4 mr-1" /> Imprimir Etiqueta Envío
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setReceiptModalOpen(true)}
              >
                <FileText className="h-4 w-4 mr-1" /> Imprimir Etiqueta Pedido
              </Button>
            </div>

            <div className="flex justify-center w-full">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploadingProof}
              />
              <Button
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingProof}
                className="bg-blue-600 hover:bg-blue-700 min-w-[200px]"
              >
                <Upload className="h-4 w-4 mr-1" /> Cargar Comprobante
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {isProvincia && guide && (
              <>
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                      Guardar
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    Editar datos de envío
                  </Button>
                )}
              </>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Payment Verification Modal */}
      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={order.id}
        orderNumber={order.orderNumber}
        onPaymentUpdated={onUpdate}
        canApprove={false}
      />

      {/* Order Receipt Modal (for printing order label) */}
      <OrderReceiptModal
        open={receiptModalOpen}
        orderId={order.id}
        onClose={() => setReceiptModalOpen(false)}
        onStatusChange={onUpdate}
      />
    </Dialog>
  );
}
