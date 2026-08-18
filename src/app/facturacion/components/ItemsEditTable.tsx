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

interface ItemWithKey {
  item: InvoiceItem;
  key: string;
}

export function ItemsEditTable({ items, onChange }: ItemsEditTableProps) {
  const updateItem = (index: number, field: keyof InvoiceItem, value: string) => {
    const next = items.map((item, currentIndex) =>
      currentIndex === index
        ? {
            ...item,
            [field]:
              field === "description"
                ? value
                : field === "quantity" || field === "unitPrice"
                  ? Number(value) || 0
                  : value,
          }
        : item,
    );

    onChange(next);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;

    onChange(items.filter((_, currentIndex) => currentIndex !== index));
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

  const itemsWithKeys: ItemWithKey[] = items.map((item, index) => ({
    item,
    key: `${item.internalCode}-${item.description}-${item.quantity}-${item.unitPrice}-${index}`,
  }));

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
            {itemsWithKeys.map(({ item, key }, index) => (
              <TableRow key={key}>
                <TableCell>
                  <Input
                    value={item.description}
                    onChange={(event) =>
                      updateItem(index, "description", event.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </TableCell>

                <TableCell>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(event) =>
                      updateItem(index, "unitPrice", event.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </TableCell>

                <TableCell className="text-right text-xs font-medium">
                  S/ {(item.quantity * item.unitPrice).toFixed(2)}
                </TableCell>

                <TableCell>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-500 hover:text-red-600"
                    title="Quitar ítem"
                    aria-label={`Quitar ${item.description}`}
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
        <Plus className="h-3.5 w-3.5" />
        Agregar ítem
      </button>
    </div>
  );
}