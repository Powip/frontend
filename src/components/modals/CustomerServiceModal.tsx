"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { Phone, PhoneOff, MessageCircle, DollarSign, Pencil, Plus, MoreVertical, Check } from "lucide-react";
import { Textarea } from "../ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import CancellationModal, { CancellationReason } from "./CancellationModal";
import PaymentVerificationModal from "./PaymentVerificationModal";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  orderId: string;
  onClose: () => void;
  onOrderUpdated?: () => void;
}

interface OrderReceipt {
  orderId: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  salesChannel?: string;
  closingChannel?: string;
  callStatus?: string;
  callAttempts?: number;
  customer: {
    fullName: string;
    phoneNumber?: string;
    dni?: string;
    address?: string;
    district?: string;
    city?: string;
    province?: string;
    clientType?: string;
    reference?: string;
  };
  items: {
    productName: string;
    sku?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discountAmount: number;
    attributes?: Record<string, any>;
  }[];
  payments: {
    id: string;
    paymentMethod: string;
    amount: number;
    paymentDate: string;
    status: string;
  }[];
  totals: {
    productsTotal: number;
    taxTotal: number;
    shippingTotal: number;
    discountTotal: number;
    grandTotal: number;
    totalPaid: number;
    pendingAmount: number;
  };
}

export default function CustomerServiceModal({ open, orderId, onClose, onOrderUpdated }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [cancellationModalOpen, setCancellationModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    fetchReceipt();
  }, [open, orderId]);

  const fetchReceipt = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}/receipt`
      );
      setReceipt(res.data);
      
      const orderRes = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`
      );
      setNotes(orderRes.data.notes || "");
    } catch (err) {
      console.error("Error fetching receipt", err);
      toast.error("Error al cargar el pedido");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCallStatus = async (callStatus: "CONFIRMED" | "NO_ANSWER") => {
    try {
      const payload: { callStatus: string; status?: string } = { callStatus };
      
      if (callStatus === "CONFIRMED") {
        payload.status = "LLAMADO";
      }
      
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        payload
      );
      
      toast.success(callStatus === "CONFIRMED" ? "Entrega confirmada" : "Registrado como no contesta");
      fetchReceipt();
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error updating call status", error);
      toast.error("Error al actualizar el estado");
    }
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        { notes }
      );
      toast.success("Notas guardadas");
    } catch (error) {
      console.error("Error saving notes", error);
      toast.error("Error al guardar las notas");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleWhatsApp = () => {
    if (!receipt) return;
    const phone = receipt.customer.phoneNumber?.replace(/\D/g, "") || "";
    const cleanPhone = phone.startsWith("51") ? phone : `51${phone}`;
    
    const message = `Hola ${receipt.customer.fullName}! Te contactamos por tu pedido ${receipt.orderNumber}.`;
    
    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`,
      "_blank"
    );
  };

  const handleConfirmCancellation = async (reason: CancellationReason, reasonNotes?: string) => {
    setIsCancelling(true);
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
        {
          status: "ANULADO",
          cancellationReason: reason,
          notes: reasonNotes,
        }
      );
      toast.success("Venta anulada");
      setCancellationModalOpen(false);
      onClose();
      onOrderUpdated?.();
    } catch (error) {
      console.error("Error cancelling order", error);
      toast.error("No se pudo anular la venta");
    } finally {
      setIsCancelling(false);
    }
  };

  const isConfirmed = receipt?.status === "LLAMADO";

  if (!receipt && !loading) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">Cargando...</div>
          ) : receipt && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* ================================== */}
              {/* SECCIÓN IZQUIERDA */}
              {/* ================================== */}
              <div className="space-y-4">
                {/* Header: N° Orden y Total */}
                <div className="border-b pb-4">
                  <h2 className="text-2xl font-bold">N° de Orden # {receipt.orderNumber}</h2>
                  <p className="text-2xl font-bold text-primary">Total: S/{receipt.totals.grandTotal.toFixed(2)}</p>
                </div>

                {/* Productos */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-lg">Productos</h3>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto">
                    {receipt.items.map((item, i) => (
                      <div key={i} className="border rounded-md p-3 bg-gray-50">
                        <p className="font-medium text-base">{item.productName}</p>
                        {item.attributes && Object.keys(item.attributes).length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(item.attributes).map(([k, v]) => (
                              <span key={k} className="mr-2 bg-gray-200 px-1 rounded">{k}: {String(v)}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between text-sm mt-2">
                          <span>Cantidad: <strong>{item.quantity}</strong></span>
                          <span>Valor Und: <strong>S/{item.unitPrice.toFixed(2)}</strong></span>
                        </div>
                        <div className="flex justify-between text-sm font-medium mt-1 pt-1 border-t">
                          <span>Sub Total:</span>
                          <span className="text-primary">S/{item.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Resumen de Pagos */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-semibold mb-3 text-lg">Resumen de Pagos</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Productos:</span>
                      <span>S/{receipt.totals.productsTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>IGV 18%:</span>
                      <span>S/{receipt.totals.taxTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Envío:</span>
                      <span>S/{receipt.totals.shippingTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                      <span>Total:</span>
                      <span>S/{receipt.totals.grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Descuentos:</span>
                      <span>S/{receipt.totals.discountTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Adelanto:</span>
                      <span>S/{receipt.totals.totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-600 font-bold text-base">
                      <span>Por Cobrar:</span>
                      <span>S/{receipt.totals.pendingAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ================================== */}
              {/* SECCIÓN DERECHA */}
              {/* ================================== */}
              <div className="space-y-4">
                {/* Cliente */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-lg">Cliente</h3>
                    <div className="flex gap-1">
                      <Button 
                        size="icon" 
                        variant="outline"
                        className="h-9 w-9 bg-green-50 text-green-600 hover:bg-green-100"
                        onClick={handleWhatsApp}
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline"
                        className="h-9 w-9 bg-amber-50 text-amber-600 hover:bg-amber-100"
                        onClick={() => setPaymentModalOpen(true)}
                        title="Gestionar Pagos"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="outline"
                        className="h-9 w-9"
                        onClick={() => router.push(`/registrar-venta?orderId=${orderId}`)}
                        title="Editar Pedido"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Nombre: </span>
                      <span className="font-medium">{receipt.customer.fullName}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Distrito: </span>
                      <span className="font-medium">{receipt.customer.district || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Teléfono: </span>
                      <span className="font-medium">{receipt.customer.phoneNumber || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tipo: </span>
                      <span className="font-medium">{receipt.customer.clientType || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Dirección: </span>
                      <span className="font-medium">{receipt.customer.address || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Departamento: </span>
                      <span className="font-medium">{receipt.customer.city || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Canal Venta: </span>
                      <span className="font-medium">{receipt.salesChannel || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Provincia: </span>
                      <span className="font-medium">{receipt.customer.province || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Canal Cierre: </span>
                      <span className="font-medium">{receipt.closingChannel || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DNI: </span>
                      <span className="font-medium">{receipt.customer.dni || "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Referencia: </span>
                      <span className="font-medium">{receipt.customer.reference || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* Promo del día */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-red-700">Promo del día</h3>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 text-red-600"
                      onClick={() => router.push(`/registrar-venta?orderId=${orderId}`)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Agregar productos
                    </Button>
                  </div>
                  <p className="text-sm text-red-600">Agregar más productos a la venta</p>
                </div>

                {/* Gestión de Llamada */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Gestión de llamada</h3>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      (receipt.callAttempts || 0) >= 3 
                        ? "bg-red-100 text-red-700" 
                        : (receipt.callAttempts || 0) >= 2 
                          ? "bg-yellow-100 text-yellow-700" 
                          : "bg-gray-100 text-gray-700"
                    }`}>
                      Intentos: {receipt.callAttempts || 0}/3
                    </span>
                  </div>
                  
                  {isConfirmed ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-2 text-green-700">
                        <Check className="h-5 w-5" />
                        <span className="font-semibold">VENTA CONFIRMADA</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        El cliente confirmó la entrega del pedido
                      </p>
                    </div>
                  ) : (receipt.callAttempts || 0) >= 3 ? (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="flex items-center justify-center gap-2 text-red-700">
                          <PhoneOff className="h-5 w-5" />
                          <span className="font-semibold">LÍMITE DE INTENTOS ALCANZADO</span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">
                          Se han realizado 3 intentos de llamada sin respuesta.
                          <br />Se recomienda anular la venta.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleUpdateCallStatus("CONFIRMED")}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          CONFIRMA ENTREGA
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => setCancellationModalOpen(true)}
                        >
                          ANULAR VENTA
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(receipt.callAttempts || 0) >= 2 && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
                          <p className="text-sm text-yellow-700">
                            ⚠️ Último intento antes de sugerir anulación
                          </p>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          onClick={() => handleUpdateCallStatus("CONFIRMED")}
                        >
                          <Phone className="h-4 w-4 mr-2" />
                          CONFIRMA ENTREGA
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => handleUpdateCallStatus("NO_ANSWER")}
                        >
                          <PhoneOff className="h-4 w-4 mr-2" />
                          NO CONTESTA ({(receipt.callAttempts || 0) + 1}/3)
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notas y Acciones */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">Notas</h3>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                      >
                        {savingNotes ? "Guardando..." : "Guardar"}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            Más acciones
                            <MoreVertical className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => setCancellationModalOpen(true)}
                          >
                            Anular Venta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Agregar notas o comentarios del pedido..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Cancelación */}
      <CancellationModal
        open={cancellationModalOpen}
        onClose={() => setCancellationModalOpen(false)}
        orderNumber={receipt?.orderNumber || ""}
        onConfirm={handleConfirmCancellation}
        isLoading={isCancelling}
      />

      {/* Modal de Pagos */}
      <PaymentVerificationModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        orderId={orderId}
        orderNumber={receipt?.orderNumber || ""}
        onPaymentUpdated={() => {
          fetchReceipt();
          onOrderUpdated?.();
        }}
      />
    </>
  );
}
