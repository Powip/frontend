import { DoubleTick } from "@/components/whatsapp/MessageStatusTicks";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WhatsAppGlyph } from "@/components/whatsapp/ui/WhatsAppGlyph";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  { key: "read", caption: "Leído", tick: "text-wa-tick-read", failed: false },
  { key: "delivered", caption: "Entregado", tick: "text-wa-tick", failed: false },
  { key: "failed", caption: "No enviado", tick: "", failed: true },
];

export function HistoryListPreview() {
  return (
    <WaCard aria-labelledby="history-list-preview-title">
      <WaCardHeader
        level={3}
        titleId="history-list-preview-title"
        title="Así se ve en las listas de pedidos"
        description="El botón de WhatsApp de cada pedido en Ventas, Operaciones y Gestión CC muestra el último aviso cuando POWIP lo informa. Sin dato, el botón se ve como hoy."
      />
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {EXAMPLES.map((example) => (
          <li key={example.key} className="flex items-center gap-[18px] text-[13px]">
            <span
              aria-hidden="true"
              className={cn(
                "relative grid size-[38px] shrink-0 place-items-center rounded-[10px] text-white",
                example.failed ? "bg-wa-red" : "bg-wa-whatsapp",
              )}
            >
              <WhatsAppGlyph />
              {!example.failed && (
                <span className="absolute -right-1.5 -bottom-1.5 flex rounded-full border border-wa-border bg-wa-surface px-1 py-px">
                  <DoubleTick className={cn("h-2.5 w-3.5", example.tick)} />
                </span>
              )}
            </span>
            <span className={cn(example.failed && "text-wa-red")}>{example.caption}</span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3.5 text-xs text-wa-muted">
        Ejemplo ilustrativo: no muestra pedidos ni fechas reales.
      </p>
    </WaCard>
  );
}
