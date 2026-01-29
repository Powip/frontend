"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
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
import {
  DollarSign,
  Upload,
  Check,
  AlertCircle,
  ExternalLink,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

interface Payment {
  id: string;
  paymentMethod: string;
  amount: number;
  status: "PENDING" | "PAID" | "LOST";
  paymentProofUrl?: string | null;
  notes?: string | null;
  paymentDate: string;
}

interface OrderData {
  grandTotal: number;
  payments: Payment[];
}

interface PaymentVerificationModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onPaymentUpdated?: () => void;
  /** Solo permitir aprobar pagos desde /finanzas y /atencion-cliente */
  canApprove?: boolean;
}

const PAYMENT_METHODS = [
  { value: "YAPE", label: "Yape" },
  { value: "PLIN", label: "Plin" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "CONTRA_ENTREGA", label: "Contra Entrega" },
  { value: "BCP", label: "BCP" },
  { value: "BANCO_NACION", label: "Banco de la Nación" },
  { value: "MERCADO_PAGO", label: "Mercado Pago" },
  { value: "POS", label: "POS" },
];

export default function PaymentVerificationModal({
  open,
  onClose,
  orderId,
  orderNumber,
  onPaymentUpdated,
  canApprove = false,
}: PaymentVerificationModalProps) {
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingProofForId, setUploadingProofForId] = useState<string | null>(
    null,
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pathname = usePathname();

  // Determinar si la ruta actual permite aprobar/rechazar pagos
  const isAllowedRoute =
    pathname.includes("/operaciones") ||
    pathname.includes("/ventas") ||
    pathname.includes("/finanzas") ||
    pathname.includes("/atencion-cliente");
  const finalCanApprove = canApprove && isAllowedRoute;

  // Form states
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fetchOrderData = async () => {
    if (!orderId) return;

    setIsLoading(true);
    try {
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      setOrderData({
        grandTotal: Number(res.data.grandTotal),
        payments: res.data.payments || [],
      });
    } catch (error) {
      console.error("Error cargando datos de la orden", error);
      toast.error("Error al cargar datos de la orden");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && orderId) {
      fetchOrderData();
      setAmount("");
      setPaymentMethod("");
      setFile(null);
    }
  }, [open, orderId]);

  const totalPaid =
    orderData?.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const pendingPayments =
    orderData?.payments.filter((p) => p.status === "PENDING") || [];

  const pendingAmount = (orderData?.grandTotal || 0) - totalPaid;

  const handleSubmitPayment = async () => {
    if (!amount || !paymentMethod) {
      toast.warning("Completa el monto y método de pago");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.warning("El monto debe ser un número válido mayor a 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("amount", numericAmount.toString());
      formData.append("paymentMethod", paymentMethod);

      if (file) {
        formData.append("file", file);
      }

      await axios.post(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/orders/${orderId}/payments/with-proof`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      toast.success("Pago registrado correctamente");
      setAmount("");
      setPaymentMethod("");
      setFile(null);
      fetchOrderData();
      onPaymentUpdated?.();
    } catch (error) {
      console.error("Error registrando pago", error);
      toast.error("Error al registrar el pago");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/approve`,
      );
      toast.success("Pago aprobado");
      fetchOrderData();
      onPaymentUpdated?.();
    } catch (error) {
      console.error("Error aprobando pago", error);
      toast.error("Error al aprobar el pago");
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    if (
      !confirm(
        "¿Estás seguro de rechazar este pago? El pago quedará marcado como PERDIDO.",
      )
    ) {
      return;
    }
    try {
      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/reject`,
        { notes: "Pago rechazado" },
      );
      toast.success("Pago rechazado");
      fetchOrderData();
      onPaymentUpdated?.();
    } catch (error) {
      console.error("Error rechazando pago", error);
      toast.error("Error al rechazar el pago");
    }
  };

  const handleUploadProofToPayment = async (
    paymentId: string,
    proofFile: File,
  ) => {
    setUploadingProofForId(paymentId);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);

      await axios.patch(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/upload-proof`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      toast.success("Comprobante subido correctamente");
      fetchOrderData();
      onPaymentUpdated?.();
    } catch (error) {
      console.error("Error subiendo comprobante", error);
      toast.error("Error al subir el comprobante");
    } finally {
      setUploadingProofForId(null);
    }
  };

  const handleProofFileChange = (
    paymentId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleUploadProofToPayment(paymentId, selectedFile);
    }
  };

  const formatCurrency = (value: number) => {
    return `S/ ${value.toFixed(2)}`;
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Gestión de Pagos - Orden #{orderNumber}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            Cargando...
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto">
            {/* Resumen */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-bold text-lg">
                  {formatCurrency(orderData?.grandTotal || 0)}
                </p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Pagado</p>
                <p className="font-bold text-lg text-green-600">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div
                className={`rounded-lg p-3 text-center ${pendingAmount > 0 ? "bg-amber-50" : "bg-green-50"}`}
              >
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p
                  className={`font-bold text-lg ${pendingAmount > 0 ? "text-amber-600" : "text-green-600"}`}
                >
                  {formatCurrency(pendingAmount)}
                </p>
              </div>
            </div>

            {/* Pagos pendientes de aprobación */}
            {pendingPayments.length > 0 && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  Pagos Pendientes de Aprobación
                </h4>
                <div className="space-y-2">
                  {pendingPayments.map((payment) => (
                    <div
                      key={payment.id}
                      className="bg-amber-50 rounded-md p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-900">
                            {formatCurrency(Number(payment.amount))} -{" "}
                            {payment.paymentMethod}
                          </p>
                          {payment.paymentProofUrl ? (
                            <a
                              href={payment.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver comprobante
                            </a>
                          ) : (
                            <span className="text-xs text-amber-600">
                              Sin comprobante adjunto
                            </span>
                          )}
                        </div>
                        {finalCanApprove && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-green-50 hover:bg-green-100 text-green-600"
                              onClick={() => handleApprovePayment(payment.id)}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-red-50 hover:bg-red-100 text-red-600"
                              onClick={() => handleRejectPayment(payment.id)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rechazar
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Botón para subir comprobante si no tiene */}
                      {!payment.paymentProofUrl && (
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={(el) => {
                              fileInputRefs.current[payment.id] = el;
                            }}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleProofFileChange(payment.id, e)
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            disabled={uploadingProofForId === payment.id}
                            onClick={() =>
                              fileInputRefs.current[payment.id]?.click()
                            }
                          >
                            {uploadingProofForId === payment.id ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Subiendo...
                              </>
                            ) : (
                              <>
                                <ImagePlus className="h-3 w-3 mr-1" />
                                Agregar comprobante
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de pagos aprobados */}
            {(orderData?.payments.filter((p) => p.status === "PAID").length ??
              0) > 0 && (
              <div className="border rounded-lg p-3">
                <h4 className="font-medium text-sm mb-2">Pagos Aprobados</h4>
                <div className="space-y-1">
                  {orderData?.payments
                    .filter((p) => p.status === "PAID")
                    .map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span>
                            {formatCurrency(Number(payment.amount))} -{" "}
                            {payment.paymentMethod}
                          </span>
                          {payment.paymentProofUrl ? (
                            <a
                              href={payment.paymentProofUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver comprobante
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Sin comprobante adjunto
                            </span>
                          )}
                        </div>
                        <span className="text-green-600 text-xs font-medium">
                          ✓ Aprobado
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Formulario para nuevo pago */}
            {pendingAmount > 0 && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h4 className="font-medium text-sm mb-3">
                  Registrar Nuevo Pago
                </h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="amount">Monto *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        placeholder={`Saldo: ${pendingAmount.toFixed(2)}`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="method">Método *</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="proof">Comprobante (imagen)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="proof"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="flex-1"
                      />
                      {file && (
                        <span className="text-xs text-muted-foreground">
                          {file.name.slice(0, 20)}...
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmitPayment}
                    disabled={isSubmitting || !amount || !paymentMethod}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      "Registrando..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Registrar Pago
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {pendingAmount <= 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-green-700 font-medium">
                  ✓ Esta orden está completamente pagada
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
