import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Cuenta «Solo CRM»: no hay casilla, todas las ventas son del chat. */
  solo: boolean;
  total: number | null;
}

export default function ChatSalesNote({ checked, onCheckedChange, solo, total }: Props) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Las ventas cerradas en Ventas por chat entran aquí con su canal y su vendedora. Los leads de Atención
        aparecen cuando se confirma la compra.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {!solo && (
          <label className="flex cursor-pointer items-center gap-2 py-1 text-sm">
            <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
            Solo ventas por chat
          </label>
        )}
        <span data-testid="ventas-count" className="text-sm text-muted-foreground">
          {total === null ? "—" : `${total} ${total === 1 ? "venta" : "ventas"}`}
        </span>
      </div>
    </div>
  );
}
