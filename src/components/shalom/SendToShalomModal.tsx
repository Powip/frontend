"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
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
  Loader2,
  Truck,
  AlertCircle,
  Package,
  CheckCircle2,
  Plus,
  Printer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { API } from "@/lib/api";
import { getUserProfile } from "@/services/userService";

// Sentinel para representar el valor vacío "" que exige la API de Shalom.
// Radix Select no admite value="" en SelectItem — usar este sentinel y mapear al enviar.
const DECLARACION_JURADA_NINGUNA = "__ninguna__";

// Lista exacta del enum del OpenAPI de Shalom. NO agregar valores fuera de este set.
const DECLARACION_JURADA_OPTIONS = [
  { value: DECLARACION_JURADA_NINGUNA, label: "Ninguna" },
  { value: "Artículos de uso personal", label: "Artículos de uso personal" },
  { value: "Documentos", label: "Documentos" },
  { value: "Ropa", label: "Ropa" },
  { value: "Electrodomésticos", label: "Electrodomésticos" },
] as const;

const PACKAGE_TYPES = [
  { label: "SOBRE (5x30x20 cm)", value: "SOBRE", h: 5, w: 30, l: 20 },
  {
    label: "PAQUETE XXS (10x15x10 cm)",
    value: "PAQUETE XXS",
    h: 10,
    w: 15,
    l: 10,
  },
  {
    label: "PAQUETE XS (15x20x12 cm)",
    value: "PAQUETE XS",
    h: 15,
    w: 20,
    l: 12,
  },
  { label: "PAQUETE S (20x30x12 cm)", value: "PAQUETE S", h: 20, w: 30, l: 12 },
  { label: "PAQUETE M (24x30x20 cm)", value: "PAQUETE M", h: 24, w: 30, l: 20 },
  { label: "PAQUETE L (30x42x23 cm)", value: "PAQUETE L", h: 30, w: 42, l: 23 },
  { label: "CAJA (30x30x30 cm)", value: "CAJA", h: 30, w: 30, l: 30 },
  { label: "BULTO (40x40x40 cm)", value: "BULTO", h: 40, w: 40, l: 40 },
  { label: "Mercadería General (Manual)", value: "MERCADERIA" },
];

interface Agency {
  id_agencia: string;
  nombre_agencia: string;
  direccion: string;
  api_name: string;
  ter_aereo: number; // 1 = permite envío aéreo, 0 = solo terrestre
}

interface District {
  id_distrito: string;
  nombre_distrito: string;
}

interface ShipmentEntry {
  recipientDoc: string;
  recipientPhone: string;
  content: string;
  destinationSearch: string;
  destinationAgencyId: string;
  destinationAgencies: Agency[];
  loadingAgencies: boolean;
  securityCode: string;
  aereo: boolean;
  packageDetails: {
    quantity: number;
    weight: number;
    height: number;
    width: number;
    length: number;
  };
}

interface ShalomRegisteredShipment {
  trackingNumber?: string;
  guideNumber?: string;
  numero_guia?: string;
  recipientName?: string;
  shalomChangedToAereo?: boolean;
  aereoVerificado?: boolean;
}

interface ShalomShipmentError {
  error: string;
  index?: number;
  shipmentInfo?: { recipientDoc?: string; recipientName?: string };
  orderNumber?: string | null;
}

interface AgencySelectorProps {
  label: string;
  agencyLabel?: string;
  searchPlaceholder: string;
  agencies: Agency[];
  searchValue: string;
  selectedAgency: string;
  onSearchChange: (val: string) => void;
  onAgencyChange: (id: string) => void;
  isLoadingAgencies?: boolean;
  error?: boolean;
}

const AgencySelector = ({
  label,
  agencyLabel = "Agencia (Destino)",
  searchPlaceholder,
  agencies,
  searchValue,
  selectedAgency,
  onSearchChange,
  onAgencyChange,
  isLoadingAgencies,
  error,
}: AgencySelectorProps) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">
        {label}
      </Label>
      {error && !selectedAgency && (
        <span className="text-[10px] font-bold text-red-500">FALTANTE</span>
      )}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
          Buscar distrito / provincia
        </Label>
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 focus:border-blue-400 focus:ring-blue-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 dark:text-slate-100",
            error &&
              !searchValue &&
              "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20",
          )}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
          {agencyLabel}
        </Label>
        <Select
          value={selectedAgency}
          onValueChange={onAgencyChange}
          disabled={isLoadingAgencies}
        >
          <SelectTrigger
            className={cn(
              "h-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-100",
              error &&
                !selectedAgency &&
                "border-red-200 bg-red-50/10 dark:border-red-800 dark:bg-red-950/20",
            )}
          >
            <SelectValue
              placeholder={
                isLoadingAgencies
                  ? "Buscando..."
                  : !searchValue
                    ? "Escribe para buscar..."
                    : "Seleccionar agencia"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-[250px] w-full dark:bg-slate-800 dark:border-slate-700 z-50">
            {agencies.length === 0 && searchValue ? (
              <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500">
                No se encontraron agencias
              </div>
            ) : (
              agencies.map((a) => (
                <SelectItem
                  key={a.id_agencia}
                  value={a.api_name}
                  className="py-1 focus:bg-slate-50 dark:focus:bg-slate-700"
                >
                  <div className="flex items-start gap-2 max-w-none min-w-[300px]">
                    <div className="flex flex-col gap-0 flex-1 min-w-0">
                      <span className="font-normal text-[12px] text-slate-700 dark:text-slate-200 truncate">
                        {a.nombre_agencia}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate italic">
                        {a.direccion}
                      </span>
                    </div>
                    {a.ter_aereo === 1 ? (
                      <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800">
                        Terrestre + Aéreo
                      </span>
                    ) : (
                      <span className="shrink-0 mt-0.5 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                        Solo terrestre
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
);

interface SendToShalomModalProps {
  open: boolean;
  onClose: () => void;
  orders: any[];
  onSuccess?: () => void;
  guideId?: string;
  companyId?: string;
}

const extractShalomErrorMessage = (rawError: string): string => {
  if (!rawError) return "Error desconocido";
  try {
    const jsonMatch = rawError.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) return parsed.error;
      if (parsed.message) return parsed.message;
    }
  } catch {}
  // Quitar el prefijo "Error en Shalom API: " si existe
  return rawError.replace(/^Error en Shalom API:\s*/i, "").trim();
};

const isValidSecurityCode = (code: string): boolean => {
  if (!code || code.length !== 4) return false;

  // Detectar números consecutivos ascendentes: 1234, 2345, etc.
  const isAscending = code.split("").every((digit, i) => {
    if (i === 0) return true;
    return Number(digit) === Number(code[i - 1]) + 1;
  });

  // Detectar números consecutivos descendentes: 4321, 5432, etc.
  const isDescending = code.split("").every((digit, i) => {
    if (i === 0) return true;
    return Number(digit) === Number(code[i - 1]) - 1;
  });

  // Detectar todos los dígitos iguales: 1111, 2222, etc.
  const allSame = code.split("").every((digit) => digit === code[0]);

  return !isAscending && !isDescending && !allSame;
};

export default function SendToShalomModal({
  open,
  onClose,
  orders,
  onSuccess,
  guideId,
  companyId: providedCompanyId,
}: SendToShalomModalProps) {
  const { auth } = useAuth();
  const companyId = providedCompanyId || auth?.company?.id;
  const [originAgencies, setOriginAgencies] = useState<Agency[]>([]);
  const [originSearch, setOriginSearch] = useState<string>("");
  const [originAgency, setOriginAgency] = useState<string>("");
  const [globalSecurityCode, setGlobalSecurityCode] = useState<string>("");
  const [declaracionJurada, setDeclaracionJurada] = useState<string>(DECLARACION_JURADA_NINGUNA);
  const [loadingOrigins, setLoadingOrigins] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [sending, setSending] = useState(false);
  const [totalQuoted, setTotalQuoted] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const [shipmentsData, setShipmentsData] = useState<Record<string, ShipmentEntry>>({});

  const [successSummary, setSuccessSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
    errors: ShalomShipmentError[];
  } | null>(null);

  const [registeredShipments, setRegisteredShipments] = useState<ShalomRegisteredShipment[]>([]);
  const [aereoChangedShipments, setAereoChangedShipments] = useState<ShalomRegisteredShipment[]>([]);
  const [aereoUnverifiedShipments, setAereoUnverifiedShipments] = useState<ShalomRegisteredShipment[]>([]);

  const fetchAgencies = useCallback(
    async (q: string, type: "origin" | string) => {
      if (!q || q.length < 3) return;
      try {
        if (type === "origin") setLoadingOrigins(true);
        else {
          setShipmentsData((prev) => ({
            ...prev,
            [type]: { ...prev[type], loadingAgencies: true },
          }));
        }

        const res = await axios.get(
          `${API.integrations}/shalom/agencies/search/${encodeURIComponent(q)}`,
        );

        if (res.data.success) {
          // Map from results if they differ in structure
          const agencies = (res.data.data || []).map(
            (a: Record<string, unknown>): Agency => ({
              id_agencia: String(a.ter_id ?? a.id ?? a.id_agencia ?? ""),
              nombre_agencia: String(a.nombre ?? a.name ?? a.nombre_agencia ?? ""),
              api_name: String(a.lugar_over ?? a.nombre ?? a.name ?? ""),
              direccion: String(a.lugar ?? a.direccion ?? ""),
              ter_aereo: typeof a.ter_aereo === "number" ? a.ter_aereo : 0,
            }),
          );

          if (type === "origin") {
            setOriginAgencies(agencies);
          } else {
            setShipmentsData((prev) => ({
              ...prev,
              [type]: {
                ...prev[type],
                destinationAgencies: agencies,
                loadingAgencies: false,
              },
            }));
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (type === "origin") setLoadingOrigins(false);
        else {
          setShipmentsData((prev) => ({
            ...prev,
            [type]: { ...prev[type], loadingAgencies: false },
          }));
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || orders.length === 0) return;

    setIsSuccess(false);
    setSuccessSummary(null);
    setRegisteredShipments([]);
    setAereoChangedShipments([]);
    setAereoUnverifiedShipments([]);
    setTotalQuoted(null);
    setGlobalSecurityCode("");
    setDeclaracionJurada(DECLARACION_JURADA_NINGUNA);

    // Pre-fill origin: fetch perfil completo del usuario para obtener district/province
    const userId = auth?.user?.id;
    const accessToken = auth?.accessToken;
    if (userId && accessToken) {
      getUserProfile(userId, accessToken).then((profile) => {
        const storeDistrict =
          profile?.district || profile?.province || profile?.city || "";
        setOriginSearch(storeDistrict);
        if (storeDistrict) fetchAgencies(storeDistrict, "origin");
      });
    }

    const initialData: Record<string, ShipmentEntry> = {};
    orders.forEach((order) => {
      const destSearch =
        order.customer?.district || order.customer?.city || order.city || "";
      initialData[order.id] = {
        recipientDoc: order.customer?.dni || "",
        recipientPhone:
          order.recipientPhone || order.customer?.phoneNumber || "",
        content: "PAQUETE XXS",
        destinationSearch: destSearch,
        destinationAgencyId: "",
        destinationAgencies: [],
        loadingAgencies: false,
        securityCode: "",
        aereo: false,
        packageDetails: {
          quantity: 1,
          weight: 1,
          height: 10,
          width: 15,
          length: 10,
        },
      };
      if (destSearch) fetchAgencies(destSearch, order.id);
    });
    setShipmentsData(initialData);
  }, [open, orders, auth, fetchAgencies]);

  // Propagar código global a todos los pedidos cuando cambia
  useEffect(() => {
    if (orders.length === 0) return;
    setShipmentsData((prev) => {
      const next = { ...prev };
      orders.forEach((order) => {
        if (next[order.id]) {
          next[order.id] = { ...next[order.id], securityCode: globalSecurityCode };
        }
      });
      return next;
    });
  }, [globalSecurityCode, orders]);

  const updateShipmentField = (
    orderId: string,
    field: string,
    value: string | boolean | number | Agency[],
  ) => {
    setShipmentsData((prev) => {
      const current = prev[orderId] ?? ({} as ShipmentEntry);
      const newShipment: ShipmentEntry = { ...current, [field]: value } as ShipmentEntry;

      // If choosing a package type, sync dimensions
      if (field === "content") {
        const pkg = PACKAGE_TYPES.find((p) => p.value === value);
        if (pkg && pkg.h) {
          newShipment.packageDetails = {
            ...(current.packageDetails ?? {}),
            height: pkg.h,
            width: pkg.w ?? 0,
            length: pkg.l ?? 0,
          };
        }
      }

      return {
        ...prev,
        [orderId]: newShipment,
      };
    });

    if (field === "destinationSearch" && typeof value === "string" && value.length >= 3) {
      fetchAgencies(value, orderId);
    }
  };

  const updatePackageDetail = (orderId: string, field: string, value: number) => {
    setShipmentsData((prev) => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        packageDetails: {
          ...prev[orderId].packageDetails,
          [field]: value,
        },
      },
    }));
  };

  const handleQuote = async () => {
    try {
      setQuoting(true);
      const payload = {
        companyId: auth?.company?.id,
        shipments: orders.map((order) => {
          const data = shipmentsData[order.id];
          return {
            origin: originAgency,
            destination: data.destinationAgencyId,
            content: data.content,
            weight: String(data.packageDetails.weight),
            height: (Number(data.packageDetails.height) / 100).toFixed(2),
            width: (Number(data.packageDetails.width) / 100).toFixed(2),
            length: (Number(data.packageDetails.length) / 100).toFixed(2),
            quantity: String(data.packageDetails.quantity),
          };
        }),
      };

      const res = await axios.post(`${API.integrations}/shalom/quote`, payload);
      if (res.data.success) {
        setTotalQuoted(res.data.data.total_amount);
        toast.success(`Total: S/ ${res.data.data.total_amount}`);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Algo salió mal");
    } finally {
      setQuoting(false);
    }
  };

  const handleSend = async () => {
    try {
      setSending(true);

      const originAgencyObj = originAgencies.find(
        (a) => a.api_name === originAgency,
      );

      const orderDestinations: Record<string, string> = {};
      const orderDestinationNames: Record<string, string> = {};
      const packageDetails: Record<string, ShipmentEntry["packageDetails"] & { content: string; recipientDoc: string; recipientPhone: string; securityCode: string; aereo: boolean }> = {};

      orders.forEach((order) => {
        const data = shipmentsData[order.id];
        orderDestinations[order.id] = data.destinationAgencyId;

        const destAgencyObj = data.destinationAgencies?.find(
          (a: Agency) => a.api_name === data.destinationAgencyId,
        );
        orderDestinationNames[order.id] =
          destAgencyObj?.api_name || data.destinationAgencyId;

        packageDetails[order.id] = {
          weight: data.packageDetails.weight,
          height: data.packageDetails.height,
          width: data.packageDetails.width,
          length: data.packageDetails.length,
          content: data.content,
          recipientDoc: data.recipientDoc,
          recipientPhone: data.recipientPhone,
          quantity: data.packageDetails.quantity,
          securityCode: data.securityCode,
          aereo: data.aereo ?? false,
        };
      });

      const payload = {
        companyId: auth?.company?.id,
        id: guideId,
        originAgencyId: originAgency,
        originAgencyName: originAgencyObj?.api_name || originAgency,
        orderDestinations,
        orderDestinationNames,
        packageDetails,
        securityCode: orders[0] ? shipmentsData[orders[0].id]?.securityCode : "",
        quotedAmount: totalQuoted || undefined,
        quotedCurrency: "PEN",
        declaracionJurada: declaracionJurada === DECLARACION_JURADA_NINGUNA ? "" : declaracionJurada,
      };

      const res = await axios.post(
        `${API.courier}/shipping-guides/${guideId}/send-to-shalom`,
        payload,
      );

      if (res.data.success) {
        const summary = res.data.summary || {};
        const rawErrors: ShalomShipmentError[] = res.data.errors || [];

        // Enriquecer errores con el nro de orden cruzando por recipientDoc (dni) o por index
        const enrichedErrors: ShalomShipmentError[] = rawErrors.map((e) => {
          const byDoc = orders.find(
            (o) => o.customer?.dni && o.customer.dni === e.shipmentInfo?.recipientDoc,
          );
          const byIndex = typeof e.index === "number" ? orders[e.index] : undefined;
          const matchedOrder = byDoc || byIndex;
          return { ...e, orderNumber: matchedOrder?.orderNumber || null };
        });

        setSuccessSummary({
          total: summary.total || orders.length,
          successful: summary.successful || 0,
          failed: summary.failed || 0,
          errors: enrichedErrors,
        });

        const rawResults: ShalomRegisteredShipment[] = res.data.data || [];
        setRegisteredShipments(rawResults);

        const changedToAereo = rawResults.filter(
          (r) => r.shalomChangedToAereo === true,
        );
        setAereoChangedShipments(changedToAereo);
        if (changedToAereo.length > 0) {
          toast.warning(
            "Algunos envíos fueron cambiados a aéreo por Shalom, no por Powip.",
          );
        }

        const unverified = rawResults.filter(
          (r) => r.aereoVerificado === false && r.shalomChangedToAereo !== true,
        );
        setAereoUnverifiedShipments(unverified);
        if (unverified.length > 0) {
          toast.warning(
            "No se pudo verificar la modalidad de algunos envíos. Revisá en Shalom Pro.",
          );
        }

        if (enrichedErrors.length > 0) {
          const firstError = enrichedErrors[0];
          const orderLabel = firstError.orderNumber ? `[${firstError.orderNumber}] ` : "";
          const errorMsg = extractShalomErrorMessage(firstError?.error || "");
          const extraCount = enrichedErrors.length > 1 ? ` (+${enrichedErrors.length - 1} más)` : "";
          toast.warning(
            `${summary.successful} de ${summary.total} procesados correctamente`,
            {
              duration: 10000,
              description: `❌ ${orderLabel}${errorMsg}${extraCount}`,
            },
          );
        } else {
          toast.success(
            `¡Todas las guías (${summary.total}) han sido generadas en Shalom Pro!`,
          );
        }

        setIsSuccess(true);
        onSuccess?.();
      }
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message || "No se pudieron registrar las guías";
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  const allDestinationsSet = useMemo(() => {
    if (!originAgency) return false;
    return orders.every((order) => {
      const data = shipmentsData[order.id];
      return (
        data?.destinationAgencyId &&
        data?.recipientDoc?.length >= 8 &&
        data?.recipientPhone?.length === 9 &&
        isValidSecurityCode(data?.securityCode || "")
      );
    });
  }, [originAgency, orders, shipmentsData]);

  // Calcula todos los problemas de validación para mostrar en el panel
  const validationIssues = useMemo(() => {
    const issues: { label: string; field: string; orderId?: string }[] = [];

    if (!originAgency)
      issues.push({ label: "Agencia de origen", field: "origen" });

    if (!globalSecurityCode || !isValidSecurityCode(globalSecurityCode))
      issues.push({ label: "Código de seguridad global", field: "securityCode" });

    orders.forEach((order) => {
      const data = shipmentsData[order.id];
      const tag = `#${order.orderNumber}`;

      if (!data?.destinationAgencyId)
        issues.push({ label: "Agencia destino", field: "destino", orderId: tag });

      if (!data?.recipientDoc || data.recipientDoc.length < 8)
        issues.push({ label: "DNI / RUC", field: "doc", orderId: tag });

      if (!data?.recipientPhone || data.recipientPhone.length !== 9)
        issues.push({ label: "Teléfono (9 dígitos)", field: "phone", orderId: tag });

      if (!isValidSecurityCode(data?.securityCode || ""))
        issues.push({ label: "Código de seguridad", field: "code", orderId: tag });
    });

    return issues;
  }, [originAgency, globalSecurityCode, orders, shipmentsData]);

  const handlePrintLabels = () => {
    const successfulOrders = successSummary?.failed === 0
      ? orders
      : orders.filter((o) => {
          // Excluir las que fallaron si podemos identificarlas por nombre
          const failedNames = (successSummary?.errors || []).map(
            (e) => e.shipmentInfo?.recipientName,
          );
          return !failedNames.includes(o.customer?.fullName);
        });

    if (successfulOrders.length === 0) {
      toast.warning("No hay pedidos exitosos para imprimir");
      return;
    }

    const company = auth?.company;
    const companyName = company?.name || "MI EMPRESA";
    const companyCuit = company?.cuit || "";
    const companyAddress = company?.billingAddress || "";
    const companyPhone = company?.phone || "";
    const courierName = "Shalom";

    const labelsHtml = successfulOrders
      .map((order, index) => {
        const isLast = index === successfulOrders.length - 1;
        const data = shipmentsData[order.id] || {};
        // Usar los datos del formulario (lo que se envió a Shalom), no los del pedido original
        const recipientDoc = data.recipientDoc || order.customer?.dni || "-";
        const recipientPhone = data.recipientPhone || order.customer?.phoneNumber || order.recipientPhone || "-";
        const destinationAgency = data.destinationAgencyId || "";
        const customerAddress = destinationAgency
          ? `${courierName} ${destinationAgency}`
          : order.customer?.address || order.address || "-";
        const province =
          order.customer?.province || order.province || "-";
        const city =
          order.customer?.city || order.city || "-";
        const district =
          order.customer?.district || order.district || "-";

        return `
          <div class="label-page" style="${isLast ? "" : "page-break-after: always;"}">
            <div class="label-container">
              <div class="label-header">
                <div class="company-info">
                  <strong>${companyName}</strong>
                  ${companyCuit ? `<br/>${companyCuit}` : ""}
                  ${companyAddress ? `<br/>${companyAddress}` : ""}
                  ${companyPhone ? `<br/>${companyPhone}` : ""}
                </div>
              </div>

              <div class="label-consignado">
                <div class="consignado-title">CONSIGNADO</div>
                <strong>${order.customer?.fullName || "-"}</strong><br/>
                DNI: ${recipientDoc}<br/>
                Tel: ${recipientPhone}<br/>
                ${province} - ${city} - ${district}<br/>
                ${customerAddress}
              </div>

              <div class="label-courier">
                <strong>${courierName}</strong><br/>
                ${order.orderNumber}
              </div>
            </div>
          </div>
        `;
      })
      .join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Etiquetas Shalom</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 400px;
            margin: 0 auto;
          }
          .label-page { margin-bottom: 20px; }
          .label-container {
            border: 2px solid #000;
            padding: 15px;
            font-size: 11px;
            min-height: 200px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
          }
          .label-header { text-align: left; margin-bottom: 15px; font-weight: bold; }
          .company-info { font-size: 9px; line-height: 1.3; }
          .label-consignado {
            text-align: right;
            margin-bottom: 15px;
            line-height: 1.4;
          }
          .consignado-title { font-weight: bold; font-size: 10px; margin-bottom: 3px; }
          .label-courier {
            text-align: center;
            font-size: 12px;
            font-weight: bold;
            border-top: 1px dashed #000;
            padding-top: 10px;
          }
          @media print {
            body { padding: 0; }
            .label-page { margin-bottom: 0; }
          }
        </style>
      </head>
      <body>${labelsHtml}</body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast.success(`${successfulOrders.length} etiqueta(s) enviadas a imprimir`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] p-0 bg-white dark:bg-slate-900 overflow-visible">
        {/* Wrapper interno que maneja el layout — DialogContent mantiene su comportamiento nativo de Radix UI */}
        <div
          className="relative flex flex-col"
          style={{ maxHeight: "calc(90vh - 2rem)" }}
        >
          {/* Header fijo */}
          <div className="flex-shrink-0 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Enviar a Shalom Pro
              </h2>
            </div>
          </div>
          {/* Contenido scrolleable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-6 space-y-6">
              {orders.length === 0 ? (
                <div className="py-20 text-center text-slate-400 dark:text-slate-500">
                  No hay pedidos seleccionados
                </div>
              ) : isSuccess ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in zoom-in duration-500">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-20 scale-150" />
                    <CheckCircle2 className="h-28 w-28 text-green-500 relative z-10" />
                  </div>

                  <div className="text-center space-y-3 max-w-md">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                      {successSummary?.failed === 0
                        ? "¡Registro Exitoso!"
                        : "¡Registro Parcial!"}
                    </h2>

                    {successSummary && (
                      <div className="space-y-2">
                        {successSummary.failed > 0 && (
                          <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <p className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2">
                              ⚠️ {successSummary.failed} envíos fallaron:
                            </p>
                            <div className="text-xs text-amber-700 dark:text-amber-500 space-y-1 text-left max-h-32 overflow-y-auto">
                              {successSummary.errors.map(
                                (e, idx: number) => (
                                  <div
                                    key={idx}
                                    className="flex items-start gap-2"
                                  >
                                    <span className="font-mono text-amber-600 dark:text-amber-400">
                                      •
                                    </span>
                                    <span>
                                      <span className="font-semibold">
                                        {e.orderNumber
                                          ? `${e.orderNumber} — ${e.shipmentInfo?.recipientName || "Sin nombre"}`
                                          : e.shipmentInfo?.recipientName || "Sin nombre"}
                                        :
                                      </span>{" "}
                                      {extractShalomErrorMessage(e.error)}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {aereoChangedShipments.length > 0 && (
                      <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-left w-full max-w-md">
                        <p className="text-amber-800 dark:text-amber-400 font-bold text-sm mb-2">
                          Aviso: modalidad cambiada por Shalom
                        </p>
                        <div className="text-xs text-amber-700 dark:text-amber-500 space-y-1 max-h-32 overflow-y-auto">
                          {aereoChangedShipments.map((s, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="font-mono text-amber-600 dark:text-amber-400">•</span>
                              <span>
                                <span className="font-semibold font-mono">
                                  {s.trackingNumber || s.guideNumber || s.numero_guia || `Envío ${idx + 1}`}
                                </span>{" "}
                                — Este envío fue cambiado a aéreo por Shalom, no por Powip.
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {aereoUnverifiedShipments.length > 0 && (
                      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-left w-full max-w-md">
                        <p className="text-slate-700 dark:text-slate-300 font-bold text-sm mb-2">
                          Modalidad no confirmada
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          No se pudo confirmar si estos envíos quedaron terrestres o aéreos. Verificá en Shalom Pro.
                        </p>
                        <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                          {aereoUnverifiedShipments.map((s, idx: number) => (
                            <div key={idx} className="flex items-start gap-2">
                              <span className="font-mono text-slate-400 dark:text-slate-500">•</span>
                              <span className="font-mono font-semibold">
                                {s.trackingNumber || s.guideNumber || s.numero_guia || `Envío ${idx + 1}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {registeredShipments.length > 0 && (
                      <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-left w-full max-w-md">
                        <p className="text-xs font-bold text-green-700 dark:text-green-400 mb-2">
                          Guías registradas en Shalom:
                        </p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {registeredShipments.map((s, i: number) => (
                            <div key={i} className="flex justify-between items-center text-xs py-0.5 border-b border-green-100 dark:border-green-900 last:border-0">
                              <span className="text-green-800 dark:text-green-300 truncate pr-2">
                                {s.recipientName || orders[i]?.customer?.fullName || `Pedido ${i + 1}`}
                              </span>
                              <span className="font-mono font-bold text-green-700 dark:text-green-400 shrink-0">
                                {s.trackingNumber || s.guideNumber || s.numero_guia || "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm leading-relaxed mt-4">
                      Puedes realizar el seguimiento detallado en la vista de{" "}
                      <span className="text-blue-600 font-bold italic underline underline-offset-4 decoration-blue-200">
                        Seguimiento Courier
                      </span>
                      .
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={handlePrintLabels}
                      variant="outline"
                      className="gap-2 h-12 px-8 font-bold border-slate-300 dark:border-slate-600 dark:text-slate-200"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir etiquetas
                      {successSummary && successSummary.successful > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({successSummary.successful})
                        </span>
                      )}
                    </Button>
                    <Button
                      onClick={onClose}
                      className="bg-slate-900 hover:bg-black dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white px-12 h-12 font-bold rounded-2xl shadow-xl shadow-slate-200 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
                    >
                      Entendido, cerrar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Configuración Global */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 mb-8 space-y-6">
                    <AgencySelector
                      label="Agencia de origen (tu tienda)"
                      agencyLabel="Agencia (Origen)"
                      searchPlaceholder="Lima, Arequipa, etc."
                      agencies={originAgencies}
                      searchValue={originSearch}
                      selectedAgency={originAgency}
                      onSearchChange={(val) => {
                        setOriginSearch(val);
                        if (val.length >= 3) fetchAgencies(val, "origin");
                      }}
                      onAgencyChange={setOriginAgency}
                      isLoadingAgencies={loadingOrigins}
                      error={!originAgency}
                    />

                    {/* Código de seguridad global */}
                    <div className="border-t dark:border-slate-700 pt-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              Código de seguridad{" "}
                              <span className="text-blue-500 text-xs font-medium">
                                — aplica a todos los pedidos
                              </span>
                            </Label>
                            {globalSecurityCode &&
                              !isValidSecurityCode(globalSecurityCode) && (
                                <span className="text-[10px] font-bold text-red-500">
                                  INVÁLIDO
                                </span>
                              )}
                            {!globalSecurityCode && (
                              <span className="text-[10px] font-bold text-red-500">
                                FALTANTE
                              </span>
                            )}
                          </div>
                          <div className="space-y-1">
                            <Input
                              value={globalSecurityCode}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                                setGlobalSecurityCode(val);
                                if (
                                  val.length === 4 &&
                                  !isValidSecurityCode(val)
                                ) {
                                  toast.error(
                                    "Código inválido: no uses números consecutivos (ej: 1234, 4321) ni repetidos (ej: 1111)",
                                  );
                                }
                              }}
                              placeholder="Ej: 1357"
                              maxLength={4}
                              className={cn(
                                "h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100",
                                (!globalSecurityCode ||
                                  (globalSecurityCode.length > 0 &&
                                    globalSecurityCode.length < 4) ||
                                  (globalSecurityCode.length === 4 &&
                                    !isValidSecurityCode(globalSecurityCode))) &&
                                  "border-red-500",
                              )}
                            />
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium italic">
                              4 dígitos sin secuencias ni repetidos
                            </span>
                          </div>
                        </div>

                        {/* Declaración jurada global */}
                        <div>
                          <div className="mb-2">
                            <Label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                              Declaración jurada{" "}
                              <span className="text-blue-500 text-xs font-medium">
                                — aplica a todos los pedidos
                              </span>
                            </Label>
                          </div>
                          <Select
                            value={declaracionJurada}
                            onValueChange={setDeclaracionJurada}
                          >
                            <SelectTrigger className="h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                              {DECLARACION_JURADA_OPTIONS.map((opt) => (
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
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Destino y Detalles por Orden
                    </h3>

                    {orders.map((order) => {
                      const data = shipmentsData[order.id] || {};
                      const details = data.packageDetails || {};

                      return (
                        <Card
                          key={order.id}
                          className="overflow-hidden border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                        >
                          <CardContent className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                              {/* Info Cliente */}
                              <div className="lg:col-span-4 space-y-6 border-r dark:border-slate-700 pr-8">
                                <div>
                                  <h4 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                                    #{order.orderNumber}
                                  </h4>
                                  <div className="mt-1.5 space-y-0.5">
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                      {order.customer?.fullName || "—"}
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      {order.customer?.address || order.address || "—"}
                                    </p>
                                    {(order.customer?.district || order.customer?.city || order.customer?.province) && (
                                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                        {[order.customer?.district, order.customer?.city || order.customer?.province]
                                          .filter(Boolean)
                                          .join(" — ")}
                                      </p>
                                    )}
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      DNI:{" "}
                                      <span className="font-medium text-slate-600 dark:text-slate-300">
                                        {order.customer?.dni || "—"}
                                      </span>
                                    </p>
                                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                      Tel:{" "}
                                      <span className="font-medium text-slate-600 dark:text-slate-300">
                                        {order.customer?.phoneNumber || order.recipientPhone || "—"}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      DNI / RUC (DESTINATARIO)
                                    </Label>
                                    <Input
                                      value={data.recipientDoc}
                                      onChange={(e) =>
                                        updateShipmentField(
                                          order.id,
                                          "recipientDoc",
                                          e.target.value,
                                        )
                                      }
                                      className={cn(
                                        "h-8 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100",
                                        !data.recipientDoc &&
                                          "border-red-500 bg-white dark:bg-red-950/20",
                                      )}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      TELÉFONO (DESTINATARIO)
                                    </Label>
                                    <Input
                                      value={data.recipientPhone}
                                      onChange={(e) =>
                                        updateShipmentField(
                                          order.id,
                                          "recipientPhone",
                                          e.target.value,
                                        )
                                      }
                                      className={cn(
                                        "h-8 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100",
                                        data.recipientPhone?.length !== 9 &&
                                          "border-red-500 bg-white dark:bg-red-950/20",
                                      )}
                                    />
                                    <span className="text-[8px] text-slate-400 dark:text-slate-500 font-medium ml-1 italic">
                                      (9 dígitos)
                                    </span>
                                  </div>
                                </div>

                                {/* Bloque de dirección de entrega */}
                                {(order.customer?.address || order.customer?.district || order.customer?.city || order.customer?.province) && (
                                  <div className="p-2.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900 space-y-1">
                                    <p className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                                      Dirección de entrega
                                    </p>
                                    {order.customer?.address && (
                                      <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium leading-tight">
                                        {order.customer.address}
                                      </p>
                                    )}
                                    <div className="flex flex-wrap gap-3">
                                      {order.customer?.district && (
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                          Dist: <span className="font-semibold text-slate-700 dark:text-slate-200">{order.customer.district}</span>
                                        </span>
                                      )}
                                      {(order.customer?.city || order.customer?.province) && (
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                          Prov: <span className="font-semibold text-slate-700 dark:text-slate-200">{order.customer?.city || order.customer?.province}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Código de seguridad por orden */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <Label className="text-[9px] font-bold text-blue-500 dark:text-blue-400 uppercase tracking-tight">
                                      Cód. Seguridad
                                    </Label>
                                    {!isValidSecurityCode(data.securityCode || "") && (
                                      <span className="text-[9px] font-bold text-red-500">
                                        FALTANTE
                                      </span>
                                    )}
                                  </div>
                                  <Input
                                    value={data.securityCode || ""}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                                      updateShipmentField(order.id, "securityCode", val);
                                      if (val.length === 4 && !isValidSecurityCode(val)) {
                                        toast.error(
                                          "Código inválido: sin secuencias ni repetidos",
                                        );
                                      }
                                    }}
                                    placeholder="Ej: 1357"
                                    maxLength={4}
                                    className={cn(
                                      "h-8 text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100",
                                      (!data.securityCode ||
                                        (data.securityCode.length > 0 && data.securityCode.length < 4) ||
                                        (data.securityCode.length === 4 && !isValidSecurityCode(data.securityCode))) &&
                                        "border-red-500",
                                    )}
                                  />
                                </div>

                              </div>

                              {/* Selección Agencia */}
                              <div className="lg:col-span-5 space-y-6">
                                <AgencySelector
                                  label={`Agencia de Destino (${order.customer?.district || order.customer?.city || "Provincia"})`}
                                  searchPlaceholder="Buscar distrito / provincia"
                                  agencies={data.destinationAgencies || []}
                                  searchValue={data.destinationSearch}
                                  selectedAgency={data.destinationAgencyId}
                                  onSearchChange={(val) =>
                                    updateShipmentField(
                                      order.id,
                                      "destinationSearch",
                                      val,
                                    )
                                  }
                                  onAgencyChange={(id) =>
                                    updateShipmentField(
                                      order.id,
                                      "destinationAgencyId",
                                      id,
                                    )
                                  }
                                  isLoadingAgencies={data.loadingAgencies}
                                  error={!data.destinationAgencyId}
                                />

                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                    DETALLES DEL PAQUETE
                                  </Label>
                                  <div className="grid grid-cols-2 gap-4 pt-1">
                                    <div className="space-y-1.5">
                                      <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                        MERCADERÍA (TIPO DE CARGA)
                                      </Label>
                                      <Select
                                        value={data.content}
                                        onValueChange={(val) =>
                                          updateShipmentField(
                                            order.id,
                                            "content",
                                            val,
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                                          {PACKAGE_TYPES.map((pkg) => (
                                            <SelectItem
                                              key={pkg.label}
                                              value={pkg.value}
                                              className="dark:focus:bg-slate-700"
                                            >
                                              {pkg.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                                        BULTOS (CANT)
                                      </Label>
                                      <Input
                                        type="number"
                                        value={details.quantity}
                                        onChange={(e) =>
                                          updatePackageDetail(
                                            order.id,
                                            "quantity",
                                            Number(e.target.value),
                                          )
                                        }
                                        className="h-9 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Medidas + Modalidad */}
                              <div className="lg:col-span-3 bg-slate-50/50 dark:bg-slate-700/40 p-4 rounded-lg space-y-4">
                                {/* Modalidad de envío */}
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                    Modalidad de envío
                                  </Label>
                                  <div className="flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-600 h-9 text-xs font-bold">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateShipmentField(order.id, "aereo", false)
                                      }
                                      className={cn(
                                        "flex-1 flex items-center justify-center gap-1 transition-colors",
                                        !data.aereo
                                          ? "bg-slate-700 dark:bg-slate-200 text-white dark:text-slate-900"
                                          : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600",
                                      )}
                                    >
                                      Terrestre
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateShipmentField(order.id, "aereo", true)
                                      }
                                      className={cn(
                                        "flex-1 flex items-center justify-center gap-1 transition-colors border-l border-slate-200 dark:border-slate-600",
                                        data.aereo
                                          ? "bg-sky-600 dark:bg-sky-500 text-white"
                                          : "bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600",
                                      )}
                                    >
                                      Aéreo
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                    PESO (KG)
                                  </Label>
                                  <Input
                                    type="number"
                                    value={details.weight}
                                    onChange={(e) =>
                                      updatePackageDetail(
                                        order.id,
                                        "weight",
                                        Number(e.target.value),
                                      )
                                    }
                                    className="h-9 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div className="space-y-1 text-center">
                                    <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      ALTO (CM)
                                    </Label>
                                    <Input
                                      type="number"
                                      value={details.height}
                                      onChange={(e) =>
                                        updatePackageDetail(
                                          order.id,
                                          "height",
                                          Number(e.target.value),
                                        )
                                      }
                                      className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                    />
                                  </div>
                                  <div className="space-y-1 text-center">
                                    <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      ANCHO (CM)
                                    </Label>
                                    <Input
                                      type="number"
                                      value={details.width}
                                      onChange={(e) =>
                                        updatePackageDetail(
                                          order.id,
                                          "width",
                                          Number(e.target.value),
                                        )
                                      }
                                      className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                    />
                                  </div>
                                  <div className="space-y-1 text-center">
                                    <Label className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                                      LARGO (CM)
                                    </Label>
                                    <Input
                                      type="number"
                                      value={details.length}
                                      onChange={(e) =>
                                        updatePackageDetail(
                                          order.id,
                                          "length",
                                          Number(e.target.value),
                                        )
                                      }
                                      className="h-8 text-center text-xs bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-4 mt-8 pt-6 border-t dark:border-slate-700">
                    {totalQuoted !== null && (
                      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 rounded-lg p-4 flex justify-between items-center">
                        <span className="font-bold">
                          Total Cotizado: S/ {Number(totalQuoted).toFixed(2)}
                        </span>
                        <span className="text-xs font-medium uppercase tracking-widest">
                          {orders.length} pedidos
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Button
                        variant="outline"
                        onClick={handleQuote}
                        disabled={!allDestinationsSet || quoting || sending}
                        className="h-12 text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      >
                        {quoting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                            Cotizando...
                          </>
                        ) : (
                          "Cotizar Envío"
                        )}
                      </Button>
                      <Button
                        onClick={handleSend}
                        disabled={!allDestinationsSet || sending || quoting}
                        className="h-12 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold"
                      >
                        {sending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                            Enviando...
                          </>
                        ) : (
                          "Confirmar y enviar a Shalom"
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>{" "}
          {/* fin scroll wrapper */}
        </div>{" "}
        {/* fin relative wrapper */}
      </DialogContent>
    </Dialog>
  );
}
