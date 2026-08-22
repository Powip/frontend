"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Video, CheckCircle2, XCircle, Send } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeadDetail, useRegistrarGestion, useMoverEtapa, useConvertirLead } from "@/hooks/superadmin/useAdquisicion";
import { StatusBadge, ESTADO_LEAD_TONE, ESTADO_LEAD_LABEL } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";
import { EstadoLead, ResultadoGestion, ViaGestion } from "@/interfaces/superadmin";

const ETAPAS: EstadoLead[] = [
  "nuevo", "contactado", "respondio", "demo_pendiente", "demo_agendada", "demo_realizada",
  "pendiente_decision", "pendiente_pago", "pago_recibido", "cerrado", "perdido", "cancelado",
];
const VIAS: ViaGestion[] = ["Llamada", "WhatsApp", "Email", "Demo", "Visita"];
const RESULTADOS: ResultadoGestion[] = ["Contestó", "No contestó", "Interesado", "Objeción", "Agendó demo", "No interesado"];

interface Props {
  leadId: string | null;
  onClose: () => void;
  onAgendarDemo: (leadId: string) => void;
}

export function LeadDetailDrawer({ leadId, onClose, onAgendarDemo }: Props) {
  const [texto, setTexto] = useState("");
  const [via, setVia] = useState<ViaGestion>("WhatsApp");
  const [resultado, setResultado] = useState<ResultadoGestion | undefined>(undefined);

  const { lead, gestiones } = useLeadDetail(leadId);
  const { mutate: registrarGestion, isPending: guardandoGestion } = useRegistrarGestion();
  const { mutate: moverEtapa } = useMoverEtapa();
  const { mutate: convertir, isPending: convirtiendo } = useConvertirLead();

  return (
    <Sheet open={!!leadId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {lead && (
          <>
            <SheetHeader>
              <SheetTitle>{lead.negocio || lead.nombre}</SheetTitle>
            </SheetHeader>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge label={ESTADO_LEAD_LABEL[lead.estado] ?? lead.estado} tone={ESTADO_LEAD_TONE[lead.estado] ?? "gray"} />
              <Select
                value={lead.estado}
                onValueChange={(v) => moverEtapa({ id: lead.id, nuevoEstado: v as EstadoLead, estadoActual: lead.estado })}
              >
                <SelectTrigger className="h-7 w-[180px] text-[11px]">
                  <SelectValue placeholder="Mover etapa" />
                </SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">
                      {ESTADO_LEAD_LABEL[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 space-y-2 text-xs">
              <Kv k="Contacto" v={lead.nombre} />
              <Kv k="WhatsApp" v={lead.whatsapp} />
              {lead.email && <Kv k="Email" v={lead.email} />}
              <Kv k="Canal de adquisición" v={lead.canalAdquisicion} />
              {lead.sdrNombre && <Kv k="SDR" v={lead.sdrNombre} />}
              {lead.interesadoEn && <Kv k="Interesado en" v={lead.interesadoEn} />}
              {lead.proximaAccion && <Kv k="Próxima acción" v={`${lead.proximaAccion}${lead.proximaFechaAccion ? ` — ${formatDateTime(lead.proximaFechaAccion)}` : ""}`} />}
              {lead.observaciones && <Kv k="Observaciones" v={lead.observaciones} />}
            </div>

            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                className="flex-1 gap-1.5 bg-[#25D366] text-white hover:bg-[#1fb959]"
                onClick={() => window.open(`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`, "_blank")}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => onAgendarDemo(lead.id)}>
                <Video className="h-3.5 w-3.5" />
                Demo
              </Button>
            </div>

            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-emerald-600 border-emerald-500/30"
                disabled={convirtiendo}
                onClick={() =>
                  convertir(lead.id, {
                    onSuccess: () => {
                      toast.success(`${lead.negocio || lead.nombre} se convirtió en empresa.`);
                      onClose();
                    },
                    onError: () => toast.error("No se pudo convertir el lead — reintentá."),
                  })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Convertir en Empresa
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-destructive border-destructive/30"
                onClick={() => moverEtapa({ id: lead.id, nuevoEstado: "perdido", estadoActual: lead.estado, motivo: "Marcado manualmente" })}
              >
                <XCircle className="h-3.5 w-3.5" />
                Marcar perdido
              </Button>
            </div>

            <div className="mt-5 rounded-lg border p-3">
              <div className="mb-2 text-xs font-bold">Registrar gestión</div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <Select value={via} onValueChange={(v) => setVia(v as ViaGestion)}>
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIAS.map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={resultado} onValueChange={(v) => setResultado(v as ResultadoGestion)}>
                  <SelectTrigger className="h-8 text-[11px]">
                    <SelectValue placeholder="Resultado" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTADOS.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comentario…" rows={2} className="text-xs" />
              <Button
                size="sm"
                className="mt-2 gap-1.5"
                disabled={guardandoGestion || !texto.trim()}
                onClick={() =>
                  registrarGestion(
                    { leadId: lead.id, via, resultado, texto: texto.trim() },
                    {
                      onSuccess: () => {
                        toast.success("Gestión registrada.");
                        setTexto("");
                        setResultado(undefined);
                      },
                      onError: () => toast.error("No se pudo registrar — reintentá."),
                    }
                  )
                }
              >
                <Send className="h-3.5 w-3.5" />
                Registrar
              </Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Historial</div>
              <ul className="space-y-3 border-l pl-3.5">
                {gestiones.map((g) => (
                  <li key={g.id} className="relative">
                    <span className="absolute -left-[18px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background" />
                    <div className="text-[11px] font-semibold">
                      {g.via ?? "Sistema"} {g.resultado && `· ${g.resultado}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{g.texto}</div>
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                      {g.autorNombre} · {formatDateTime(g.creadoEn)}
                    </div>
                  </li>
                ))}
                {!gestiones.length && <li className="text-xs text-muted-foreground">Sin gestiones registradas todavía.</li>}
              </ul>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-1.5 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-right">{v}</span>
    </div>
  );
}
