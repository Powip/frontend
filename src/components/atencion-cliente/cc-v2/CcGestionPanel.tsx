"use client";

import { useState, useCallback } from "react";
import { Check, Phone, PhoneOff, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubEstadoCc } from "@/interfaces/IOrder";
import { updateSubEstadoCC, confirmarEntregaLima, confirmarDespacho } from "@/services/atencionClienteService";
import { toast } from "sonner";
import AliclikStatusBadge from "@/components/aliclik/AliclikStatusBadge";

interface Props {
  orderId: string;
  subEstadoCc: SubEstadoCc;
  callAttempts: number;
  datosCompletos: boolean;
  onUpdated: () => void;
  aliclikDispatchStatus?: string | null;
  aliclikSyncedAt?: string | null;
}

const CHECKLIST_ITEMS = [
  "DNI del cliente verificado",
  "Dirección de entrega confirmada",
  "Productos del pedido correctos",
  "Precio total acordado con el cliente",
];

const TERMINAL_STATES: SubEstadoCc[] = ["confirmado", "anulado_cc", "carrito_recuperado"];

function TerminalBadge({ colorCls, label, sub }: { colorCls: string; label: string; sub: string }) {
  return (
    <div className={`${colorCls} rounded-lg p-4 text-center`}>
      <p className="font-semibold text-sm">{label}</p>
      <p className="text-xs opacity-75 mt-0.5">{sub}</p>
    </div>
  );
}

export function CcGestionPanel({ orderId, subEstadoCc, callAttempts, datosCompletos, onUpdated, aliclikDispatchStatus, aliclikSyncedAt }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [checks, setChecks] = useState(() => CHECKLIST_ITEMS.map(() => false));
  const [limaDatetime, setLimaDatetime] = useState("");

  const todosChecked = checks.every(Boolean);
  const isMaxIntentos = callAttempts >= 3;

  const cambiar = useCallback(
    async (nuevoEstado: SubEstadoCc, comentario?: string) => {
      setLoading(nuevoEstado);
      try {
        const result = await updateSubEstadoCC(orderId, nuevoEstado, comentario);
        onUpdated();
        if (result.autoCanceled) {
          toast.warning("No contesta, limite de intentos. Se envia a Anulados");
        } else {
          toast.success(`Estado actualizado: ${nuevoEstado.replace(/_/g, " ")}`);
        }
      } catch {
        toast.error("Error al actualizar el estado");
      } finally {
        setLoading(null);
        setConfirmando(false);
        setChecks(CHECKLIST_ITEMS.map(() => false));
      }
    },
    [orderId, onUpdated],
  );

  const cancelarConfirmacion = () => {
    setConfirmando(false);
    setChecks(CHECKLIST_ITEMS.map(() => false));
    setLimaDatetime("");
  };

  const handleConfirmarLima = async () => {
    if (!limaDatetime) return;
    setLoading("confirmar_lima");
    try {
      await confirmarEntregaLima(orderId, new Date(limaDatetime).toISOString());
      onUpdated();
      toast.success("Entrega Lima confirmada");
    } catch {
      toast.error("Error al confirmar entrega Lima");
    } finally {
      setLoading(null);
      setConfirmando(false);
      setLimaDatetime("");
    }
  };

  // ── Terminal states ──────────────────────────────────────
  if (subEstadoCc === "confirmado") {
    return (
      <TerminalBadge
        colorCls="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
        label="✓ PEDIDO CONFIRMADO"
        sub="El cliente confirmó la entrega del pedido"
      />
    );
  }
  if (subEstadoCc === "anulado_cc") {
    return (
      <TerminalBadge
        colorCls="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400"
        label="ANULADO POR CC"
        sub="Este pedido fue anulado por Call Center"
      />
    );
  }
  if (subEstadoCc === "carrito_recuperado") {
    return (
      <TerminalBadge
        colorCls="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400"
        label="✓ CARRITO RECUPERADO"
        sub="El carrito fue recuperado exitosamente"
      />
    );
  }

  // ── Button visibility rules ──────────────────────────────
  const esCarrito = subEstadoCc.startsWith("carrito");
  const esLima = subEstadoCc === "entrega_lima";
  // Flujo COD: usa /confirmar-despacho (transacción atómica)
  // Carrito / Lima: usa updateSubEstadoCC (cambio simple de estado)
  const estadoConfirmado: SubEstadoCc = esCarrito ? "carrito_recuperado" : "confirmado";

  const labelConfirmar =
    esLima ? "Confirmar entrega Lima" :
    esCarrito ? "Carrito recuperado ✓" :
    "Confirmar despacho";

  const showConfirmar = !TERMINAL_STATES.includes(subEstadoCc);
  const showContactado = ["por_confirmar", "no_contesta"].includes(subEstadoCc);
  const showPrimerContacto = subEstadoCc === "carrito_sin_contactar";
  const showNoContesta = !TERMINAL_STATES.includes(subEstadoCc);
  const showAnularCc = !TERMINAL_STATES.includes(subEstadoCc) && !esCarrito;

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm">Gestión CC</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <AliclikStatusBadge
            aliclikDispatchStatus={aliclikDispatchStatus}
            aliclikSyncedAt={aliclikSyncedAt}
          />
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isMaxIntentos ? "bg-red-100 text-red-700" :
            callAttempts >= 2 ? "bg-amber-100 text-amber-700" :
            "bg-gray-100 text-gray-500"
          }`}>
            Intentos: {callAttempts}/3
          </span>
        </div>
      </div>

      {isMaxIntentos && !confirmando && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded p-2 text-xs text-red-700 dark:text-red-400 text-center font-medium">
          Límite de intentos alcanzado — se recomienda anular el pedido
        </div>
      )}

      {/* Datetime picker — solo para entrega_lima */}
      {confirmando && subEstadoCc === "entrega_lima" && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-purple-800 dark:text-purple-300 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Horario de entrega en Lima
          </p>
          <input
            type="datetime-local"
            value={limaDatetime}
            onChange={(e) => setLimaDatetime(e.target.value)}
            className="w-full text-xs border border-purple-300 dark:border-purple-700 rounded px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-purple-400"
          />
          {!limaDatetime && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Seleccioná la fecha y hora antes de confirmar
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs h-7 disabled:opacity-40"
              disabled={!limaDatetime || !!loading}
              onClick={handleConfirmarLima}
            >
              <MapPin className="h-3 w-3 mr-1" />
              {loading === "confirmar_lima" ? "Confirmando..." : "Confirmar entrega"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={cancelarConfirmacion}
              disabled={!!loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Checklist de seguridad (para todos los demás estados al confirmar) */}
      {confirmando && subEstadoCc !== "entrega_lima" && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
          <p className="text-xs font-bold text-blue-800 dark:text-blue-300">
            Verificá estos 4 puntos antes de confirmar:
          </p>
          {CHECKLIST_ITEMS.map((item, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checks[i]}
                onChange={() => setChecks((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                className="w-3.5 h-3.5 accent-green-600 cursor-pointer"
              />
              <span className={`text-xs ${checks[i] ? "line-through text-gray-400 dark:text-slate-500" : "text-gray-700 dark:text-slate-300"}`}>
                {item}
              </span>
            </label>
          ))}
          {!todosChecked && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Marcá todos los puntos para habilitar la confirmación
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-xs h-7 disabled:opacity-40"
              disabled={!todosChecked || !!loading}
              onClick={async () => {
                if (esCarrito) {
                  // Carritos: cambio simple de estado
                  await cambiar(estadoConfirmado, "Carrito recuperado — checklist verificado");
                } else {
                  // COD: transacción completa → mueve a PREPARADO
                  setLoading(estadoConfirmado);
                  try {
                    await confirmarDespacho(orderId);
                    onUpdated();
                    toast.success("Pedido confirmado → pasó a Operaciones como Preparado");
                  } catch (err: any) {
                    const msg = err?.response?.data?.message ?? "Error al confirmar el despacho";
                    toast.error(msg);
                  } finally {
                    setLoading(null);
                    setConfirmando(false);
                    setChecks(CHECKLIST_ITEMS.map(() => false));
                  }
                }
              }}
            >
              <Check className="h-3 w-3 mr-1" />
              {loading === estadoConfirmado ? "Confirmando..." : "Confirmar"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={cancelarConfirmacion}
              disabled={!!loading}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      {!confirmando && (
        <div className="flex flex-wrap gap-2">
          {showConfirmar && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-xs h-7 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!datosCompletos || !!loading}
              title={!datosCompletos ? "Completá los datos requeridos antes de confirmar" : undefined}
              onClick={() => setConfirmando(true)}
            >
              <Phone className="h-3 w-3 mr-1" />
              {labelConfirmar}
            </Button>
          )}

          {showContactado && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs h-7"
              disabled={!!loading}
              onClick={() => cambiar("contactado", "Contacto establecido con el cliente")}
            >
              {loading === "contactado" ? "..." : "Contactado"}
            </Button>
          )}

          {showPrimerContacto && (
            <Button
              size="sm"
              variant="outline"
              className="border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs h-7"
              disabled={!!loading}
              onClick={() => cambiar("carrito_contactado", "Primer contacto con el cliente")}
            >
              {loading === "carrito_contactado" ? "..." : "Primer contacto"}
            </Button>
          )}

          {showNoContesta && (
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-xs h-7"
              disabled={!!loading}
              onClick={() =>
                cambiar("no_contesta", `Intento ${callAttempts + 1} — sin respuesta`)
              }
            >
              <PhoneOff className="h-3 w-3 mr-1" />
              {loading === "no_contesta" ? "..." : `No contesta (${callAttempts + 1}/3)`}
            </Button>
          )}

          {showAnularCc && (
            <Button
              size="sm"
              variant="destructive"
              className="text-xs h-7"
              disabled={!!loading}
              onClick={() => cambiar("anulado_cc", "Anulado por CC")}
            >
              {loading === "anulado_cc" ? "..." : "Anular pedido"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
