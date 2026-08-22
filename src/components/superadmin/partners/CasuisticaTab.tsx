import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Ban, CalendarClock, Copy, Layers, ShieldOff } from "lucide-react";
import { SectionHeader } from "@/components/superadmin/shared";

const CASOS = [
  {
    icon: CalendarClock,
    titulo: "Paga el 1er mes",
    texto:
      "La comisión del 1er mes se calcula sobre el precio neto en cuanto el referido queda \"activo\" (primer cobro exitoso). Se liquida en el ciclo mensual siguiente, sujeta a retención del 8%.",
  },
  {
    icon: Ban,
    titulo: "Cancelación dentro de la ventana",
    texto:
      "Si el referido cancela dentro de la ventana de atribución (60 días) y el toggle de Clawback está activo, la comisión ya pagada se reversa como comisión tipo \"reverso\" y se descuenta del bruto en la siguiente liquidación del partner.",
  },
  {
    icon: Copy,
    titulo: "Referido duplicado",
    texto:
      "Un negocio ya registrado (por email o WhatsApp) no genera una segunda comisión aunque llegue por el link de otro partner. Se marca como duplicado y queda vinculado al primer partner que lo trajo.",
  },
  {
    icon: Layers,
    titulo: "Upgrade de plan",
    texto:
      "Si el referido sube de plan, la comisión recurrente se recalcula sobre el nuevo precio de lista desde el ciclo siguiente al cambio — no se retroactiva ni genera un nuevo 1er mes.",
  },
  {
    icon: AlertCircle,
    titulo: "Bajo el umbral mínimo",
    texto:
      "Si el monto de una comisión individual no alcanza el umbral mínimo (S/50), se acumula al siguiente ciclo en vez de liquidarse sola, para evitar transferencias de montos muy pequeños.",
  },
  {
    icon: ShieldOff,
    titulo: "Auto-referido",
    texto:
      "Con Anti-fraude activo, un partner no puede referirse a sí mismo ni a una empresa donde figure como usuario/administrador. El sistema bloquea el alta y no genera comisión.",
  },
];

export function CasuisticaTab() {
  return (
    <div>
      <SectionHeader title="Casuística del programa" sub="Reglas de negocio que rigen cómo se generan, pagan y reversan las comisiones" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CASOS.map((caso) => (
          <Card key={caso.titulo}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <caso.icon className="h-4 w-4 text-primary shrink-0" />
                {caso.titulo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">{caso.texto}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
