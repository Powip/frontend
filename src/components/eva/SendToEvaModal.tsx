"use client";

import React, { useState, useEffect, useMemo } from "react";
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
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getEvaCredentials,
  getEvaDistricts,
  createEvaOrder,
  type EvaCredentialSafe,
  type EvaPaymentMethod,
  type EvaServiceType,
  type EvaCreateOrderResult,
  type CreateEvaOrderPayload,
} from "@/services/evaService";

// ─── CONSTANTES ─────────────────────────────────────────

const SERVICE_TYPE_OPTIONS: { value: EvaServiceType; label: string }[] = [
  { value: 1, label: "General" },
  { value: 2, label: "Tarde" },
];

const PAYMENT_METHOD_OPTIONS: { value: EvaPaymentMethod; label: string }[] = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "SOLO ENTREGAR", label: "Solo entregar (sin cobro)" },
  { value: "POS", label: "POS" },
  { value: "TRANSFERENCIA / YAPE", label: "Transferencia / Yape" },
  {
    value: "TRANSFERENCIA DIRECTA A EMPRESA",
    label: "Transferencia directa a empresa",
  },
  { value: "CAMBIO / CAMBIO CON COBRO", label: "Cambio / Cambio con cobro" },
  { value: "RECOJO EN RUTA", label: "Recojo en ruta" },
];

/** Normaliza un teléfono peruano de 9 dígitos (con o sin "51"/"+51") a "+51XXXXXXXXX". */
function normalizeEvaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length === 11) return `+${digits}`;
  if (digits.length === 9) return `+51${digits}`;
  return digits ? `+${digits}` : "";
}

function isValidEvaPhone(raw: string): boolean {
  return /^\+51\d{9}$/.test(normalizeEvaPhone(raw));
}

/**
 * Normaliza un string de distrito para matching TOLERANTE: recorta espacios,
 * colapsa espacios múltiples internos y uppercasea — replica exactamente la
 * normalización de `EvaCoverageService.validateDistrict` en ms-integrations (a
 * propósito SIN accent-folding, EVA es sensible a tildes).
 */
function normalizeDistrict(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

// ─── PROPS ──────────────────────────────────────────────

interface SendToEvaModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  companyId?: string;
  /** Datos del pedido ya cargados por el llamador — el modal solo los pre-completa. */
  recipientName: string;
  recipientPhone: string;
  district: string;
  address: string;
  amount: number;
  onSuccess?: () => void;
}

// ─── COMPONENTE ─────────────────────────────────────────

export default function SendToEvaModal({
  open,
  onClose,
  orderId,
  companyId: propCompanyId,
  recipientName,
  recipientPhone,
  district,
  address,
  amount,
  onSuccess,
}: SendToEvaModalProps) {
  const { auth } = useAuth();
  const companyId = propCompanyId ?? auth?.company?.id;
  const token = auth?.accessToken ?? "";

  // Estado de credencial
  const [loadingCredential, setLoadingCredential] = useState(false);
  const [credentialError, setCredentialError] = useState<string | null>(null);
  const [credential, setCredential] = useState<EvaCredentialSafe | null>(null);

  // Estado del maestro de distritos EVA (Anexo A, hallazgo #14 auditoría)
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtMismatch, setDistrictMismatch] = useState(false);

  // Formulario auto-completado desde el pedido
  const [localName, setLocalName] = useState("");
  const [localPhone, setLocalPhone] = useState("");
  const [localDistrict, setLocalDistrict] = useState("");
  const [localAddress, setLocalAddress] = useState("");
  const [localAmount, setLocalAmount] = useState("");

  // Campos EVA-específicos
  const [serviceType, setServiceType] = useState<EvaServiceType>(1);
  const [paymentMethod, setPaymentMethod] = useState<EvaPaymentMethod>("EFECTIVO");
  const [product, setProduct] = useState("");
  const [packages, setPackages] = useState("1");
  const [sku, setSku] = useState("");
  const [reference, setReference] = useState("");
  const [observations, setObservations] = useState("");

  // Envío
  const [sending, setSending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successResult, setSuccessResult] =
    useState<EvaCreateOrderResult | null>(null);

  // ─── EFECTOS ──────────────────────────────────────────

  useEffect(() => {
    if (!open || !companyId || !token) return;

    // Reset y auto-completado desde los datos del pedido
    setCredential(null);
    setCredentialError(null);
    setLocalName(recipientName ?? "");
    setLocalPhone(recipientPhone ?? "");
    setLocalDistrict("");
    setLocalAddress(address ?? "");
    setLocalAmount(amount != null && !Number.isNaN(amount) ? String(amount) : "");
    setServiceType(1);
    setPaymentMethod("EFECTIVO");
    setProduct("");
    setPackages("1");
    setSku("");
    setReference("");
    setObservations("");
    setIsSuccess(false);
    setSuccessResult(null);
    setDistricts([]);
    setDistrictsError(null);
    setDistrictMismatch(false);

    setLoadingCredential(true);
    getEvaCredentials(token, companyId)
      .then((cred) => {
        if (!cred || !cred.isActive) {
          setCredentialError(
            "La integración con EVA no está configurada o activa para esta empresa. Configurala en Configuración > Integraciones > EVA.",
          );
          return;
        }
        setCredential(cred);
      })
      .catch(() => {
        setCredentialError("Error al verificar la configuración de EVA.");
      })
      .finally(() => setLoadingCredential(false));

    // Maestro de distritos EVA — un solo request (cacheado en evaService), match
    // TOLERANTE (case-insensitive + espacios colapsados) contra el distrito del
    // pedido. Si no matchea, el campo queda sin selección (nunca texto libre).
    setLoadingDistricts(true);
    getEvaDistricts(token)
      .then((list) => {
        setDistricts(list);
        const rawDistrict = (district ?? "").trim();
        const normalizedTarget = normalizeDistrict(rawDistrict);
        const match = normalizedTarget
          ? list.find((d) => normalizeDistrict(d) === normalizedTarget)
          : undefined;

        if (match) {
          setLocalDistrict(match);
          setDistrictMismatch(false);
        } else {
          setLocalDistrict("");
          setDistrictMismatch(rawDistrict.length > 0);
        }
      })
      .catch(() => {
        setDistrictsError(
          "Error al cargar el listado de distritos habilitados por EVA.",
        );
      })
      .finally(() => setLoadingDistricts(false));
  }, [open, companyId, token, recipientName, recipientPhone, district, address, amount]);

  // ─── VALIDACIÓN ───────────────────────────────────────

  const parsedAmount = parseFloat(localAmount);
  const parsedPackages = parseInt(packages, 10);

  /** Opciones del Combobox de distrito — exclusivamente el maestro ya cargado. */
  const districtOptions = useMemo(
    () => districts.map((d) => ({ value: d, label: d })),
    [districts],
  );

  /** El distrito seleccionado debe ser SIEMPRE uno exacto del maestro cargado. */
  const isDistrictValid = districts.includes(localDistrict);

  const canSubmit = useMemo(() => {
    if (!credential || sending) return false;
    if (!localName.trim() || !isDistrictValid || !localAddress.trim())
      return false;
    if (!isValidEvaPhone(localPhone)) return false;
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) return false;
    if (credential.clientType === "RECOJO") {
      if (!product.trim() || Number.isNaN(parsedPackages) || parsedPackages < 1)
        return false;
    }
    if (credential.clientType === "ALMACEN") {
      if (!sku.trim()) return false;
    }
    return true;
  }, [
    credential,
    sending,
    localName,
    isDistrictValid,
    localAddress,
    localPhone,
    parsedAmount,
    product,
    parsedPackages,
    sku,
  ]);

  // ─── SUBMIT ───────────────────────────────────────────

  const handleCreate = async () => {
    if (!credential || !companyId || !canSubmit) return;

    setSending(true);
    try {
      const payload: CreateEvaOrderPayload = {
        companyId,
        orderId,
        recipientName: localName.trim(),
        recipientPhone: normalizeEvaPhone(localPhone),
        district: localDistrict.trim(),
        address: localAddress.trim(),
        amount: parsedAmount,
        paymentMethod,
        serviceType,
        ...(reference.trim() && { reference: reference.trim() }),
        ...(observations.trim() && { observations: observations.trim() }),
        ...(credential.clientType === "RECOJO" && {
          product: product.trim(),
          packages: parsedPackages,
        }),
        ...(credential.clientType === "ALMACEN" && { sku: sku.trim() }),
      };

      const result = await createEvaOrder(token, payload);
      setSuccessResult(result);
      setIsSuccess(true);
      toast.success("Pedido creado en EVA correctamente");
      onSuccess?.();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Error al crear el pedido en EVA";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-visible">
        <div
          className="relative flex flex-col"
          style={{ maxHeight: "calc(90vh - 2rem)" }}
        >
          {/* Header fijo */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-500" />
                Enviar a EVA
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-5">
              {/* Estado: Verificando credencial */}
              {loadingCredential && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                  <p className="text-sm font-medium">
                    Verificando configuración de EVA...
                  </p>
                </div>
              )}

              {/* Estado: Sin credencial activa */}
              {!loadingCredential && credentialError && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <AlertCircle className="h-12 w-12 text-red-400" />
                  <p className="text-sm font-medium text-red-600 dark:text-red-400 text-center">
                    {credentialError}
                  </p>
                  <Button variant="outline" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              )}

              {/* Estado: Éxito */}
              {isSuccess && successResult && (
                <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                    <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
                  </div>

                  <div className="text-center space-y-3 max-w-md w-full">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      ¡Pedido creado!
                    </h2>

                    <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-left">
                      <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">
                        Tracking ID en EVA:
                      </p>
                      <p className="font-mono font-bold text-green-800 dark:text-green-400 text-sm">
                        {successResult.trackingId}
                      </p>
                    </div>

                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-4">
                      El pedido fue registrado en EVA correctamente.
                    </p>
                  </div>

                  <Button
                    onClick={onClose}
                    className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-12 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                  >
                    Entendido, cerrar
                  </Button>
                </div>
              )}

              {/* Estado: Formulario auto-completado */}
              {!loadingCredential && !credentialError && credential && !isSuccess && (
                <>
                  {/* Datos del destinatario */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Destinatario
                    </p>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-name"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Nombre <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="eva-name"
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-phone"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Teléfono (+51) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="eva-phone"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        placeholder="999999999"
                        className={`h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 ${
                          localPhone.trim() && !isValidEvaPhone(localPhone)
                            ? "border-red-400"
                            : ""
                        }`}
                      />
                      {localPhone.trim() && !isValidEvaPhone(localPhone) && (
                        <p className="text-[10px] text-red-500">
                          Teléfono inválido — debe ser un número peruano de 9
                          dígitos.
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-district"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Distrito <span className="text-red-500">*</span>
                      </Label>

                      {loadingDistricts && (
                        <div className="h-9 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Cargando distritos habilitados por EVA...
                        </div>
                      )}

                      {!loadingDistricts && districtsError && (
                        <div className="flex items-center gap-2 text-xs text-red-500 dark:text-red-400">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          {districtsError}
                        </div>
                      )}

                      {!loadingDistricts && !districtsError && (
                        <>
                          <Combobox
                            value={localDistrict}
                            onValueChange={(value) => {
                              setLocalDistrict(value);
                              setDistrictMismatch(false);
                            }}
                            options={districtOptions}
                            placeholder="Seleccionar distrito"
                            searchPlaceholder="Buscar distrito..."
                            emptyMessage="No se encontraron distritos."
                            className={
                              !isDistrictValid ? "border-red-400" : ""
                            }
                          />
                          {districtMismatch && (
                            <p className="text-[10px] text-amber-600 dark:text-amber-400">
                              El distrito del pedido no coincide con la
                              cobertura de EVA — seleccioná uno manualmente.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-address"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Dirección <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="eva-address"
                        value={localAddress}
                        onChange={(e) => setLocalAddress(e.target.value)}
                        className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-amount"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Monto a cobrar (S/) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="eva-amount"
                        type="number"
                        min={0}
                        step={0.01}
                        value={localAmount}
                        onChange={(e) => setLocalAmount(e.target.value)}
                        className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  {/* Datos del servicio EVA */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Servicio EVA
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="eva-service-type"
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                        >
                          Tipo de servicio
                        </Label>
                        <Select
                          value={String(serviceType)}
                          onValueChange={(val) =>
                            setServiceType(Number(val) as EvaServiceType)
                          }
                        >
                          <SelectTrigger
                            id="eva-service-type"
                            className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                            {SERVICE_TYPE_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={String(opt.value)}
                                className="dark:focus:bg-slate-700"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label
                          htmlFor="eva-payment-method"
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                        >
                          Método de cobro
                        </Label>
                        <Select
                          value={paymentMethod}
                          onValueChange={(val) =>
                            setPaymentMethod(val as EvaPaymentMethod)
                          }
                        >
                          <SelectTrigger
                            id="eva-payment-method"
                            className="h-9 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                            {PAYMENT_METHOD_OPTIONS.map((opt) => (
                              <SelectItem
                                key={opt.value}
                                value={opt.value}
                                className="dark:focus:bg-slate-700"
                              >
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* RECOJO: product + packages */}
                    {credential.clientType === "RECOJO" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="eva-product"
                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                          >
                            Producto <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="eva-product"
                            value={product}
                            onChange={(e) => setProduct(e.target.value)}
                            placeholder="Descripción del producto a recoger"
                            className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="eva-packages"
                            className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                          >
                            Bultos <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            id="eva-packages"
                            type="number"
                            min={1}
                            value={packages}
                            onChange={(e) => setPackages(e.target.value)}
                            className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    )}

                    {/* ALMACEN: sku */}
                    {credential.clientType === "ALMACEN" && (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="eva-sku"
                          className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                        >
                          SKU(s) <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="eva-sku"
                          value={sku}
                          onChange={(e) => setSku(e.target.value)}
                          placeholder="CODIGO(cant),CODIGO(cant)"
                          className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          Formato: CODIGO(cantidad), separados por coma si hay
                          más de uno.
                        </p>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-reference"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Referencia{" "}
                        <span className="text-slate-400 font-normal normal-case">
                          (opcional)
                        </span>
                      </Label>
                      <Input
                        id="eva-reference"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label
                        htmlFor="eva-observations"
                        className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase"
                      >
                        Observaciones{" "}
                        <span className="text-slate-400 font-normal normal-case">
                          (opcional)
                        </span>
                      </Label>
                      <Textarea
                        id="eva-observations"
                        value={observations}
                        onChange={(e) => setObservations(e.target.value)}
                        placeholder="Notas para el mensajero (opcional)"
                        className="min-h-[64px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 resize-none"
                      />
                    </div>
                  </div>

                  {/* Botón de acción */}
                  <div className="pt-2 border-t dark:border-slate-700">
                    <Button
                      onClick={handleCreate}
                      disabled={!canSubmit}
                      className="w-full h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                    >
                      {sending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creando pedido...
                        </>
                      ) : (
                        "Crear pedido en EVA"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
