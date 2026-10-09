import { Store } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

interface WhatsAppStoresPendingListProps {
  stores: { id: string; name: string }[];
}

export function WhatsAppStoresPendingList({ stores }: WhatsAppStoresPendingListProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 md:p-6">
        <div>
          <h3 className="font-semibold">Tiendas de tu empresa</h3>
          <p className="text-sm text-muted-foreground">
            Cada tienda podrá enviar avisos desde su propio número. El estado de cada número se
            mostrará cuando la integración esté disponible.
          </p>
        </div>
        {stores.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tu empresa todavía no tiene tiendas.{" "}
            <Link href="/configuracion/tiendas" className="font-medium text-primary underline">
              Crear una tienda
            </Link>
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label="Tiendas de tu empresa">
            {stores.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-medium">{store.name}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300">
                  Estado de WhatsApp pendiente de integración
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
