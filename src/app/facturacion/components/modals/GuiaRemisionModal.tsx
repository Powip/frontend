"use client";

import { AlertTriangle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { useFacturacionMock } from "@/hooks/useFacturacionMock";
import { cn } from "@/lib/utils";
import { type Almacen, MODALIDAD_TRANSPORTE, MOTIVOS_TRASLADO } from "@/types/facturacion";

const PIPELINE_STEPS = [
  "Generando XML de la GRE-Remitente (UBL 2.1)",
  "Firmando digitalmente",
  "Enviando a SUNAT",
];

interface PedidoOption {
  id: string;
  orderNumber: string;
  cliente: string;
  fullNumber: string | null;
}

interface GuiaRemisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  almacenes: Almacen[];
  pedidos: PedidoOption[];
  emitirGuia: ReturnType<typeof useFacturacionMock>["emitirGuia"];
}

export default function GuiaRemisionModal({
  isOpen,
  onClose,
  almacenes,
  pedidos,
  emitirGuia,
}: GuiaRemisionModalProps) {
  const [step, setStep] = useState<"form" | "pipeline" | "ok" | "bad">("form");

  const [pedidoId, setPedidoId] = useState(pedidos[0]?.id ?? "");
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id ?? "");
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_TRASLADO[0]?.code ?? "");
  const [modalidad, setModalidad] = useState<"01" | "02">("01");
  const [transportista, setTransportista] = useState("");
  const [transportistaRuc, setTransportistaRuc] = useState("");
  const [placa, setPlaca] = useState("");
  const [licencia, setLicencia] = useState("");
  const [bultos, setBultos] = useState("1");
  const [peso, setPeso] = useState("1.0");
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [okNumber, setOkNumber] = useState("");
  const [badError, setBadError] = useState<{
    code: string;
    desc: string;
    sol: string;
  } | null>(null);

  const pedido = pedidos.find((item) => item.id === pedidoId);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const initialPedidoId =
      pedidoId && pedidos.some((item) => item.id === pedidoId) ? pedidoId : (pedidos[0]?.id ?? "");

    const initialPedido = pedidos.find((item) => item.id === initialPedidoId);

    setStep("form");
    setPedidoId(initialPedidoId);
    setAlmacenId((current) => {
      if (current && almacenes.some((item) => item.id === current)) {
        return current;
      }

      return almacenes[0]?.id ?? "";
    });
    setPipelineIndex(0);
    setOkNumber("");
    setBadError(null);

    if (initialPedido) {
      setDestino(`Dirección registrada de ${initialPedido.cliente}`);
    } else {
      setDestino("");
    }
  }, [isOpen, pedidoId, pedidos, almacenes]);

  const handleSubmit = async () => {
    if (!pedido) {
      toast.error("Selecciona un pedido");
      return;
    }

    if (!almacenId) {
      toast.error("Selecciona un almacén de origen");
      return;
    }

    if (!destino.trim()) {
      toast.error("Ingresa la dirección de destino");
      return;
    }

    if (modalidad === "01") {
      if (!transportista.trim()) {
        toast.error("Ingresa el nombre del transportista");
        return;
      }

      if (!transportistaRuc.trim()) {
        toast.error("Ingresa el RUC del transportista");
        return;
      }
    }

    if (modalidad === "02") {
      if (!placa.trim()) {
        toast.error("Ingresa la placa del vehículo");
        return;
      }

      if (!licencia.trim()) {
        toast.error("Ingresa la licencia del conductor");
        return;
      }
    }

    setStep("pipeline");
    setPipelineIndex(0);

    let pipelineStep = 0;

    const timer = window.setInterval(() => {
      pipelineStep += 1;

      setPipelineIndex(Math.min(pipelineStep, PIPELINE_STEPS.length - 1));

      if (pipelineStep >= PIPELINE_STEPS.length - 1) {
        window.clearInterval(timer);
      }
    }, 550);

    try {
      const result = await emitirGuia({
        fecha: new Date().toLocaleString("es-PE"),
        pedido: pedido.orderNumber,
        almacenId,
        destino: destino.trim(),
        cliente: pedido.cliente,
        motivo,
        modalidad,
        transportista: modalidad === "01" ? transportista.trim() : "Reparto propio",
        transportistaRuc: modalidad === "01" ? transportistaRuc.trim() : undefined,
        placa: modalidad === "02" ? placa.trim() : undefined,
        licencia: modalidad === "02" ? licencia.trim() : undefined,
        bultos,
        peso,
        docRelacionado: pedido.fullNumber,
      });

      window.clearInterval(timer);
      setPipelineIndex(PIPELINE_STEPS.length);

      window.setTimeout(() => {
        if (result.ok) {
          setOkNumber(result.guia.fullNumber || "");
          setStep("ok");
          return;
        }

        setBadError(
          result.error ?? {
            code: "—",
            desc: "Rechazado",
            sol: "Revisa los datos e intenta nuevamente.",
          },
        );

        setStep("bad");
      }, 350);
    } catch {
      window.clearInterval(timer);
      setPipelineIndex(PIPELINE_STEPS.length);

      window.setTimeout(() => {
        setBadError({
          code: "CONNECTION_ERROR",
          desc: "No se pudo completar la emisión",
          sol: "Verifica tu conexión e intenta nuevamente.",
        });

        setStep("bad");
      }, 350);
    }
  };

  const handlePedidoChange = (value: string) => {
    setPedidoId(value);

    const selectedPedido = pedidos.find((item) => item.id === value);

    if (selectedPedido) {
      setDestino(`Dirección registrada de ${selectedPedido.cliente}`);
    } else {
      setDestino("");
    }
  };

  const handleClose = () => {
    if (step === "pipeline") {
      return;
    }

    onClose();
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[620px]">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Truck className="h-5 w-5 text-primary" />
                Emitir Guía de Remisión (Remitente)
              </DialogTitle>

              <DialogDescription>
                Se emite antes de que el paquete salga del almacén — no esperes a que el pedido
                llegue a ENTREGADO.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Pedido</Label>

                  <Select value={pedidoId} onValueChange={handlePedidoChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un pedido" />
                    </SelectTrigger>

                    <SelectContent>
                      {pedidos.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.orderNumber} — {item.cliente}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Almacén de origen</Label>

                  <Select value={almacenId} onValueChange={setAlmacenId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un almacén" />
                    </SelectTrigger>

                    <SelectContent>
                      {almacenes.map((almacen) => (
                        <SelectItem key={almacen.id} value={almacen.id}>
                          {almacen.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Dirección de destino</Label>

                <Input
                  value={destino}
                  onChange={(event) => setDestino(event.target.value)}
                  placeholder="Dirección completa de destino"
                />
              </div>

              <div className="grid gap-2">
                <Label>Motivo de traslado (catálogo N° 20 SUNAT)</Label>

                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {MOTIVOS_TRASLADO.map((item) => (
                      <SelectItem key={item.code} value={item.code}>
                        {item.code} — {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <p className="mt-1 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
                  Para ventas COD sin comprobante emitido aún, usa &quot;14 — Venta sujeta a
                  confirmación del comprador&quot;: la guía sale primero y la boleta la referencia
                  después.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Modalidad de transporte</Label>

                <div className="flex gap-2">
                  {MODALIDAD_TRANSPORTE.map((item) => (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => setModalidad(item.code)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-center text-xs font-semibold",
                        modalidad === item.code
                          ? "border-primary bg-primary/10 text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {modalidad === "01" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Transportista</Label>

                    <Input
                      value={transportista}
                      onChange={(event) => setTransportista(event.target.value)}
                      placeholder="Ej. Shalom Empresarial S.A.C."
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>RUC del transportista</Label>

                    <Input
                      value={transportistaRuc}
                      onChange={(event) => setTransportistaRuc(event.target.value)}
                      placeholder="20xxxxxxxxx"
                      inputMode="numeric"
                      maxLength={11}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Placa del vehículo</Label>

                    <Input
                      value={placa}
                      onChange={(event) => setPlaca(event.target.value)}
                      placeholder="ABC-123"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Licencia del conductor</Label>

                    <Input
                      value={licencia}
                      onChange={(event) => setLicencia(event.target.value)}
                      placeholder="Q12345678"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>N° de bultos</Label>

                  <Input
                    value={bultos}
                    onChange={(event) => setBultos(event.target.value)}
                    type="number"
                    min="1"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Peso bruto (kg)</Label>

                  <Input
                    value={peso}
                    onChange={(event) => setPeso(event.target.value)}
                    type="number"
                    min="0.01"
                    step="0.01"
                  />
                </div>
              </div>

              {pedido?.fullNumber && (
                <p className="text-xs text-muted-foreground">
                  Esta guía referenciará el comprobante <b>{pedido.fullNumber}</b>, ya emitido para
                  este pedido.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>

              <Button onClick={handleSubmit} className="bg-primary text-white hover:bg-primary/90">
                Emitir Guía
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pipeline" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Emitiendo guía de remisión...
              </DialogTitle>

              <DialogDescription>
                Pedido {pedido?.orderNumber} — no cierres esta ventana
              </DialogDescription>
            </DialogHeader>

            <EmisionPipeline steps={PIPELINE_STEPS} activeIndex={pipelineIndex} />
          </>
        )}

        {step === "ok" && (
          <>
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">¡Guía aceptada por SUNAT!</h3>

              <div className="mt-1 font-bold text-primary">{okNumber}</div>

              <p className="mt-1 text-xs text-muted-foreground">
                El pedido ya puede salir del almacén.
              </p>
            </div>

            <DialogFooter>
              <Button
                onClick={onClose}
                className="w-full bg-primary text-white hover:bg-primary/90"
              >
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "bad" && badError && (
          <>
            <div className="py-2 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle className="h-7 w-7" />
              </div>

              <h3 className="text-lg font-bold">SUNAT rechazó la guía</h3>

              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm dark:border-red-900 dark:bg-red-950/40">
                <div className="font-bold text-red-600 dark:text-red-400">
                  Código {badError.code} — {badError.desc}
                </div>

                <div className="mt-1 text-red-800 dark:text-red-300">
                  <b>Solución:</b> {badError.sol}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cerrar
              </Button>

              <Button
                onClick={() => {
                  setStep("form");
                  setPipelineIndex(0);
                  setBadError(null);
                }}
                className="bg-primary text-white hover:bg-primary/90"
              >
                Corregir y reintentar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
