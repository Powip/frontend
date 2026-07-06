"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Upload,
  CreditCard,
  Truck,
  RefreshCcw,
  AlertTriangle,
  Check,
  Key,
  MessageCircle,
  Loader2,
  X,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCreateLiquidationPayment,
  useCreateFreightPayment,
  useLiquidationDetails,
} from "@/hooks/finanzas/useLiquidaciones";
import type { TableRow as ApiTableRow } from "@/api/Courier";

// ---- Schema ----

const pagoSchema = z.object({
  monto: z
    .string()
    .min(1, "El monto es requerido")
    .refine(
      (v) => {
        const n = parseFloat(v.replace(",", "."));
        return !isNaN(n) && n > 0;
      },
      { message: "El monto debe ser mayor a 0" },
    ),
  metodo: z.string().min(1, "Seleccioná un método de pago"),
  numeroOperacion: z.string().optional(),
  fecha: z.string().min(1, "La fecha es requerida"),
  observaciones: z.string().max(400, "Máximo 400 caracteres").optional(),
});

type PagoFormValues = z.infer<typeof pagoSchema>;

// ---- Local interfaces ----

interface PedidoItem {
  id: string;
  cliente?: string;
  distrito?: string;
  adelanto?: number;
  monto?: number;
  estado: string;
  entregado?: boolean;
  subtext?: string;
  dias?: string;
  diasPorcentaje?: number;
  warningText?: string;
  [key: string]: unknown;
}

interface PagoItem {
  id: string;
  monto: number;
  metodo: string;
  fecha: string;
  [key: string]: unknown;
}

// ---- Helper ----

function fmtMoney(n: number): string {
  if (!n || n === 0) return "S/ 0";
  return `S/ ${n.toLocaleString("es-PE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// ---- Shared form fields component ----

interface PagoFormFieldsProps {
  form: ReturnType<typeof useForm<PagoFormValues>>;
  tipo: string;
  comprobante: File | null;
  onComprobanteChange: (file: File | null) => void;
  fileInputId?: string;
}

function PagoFormFields({
  form,
  tipo,
  comprobante,
  onComprobanteChange,
  fileInputId = "comprobante-input",
}: PagoFormFieldsProps) {
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = form;
  const observaciones = watch("observaciones") ?? "";
  const isTipoB = tipo === "Negocio cobra";

  return (
    <div className="space-y-4">
      {tipo === "Courier cobra" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 text-[13px] text-blue-700 dark:text-blue-400">
          <span className="font-bold">
            Courier cobra al cliente y rinde al negocio.
          </span>{" "}
          Métodos: cómo el courier transfiere al negocio.
        </div>
      )}
      {isTipoB && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 rounded-lg p-3 text-[13px] text-blue-800 dark:text-blue-300">
          <span className="font-bold">Negocio paga el flete al courier.</span>{" "}
          El cliente pagó al negocio. Registra cuánto le pagás al courier por
          las entregas.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Monto <span className="text-red-500 dark:text-red-400">*</span>
          </Label>
          <Input
            {...register("monto")}
            placeholder="Ej: 250.00"
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 shadow-sm"
          />
          {errors.monto && (
            <p className="text-[11px] text-red-500">{errors.monto.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Método <span className="text-red-500 dark:text-red-400">*</span>
          </Label>
          <Controller
            control={control}
            name="metodo"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 shadow-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transferencia">
                    Transferencia BCP
                  </SelectItem>
                  <SelectItem value="yape">Yape</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.metodo && (
            <p className="text-[11px] text-red-500">{errors.metodo.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            N° de operación
          </Label>
          <Input
            {...register("numeroOperacion")}
            placeholder="Ej: Op. 98765432"
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 shadow-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Fecha
          </Label>
          <Input
            type="date"
            {...register("fecha")}
            className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-10 shadow-sm"
          />
          {errors.fecha && (
            <p className="text-[11px] text-red-500">{errors.fecha.message}</p>
          )}
        </div>
      </div>

      {/* Comprobante — upload habilitado */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Comprobante (Imagen)
          <span className="ml-2 text-[10px] font-normal normal-case text-slate-400 dark:text-slate-500">
            opcional · JPG, PNG, WEBP — máx. 5 MB
          </span>
        </Label>
        {comprobante ? (
          <div className="flex items-center gap-3 border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-white dark:bg-slate-900 shadow-sm">
            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md shrink-0">
              <ImageIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <span className="text-[13px] text-slate-700 dark:text-slate-300 flex-1 truncate">
              {comprobante.name}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
              {(comprobante.size / 1024).toFixed(0)} KB
            </span>
            <button
              type="button"
              onClick={() => onComprobanteChange(null)}
              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor={fileInputId}
            className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-3 text-center bg-white dark:bg-slate-900 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors"
          >
            <input
              type="file"
              id={fileInputId}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && file.size > 5 * 1024 * 1024) {
                  toast.error("El archivo supera los 5 MB");
                  e.target.value = "";
                  return;
                }
                onComprobanteChange(file);
              }}
            />
            <Upload className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="text-[13px] text-slate-500 dark:text-slate-400">
              Seleccionar archivo
            </span>
          </label>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
          <span>Observaciones</span>
          <span className="text-slate-400 dark:text-slate-500 normal-case font-normal">
            (opcional)
          </span>
        </Label>
        <Textarea
          {...register("observaciones")}
          placeholder="Ej: Shalom rindió en 2 partes · Falta confirmar pedidos de Iquitos · Courier llegó tarde a liquidar..."
          className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 min-h-[90px] resize-none shadow-sm text-[13px]"
        />
        {errors.observaciones && (
          <p className="text-[11px] text-red-500">
            {errors.observaciones.message}
          </p>
        )}
        <div className="text-right text-[11px] text-slate-400 dark:text-slate-500">
          {observaciones.length}/400 caracteres
        </div>
      </div>

      <div className="bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-[12px] rounded-lg p-3 text-center">
        <span className="font-bold">Al registrar:</span> Saldo de la guía se
        actualiza · Si llega a S/0.00 queda liquidada · Observación guardada en
        el historial del pago
      </div>
    </div>
  );
}

// ---- Sub-modal for Tipo B (pago de flete) ----

interface PagoFleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApiTableRow;
  courierDisplay: string;
  storeId: string;
}

function PagoFleteModal({
  isOpen,
  onClose,
  data,
  courierDisplay,
  storeId,
}: PagoFleteModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const [comprobante, setComprobante] = useState<File | null>(null);

  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      monto: String(data?.costos ?? ""),
      metodo: "",
      numeroOperacion: "",
      fecha: today,
      observaciones: "",
    },
  });

  const createFreightPayment = useCreateFreightPayment(storeId, data.id);

  const handleSubmit = form.handleSubmit((values) => {
    const montoNum = parseFloat(values.monto.replace(",", "."));
    createFreightPayment.mutate(
      {
        monto: montoNum,
        metodo: values.metodo as
          | "transferencia"
          | "yape"
          | "efectivo"
          | "no-aplica",
        numeroOperacion: values.numeroOperacion || undefined,
        fecha: values.fecha,
        observaciones: values.observaciones || undefined,
        cobrarOpcion: "nada",
        comprobante: comprobante ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success("Pago de flete registrado correctamente");
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || "No se pudo registrar el pago");
        },
      },
    );
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl p-0 rounded-xl overflow-hidden shadow-2xl">
        <DialogHeader className="p-4 px-6 border-b bg-background">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 dark:bg-blue-900/40 p-2.5 rounded-full">
              <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Registrar pago de flete
              </DialogTitle>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                {courierDisplay} · Flete: {fmtMoney(data.costos)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 bg-muted/30 overflow-y-auto max-h-[70vh]">
          <PagoFormFields
            form={form}
            tipo="Negocio cobra"
            comprobante={comprobante}
            onComprobanteChange={setComprobante}
            fileInputId="comprobante-flete"
          />
        </div>

        <DialogFooter className="p-4 px-6 border-t bg-white dark:bg-slate-900 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-200 dark:border-slate-800 font-semibold h-10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createFreightPayment.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 font-semibold h-10 shadow-md"
          >
            {createFreightPayment.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Registrar pago
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Props ----

interface GestionCobroModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApiTableRow;
}

export function GestionCobroModal({
  isOpen,
  onClose,
  data,
}: GestionCobroModalProps) {
  const [selectedTipo, setSelectedTipo] = useState<string>(
    data?.tipo ?? "Courier cobra",
  );
  const [pedidosFiltro, setPedidosFiltro] = useState("Todos");
  const [cobrarOpcion, setCobrarOpcion] = useState<
    "todo" | "solo_envio" | "nada"
  >("todo");
  const [isPagoFleteModalOpen, setIsPagoFleteModalOpen] = useState(false);
  const [comprobante, setComprobante] = useState<File | null>(null);

  const today = new Date().toISOString().split("T")[0];
  const { selectedStoreId } = useAuth();

  const form = useForm<PagoFormValues>({
    resolver: zodResolver(pagoSchema),
    defaultValues: {
      monto: String(data?.neto ?? ""),
      metodo: "",
      numeroOperacion: "",
      fecha: today,
      observaciones: "",
    },
  });

  const {
    data: details,
    isLoading: loadingDetails,
    isError: errorDetails,
  } = useLiquidationDetails(data?.id ?? null);

  const createPayment = useCreateLiquidationPayment(
    selectedStoreId ?? "",
    data.id,
  );

  if (!data) return null;

  const isTipoA = selectedTipo === "Courier cobra";
  const isTipoB = selectedTipo === "Negocio cobra";
  const isTipoC = selectedTipo === "Prepagado";

  const pedidosFromApi = (details as Record<string, unknown> | undefined)
    ?.pedidos as PedidoItem[] | undefined;
  const pagosFromApi = (details as Record<string, unknown> | undefined)
    ?.pagos as PagoItem[] | undefined;
  const saldoPendiente = (details as Record<string, unknown> | undefined)
    ?.saldoPendiente as number | undefined;

  const pedidosFiltrados = pedidosFromApi
    ? pedidosFiltro === "Todos"
      ? pedidosFromApi
      : pedidosFromApi.filter((p) => p.estado === pedidosFiltro)
    : [];

  const pedidosEnAgencia =
    pedidosFromApi?.filter((p) => p.estado === "En agencia") ?? [];

  const courierDisplay = data.courierName ?? data.courier ?? "—";

  const showPaymentForm = isTipoA && cobrarOpcion !== "nada";

  const handleRegistrar = form.handleSubmit((values) => {
    const montoNum = parseFloat(values.monto.replace(",", "."));
    createPayment.mutate(
      {
        monto: montoNum,
        metodo: values.metodo as
          | "transferencia"
          | "yape"
          | "efectivo"
          | "no-aplica",
        numeroOperacion: values.numeroOperacion || undefined,
        fecha: values.fecha,
        observaciones: values.observaciones || undefined,
        cobrarOpcion,
        comprobante: comprobante ?? undefined,
      },
      {
        onSuccess: () => {
          toast.success("Pago registrado correctamente");
          onClose();
        },
        onError: (err: Error) => {
          toast.error(err.message || "No se pudo registrar el pago");
        },
      },
    );
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="min-w-7xl p-0 overflow-y-hidden rounded-xl h-[95vh] flex flex-col shadow-2xl bg-background">
          <DialogHeader className="p-4 px-6 border-b bg-background sticky top-0 z-10 flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-full flex items-center justify-center">
                <span className="text-xl leading-none">💰</span>
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  Gestión de Cobro — {data.id}
                </DialogTitle>
                <p className="text-[13px] text-muted-foreground dark:text-slate-400 mt-0.5">
                  {courierDisplay} · {data.pedidosCount} pedidos ·{" "}
                  {new Date(data.date).toLocaleDateString("es-PE")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
              </Button>
            </div>
          </DialogHeader>

          <div className="overflow-y-auto p-6 space-y-8 bg-muted/30 flex-1 custom-scrollbar">
            {/* Tipo B top banner */}
            {isTipoB && (
              <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl p-5 flex justify-between items-center shadow-sm">
                <div>
                  <div className="flex items-center gap-2 text-teal-800 dark:text-teal-400 font-semibold mb-1 text-[13px]">
                    <span className="text-base leading-none">💸</span> El
                    negocio le debe pagar el flete al courier
                  </div>
                  <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">
                    {fmtMoney(data.costos)}
                  </div>
                  <div className="text-xs text-teal-600/80 dark:text-teal-400/80 mt-1">
                    Entregas exitosas × tarifa · {courierDisplay}
                  </div>
                </div>
                <Button
                  className="bg-teal-700 dark:bg-teal-600 hover:bg-teal-800 dark:hover:bg-teal-700 text-white shadow-sm font-semibold"
                  onClick={() => setIsPagoFleteModalOpen(true)}
                >
                  Registrar pago de flete
                </Button>
              </div>
            )}

            {/* Tipo selector */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground dark:text-slate-400 uppercase tracking-wider">
                TIPO DE COBRO DE ESTA GUÍA
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div
                  className={`border rounded-xl p-4 relative overflow-hidden cursor-pointer transition-all ${isTipoA ? "border-amber-600 dark:border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:border-amber-300 dark:hover:border-amber-700/50 hover:bg-amber-50/10 dark:hover:bg-amber-900/20"}`}
                  onClick={() => setSelectedTipo("Courier cobra")}
                >
                  {isTipoA && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
                  )}
                  <div
                    className={`font-semibold text-[13px] mb-1.5 flex items-center gap-1.5 ${isTipoA ? "text-amber-900 dark:text-amber-400 ml-1" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    <span className="text-base leading-none">🛵</span> Tipo A —
                    Courier cobra
                  </div>
                  <p
                    className={`text-[11px] leading-tight ${isTipoA ? "text-amber-800/80 dark:text-amber-400/80 ml-1" : "text-muted-foreground dark:text-slate-400"}`}
                  >
                    Shalom/Indriver cobran al cliente y rinden al negocio.
                  </p>
                </div>
                <div
                  className={`border rounded-xl p-4 relative overflow-hidden cursor-pointer transition-all ${isTipoB ? "border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-900/20 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/10 dark:hover:bg-blue-900/20"}`}
                  onClick={() => setSelectedTipo("Negocio cobra")}
                >
                  {isTipoB && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-600 dark:bg-blue-500" />
                  )}
                  <div
                    className={`font-semibold text-[13px] mb-1.5 flex items-center gap-1.5 ${isTipoB ? "text-blue-700 dark:text-blue-400 ml-1" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    <CreditCard
                      className={`h-4 w-4 ${isTipoB ? "text-blue-700 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
                    />{" "}
                    Tipo B — Cliente al negocio
                  </div>
                  <p
                    className={`text-[11px] leading-tight ${isTipoB ? "text-slate-600 dark:text-slate-500 ml-1" : "text-muted-foreground dark:text-slate-400"}`}
                  >
                    Cliente paga al negocio. Negocio paga el flete al courier.
                  </p>
                </div>
                <div
                  className={`border rounded-xl p-4 relative overflow-hidden cursor-pointer transition-all ${isTipoC ? "border-purple-400 dark:border-purple-600/50 bg-purple-50/30 dark:bg-purple-900/20 shadow-sm" : "border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 hover:border-purple-300 dark:hover:border-purple-700/50 hover:bg-purple-50/10 dark:hover:bg-purple-900/20"}`}
                  onClick={() => setSelectedTipo("Prepagado")}
                >
                  {isTipoC && (
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500" />
                  )}
                  <div
                    className={`font-semibold text-[13px] mb-1.5 flex items-center gap-1.5 ${isTipoC ? "text-purple-900 dark:text-purple-400 ml-1" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    <span className="text-base leading-none">📋</span> Tipo C —
                    Prepagado (Olva)
                  </div>
                  <p
                    className={`text-[11px] leading-tight ${isTipoC ? "text-purple-800/70 dark:text-purple-400/70 ml-1" : "text-muted-foreground dark:text-slate-400"}`}
                  >
                    Negocio pagó el envío al registrar.
                  </p>
                </div>
              </div>
            </div>

            {/* Tipo A — cobrar opciones */}
            {isTipoA && (
              <div className="bg-amber-50/40 dark:bg-amber-950/20 p-4 -mx-6 px-6 border-y border-amber-100/50 dark:border-amber-900/30 space-y-3">
                <h3 className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  ¿QUÉ COBRA {courierDisplay.toUpperCase()} AL CLIENTE?
                </h3>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={cobrarOpcion === "todo" ? "secondary" : "outline"}
                    className={`rounded-full text-xs px-4 py-1.5 font-semibold cursor-pointer transition-colors ${cobrarOpcion === "todo" ? "bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm" : "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
                    onClick={() => setCobrarOpcion("todo")}
                  >
                    Cobra todo (producto + envío)
                  </Badge>
                  <Badge
                    variant={
                      cobrarOpcion === "solo_envio" ? "secondary" : "outline"
                    }
                    className={`rounded-full text-xs px-4 py-1.5 font-semibold cursor-pointer transition-colors ${cobrarOpcion === "solo_envio" ? "bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm" : "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
                    onClick={() => setCobrarOpcion("solo_envio")}
                  >
                    Solo el envío (cliente pagó producto al negocio)
                  </Badge>
                  <Badge
                    variant={cobrarOpcion === "nada" ? "secondary" : "outline"}
                    className={`rounded-full text-xs px-4 py-1.5 font-semibold cursor-pointer transition-colors ${cobrarOpcion === "nada" ? "bg-amber-500 hover:bg-amber-600 text-white border-0 shadow-sm" : "border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-400 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
                    onClick={() => setCobrarOpcion("nada")}
                  >
                    No cobra nada (solo custodia)
                  </Badge>
                </div>

                {cobrarOpcion === "solo_envio" && (
                  <div
                    role="alert"
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-lg p-4 mt-2"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-full shrink-0">
                        <Key className="h-4 w-4 text-green-700 dark:text-green-400" />
                      </div>
                      <div>
                        <p className="font-bold text-[13px] text-green-900 dark:text-green-300">
                          Clave de recojo {courierDisplay}
                        </p>
                        <p className="text-[12px] text-green-700 dark:text-green-400 mt-0.5 leading-snug">
                          El cliente pagó al negocio. Envíale la clave de
                          recojo. Sin esta clave, {courierDisplay} no entrega el
                          paquete.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-400 text-white font-semibold shrink-0 gap-1.5"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Enviar clave al cliente
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Financial summary */}
            <div className="flex border border-border dark:border-slate-800 rounded-xl bg-background divide-x divide-border overflow-hidden shadow-sm">
              <div className="flex-1 p-4 text-center">
                <div className="font-bold text-[19px] text-slate-800 dark:text-slate-200">
                  {fmtMoney(data.codBruto)}
                </div>
                <div className="text-[10px] text-muted-foreground dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                  COD BRUTO
                </div>
              </div>
              <div className="flex-1 p-4 text-center">
                <div className="font-bold text-[19px] text-emerald-500 dark:text-emerald-400">
                  {fmtMoney(data.adelantos)}
                </div>
                <div className="text-[10px] text-muted-foreground dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                  ADELANTOS
                </div>
              </div>
              <div className="flex-1 p-4 text-center">
                <div className="font-bold text-[19px] text-amber-500 dark:text-amber-400">
                  {fmtMoney(data.codNeto)}
                </div>
                <div className="text-[10px] text-muted-foreground dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                  COD NETO COURIER
                </div>
              </div>
              <div className="flex-1 p-4 text-center">
                <div className="font-bold text-[19px] text-red-500 dark:text-red-400">
                  {fmtMoney(data.costos)}
                </div>
                <div className="text-[10px] text-muted-foreground dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                  COSTOS COURIER
                </div>
              </div>
              <div className="flex-1 p-4 text-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="font-bold text-[19px] text-teal-600 dark:text-teal-400">
                  {fmtMoney(data.neto)}
                </div>
                <div className="text-[10px] text-muted-foreground dark:text-slate-400 font-bold uppercase tracking-wider mt-1">
                  NETO A COBRAR
                </div>
              </div>
            </div>

            {/* En agencia alert */}
            {pedidosEnAgencia.length > 0 && (
              <div
                role="alert"
                className="flex flex-col sm:flex-row items-start gap-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-full shrink-0">
                    <Truck className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-bold text-[13px] text-blue-900 dark:text-blue-300">
                      {pedidosEnAgencia.length} pedido
                      {pedidosEnAgencia.length > 1 ? "s" : ""} en agencia{" "}
                      {courierDisplay} esperando recojo
                    </p>
                    <p className="text-[12px] text-blue-700 dark:text-blue-400 mt-0.5 leading-snug">
                      Hasta 30 días para recoger. Si no recogen:{" "}
                      {courierDisplay} cobra retorno (tarifa variable por
                      ciudad).
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:shrink-0">
                  <Button
                    size="sm"
                    className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:ring-2 focus:ring-blue-400 text-white font-semibold gap-1.5"
                    onClick={() => setPedidosFiltro("En agencia")}
                  >
                    Ver en agencia
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-400 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-semibold gap-1.5"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    Enviar WA recordatorio
                  </Button>
                </div>
              </div>
            )}

            {/* Pedidos list */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-[15px] text-foreground dark:text-slate-100">
                  Pedidos de la guía
                </h3>
                <div className="flex gap-1.5">
                  {[
                    "Todos",
                    "En agencia",
                    "Cobrado",
                    "Rechazado",
                    "Retorno",
                    "En envío",
                  ].map((f) => (
                    <Badge
                      key={f}
                      variant={pedidosFiltro === f ? "secondary" : "outline"}
                      className={`rounded-full text-[11px] px-3 py-0.5 font-medium cursor-pointer ${pedidosFiltro === f ? "bg-teal-700 dark:bg-teal-600 hover:bg-teal-800 dark:hover:bg-teal-700 text-white border-0 shadow-sm" : "text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                      onClick={() => setPedidosFiltro(f)}
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                {loadingDetails ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-[13px]">Cargando pedidos...</span>
                  </div>
                ) : errorDetails ? (
                  <div className="flex items-center gap-2 py-4 text-destructive text-[13px]">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    No se pudieron cargar los pedidos. Intentá cerrar y volver a
                    abrir.
                  </div>
                ) : pedidosFiltrados.length === 0 ? (
                  <p className="text-[13px] text-slate-400 dark:text-slate-500 py-4 text-center">
                    Sin pedidos en este estado
                  </p>
                ) : (
                  pedidosFiltrados.map((pedido) => {
                    const CheckboxUI = () => (
                      <div
                        className={`w-[18px] h-[18px] rounded-[4px] flex items-center justify-center shrink-0 shadow-sm transition-colors ${pedido.entregado ? "bg-emerald-500 text-white border-none" : "bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"}`}
                      >
                        {pedido.entregado && (
                          <Check className="h-3 w-3" strokeWidth={3} />
                        )}
                      </div>
                    );

                    if (pedido.estado === "Cobrado" && pedido.entregado) {
                      return (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3.5 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/30 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <CheckboxUI />
                            <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">
                              {pedido.id}
                            </span>
                            <span className="text-[13px] text-slate-500 dark:text-slate-400">
                              {pedido.cliente} · {pedido.distrito}
                            </span>
                          </div>
                          <div className="flex items-center gap-5">
                            {pedido.adelanto != null &&
                              pedido.adelanto > 0 && (
                                <div className="text-right flex items-center gap-2">
                                  <div className="text-emerald-600/70 dark:text-emerald-400/70 text-[11px] font-medium leading-none mt-1.5">
                                    Adel:
                                    <br />
                                    S/{pedido.adelanto.toFixed(2)}
                                  </div>
                                </div>
                              )}
                            <div className="flex gap-2">
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                                Pagado ✓
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md">
                                ✓ Entregado
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (pedido.estado === "Rechazado") {
                      return (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3.5 border border-amber-300 dark:border-amber-700 bg-amber-50/20 dark:bg-amber-950/20 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <CheckboxUI />
                            <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">
                              {pedido.id}
                            </span>
                            <span className="text-[13px] text-slate-500 dark:text-slate-400">
                              {pedido.cliente} · {pedido.distrito}
                            </span>
                          </div>
                          <div className="flex items-center gap-5">
                            <div className="flex items-center gap-4">
                              {pedido.adelanto != null &&
                                pedido.adelanto > 0 && (
                                  <div className="text-right flex flex-col items-center justify-center leading-none">
                                    <span className="text-emerald-600/70 dark:text-emerald-400/70 text-[11px] font-medium">
                                      Adel:
                                    </span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[12px]">
                                      S/{pedido.adelanto.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              <div className="font-bold text-amber-600 dark:text-amber-400 text-[14px]">
                                S/ {(pedido.monto ?? 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 rounded border border-amber-200/50 dark:border-amber-900/50 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" /> Rechazado
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] font-semibold text-blue-700 dark:text-blue-400 border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-2.5 gap-1 shadow-sm"
                              >
                                <RefreshCcw className="h-3 w-3" /> Reasignar
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (pedido.estado === "Reasignado") {
                      return (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3.5 border border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/20 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                              <RefreshCcw className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">
                              {pedido.id}
                            </span>
                            <div className="flex flex-col leading-tight">
                              <span className="text-[13px] text-slate-500 dark:text-slate-400">
                                {pedido.cliente} · {pedido.distrito}
                              </span>
                              <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1 font-medium mt-0.5">
                                <RefreshCcw className="h-2.5 w-2.5" />{" "}
                                {pedido.subtext}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[14px]">
                              S/ {(pedido.monto ?? 0).toFixed(2)}
                            </div>
                            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 bg-purple-100/50 dark:bg-purple-900/30 px-2.5 py-1 rounded border border-purple-200 dark:border-purple-800/50 flex items-center gap-1">
                              <RefreshCcw className="h-3 w-3" /> Reasignado
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (pedido.estado === "En agencia") {
                      return (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3.5 border border-blue-200 dark:border-blue-900 bg-blue-50/20 dark:bg-blue-950/20 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <CheckboxUI />
                            <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">
                              {pedido.id}
                            </span>
                            <div className="flex flex-col gap-1.5 ml-1">
                              <span className="text-[13px] text-slate-500 dark:text-slate-400 leading-none">
                                {pedido.cliente} · {pedido.distrito}
                              </span>
                              {pedido.dias && (
                                <div className="flex items-center gap-2">
                                  <div className="h-1 w-12 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${pedido.diasPorcentaje != null && pedido.diasPorcentaje > 60 ? "bg-red-500" : "bg-amber-500"}`}
                                      style={{
                                        width: `${pedido.diasPorcentaje ?? 0}%`,
                                      }}
                                    />
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold leading-none ${pedido.diasPorcentaje != null && pedido.diasPorcentaje > 60 ? "text-red-500 dark:text-red-400" : "text-amber-500 dark:text-amber-400"}`}
                                  >
                                    {pedido.dias}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-5">
                            <div className="font-bold text-amber-600 dark:text-amber-400 text-[14px]">
                              S/ {(pedido.monto ?? 0).toFixed(2)}
                            </div>
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-900/50">
                              En agencia
                            </span>
                          </div>
                        </div>
                      );
                    }

                    if (pedido.estado === "Retorno") {
                      return (
                        <div
                          key={pedido.id}
                          className="flex items-center justify-between p-3.5 border border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-950/20 rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <CheckboxUI />
                            <span className="font-bold text-[13px] text-slate-800 dark:text-slate-200">
                              {pedido.id}
                            </span>
                            <div className="flex flex-col leading-tight ml-1">
                              <span className="text-[13px] text-slate-500 dark:text-slate-400">
                                {pedido.cliente} · {pedido.distrito}
                              </span>
                              <span className="text-[11px] text-red-500 dark:text-red-400 flex items-center gap-1 font-medium mt-1.5">
                                <AlertTriangle className="h-3 w-3" />{" "}
                                {pedido.warningText}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-5">
                            <div className="font-bold text-amber-600 dark:text-amber-400 text-[14px]">
                              S/ {(pedido.monto ?? 0).toFixed(2)}
                            </div>
                            <span className="text-[11px] font-bold text-red-700 dark:text-red-400 bg-red-100/50 dark:bg-red-900/30 px-2.5 py-1 rounded border border-red-200 dark:border-red-800/50">
                              Retornando
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })
                )}
              </div>
            </div>

            {/* Tipo B flete breakdown */}
            {isTipoB && (
              <div className="bg-blue-50/60 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-semibold text-[13px]">
                  <span className="text-base leading-none">💸</span> Flete a
                  pagar por el negocio al courier
                </div>
                <div className="bg-white dark:bg-slate-900 rounded-lg border border-blue-50 dark:border-slate-800 p-3 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="text-[12px] text-blue-700/70 dark:text-blue-400/70 mb-0.5">
                      Entregas exitosas × tarifa
                    </div>
                    <div className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                      {fmtMoney(data.costos)}
                    </div>
                  </div>
                  <Button
                    className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold"
                    onClick={() => setIsPagoFleteModalOpen(true)}
                  >
                    Registrar pago de flete
                  </Button>
                </div>
              </div>
            )}

            {/* Cost breakdown / neto */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-3.5 px-4 border-b flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <div className="flex items-center gap-2 font-semibold text-[13px] text-slate-700 dark:text-slate-300">
                  <span className="text-base leading-none">📊</span> Desglose
                  de costos del courier
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="p-3.5 px-4 border-b flex justify-between items-center bg-emerald-50/20 dark:bg-emerald-950/20">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[13px]">
                  NETO A COBRAR AL COURIER
                </div>
                <div className="font-bold text-emerald-600 dark:text-emerald-400 text-[17px]">
                  {fmtMoney(saldoPendiente ?? data.neto)}
                </div>
              </div>
              {saldoPendiente != null && saldoPendiente !== data.neto && (
                <div className="p-3.5 px-4 flex justify-between items-center bg-amber-50/30 dark:bg-amber-950/30">
                  <div className="font-semibold text-amber-600 dark:text-amber-400 text-[13px]">
                    Saldo pendiente
                  </div>
                  <div className="font-bold text-amber-600 dark:text-amber-400 text-[17px]">
                    {fmtMoney(saldoPendiente)}
                  </div>
                </div>
              )}
            </div>

            {/* Pagos registrados */}
            <div>
              <h3 className="text-[10px] font-bold text-muted-foreground dark:text-slate-400 uppercase tracking-wider mb-2.5">
                PAGOS REGISTRADOS{" "}
                <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">
                  {pagosFromApi?.length ?? 0} PAGOS
                </span>
              </h3>
              {loadingDetails ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-[13px]">Cargando pagos...</span>
                </div>
              ) : errorDetails ? (
                <p className="text-[13px] text-slate-400 dark:text-slate-500">
                  Sin información de pagos disponible
                </p>
              ) : !pagosFromApi || pagosFromApi.length === 0 ? (
                <p className="text-[13px] text-slate-400 dark:text-slate-500">
                  Sin pagos registrados aún
                </p>
              ) : (
                <div className="space-y-2">
                  {pagosFromApi.map((pago) => (
                    <div
                      key={pago.id}
                      className="flex justify-between items-center p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900 text-[13px]"
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {pago.metodo}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {pago.fecha}
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtMoney(pago.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment form — Tipo A only (hidden when "nada") */}
            {showPaymentForm && (
              <div className="space-y-4 pt-2">
                <h3 className="font-bold text-[15px] text-slate-800 dark:text-slate-200">
                  Registrar nuevo pago del courier
                </h3>
                <PagoFormFields
                  form={form}
                  tipo={selectedTipo}
                  comprobante={comprobante}
                  onComprobanteChange={setComprobante}
                  fileInputId="comprobante-tipo-a"
                />
              </div>
            )}

            {/* Tipo A + nada notice */}
            {isTipoA && cobrarOpcion === "nada" && (
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 text-center space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-[14px]">
                  Sin monto a cobrar
                </p>
                <p className="text-[13px] text-slate-500 dark:text-slate-400">
                  Esta guía está en custodia. El courier no cobra al cliente ni
                  rinde monto.
                </p>
              </div>
            )}

            {/* Tipo C notice */}
            {isTipoC && (
              <div className="bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/50 rounded-xl p-5 text-center space-y-1">
                <p className="font-semibold text-purple-800 dark:text-purple-300 text-[14px]">
                  Envío prepagado
                </p>
                <p className="text-[13px] text-purple-700/80 dark:text-purple-400/80">
                  El costo del envío ya fue pagado al registrar la guía. No hay
                  cobros pendientes de rendición.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 px-6 border-t bg-white dark:bg-slate-900 flex justify-between items-center sm:justify-between shrink-0">
            <Button
              variant="outline"
              className="font-semibold text-slate-700 dark:text-slate-300 gap-2 border-slate-200 dark:border-slate-800 h-10"
            >
              <FileText className="h-4 w-4" />
              Exportar PDF
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold h-10"
              >
                Cancelar
              </Button>
              {showPaymentForm && (
                <Button
                  onClick={handleRegistrar}
                  disabled={createPayment.isPending}
                  className="bg-teal-700 dark:bg-teal-600 hover:bg-teal-800 dark:hover:bg-teal-700 text-white gap-2 px-6 font-semibold h-10 shadow-md"
                >
                  {createPayment.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Registrar Pago
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-modal for Tipo B flete payment */}
      {isPagoFleteModalOpen && (
        <PagoFleteModal
          isOpen={isPagoFleteModalOpen}
          onClose={() => setIsPagoFleteModalOpen(false)}
          data={data}
          courierDisplay={courierDisplay}
          storeId={selectedStoreId ?? ""}
        />
      )}
    </>
  );
}
