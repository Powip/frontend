"use client";

import { toast } from "sonner";
import { MessageCircle, Video } from "lucide-react";
import { useLeadsList } from "@/hooks/superadmin/useAdquisicion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyBlock, TableSkeleton } from "@/components/superadmin/shared";
import { Inbox } from "lucide-react";

export function BandejaAbordarAhora({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const { data, isLoading } = useLeadsList({ estado: "nuevo", pageSize: 8 });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Bandeja &quot;abordar ahora&quot;</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={2} cols={3} />}
        {!isLoading && !data.length && <EmptyBlock icon={Inbox} title="Todo abordado" description="No hay leads nuevos sin contactar." />}
        {!isLoading && !!data.length && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-l-[3px] border-l-primary bg-card p-3.5 shadow-sm">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-xs font-bold">{lead.negocio || lead.nombre}</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    Nuevo
                  </span>
                </div>
                <div className="mb-2.5 text-[11px] text-muted-foreground">
                  {lead.canalAdquisicion} · {lead.whatsapp}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="flex-1 h-7 bg-[#25D366] text-white hover:bg-[#1fb959] text-[11px] gap-1"
                    onClick={() => window.open(`https://wa.me/${lead.whatsapp.replace(/\D/g, "")}`, "_blank")}
                  >
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-[11px] gap-1"
                    onClick={() => {
                      onOpenLead(lead.id);
                      toast.info("Agenda la demo desde la ficha del lead.");
                    }}
                  >
                    <Video className="h-3 w-3" />
                    Demo
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
