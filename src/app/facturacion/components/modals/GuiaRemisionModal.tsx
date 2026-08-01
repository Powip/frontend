"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AlertTriangle, CheckCircle2, Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmisionPipeline } from "@/app/facturacion/components/EmisionPipeline";
import { Almacen, Guia, MODALIDAD_TRANSPORTE, MOTIVOS_TRASLADO } from "@/types/facturacion";
import { useFacturacionMock } from "@/hooks/useFacturacionMock";

const PIPELINE_STEPS = ["Generando XML de la GRE-Remitente (UBL 2.1)", "Firmando digitalmente", "Enviando a SUNAT"];

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

export default function GuiaRemisionModal({ isOpen, onClose, almacenes, pedidos, emitirGuia }: GuiaRemisionModalProps) {
  const [step, setStep] = useState<"form" | "pipeline" | "ok" | "bad">("form");
  const [pedidoId, setPedidoId] = useState(pedidos[0]?.id || "");
  const [almacenId, setAlmacenId] = useState(almacenes[0]?.id || "");
  const [destino, setDestino] = useState("");
  const [motivo, setMotivo] = useState(MOTIVOS_TRASLADO[0].code);
  const [modalidad, setModalidad] = useState<"01" | "02">("01");
  const [transportista, setTransportista] = useState("");
  const [transportistaRuc, setTransportistaRuc] = useState("");
  const [placa, setPlaca] = useState("");
  const [licencia, setLicencia] = useState("");
  const [bultos, setBultos] = useState("1");
  const [peso, setPeso] = useState("1.0");
  const [pipelineIndex, setPipelineIndex] = useState(0);
  const [okNumber, setOkNumber] = useState("");
  const [badError, setBadError] = useState<{ code: string; desc: string; sol: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStep("form");
    const p = pedidos.find((x) => x.id === pedidoId) || pedidos[0];
    if (p) {
      setPedidoId(p.id);
      setDestino(`Dirección registrada de ${p.cliente}`);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const pedido = pedidos.find((p) => p.id === pedidoId);

  const handleSubmit = async () => {
    if (!pedido) {
      toast.error("Selecciona un pedido");
      return;
    }
    if (!destino.trim()) {
      toast.error("Ingresa la dirección de destino");
      return;
    }
    setStep("pipeline");
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      setPipelineIndex(Math.min(i, PIPELINE_STEPS.length - 1));
      if (i >= PIPELINE_STEPS.length - 1) clearInterval(timer);
    }, 550);

    const result = await emitirGuia({
      fecha: new Date().toLocaleString("es-PE"),
      pedido: pedido.orderNumber,
      almacenId,
      destino,
      cliente: pedido.cliente,
      motivo,
      modalidad,
      transportista: modalidad === "01" ? transportista || "Sin especificar" : "Reparto propio",
      transportistaRuc: modalidad === "01" ? transportistaRuc : undefined,
      placa: modalidad === "02" ? placa : undefined,
      licencia: modalidad === "02" ? licencia : undefined,
      bultos,
      peso,
      docRelacionado: pedido.fullNumber,
    });

    clearInterval(timer);
    setPipelineIndex(PIPELINE_STEPS.length);
    setTimeout(() => {
      if (result.ok) {
        setOkNumber(result.guia.fullNumber || "");
        setStep("ok");
      } else {
        setBadError(result.error || { code: "—", desc: "Rechazado", sol: "Revisa los datos e intenta nuevamente." });
        setStep("bad");
      }
    }, 350);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Truck className="h-5 w-5 text-primary" />
                Emitir Guía de Remisión (Remitente)
              </DialogTitle>
              <DialogDescription>
                Se emite antes de que el paquete salga del almacén — no esperes a que el pedido llegue a ENTREGADO.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Pedido</Label>
                  <Select
                    value={pedidoId}
                    onValueChange={(v) => {
                      setPedidoId(v);
                      const p = pedidos.find((x) => x.id === v);
                      if (p) setDestino(`Dirección registrada de ${p.cliente}`);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un pedido" />
                    </SelectTrigger>
                    <SelectContent>
                      {pedidos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.orderNumber} — {p.cliente}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Almacén de origen</Label>
                  <Select value={almacenId} onValueChange={setAlmacenId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {almacenes.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Dirección de destino</Label>
                <Input value={destino} onChange={(e) => setDestino(e.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Motivo de traslado (catálogo N° 20 SUNAT)</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_TRASLADO.map((m) => (
                      <SelectItem key={m.code} value={m.code}>
                        {m.code} — {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2 mt-1">
                  Para ventas COD sin comprobante emitido aún, usa &quot;14 — Venta sujeta a confirmación del comprador&quot;: la guía
                  sale primero y la boleta la referencia después.
                </p>
              </div>

              <div className="grid gap-2">
                <Label>Modalidad de transporte</Label>
                <div className="flex gap-2">
                  {MODALIDAD_TRANSPORTE.map((m) => (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => setModalidad(m.code)}
                      className={cn(
                        "flex-1 rounded-md border px-3 py-2 text-xs font-semibold text-center",
                        modalidad === m.code ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {modalidad === "01" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Transportista</Label>
                    <Input value={transportista} onChange={(e) => setTransportista(e.target.value)} placeholder="Ej. Shalom Empresarial S.A.C." />
                  </div>
                  <div className="grid gap-2">
                    <Label>RUC del transportista</Label>
                    <Input value={transportistaRuc} onChange={(e) => setTransportistaRuc(e.target.value)} placeholder="20xxxxxxxxx" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Placa del vehículo</Label>
                    <Input value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="ABC-123" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Licencia del conductor</Label>
                    <Input value={licencia} onChange={(e) => setLicencia(e.target.value)} placeholder="Q12345678" />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>N° de bultos</Label>
                  <Input value={bultos} onChange={(e) => setBultos(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label>Peso bruto (kg)</Label>
                  <Input value={peso} onChange={(e) => setPeso(e.target.value)} />
                </div>
              </div>

              {pedido?.fullNumber && (
                <p className="text-xs text-muted-foreground">
                  Esta guía referenciará el comprobante <b>{pedido.fullNumber}</b>, ya emitido para este pedido.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-white">
                Emitir Guía
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "pipeline" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Loader2 className="h-5 w-5 animate-spin text-primary" /> Emitiendo guía de remisión...
              </DialogTitle>
              <DialogDescription>Pedido {pedido?.orderNumber} — no cierres esta ventana</DialogDescription>
            </DialogHeader>
            <EmisionPipeline steps={PIPELINE_STEPS} activeIndex={pipelineIndex} />
          </>
        )}

        {step === "ok" && (
          <>
            <div className="text-center py-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">¡Guía aceptada por SUNAT!</h3>
              <div className="text-primary font-bold mt-1">{okNumber}</div>
              <p className="text-xs text-muted-foreground mt-1">El pedido ya puede salir del almacén.</p>
            </div>
            <DialogFooter>
              <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-white w-full">
                Cerrar
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "bad" && badError && (
          <>
            <div className="text-center py-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-bold">SUNAT rechazó la guía</h3>
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-3 text-left text-sm">
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
              <Button onClick={() => setStep("form")} className="bg-primary hover:bg-primary/90 text-white">
                Corregir y reintentar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
