"use client";
import {useAuth} from "@/contexts/AuthContext";

import { useState, useEffect, useRef, useCallback } from "react";
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
  Pencil,
  X,
} from "lucide-react";
import axios from "axios";
import axiosAuth from "@/lib/axiosAuth";
import { toast } from "sonner";
import {
  getLeadPaymentCapabilities,
  captureLeadPayment,
  approveLeadPayment,
  rejectLeadPayment,
  changeLeadPaymentAmount,
  uploadLeadPaymentProof,
} from "@/services/leadPaymentsService";
import { safePaymentProof } from "@/components/commercial-leads/paymentPresentation";
import { notifyCommercialChange } from "@/utils/commercialOrders";
import { leadCommandId } from "@/components/commercial-leads/lead-ui";
import type { CaptureLeadPaymentInput, LeadPaymentCapabilities } from "@/types/leadPayments";

interface Payment {
  id: string;
  paymentMethod: string;
  amount: number;
  status: "PENDING" | "PAID" | "LOST";
  paymentProofUrl?: string | null;
  notes?: string | null;
  paymentDate: string;
  leadId?: string | null;
  leadPaymentVersion?: number | null;
}

interface OrderData {
  companyId?: string;
  commercialLeadId?: string | null;
  commercialStage?: "LEAD" | "SALE" | null;
  currency?: string | null;
  grandTotal: number;
  payments: Payment[];
}

interface PaymentVerificationModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderNumber: string;
  onPaymentUpdated?: () => void;
  /** Solo permitir aprobar pagos desde /finanzas */
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

const PROOF_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const PROOF_FILE_ACCEPT = PROOF_FILE_TYPES.join(",");

function validateProofFile(file: File) {
  if (!PROOF_FILE_TYPES.includes(file.type)) {
    toast.error("Tipo de archivo no permitido. Use JPG, PNG, WEBP o PDF.");
    return false;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error("El archivo es muy grande. Máximo 5MB.");
    return false;
  }
  return true;
}

export default function PaymentVerificationModal({
  open,
  onClose,
  orderId,
  orderNumber,
  onPaymentUpdated,
  canApprove = false,
}: PaymentVerificationModalProps) {
  const {auth, hasPermission}=useAuth();
  const canRecordOrderPayment = ["CREATE_SALE", "EDIT_SALE", "APPROVE_PAYMENTS"].some(hasPermission);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [leadPaymentCaps, setLeadPaymentCaps] = useState<LeadPaymentCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingProofForId, setUploadingProofForId] = useState<string | null>(
    null,
  );
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(
    null,
  );
  const [editingAmountForId, setEditingAmountForId] = useState<string | null>(
    null,
  );
  const [editAmountValue, setEditAmountValue] = useState("");
  const [savingAmountForId, setSavingAmountForId] = useState<string | null>(
    null,
  );
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const pathname = usePathname();

  // Aprobar/rechazar pagos solo puede pasar desde /finanzas (directiva de
  // negocio, ver FIX-aprobacion-pagos-solo-finanzas). El resto de pantallas
  // que usan este modal siguen pudiendo crear pagos y subir comprobantes.
  const isAllowedRoute =
    pathname === "/finanzas" || pathname.startsWith("/finanzas/");
  const finalCanApprove = canApprove && isAllowedRoute && hasPermission("APPROVE_PAYMENTS");

  // Form states
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const captureScope = `${auth?.company?.id ?? ""}:${auth?.user?.id ?? ""}:${orderId}`;
  const activeCaptureScope = useRef(captureScope);
  activeCaptureScope.current = captureScope;
  const leadCapture = useRef<{scope:string;leadId:string;input:CaptureLeadPaymentInput;file:File|null} | null>(null);
  const leadProofRetry = useRef<{scope:string;leadId:string;paymentId:string;file:File;input:CaptureLeadPaymentInput} | null>(null);
  const [captureFrozen, setCaptureFrozen] = useState(false);
  const needsLeadCapture = orderData?.commercialStage === "LEAD" || captureFrozen;
  const canRecord = needsLeadCapture ? Boolean(leadPaymentCaps?.enabled && leadPaymentCaps.canCapture) : canRecordOrderPayment;
  const activeOrderIdRef = useRef<string | null>(null);
  const orderRequestRef = useRef(0);
  const operationEpoch = useRef(0);
  const operationLocks = useRef(new Set<string>());
  useEffect(() => {
    setLeadPaymentCaps(null);
    if (!open || !needsLeadCapture) return;
    let active = true;
    void getLeadPaymentCapabilities().then((caps) => { if (active && activeCaptureScope.current === captureScope) setLeadPaymentCaps(caps); }).catch(() => { if (active) setLeadPaymentCaps(null); });
    return () => { active = false; };
  }, [open, needsLeadCapture, orderData?.commercialLeadId, captureScope]);
  const currentOperation = (epoch: number) =>
    operationEpoch.current === epoch && activeOrderIdRef.current === orderId;
  const paymentChanged = () => {
    notifyCommercialChange(orderData?.companyId);
    void fetchOrderData();
    onPaymentUpdated?.();
  };

  const fetchOrderData = useCallback(async () => {
    if (!orderId || activeOrderIdRef.current !== orderId) return;

    const requestId = ++orderRequestRef.current;
    const isCurrentRequest = () =>
      activeOrderIdRef.current === orderId &&
      orderRequestRef.current === requestId;
    setIsLoading(true);
    try {
      const res = await axiosAuth.get(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/order-header/${orderId}`,
      );
      if (!isCurrentRequest()) return;
      setOrderData({
        companyId: res.data.companyId || res.data.customer?.companyId,
        commercialLeadId: res.data.commercialLeadId,
        commercialStage: res.data.commercialStage,
        currency: res.data.currency,
        grandTotal: Number(res.data.grandTotal),
        payments: res.data.payments || [],
      });
    } catch (error) {
      if (!isCurrentRequest()) return;
      console.error("Error cargando datos de la orden", error);
      toast.error("Error al cargar datos de la orden");
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    operationEpoch.current += 1;
    activeOrderIdRef.current = open ? orderId : null;
    if (open && orderId) {
      setOrderData(null);
      fetchOrderData();
      if (leadCapture.current?.scope !== captureScope) leadCapture.current = null;
      if (leadProofRetry.current?.scope !== captureScope) leadProofRetry.current = null;
      const previous = leadCapture.current || leadProofRetry.current;
      setAmount(previous ? String(previous.input.amount) : "");
      setPaymentMethod(previous?.input.paymentMethod || "");
      setFile(previous?.file || null);
      setCaptureFrozen(Boolean(previous));
      setEditingAmountForId(null);
      setEditAmountValue("");
      setSavingAmountForId(null);
      setProcessingPaymentId(null);
      setUploadingProofForId(null);
      setIsSubmitting(false);
    }
    return () => {
      activeOrderIdRef.current = null;
      orderRequestRef.current += 1;
      operationEpoch.current += 1;
    };
  }, [open, orderId, fetchOrderData, captureScope]);

  const totalPaid =
    orderData?.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  const pendingPayments =
    orderData?.payments.filter((p) => p.status === "PENDING") || [];

  const pendingAmount = (orderData?.grandTotal || 0) - totalPaid;

  const handleSubmitPayment = async () => {
    if(!canRecord)return;
    const epoch = operationEpoch.current;
    const lockKey = `${epoch}:new`;
    if (!currentOperation(epoch) || operationLocks.current.has(lockKey)) return;
    if (!amount || !paymentMethod) {
      toast.warning("Completa el monto y método de pago");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.warning("El monto debe ser un número válido mayor a 0");
      return;
    }

    operationLocks.current.add(lockKey);
    setIsSubmitting(true);
    try {
      if (needsLeadCapture) {
        if (!orderData?.commercialLeadId || !orderData.currency || !/^[A-Z]{3}$/.test(orderData.currency)) throw new Error("Revisa la moneda y el Lead vinculado antes de registrar el anticipo.");
        const isCurrentCapture = () => currentOperation(epoch) && activeCaptureScope.current === captureScope;
        const proofRetry = leadProofRetry.current;
        if (proofRetry) {
          if (proofRetry.scope !== captureScope) return;
          // Same capture replay is a scoped read of its current version, without granting ledger read or creating a second payment.
          const payment = await captureLeadPayment(proofRetry.leadId, proofRetry.input);
          if (!isCurrentCapture()) return;
          if (payment.id !== proofRetry.paymentId) throw new Error("La captura ya no identifica el mismo anticipo. Revísalo desde el Lead.");
          if (!payment?.leadPaymentVersion) throw new Error("Actualiza el anticipo antes de volver a adjuntar su comprobante.");
          await uploadLeadPaymentProof(proofRetry.leadId, proofRetry.paymentId, payment.leadPaymentVersion, proofRetry.file);
          if (!isCurrentCapture()) return;
          leadProofRetry.current = null;
        } else {
          if (!leadCapture.current) leadCapture.current = {scope:captureScope,leadId:orderData.commercialLeadId,input:{captureId:leadCommandId(),amount:numericAmount,currency:orderData.currency,paymentMethod:paymentMethod as CaptureLeadPaymentInput["paymentMethod"]},file};
          const operation = leadCapture.current;
          if (operation.scope !== captureScope) return;
          setCaptureFrozen(true);
          const payment = await captureLeadPayment(operation.leadId, operation.input);
          if (!isCurrentCapture()) return;
          leadCapture.current = null;
          if (operation.file) {
            leadProofRetry.current = {scope:captureScope,leadId:operation.leadId,paymentId:payment.id,file:operation.file,input:operation.input};
            if (!payment.leadPaymentVersion) throw new Error("El anticipo quedó guardado. Actualiza su versión antes de adjuntar el comprobante.");
            await uploadLeadPaymentProof(operation.leadId,payment.id,payment.leadPaymentVersion,operation.file);
            if (!isCurrentCapture()) return;
            leadProofRetry.current = null;
          }
        }
        setCaptureFrozen(false);
        setAmount("");setPaymentMethod("");setFile(null);
        toast.success("Anticipo registrado. La compra sigue pendiente de confirmación del vendedor.");
        paymentChanged();
        return;
      }
      const formData = new FormData();
      formData.append("amount", numericAmount.toString());
      formData.append("paymentMethod", paymentMethod);

      if (file) {
        formData.append("file", file);
      }

      await axiosAuth.post(
        `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/orders/${orderId}/payments/with-proof`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (!currentOperation(epoch)) return;
      toast.success("Pago registrado correctamente");
      setAmount("");
      setPaymentMethod("");
      setFile(null);
      paymentChanged();
    } catch (error) {
      if (!currentOperation(epoch)) return;
      console.error("Error registrando pago", error);
      toast.error(leadProofRetry.current ? "El anticipo ya está guardado. Reintenta sólo el comprobante, sin crear otro pago." : leadCapture.current ? "No se pudo confirmar la respuesta. El reintento conserva el mismo anticipo y comando." : "Error al registrar el pago");
    } finally {
      operationLocks.current.delete(lockKey);
      if (currentOperation(epoch)) setIsSubmitting(false);
    }
  };

  const handleApprovePayment = async (paymentId: string) => {
    const epoch = operationEpoch.current;
    const lockKey = `${epoch}:${paymentId}`;
    if (
      !finalCanApprove ||
      !currentOperation(epoch) ||
      operationLocks.current.has(lockKey)
    )
      return;
    operationLocks.current.add(lockKey);
    setProcessingPaymentId(paymentId);
    try {
      const payment = orderData?.payments.find((p) => p.id === paymentId);
      if (payment?.leadId) {
        if (!payment.leadPaymentVersion)
          throw new Error(
            "Actualiza el pago para consultar su versión vigente.",
          );
        await approveLeadPayment(payment.leadId, paymentId, {
          version: payment.leadPaymentVersion,
        });
      } else {
        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/approve`,
        );
      }
      if (!currentOperation(epoch)) return;
      toast.success("Pago aprobado");
      paymentChanged();
    } catch (error) {
      if (!currentOperation(epoch)) return;
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (status === 403) {
        toast.error("No tenés permiso para aprobar pagos");
      } else {
        console.error("Error aprobando pago", error);
        toast.error("Error al aprobar el pago");
      }
    } finally {
      operationLocks.current.delete(lockKey);
      if (currentOperation(epoch)) setProcessingPaymentId(null);
    }
  };

  const handleRejectPayment = async (paymentId: string) => {
    const epoch = operationEpoch.current;
    const lockKey = `${epoch}:${paymentId}`;
    if (
      !finalCanApprove ||
      !currentOperation(epoch) ||
      operationLocks.current.has(lockKey)
    )
      return;
    if (
      !confirm(
        "¿Estás seguro de rechazar este pago? El pago quedará marcado como PERDIDO.",
      )
    ) {
      return;
    }
    operationLocks.current.add(lockKey);
    setProcessingPaymentId(paymentId);
    try {
      const payment = orderData?.payments.find((p) => p.id === paymentId);
      if (payment?.leadId) {
        if (!payment.leadPaymentVersion)
          throw new Error(
            "Actualiza el pago para consultar su versión vigente.",
          );
        await rejectLeadPayment(payment.leadId, paymentId, {
          version: payment.leadPaymentVersion,
          notes: "Pago rechazado",
        });
      } else {
        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/reject`,
          { notes: "Pago rechazado" },
        );
      }
      if (!currentOperation(epoch)) return;
      toast.success("Pago rechazado");
      paymentChanged();
    } catch (error) {
      if (!currentOperation(epoch)) return;
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (status === 403) {
        toast.error("No tenés permiso para rechazar pagos");
      } else {
        console.error("Error rechazando pago", error);
        toast.error("Error al rechazar el pago");
      }
    } finally {
      operationLocks.current.delete(lockKey);
      if (currentOperation(epoch)) setProcessingPaymentId(null);
    }
  };

  const handleStartEditAmount = (payment: Payment) => {
    setEditingAmountForId(payment.id);
    setEditAmountValue(String(Number(payment.amount)));
  };

  const handleCancelEditAmount = () => {
    setEditingAmountForId(null);
    setEditAmountValue("");
  };

  const handleUpdatePaymentAmount = async (paymentId: string) => {
    if(!canRecord)return;
    const epoch = operationEpoch.current;
    const lockKey = `${epoch}:${paymentId}`;
    if (
      !finalCanApprove ||
      !currentOperation(epoch) ||
      operationLocks.current.has(lockKey)
    )
      return;
    const numericAmount = parseFloat(editAmountValue);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast.warning("El monto debe ser un número válido mayor a 0");
      return;
    }

    operationLocks.current.add(lockKey);
    setSavingAmountForId(paymentId);
    try {
      const payment = orderData?.payments.find((p) => p.id === paymentId);
      if (payment?.leadId) {
        if (!payment.leadPaymentVersion)
          throw new Error(
            "Actualiza el pago para consultar su versión vigente.",
          );
        await changeLeadPaymentAmount(payment.leadId, paymentId, {
          version: payment.leadPaymentVersion,
          amount: numericAmount,
        });
      } else {
        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}`,
          { amount: numericAmount },
        );
      }
      if (!currentOperation(epoch)) return;
      toast.success("Monto del pago actualizado");
      setEditingAmountForId(null);
      setEditAmountValue("");
      paymentChanged();
    } catch (error) {
      if (!currentOperation(epoch)) return;
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      if (status === 400) {
        toast.error(
          "No se puede editar el monto: el pago ya no está pendiente.",
        );
      } else {
        console.error("Error actualizando el monto del pago", error);
        toast.error("Error al actualizar el monto del pago");
      }
      fetchOrderData();
    } finally {
      operationLocks.current.delete(lockKey);
      if (currentOperation(epoch)) setSavingAmountForId(null);
    }
  };

  const handleUploadProofToPayment = async (
    paymentId: string,
    proofFile: File,
  ) => {
    if(!canRecord)return;
    const epoch = operationEpoch.current;
    const lockKey = `${epoch}:${paymentId}`;
    if (!currentOperation(epoch) || operationLocks.current.has(lockKey)) return;
    operationLocks.current.add(lockKey);
    setUploadingProofForId(paymentId);
    try {
      const formData = new FormData();
      formData.append("file", proofFile);

      const payment = orderData?.payments.find((p) => p.id === paymentId);
      if (payment?.leadId) {
        if (!payment.leadPaymentVersion)
          throw new Error(
            "Actualiza el pago para consultar su versión vigente.",
          );
        await uploadLeadPaymentProof(
          payment.leadId,
          paymentId,
          payment.leadPaymentVersion,
          proofFile,
        );
      } else {
        await axiosAuth.patch(
          `${process.env.NEXT_PUBLIC_API_VENTAS}/payments/payments/${paymentId}/upload-proof`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
      }

      if (!currentOperation(epoch)) return;
      toast.success("Comprobante subido correctamente");
      paymentChanged();
    } catch (error) {
      if (!currentOperation(epoch)) return;
      console.error("Error subiendo comprobante", error);
      toast.error("Error al subir el comprobante");
    } finally {
      operationLocks.current.delete(lockKey);
      if (currentOperation(epoch)) setUploadingProofForId(null);
    }
  };

  const handleProofFileChange = (
    paymentId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = e.target.files?.[0];
    e.target.value = "";
    if (selectedFile && validateProofFile(selectedFile)) {
      handleUploadProofToPayment(paymentId, selectedFile);
    }
  };

  const renderProofUpload = (payment: Payment) => (
    <div className="flex items-center gap-2">
      <input
        type="file"
        ref={(el) => {
          fileInputRefs.current[payment.id] = el;
        }}
        accept={PROOF_FILE_ACCEPT}
        className="hidden"
        onChange={(e) => handleProofFileChange(payment.id, e)}
      />
      <Button
        size="sm"
        variant="outline"
        className="text-xs"
        disabled={!canRecord||uploadingProofForId === payment.id}
        onClick={() => fileInputRefs.current[payment.id]?.click()}
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
  );

  const formatCurrency = (value: number) => {
    const label =
      orderData?.currency === "PEN" ||
      (!orderData?.currency && !orderData?.commercialLeadId)
        ? "S/"
        : orderData?.currency || "Moneda no informada";
    return `${label} ${value.toFixed(2)}`;
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
        {orderData?.commercialLeadId ? (
          <a
            className="text-sm underline"
            href={`/leads-comerciales?leadId=${encodeURIComponent(orderData.commercialLeadId)}`}
          >
            Consultar el Lead y sus anticipos originales
          </a>
        ) : null}
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
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          {editingAmountForId === payment.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editAmountValue}
                                onChange={(e) =>
                                  setEditAmountValue(e.target.value)
                                }
                                className="h-8 w-28"
                                disabled={!canRecord||savingAmountForId === payment.id}
                              />
                              <span className="text-sm text-amber-900">
                                {payment.paymentMethod}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 bg-green-50 hover:bg-green-100 text-green-600"
                                disabled={!canRecord||savingAmountForId === payment.id}
                                onClick={() =>
                                  handleUpdatePaymentAmount(payment.id)
                                }
                              >
                                {savingAmountForId === payment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "Guardar"
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8"
                                disabled={!canRecord||savingAmountForId === payment.id}
                                onClick={handleCancelEditAmount}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-amber-900">
                                {formatCurrency(Number(payment.amount))} -{" "}
                                {payment.paymentMethod}
                              </p>
                              {finalCanApprove && (
                                <button
                                  type="button"
                                  className="text-xs text-amber-700 hover:underline flex items-center gap-0.5"
                                  onClick={() => handleStartEditAmount(payment)}
                                >
                                  <Pencil className="h-3 w-3" />
                                  Corregir monto
                                </button>
                              )}
                            </div>
                          )}
                          {payment.paymentProofUrl ? (
                            <a
                              href={
                                safePaymentProof(payment.paymentProofUrl) ||
                                undefined
                              }
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
                        {finalCanApprove &&
                          editingAmountForId !== payment.id && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-green-50 hover:bg-green-100 text-green-600"
                                disabled={processingPaymentId === payment.id}
                                onClick={() => handleApprovePayment(payment.id)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Aprobar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-red-50 hover:bg-red-100 text-red-600"
                                disabled={processingPaymentId === payment.id}
                                onClick={() => handleRejectPayment(payment.id)}
                              >
                                <X className="h-4 w-4 mr-1" />
                                Rechazar
                              </Button>
                            </div>
                          )}
                      </div>

                      {/* Botón para subir comprobante si no tiene */}
                      {!payment.paymentProofUrl && renderProofUpload(payment)}
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
                              href={
                                safePaymentProof(payment.paymentProofUrl) ||
                                undefined
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver comprobante
                            </a>
                          ) : (
                            <>
                              <span className="text-xs text-muted-foreground italic">
                                Sin comprobante adjunto
                              </span>
                              {renderProofUpload(payment)}
                            </>
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
                {orderData?.commercialStage === "LEAD" && leadPaymentCaps && !canRecord && <p role="status" className="mb-3 text-sm text-muted-foreground">La captura de anticipos no está habilitada para esta cuenta.</p>}
                <div className="space-y-3">
                  <div inert={captureFrozen}>
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
                    <Label htmlFor="proof">Comprobante (opcional)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="proof"
                        type="file"
                        accept={PROOF_FILE_ACCEPT}
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (
                            !selectedFile ||
                            !validateProofFile(selectedFile)
                          ) {
                            setFile(null);
                            e.target.value = "";
                            return;
                          }
                          setFile(selectedFile);
                        }}
                        className="flex-1"
                      />
                      {file && (
                        <span className="text-xs text-muted-foreground">
                          {file.name.slice(0, 20)}...
                        </span>
                      )}
                    </div>
                  </div>

                  </div>
                  {captureFrozen && <p role="status" className="text-xs">El reintento conserva el mismo anticipo. Si ya se guardó, sólo se adjunta su comprobante.</p>}
                  <Button
                    onClick={handleSubmitPayment}
                    disabled={!canRecord || isSubmitting || !amount || !paymentMethod}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      "Registrando..."
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        {captureFrozen ? leadProofRetry.current ? "Reintentar comprobante" : "Reintentar anticipo" : "Registrar Pago"}
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
