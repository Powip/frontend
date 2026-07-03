"use client";

import { useState } from "react";
import { Copy, Check, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubEstadoCc } from "@/interfaces/IOrder";
import { toast } from "sonner";

interface Props {
  subEstadoCc: SubEstadoCc;
  clienteName: string;
  orderNumber: string;
}

function buildScript(
  subEstadoCc: SubEstadoCc,
  nombre: string,
  orderNumber: string,
): string | null {
  const n = nombre.split(" ")[0]; // solo el primer nombre
  switch (subEstadoCc) {
    case "por_confirmar":
      return `Hola ${n}, le llamo de parte de nuestra empresa para confirmar su pedido N° ${orderNumber}. ¿Confirma que desea recibirlo? Necesito verificar su DNI y dirección de entrega.`;
    case "contactado":
      return `Hola ${n}, continuamos gestionando su pedido N° ${orderNumber}. ¿Tiene alguna consulta sobre los productos o la entrega?`;
    case "no_contesta":
      return `Hola ${n}, le volvemos a llamar por su pedido N° ${orderNumber}. Por favor contáctenos al número de WhatsApp para coordinar la entrega.`;
    case "reprogramado":
      return `Hola ${n}, le llamamos para confirmar la nueva fecha de entrega de su pedido N° ${orderNumber}. ¿Sigue disponible para recibirlo?`;
    case "entrega_lima":
      return `Hola ${n}, le llamamos para coordinar la entrega en Lima de su pedido N° ${orderNumber}. ¿Cuál es el horario más cómodo para usted?`;
    case "carrito_sin_contactar":
      return `Hola ${n}, notamos que mostró interés en nuestros productos pero no completó su compra. ¿Podemos ayudarle? Tenemos disponibilidad para finalizar su pedido hoy.`;
    case "carrito_contactado":
      return `Hola ${n}, le volvemos a contactar por los productos que seleccionó. ¿Pudo revisar la información que le enviamos? Estamos aquí para resolver cualquier duda.`;
    default:
      return null;
  }
}

export function CcScriptPanel({ subEstadoCc, clienteName, orderNumber }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const script = buildScript(subEstadoCc, clienteName, orderNumber);
  if (!script) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.success("Script copiado al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el script");
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium bg-muted/40 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          Script sugerido
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">{script}</p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs w-full"
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 mr-1 text-green-600" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 mr-1" />
                Copiar al portapapeles
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
