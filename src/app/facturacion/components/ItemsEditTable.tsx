import { Plus, Trash2 } from "lucide-react";
import { TAX_TYPES, UNIT_CODES } from "@/api/sunat/types/sunat-document.types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CreateManualInvoiceInput } from "@/schemas/sunat/create-manual-invoice.schema";

type InvoiceItem = CreateManualInvoiceInput["items"][number];

interface ItemsEditTableProps {
  items: InvoiceItem[];
  onChange: (items: InvoiceItem[]) => void;
}

export function ItemsEditTable({ items, onChange }: ItemsEditTableProps) {
  const updateItem = (i: number, field: keyof InvoiceItem, value: string) => {
    const next = items.map((it, idx) =>
      idx === i
        ? {
            ...it,
            [field]:
              field === "description"
                ? value
                : field === "quantity" || field === "unitPrice"
                  ? Number(value) || 0
                  : value,
          }
        : it,
    );

    onChange(next);
  };

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, idx) => idx !== i));
  };

  const addItem = () => {
    onChange([
      ...items,
      {
        internalCode: "PROD001",
        description: "Nuevo ítem",
        quantity: 1,
        unitPrice: 0,
        unitCode: UNIT_CODES.UNIT,
        taxType: TAX_TYPES.GRAVADO,
      },
    ]);
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead className="w-20">Cant.</TableHead>
              <TableHead className="w-28">P. Unit.</TableHead>
              <TableHead className="w-24 text-right">Importe</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input
                    value={it.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(i, "quantity", e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell className="text-right text-xs font-medium">
                  S/ {(it.quantity * it.unitPrice).toFixed(2)}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-red-500 hover:text-red-600"
                    title="Quitar ítem"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <Plus className="h-3.5 w-3.5" /> Agregar ítem
      </button>
    </div>
  );
}
