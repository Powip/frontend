import { ArrowRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function WhatsAppNotificationsSection() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-green-600" aria-hidden="true" />
        <div>
          <h3 className="font-bold">Notificaciones automáticas por WhatsApp</h3>
          <p className="text-sm text-muted-foreground">
            Los avisos por WhatsApp se configuran en un solo lugar: Configuración › WhatsApp.
          </p>
        </div>
      </div>
      <Button asChild variant="outline" className="shrink-0">
        <Link href="/configuracion/whatsapp?tab=programacion">
          Ir a WhatsApp
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
